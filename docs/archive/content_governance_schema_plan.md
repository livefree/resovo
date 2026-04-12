# Resovo（流光）— 内容治理层 Schema 设计方案

> status: archived
> owner: @engineering
> scope: content governance schema evolution reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 对应决策：ADR-016（S/E 统一模型）、ADR-017（类型系统扩展）、ADR-018（治理层字段）、ADR-019（Ingest Policy）
> 任务入口：SEQ-20260322-11（CHG-170/171/172）、SEQ-20260322-12（CHG-173/174）
> 本文档描述 schema 演化目标、字段设计、迁移策略与执行边界。

---

## 一、问题背景

### 1.1 当前 videos 表的结构限制

```sql
type          TEXT CHECK (type IN ('movie','series','anime','variety'))  -- 仅4种，不够用
episode_count INT DEFAULT 1                                               -- 只存总集数，无 season 概念
is_published  BOOLEAN DEFAULT false                                       -- 二值状态，无审核流
-- 无任何内容风险字段
-- 无原始类型来源字段
-- 无内容格式/集数模式判定字段
```

### 1.2 三层演化目标

| 层 | 解决的问题 | 涉及迁移 |
|----|-----------|---------|
| **类型判定分离** | 爬虫原始数据质量不影响平台规范分类；支持 12 种内容类型 | Migration 013/015 |
| **S/E 统一坐标系** | 电影与分集用同一模型表达，消除 NULL 歧义 | Migration 014 |
| **内容治理独立建模** | 审核流程、可见性控制、发布策略独立于 is_published 布尔值 | Migration 016/018 |

---

## 二、类型系统设计（ADR-017）

### 2.1 类型扩展：4种 → 12种

```sql
-- Migration 013
ALTER TABLE videos DROP CONSTRAINT videos_type_check;
ALTER TABLE videos ADD CONSTRAINT videos_type_check
  CHECK (type IN (
    'movie',        -- 电影
    'drama',        -- 电视剧集
    'anime',        -- 动漫
    'variety',      -- 综艺
    'short_drama',  -- 短剧
    'sports',       -- 体育
    'music',        -- 音乐
    'documentary',  -- 纪录片
    'game_show',    -- 游戏
    'news',         -- 新闻
    'children',     -- 少儿
    'other'         -- 其他
  ));
```

**现有数据兼容性**：原有 `series` 类型需迁移为 `drama`（Migration 013 数据迁移包含此映射）。

### 2.2 新增类型判定字段

```sql
-- Migration 013（同一 migration 内完成）
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS source_content_type TEXT,         -- 爬虫原样写入的源站类型字符串
  ADD COLUMN IF NOT EXISTS normalized_type TEXT,             -- 平台规范化分类（可比 type 更细粒度）
  ADD COLUMN IF NOT EXISTS content_format TEXT
    CHECK (content_format IN ('movie','episodic','collection','clip')),
  ADD COLUMN IF NOT EXISTS episode_pattern TEXT
    CHECK (episode_pattern IN ('single','multi','ongoing','unknown'));
```

### 2.3 三个类型字段的语义分工

| 字段 | 写入者 | 用途 | 示例值 |
|------|-------|------|--------|
| `type` | 爬虫映射表 | 前台导航路由（`/movie/`、`/anime/` 等），用户可见主分类 | `movie` |
| `source_content_type` | 爬虫原样写入 | 溯源、重分类参考 | `"连续剧"` / `"综艺节目"` |
| `normalized_type` | 爬虫映射表 | 搜索聚合、推荐系统、后台分析 | `action_movie` / `idol_variety` |

### 2.4 爬虫映射规则

```
源站原始类型 → type（前台） / normalized_type（内部）

"电影"/"movie"/"Movie"  → movie / movie
"电视剧"/"连续剧"/"剧集" → drama / drama
"动漫"/"动画"/"anime"   → anime / anime
"综艺"/"综艺节目"       → variety / variety
"短剧"/"微剧"           → short_drama / short_drama
"体育"/"sports"         → sports / sports
"音乐"/"MV"             → music / music
"纪录片"/"documentary"  → documentary / documentary
（未匹配）               → other / other（source_content_type 保留原始值）
```

映射表写在 `CrawlerService.ts` 中，数据层不做枚举扩散。

### 2.5 content_format 与 episode_pattern 自动推断

```
episode_count = 1                          → content_format='movie',   episode_pattern='single'
episode_count > 1 AND status='completed'   → content_format='episodic', episode_pattern='multi'
episode_count > 0 AND status='ongoing'     → content_format='episodic', episode_pattern='ongoing'
不能确定                                   → content_format='episodic', episode_pattern='unknown'
```

---

## 三、Season/Episode 统一模型（ADR-016）

### 3.1 设计原则

所有视频资源统一到 `(season_number, episode_number)` 坐标系：
- 单集电影 = S1E1
- 剧集第3集 = S1E3
- 第二季第1集 = S2E1
- 没有分集的资源不再使用 NULL，一律为 (1, 1)

