# Resovo（流光） — 数据库操作规范

> status: active
> owner: @engineering
> scope: database schema and query rules
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 适用范围：`src/api/db/` 所有数据库相关文件
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
// src/api/db/queries/videos.ts

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
-- src/api/db/migrations/003_add_directors.sql
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
