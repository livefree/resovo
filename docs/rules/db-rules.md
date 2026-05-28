# Resovo（流光） — 数据库操作规范

> status: active
> owner: @engineering
> scope: database schema and query rules
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 适用范围：`apps/api/src/db/` 所有数据库相关文件
> AI 在编写数据库相关代码前必须读取本文件

---

## 核心原则

- **所有 SQL 在 `db/queries/` 目录集中管理**，Service 层不直接拼 SQL
- **参数化查询，禁止字符串拼接**（防 SQL 注入）
- **schema 变更必须通过迁移文件**，不得手动执行 ALTER TABLE
- **写操作必须有事务**，多步操作保证原子性

---

## 查询函数规范

```typescript
// apps/api/src/db/queries/videos.ts

// ✅ 正确：参数化查询，明确返回类型
export async function findVideoByShortId(
  db: Pool,
  shortId: string
): Promise<Video | null> {
  const result = await db.query<Video>(
    `SELECT * FROM videos WHERE short_id = $1 AND deleted_at IS NULL`,
    [shortId]
  )
  return result.rows[0] ?? null
}

// ✅ 正确：列表查询含分页
export async function listVideos(
  db: Pool,
  filters: VideoFilters,
  page: number,
  limit: number
): Promise<{ rows: Video[], total: number }> {
  const offset = (page - 1) * limit
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.type) {
    conditions.push(`type = $${idx++}`)
    params.push(filters.type)
  }
  // ... 其他 filter

  const where = conditions.join(' AND ')
  const [rows, countResult] = await Promise.all([
    db.query<Video>(`SELECT * FROM videos WHERE ${where} LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]),
    db.query<{count: string}>(`SELECT COUNT(*) FROM videos WHERE ${where}`, params)
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0].count)
  }
}