### 3.2 Migration 014 变更

```sql
-- video_sources
ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS season_number INT NOT NULL DEFAULT 1;

-- 将现有 episode_number NULL 填为 1
UPDATE video_sources SET episode_number = 1 WHERE episode_number IS NULL;
ALTER TABLE video_sources
  ALTER COLUMN episode_number SET NOT NULL,
  ALTER COLUMN episode_number SET DEFAULT 1;

-- watch_history
ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS season_number INT NOT NULL DEFAULT 1;

UPDATE watch_history SET episode_number = 1 WHERE episode_number IS NULL;
ALTER TABLE watch_history
  ALTER COLUMN episode_number SET NOT NULL,
  ALTER COLUMN episode_number SET DEFAULT 1;
```

### 3.3 代码影响

Migration 014 执行后，以下代码必须同步更新：

| 位置 | 修改内容 |
|------|---------|
| `src/api/db/queries/videoSources.ts` | 所有 `episode_number IS NULL` 判断改为 `season_number = 1 AND episode_number = 1` |
| `src/api/db/queries/watchHistory.ts` | 同上 |
| `src/api/services/CrawlerService.ts` | 爬虫写入时显式写 `season_number = 1, episode_number = 1`（电影/单集） |
| `src/components/player/*` | episode selector 逻辑以 (season, episode) 为主键 |
| `src/api/routes/users.ts` | 续播进度读写加入 `season_number` 参数 |

### 3.4 videos.episode_count 保留

`episode_count` 字段语义变更为"总集数"，movie 的值为 1。该字段保留用于快速判断内容规模（避免 COUNT(*)），不影响播放逻辑。

---

## 四、内容治理层字段（ADR-018）

### 4.1 审核状态机

```
             爬虫写入
                │
         ┌──────┴──────┐
   auto_publish=true    auto_publish=false
         │                     │
   visibility='public'   visibility='internal'
   review='approved'     review='pending_review'
                               │
                    moderator/admin 审核
                    ┌──────────┴──────────┐
              通过                     拒绝/封锁
    visibility='public'        visibility='hidden'/'blocked'
    review='approved'          review='rejected'/'blocked'
```

### 4.2 Migration 016 字段定义

```sql
ALTER TABLE videos
  -- 审核状态
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review','approved','rejected','blocked')),

  -- 可见性（替代 is_published 的主字段）
  ADD COLUMN IF NOT EXISTS visibility_status TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility_status IN ('public','hidden','internal','blocked')),

  -- 审核元数据
  ADD COLUMN IF NOT EXISTS review_reason   TEXT,
  ADD COLUMN IF NOT EXISTS review_source   TEXT CHECK (review_source IN ('system','ai','manual')),
  ADD COLUMN IF NOT EXISTS reviewed_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,

  -- 分类辅助
  ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN NOT NULL DEFAULT false;
```

**数据迁移（同一事务内）：**
```sql
-- 已发布内容 → 公开可见 + 已审核通过
UPDATE videos
SET visibility_status = 'public', review_status = 'approved'
WHERE is_published = true;

-- 未发布内容 → 内部可见 + 待审核
UPDATE videos
SET visibility_status = 'internal', review_status = 'pending_review'
WHERE is_published = false;
```

### 4.3 is_published 迁移策略（方案 B）

**保留字段，服务层同步，逐步迁移旧代码**：

```typescript
// VideoService / CrawlerService 写入路径
// 新代码写 visibility_status，同步写 is_published
async function publishVideo(id: string) {
  await db.query(`
    UPDATE videos
    SET visibility_status = 'public',
        review_status = 'approved',
        is_published = true          -- 同步写，保持旧代码可用
    WHERE id = $1
  `, [id]);
}
```

**前台查询切换（Migration 016 后全量替换）：**
```sql
-- 旧（弃用）
WHERE is_published = true

-- 新（统一使用）
WHERE visibility_status = 'public'
```

**时间线：**
1. Migration 016 执行时：数据迁移，`is_published` 与 `visibility_status` 保持一致
2. CHG-173 完成时：所有 `WHERE is_published` 查询改为 `WHERE visibility_status`
3. 所有新代码禁止写 `is_published`，只写 `visibility_status`
4. `is_published` 字段在代码注释中标注 `@deprecated`，等前台 MVP 稳定后评估物理删除

### 4.4 内容风险标志（Migration 016-ext，P2 延后）

以下字段暂不在 SEQ-20260322-12 范围内，等前台 MVP 稳定后在独立序列中实现：

```sql
-- 延后实现
is_adult              BOOLEAN NOT NULL DEFAULT false
is_suspected_adult    BOOLEAN NOT NULL DEFAULT false
is_sensitive          BOOLEAN NOT NULL DEFAULT false
is_violence           BOOLEAN NOT NULL DEFAULT false
is_gore               BOOLEAN NOT NULL DEFAULT false
is_gambling           BOOLEAN NOT NULL DEFAULT false
is_illegal_source     BOOLEAN NOT NULL DEFAULT false
is_low_quality_meta   BOOLEAN NOT NULL DEFAULT false
is_spam               BOOLEAN NOT NULL DEFAULT false
```

---

## 五、Ingest Policy 设计（ADR-019）

### 5.1 站点级策略（Migration 018-partial）

```sql
ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS ingest_policy JSONB NOT NULL DEFAULT '{
    "allow_auto_publish": false,
    "allow_search_index": true,
    "allow_recommendation": true,
    "allow_public_detail": true,
    "allow_playback": true,
    "require_review_before_publish": true
  }';
```

### 5.2 策略字段语义

| 字段 | 含义 | 默认值 | 影响位置 |
|------|------|--------|---------|
| `allow_auto_publish` | 采集后直接设为 `visibility='public'`，跳过审核 | `false` | `CrawlerService` 写入逻辑 |
| `allow_search_index` | 是否进入 ES 索引 | `true` | ES 同步 worker |
| `allow_recommendation` | 是否出现在推荐位 | `true` | 推荐 API 过滤 |
| `allow_public_detail` | 是否允许访问详情页 | `true` | 详情页鉴权 |
| `allow_playback` | 是否允许播放 | `true` | 播放源 API 鉴权 |
| `require_review_before_publish` | 是否要求人工审核后才能上架 | `true` | Moderator 工作流 |

### 5.3 爬虫写入逻辑（CrawlerService）

```typescript
// 伪代码
const policy = site.ingest_policy;
const initialVisibility = policy.allow_auto_publish ? 'public' : 'internal';
const initialReviewStatus = policy.allow_auto_publish ? 'approved' : 'pending_review';

// 写入 videos 时
await db.query(`
  INSERT INTO videos (..., visibility_status, review_status, is_published)
  VALUES (..., $1, $2, $3)
`, [initialVisibility, initialReviewStatus, policy.allow_auto_publish]);
```

**兜底优先级**（低到高）：
1. 全局 `AUTO_PUBLISH=true` 环境变量（最低优先级，全局兜底）
2. `crawler_sites.ingest_policy.allow_auto_publish`（站点级策略，覆盖全局）
3. 未来 `videos.ingest_policy_override`（单视频级覆盖，最高优先级，P2 延后）

### 5.4 单视频覆盖（延后）

`videos.ingest_policy_override JSONB` 字段延后到前台 MVP 稳定后实现，支持对单条内容覆盖站点策略。

---

## 六、Migration 执行顺序

```
013 → 014 → 015（在 CHG-172 实现写入逻辑）→ 016 → 018

每个 migration 文件：
- 使用 ADD COLUMN IF NOT EXISTS（幂等可重跑）
- ALTER + UPDATE 数据迁移在同一事务内
- 不破坏现有数据
```

| Migration | 内容 | 阻塞前台 MVP |
|-----------|------|------------|
| 013 | type 枚举扩展 + 类型判定字段 | **是**（分类路由依赖） |
| 014 | season/episode 统一 | **是**（播放器 episode 选集依赖） |
| 015/CHG-172 | content_format/episode_pattern 写入逻辑 | 部分（UI 标签依赖） |
| 016 | 审核状态/可见性 + is_published 迁移 | **是**（发布工作流依赖） |
| 018-partial | crawler_sites.ingest_policy | 否（有全局兜底） |

---

## 七、回滚策略

### R1：type 枚举扩展回滚
Migration 013 在同一事务内，回滚即恢复。旧 4 种值在新枚举内，无数据丢失。`series` → `drama` 迁移需在回滚前手动还原数据。

### R2：S/E 迁移回滚
Migration 014 填充 NULL → 1 是不可逆的（无法区分"原本是 NULL"还是"原本是 1"）。**回滚点**：执行 migration 前备份 `video_sources` 表的 `episode_number` 字段。

### R3：visibility_status 同步窗口期
Migration 016 执行完成到服务重启之间，`is_published` 和 `visibility_status` 可能短暂不同步。**回滚点**：migration 的 ALTER + UPDATE 在单事务内，不存在中间态。

### R4：is_published 不立即删除
整个过程中 `is_published` 字段保留，任何时间点可以回退到"只看 is_published"的行为。

---

## 八、不在本方案内的内容

| 功能 | 优先级 | 理由 |
|------|-------|------|
| 内容风险标志（9个布尔列） | P2 | 运营功能，不阻塞 MVP |
| `videos.ingest_policy_override` | P2 | 站点级策略已覆盖大多数场景 |
| AI 分类管线（`classification_meta`） | P3 | 无具体实现计划，等设计成熟后再加 migration |
| Moderator 审核队列 UI | 独立序列 | 依赖 Migration 016 完成，列为后续 CHG |
| ES 索引同步 `allow_search_index` 逻辑 | 独立序列 | 依赖 Migration 018 完成 |