// ❌ 错误：直接在 Service 里写 SQL
class VideoService {
  async getVideo(id: string) {
    return this.db.query(`SELECT * FROM videos WHERE id = '${id}'`)  // ❌ SQL 注入风险
  }
}
```

---

## 事务规范

```typescript
// ✅ 正确：多步写操作使用事务
export async function createListWithFirstItem(
  db: Pool,
  listData: CreateListInput,
  firstVideoId: string
): Promise<List> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const list = await client.query<List>(
      `INSERT INTO lists (id, short_id, owner_id, type, title, visibility)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [uuid(), nanoid(8), listData.ownerId, listData.type, listData.title, listData.visibility]
    )

    await client.query(
      `INSERT INTO list_items (id, list_id, video_id, position)
       VALUES ($1, $2, $3, 0)`,
      [uuid(), list.rows[0].id, firstVideoId]
    )

    await client.query('COMMIT')
    return list.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

---

## 迁移文件规范

```sql
-- apps/api/src/db/migrations/003_add_directors.sql
-- 描述：为 videos 表添加 director/cast/writers 字段
-- 日期：2025-03
-- 幂等：是（使用 IF NOT EXISTS）

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS director TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cast     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS writers  TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_videos_director ON videos USING gin(director);
CREATE INDEX IF NOT EXISTS idx_videos_cast     ON videos USING gin(cast);
CREATE INDEX IF NOT EXISTS idx_videos_writers  ON videos USING gin(writers);
```

迁移文件命名：`{序号}_{描述}.sql`，序号三位数字，单调递增。

---

## 索引使用规范

```typescript
// 以下查询必须使用索引，避免全表扫描：

// ✅ short_id 查询（有唯一索引）
WHERE short_id = $1

// ✅ 播放源查询（有复合索引）
WHERE video_id = $1 AND episode_number = $2

// ✅ 弹幕时间轴查询（有复合索引）
WHERE video_id = $1 AND episode_number = $2
ORDER BY time_seconds ASC

// ✅ 用户历史记录（有索引）
WHERE user_id = $1 ORDER BY watched_at DESC

// ⚠️ 以下查询性能风险，需要 EXPLAIN ANALYZE 确认：
// - 多个 OR 条件
// - LIKE '%keyword%'（前缀通配符）
// - 对未加索引字段的排序
```

---

## 索引设计 4 步核验（CHG-368-B-A1-FIX 系列 1-5 沉淀 / 2026-05-28）

> **背景**：CHG-368-B-A1-FIX-{1..5} 在 2026-05-28 当日由 Codex stop-time review 连续 5 次抓出 `idx_source_line_aliases_codename_active` / `idx_source_line_aliases_retired_at` 两个部分索引的虚假用途声明（changelog 行 10359-10510）。元根因：把索引用途描述视为"看起来匹配就能用"的直觉判断，而非"严格核对索引键、部分索引 WHERE 子句、查询 driving 谓词三者匹配性"的形式化推理。本节是这 5 次修订沉淀的**强制规范**——适用于 migration 注释 / `docs/architecture.md` 索引说明 / ADR §SQL 草案 / `db/queries/*` 函数 JSDoc 全部 4 类索引文档载体。

### 4 步核验流程（设计 + 文档化任一索引时必走）

设计或文档化任一索引时，按以下 4 步**逐步形式化书写**，禁止跳步：

1. **索引键**：明示**完整列名**（多列索引不省略 / 表达式索引不简化 / 部分索引 ON 子句完整列出）
   - 反例：`codename 索引`、`active codename` → ❌ 隐藏列序与表达式
   - 正例：`idx_source_line_aliases_codename_active ON (codename) WHERE codename IS NOT NULL AND retired_at IS NULL` → ✅

2. **部分索引 WHERE 子句覆盖哪些行**：完整列出 + **显式记反向条件 invariant**（对 partial index 必做 / 全表索引可省）
   - 反例：`部分索引覆盖 codename 列` → ❌ 未说覆盖"哪些行"
   - 正例：`WHERE retired_at IS NULL` 覆盖"在役行" → 反向 invariant：**不能服务 `WHERE retired_at IS NOT NULL` 查询（方向相反 PG 规划器拒走）** → ✅

3. **候选查询的 driving 谓词**：列出该索引**可能被消费**的所有 SQL 模板 driving 列（与步 1 索引键比对）
   - driving 列 = 实际 `WHERE col = $1` / `JOIN ON col = ...` / `ORDER BY col` 等触发索引扫描的列
   - 反例：`服务 listSources JOIN` → ❌ 未说 JOIN driving 列是什么
   - 正例：`listSources JOIN driving 列 = (source_site_key, source_name) 复合 PK 匹配` → ✅

4. **匹配判定**：索引键 vs driving 列**逐列比对** + 部分索引 WHERE 子句**不与查询谓词方向相反** → 才能列入"候选路径"；任一不符 → **明示"不适用"+ 原因**
   - 反例：`idx_codename_active(codename)` 部分索引 `WHERE retired_at IS NULL` → 列入 listSources JOIN 候选 → ❌ JOIN driving 是 (site_key, name) PK，索引键 codename 不匹配 → 应列"不适用：JOIN driving 列错配"
   - 正例：cooling lookup `WHERE codename = $1 AND retired_at IS NOT NULL` vs `idx_codename_active WHERE retired_at IS NULL` → 部分索引 WHERE 方向相反 → 列"不适用：部分索引方向反"

### 双 invariant（FIX-2 / FIX-4 / FIX-5 反例反复抓出）

设计索引时必须显式核对以下 2 项 invariant，**违反必明示"不适用"+ 原因**：

#### I1 — 部分索引方向 invariant

部分索引的 `WHERE col_a IS NOT NULL` 子句**不能服务** `WHERE col_a IS NULL` 查询（PG 规划器对方向相反的 IS 谓词不消费该部分索引）。

| 部分索引 WHERE | 可服务查询 | 不可服务查询 |
|---|---|---|
| `WHERE deleted_at IS NULL` | `WHERE deleted_at IS NULL` | `WHERE deleted_at IS NOT NULL` |
| `WHERE retired_at IS NOT NULL` | `WHERE retired_at IS NOT NULL` | `WHERE retired_at IS NULL` |
| `WHERE status = 'active'` | `WHERE status = 'active'` | `WHERE status = 'inactive'` / `WHERE status IN ('inactive', 'pending')` |

5 FIX 反例（CHG-368-B-A1-FIX-2）：`idx_source_line_aliases_retired_at WHERE retired_at IS NOT NULL` 被声明"加速 listSources `WHERE retired_at IS NULL`"——方向相反，部分索引零加速。修订：列入"不适用：部分索引 WHERE 与查询谓词方向相反"。

#### I2 — 驱动列 vs 索引列匹配性 invariant

索引键的**首列**（多列索引）或唯一列必须**等于**或**包含**查询的 driving 列；JOIN 索引覆盖判定时 driving 列以 JOIN ON 子句为准（非 SELECT / 非 WHERE 过滤列）。

| 索引键 | JOIN ON | 是否可消费 |
|---|---|---|
| `(site_key, source_name)` | `ON a.site_key = b.site_key AND a.source_name = b.source_name` | ✅ 复合 PK 完整匹配 |
| `(codename)` | `ON a.site_key = b.site_key AND a.source_name = b.source_name` | ❌ driving 列 (site_key, source_name) 与索引键 codename 错配 |
| `(video_id, episode_number)` | `ON a.video_id = b.video_id` + `WHERE episode_number = $1` | ✅ 首列匹配，第二列由 WHERE 提供 |

5 FIX 反例（CHG-368-B-A1-FIX-5）：`idx_codename_active(codename)` 部分索引被声明"listSources JOIN 主路径候选"——但实测 `apps/api/src/db/queries/sources-matrix.ts:300-301 / 462-465` 显示 listSources JOIN 按 `(source_site_key, source_name)` 复合 PK 匹配，driving 列与索引键 codename 完全错配。修订：列入"不适用：JOIN driving 列与索引键错配（site_key, source_name PK ≠ codename）"。

### 四级范式（索引设计文档结构 / 强制 4 段）

任一索引在 migration 注释 / architecture.md / ADR §SQL 草案 / queries JSDoc 4 类载体中，必须按**四级结构**书写（缺一段 = 文档不完整）：

```
1. 索引覆盖（物理事实）
   - 索引键: <完整列名 / 表达式>
   - 部分索引 WHERE: <子句完整 / 或"无">
   - 索引类型: btree / gin / gist / brin / hash
   - 创建语句: <CREATE INDEX 完整 SQL>

2. 候选查询模式（可能消费的 SQL 模板列表）
   - <query function 名> @ <文件:行>: <driving 谓词或 JOIN ON 子句>
   - <query function 名> @ <文件:行>: <driving 谓词或 JOIN ON 子句>
   ...

3. 不适用排除（同模式下哪些查询模式被排除 + 反例引用）
   - <query function 名>: 不适用原因 — <I1 方向相反 / I2 driving 列错配 / 其他>
   - <query function 名>: 不适用原因 — <...>

4. 实测验证（EXPLAIN ANALYZE 留位 / 不假设规划器一定走）
   - 实测命令: EXPLAIN ANALYZE SELECT ... FROM <table> WHERE ...;
   - 实测结果: <Index Scan using idx_xxx / Bitmap Index Scan / Seq Scan 等>
   - 验证时间: <YYYY-MM-DD>
   - 留位标记: TODO 实测（生产数据填充后） — 允许标记，但不得省略本段
```

5 FIX 反例（CHG-368-B-A1-FIX 系列）：5 次修订前 architecture.md / ADR-164 仅写"该索引加速 listSources JOIN"——一句话绑定式声明，缺第 2-4 段全部，是连续犯错的载体。

### 索引设计文档书写禁令

以下文档形式**严禁出现**于 migration 注释 / architecture.md / ADR / queries JSDoc：

| 禁令 | 反例 | 修订 |
|---|---|---|
| **绑定式声明**：把索引用途绑定到具体 Service 方法名 + 假设规划器一定走该索引 | `加速 listSources JOIN 主路径` / `服务 isCodenameInCooling 查询` | 改写为"候选路径"+"driving 列"两段（按四级范式第 2-3 段） |
| **方向遗漏**：部分索引声明只写"覆盖列"不写"WHERE 子句方向" | `部分索引覆盖 codename 列` | 完整写 `WHERE codename IS NOT NULL AND retired_at IS NULL` + I1 反向 invariant |
| **driving 列遗漏**：JOIN 索引声明不写 JOIN ON 子句 driving 列 | `服务 sources JOIN matrix` | 写 `JOIN ON (site_key, source_name) 复合 PK 匹配` 完整子句 |
| **实测假设**：未写 EXPLAIN ANALYZE 直接声明"规划器走该索引" | `规划器优先选择 idx_xxx` | 改为"候选路径（实测待补）"+ 留位标记 |

### 与既有"索引使用规范"段的关系

既有"索引使用规范"段（本文件上方）是**查询侧**指南——告诉 query 函数作者"写查询时哪些场景必须命中索引"。本"索引设计 4 步核验"章节是**设计侧**规范——告诉 schema/migration/ADR 作者"设计索引 + 文档化索引用途时如何避免虚假声明"。两段互补，不重叠。

### Checklist（设计或评审任一索引时勾选）

- [ ] 步 1：索引键完整列名 + 列序 + 部分索引 WHERE 子句完整列出
- [ ] 步 2：部分索引（若有）WHERE 子句 + I1 反向 invariant 显式声明
- [ ] 步 3：候选查询 driving 谓词列出 + 与索引键逐列比对
- [ ] 步 4：匹配判定 + 不适用排除（I1 / I2）明示 + 反例引用
- [ ] 四级范式 4 段齐全（覆盖 / 候选 / 不适用 / 实测留位）
- [ ] 无"绑定式声明" / "方向遗漏" / "driving 列遗漏" / "实测假设" 4 类禁令

---

## 软删除规范

```typescript
// videos、users 等核心表使用软删除
// deleted_at 字段，NULL 表示未删除

// ✅ 所有查询默认过滤软删除
WHERE deleted_at IS NULL

// ✅ 删除操作设置时间戳
UPDATE videos SET deleted_at = NOW() WHERE id = $1

// ❌ 不直接 DELETE 核心表数据
DELETE FROM videos WHERE id = $1  // ❌
```

---

## 冗余计数器维护

```typescript
// lists 表的 item_count、like_count 是冗余字段
// 增删操作时必须同步更新，使用事务保证一致性

// 添加视频到列表时
await client.query(
  `UPDATE lists SET item_count = item_count + 1, updated_at = NOW()
   WHERE id = $1`,
  [listId]
)

// 移除视频时
await client.query(
  `UPDATE lists SET item_count = GREATEST(item_count - 1, 0), updated_at = NOW()
   WHERE id = $1`,
  [listId]
)
```
