# Resovo（流光）— 技术架构（现状基线）

> status: active  
> owner: @engineering  
> scope: system architecture and module boundaries  
> source_of_truth: yes  
> supersedes: none  
> superseded_by: none  
> last_reviewed: 2026-04-17

---

## 1. 系统总览

Resovo 采用同域多进程独立部署：

- **web**（前台）：Next.js App Router（`apps/web/src/app`，含 `[locale]`，i18n）— 端口 3000
- **server**（后台）：Next.js App Router（`apps/server/src/app`，无 `[locale]`）— 端口 3001
- **api**：Fastify API（`apps/api/src`，统一前缀 `/v1`）— 端口 4000
- **数据**：PostgreSQL + Elasticsearch
- **异步**：Redis + Bull（crawler/verify 队列）

关键边界：

- 前台与后台仅通过 `/v1` API 与数据库建立联系，不共享代码路径。
- 业务规则收敛在 `services` + `db/queries` + DB 触发器；页面层不做状态机判定。
- 视频状态（三元组）由数据库触发器强约束（Migration 023）。

---

## 1a. 部署拓扑（Monorepo 三进程）

```
                    ┌─────────────────────────────────────────┐
                    │           Nginx 反向代理（:80）           │
                    │                                         │
                    │  /v1/*    ──→  api:4000   (Fastify)     │
                    │  /admin/* ──→  server:3001 (Next.js)    │
                    │  /*       ──→  web:3000   (Next.js)     │
                    └─────────────────────────────────────────┘
                           │              │              │
                    ┌──────┘       ┌──────┘       ┌─────┘
                    ▼              ▼              ▼
             web:3000          server:3001     api:4000
             前台 Next.js      后台 Next.js    Fastify API
             apps/web/         apps/server/   apps/api/
             [locale]/*        admin/*        /v1/*
                    │              │              │
                    └──────┬───────┘              │
                           │                      │
                    ┌──────▼──────────────────────▼──────┐
                    │  PostgreSQL  │  Elasticsearch  │  Redis │
                    └────────────────────────────────────┘
```

**同域 Cookie 传递**：`refresh_token` 由 API（`/v1/auth/`）设置，`Path=/`，`HttpOnly`，`SameSite=Lax`。
三个进程共享同一域名，浏览器在所有请求中自动携带该 Cookie，无需额外配置。

**静态资源路由**：
- `server` 应用在生产环境设置 `assetPrefix=/admin`（`NEXT_PUBLIC_ASSET_PREFIX` 环境变量）。
- 浏览器请求 `/admin/_next/...` → nginx 剥除 `/admin` 前缀 → 转发给 `server:3001/_next/...`。
- `web` 应用的 `/_next/...` 直接路由到 `web:3000`，互不干扰。

**Monorepo 结构**：

```text
resovo/                         ← Turbo + npm workspaces 根
├── apps/
│   ├── web/                    ← 前台 Next.js（@resovo/web，port 3000）
│   ├── server/                 ← 后台 Next.js（@resovo/server，port 3001）
│   └── api/                    ← Fastify API（@resovo/api，port 4000）
├── packages/
│   ├── player/                 ← 共享播放器组件（@resovo/player，legacy）
│   ├── player-core/            ← 播放器核心层（@resovo/player-core，M3+，ADR-036）
│   └── types/                  ← 共享类型（@resovo/types）
├── docker/
│   ├── nginx.conf              ← 反向代理路由规则
│   ├── docker-compose.dev.yml  ← 本地三端联调代理
│   └── elasticsearch.Dockerfile
└── docker-compose.yml          ← PostgreSQL + Elasticsearch + Redis
```

**本地开发**：各进程独立启动（npm run dev / turbo dev），通过 `docker/docker-compose.dev.yml` 启动 nginx 实现同域联调（localhost:8080）。

---

## 2. 目录与模块边界（当前）

```text
resovo/
├── apps/
│   ├── web/                         # 前台 Next.js（@resovo/web）
│   │   ├── src/
│   │   │   ├── app/                 # App Router（[locale]/...）
│   │   │   ├── components/          # 前台组件（含 player shell）
│   │   │   ├── lib/                 # api-client、工具函数
│   │   │   ├── stores/              # Zustand 状态
│   │   │   ├── types/               # 前台本地类型
│   │   │   └── i18n/                # next-intl 配置
│   │   ├── messages/                # i18n 翻译文件（en/zh-CN）
│   │   └── middleware.ts            # next-intl 国际化中间件
│   ├── server/                      # 后台 Next.js（@resovo/server）
│   │   └── src/
│   │       ├── app/                 # App Router（/admin/...）
│   │       └── components/admin/    # 后台管理组件
│   └── api/                         # Fastify API（@resovo/api）
│       └── src/
│           ├── routes/              # 路由层（参数校验、鉴权）
│           ├── services/            # 业务编排层
│           ├── db/queries/          # SQL 读写层
│           └── workers/             # 异步任务执行
├── packages/
│   ├── player/                      # 共享播放器组件（@resovo/player，legacy）
│   ├── player-core/                 # 播放器核心层（@resovo/player-core，M3+，ADR-036）
│   └── types/                       # 共享类型（@resovo/types）
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── tasks.md
│   ├── task-queue.md
│   └── changelog.md
└── scripts/
    ├── migrate.ts
    ├── clear-crawled-data.ts
    ├── clear-local-db.sh
    ├── stop-all-crawls.ts
    ├── test-crawler-site.ts
    └── verify-*.{sh,mjs,ts}
```

后端分层（必须遵守）：

- `routes/`：参数校验、鉴权、错误映射。
- `services/`：业务编排。
- `db/queries/`：SQL 读写。
- `workers/`：异步任务执行。

---

## 3. 路由架构（当前真实生效）

### 3.1 前台路由

- 内容入口：`/[locale]/(home)`、`/browse`、`/search`
- 详情页：`/movie/[slug]`、`/series/[slug]`、`/anime/[slug]`、`/variety/[slug]`、`/others/[slug]`
- 播放页：`/watch/[slug]`

### 3.2 登录与后台入口

- 后台登录：`/admin/login`（`apps/server` 独立进程，无 `[locale]` 前缀）
- 前台登录/注册路由仍存在文件，但已下线为 `notFound()`：
  - `/[locale]/auth/login`
  - `/[locale]/auth/register`

### 3.3 后台路由（`apps/server`，进程 server:3001）

- `/admin`（首页）
- `/admin/{videos,sources,users,content,submissions,subtitles,crawler,analytics,moderation}`
- `/admin/403`

中间件约束（`apps/server/middleware.ts`）：

- `/admin/**`（除 `/admin/login`、`/admin/403`）要求存在 `refresh_token`。
- `user_role=user` 拒绝进入后台。
- moderator 不能访问 admin-only（`/admin/users`、`/admin/crawler`、`/admin/analytics`）。

### 3.4 前台中间件（`apps/web/middleware.ts`）

仅负责 next-intl 国际化路由，不含鉴权逻辑。

---

## 4. API 架构

服务入口：`apps/api/src/server.ts`

- 所有路由挂载在 `/v1`。
- 已注册核心路由：
  - 公共：`auth`、`videos`、`sources`、`search`、`subtitles`、`danmaku`、`users`
  - 后台：`admin/{videos,content,users,analytics,crawler,cache,migration,performance,siteConfig,crawlerSites}`

运行开关：

- `CRAWLER_SCHEDULER_ENABLED=true` 启用采集调度器
- `VERIFY_SCHEDULER_ENABLED=true` 启用链接验证定时任务

---

## 5. 数据模型（核心现状）

### 5.1 videos（治理核心）

关键字段：

- `type`：11 类（`movie/series/anime/variety/documentary/short/sports/music/news/kids/other`）
- `source_category`：源站原始分类字符串
- `genres`：平台题材数组（`VideoGenre[]`，Migration 031 改为多值）
- `content_rating`：`general | adult`
- `review_status`：`pending_review | approved | rejected`
- `visibility_status`：`public | internal | hidden`
- `is_published`：兼容字段，仍参与查询/索引/状态机
- `site_key`：`VARCHAR(100)`，FK -> `crawler_sites(key)`
- `douban_status`：`pending | matched | candidate | unmatched`（Migration 032，自动丰富 Job 写入）
- `source_check_status`：`pending | ok | partial | all_dead`（Migration 032，源活性批量检验结果）
- `meta_score`：`SMALLINT 0-100`（Migration 032，元数据完整度评分）

注意：历史文档中的 `blocked` 状态已不在当前 schema 中。

### 5.1a media_catalog（作品元数据层）

Migration 026 建表，Migration 042（META-06）新增 6 个扩展字段：

核心字段：
- `title` / `title_en` / `title_original` / `title_normalized`：标题四形态
- `type`：作品类型（与 videos.type 一致）
- `genres TEXT[]` / `genres_raw TEXT[]`：平台题材 / 原始题材
- `year INT` / `release_date TEXT`：年份与首播/上映日期
- `country TEXT` / `runtime_minutes INT`：国家地区 / 片长（分钟）
- `status TEXT`：作品完成状态
- `description TEXT` / `cover_url TEXT` / `rating NUMERIC` / `rating_votes INT`：简介/封面/评分/评分人数
- `director TEXT[]` / `cast TEXT[]` / `writers TEXT[]`：导演/演员/编剧（字符串数组）
- `imdb_id TEXT` / `tmdb_id INT` / `douban_id TEXT` / `bangumi_subject_id INT`：外部 ID
- `metadata_source TEXT`：元数据最近写入来源（manual/tmdb/bangumi/douban/crawler）
- `locked_fields TEXT[]`：已锁定字段列表（手动确认后不被自动覆盖）

META-06 新增字段：
- `aliases TEXT[]`：别名/又名列表
- `languages TEXT[]`：语言列表
- `official_site TEXT`：官网 URL
- `tags TEXT[]`：标签列表
- `backdrop_url TEXT`：横幅/背景图 URL
- `trailer_url TEXT`：预告片 URL

### 5.2 video_sources

- `season_number INT NOT NULL DEFAULT 1`
- `episode_number INT NOT NULL DEFAULT 1`（Migration 014 已将 NULL 统一回填为 1）
- `source_site_key VARCHAR(100) NULL`：行级源站 key（Migration 046，CHG-414）。爬虫写入时记录当前源站；JOIN 路径优先用此字段，NULL 时 fallback 到 `videos.site_key`，支持同一视频聚合多个源站线路时精确显示各自名称。
- 唯一去重约束：`uq_sources_video_episode_url`

### 5.3 crawler_sites

- 主键是 `key VARCHAR(100)`，不是 UUID。
- `display_name VARCHAR(200)`：对用户友好的中文展示名称（Migration 038）。未设置时前台 fallback 到 `normalizeProviderName(source_name)`。
- `is_adult` 控制成人源站标记。
- `ingest_policy` 存站点级采集策略。

### 5.4 采集运行表

- `crawler_runs`：批次级状态与汇总
  - `crawl_mode`：`batch | keyword | source-refetch`（Migration 032）
  - `keyword`：关键词采集时的搜索词（Migration 032）
  - `target_video_id`：补源采集时的目标视频 ID（Migration 032）
- `crawler_tasks`：单任务状态（含 pause/cancel/timeout）
- `crawler_task_logs`：结构化日志

### 5.5 外部数据 schema（external_data）

Migration 036 新增，供 MetadataEnrichService 做本地毫秒级标题匹配（与 external_*_raw 原始暂存表用途不同）：

- `external_data.douban_entries`：豆瓣条目查询表（约 14 万行，来源 external-db/douban/）
  - 关键字段：`douban_id`（UNIQUE）、`title`、`title_normalized`、`year`、`rating`、`directors[]`、`cast[]`、`genres[]`
  - META-01 扩展字段：`aliases TEXT[]`、`imdb_id`、`languages TEXT[]`、`duration_minutes`、`tags TEXT[]`、`douban_votes`、`regions TEXT[]`、`release_date TEXT`、`actor_ids TEXT[]`、`director_ids TEXT[]`、`official_site`
  - 索引：`(title_normalized, year)` — Step1 精确匹配；`imdb_id` — META-05 精确匹配用
  - 导入脚本：`scripts/import-douban-dump.ts`（ON CONFLICT DO UPDATE，幂等，支持 --limit/--dry-run/--file）
- `external_data.douban_people`：豆瓣人物查询表（约 7.3 万行，来源 external-db/douban/person.csv）
  - 关键字段：`person_id`（UNIQUE）、`name`、`name_en`、`name_zh`、`sex`、`birth TEXT`、`profession TEXT[]`、`biography`
  - 索引：`person_id`（UNIQUE）、`name`（查找用）
  - 导入脚本：`scripts/import-douban-people.ts`（ON CONFLICT DO UPDATE，幂等，支持 --limit/--dry-run/--file）
- `external_data.bangumi_entries`：Bangumi 动画条目查询表（type=2，约 1 万行，来源 external-db/bangumi/）
  - 关键字段：`bangumi_id`（UNIQUE）、`title_cn`、`title_jp`、`title_normalized`、`air_date`、`year`、`rating`
  - 索引：`(title_normalized, year)` — Step3 动画匹配用
  - 导入脚本：`scripts/import-bangumi-dump.ts`（ON CONFLICT DO UPDATE，幂等）

注意：`external_*_raw` 表（Migration 027）用于构建 `media_catalog`，是导入暂存表，不用于运行时查询。

### 5.6 内外部关联表

- `video_external_refs`：记录内部视频与外部条目的匹配关系（Migration 041，META-03）
  - 关键字段：`video_id FK`、`provider`（douban/tmdb/bangumi/imdb）、`external_id`、`match_status`（auto_matched/manual_confirmed/candidate/rejected）、`confidence NUMERIC(4,2)`、`is_primary BOOLEAN`
  - 约束：`(video_id, provider)` 上的唯一部分索引（WHERE is_primary=true）—— 每视频每 provider 最多一个 primary 绑定
  - 查询函数：`upsertVideoExternalRef()` / `findPrimaryVideoExternalRef()`（`apps/api/src/db/queries/externalData.ts`）

### 5.7 元数据追踪与锁定（META-09）

- `video_metadata_provenance`：追踪 `media_catalog` 每个字段最后一次写入来源（Migration 043）
  - 主键：`(catalog_id, field_name)`；`catalog_id FK → media_catalog(id) ON DELETE CASCADE`
  - 关键字段：`source_kind`（manual/douban/bangumi/tmdb/crawler）、`source_ref`（外部 ID）、`source_priority`（优先级数值）、`updated_at`
  - 查询函数：`batchUpsertFieldProvenance()` / `getProvenanceByCatalogId()`（`apps/api/src/db/queries/metadataProvenance.ts`）

- `video_metadata_locks`：精细化字段级锁定（Migration 044）
  - 主键：`(catalog_id, field_name)`；`catalog_id FK → media_catalog(id) ON DELETE CASCADE`
  - 关键字段：`lock_mode TEXT CHECK('soft','hard')`、`locked_by`、`locked_at`、`reason`
  - hard lock：`MediaCatalogService.safeUpdate` 写字段前检查，硬锁字段不得被任何来源覆盖
  - soft lock：仅标记，当前不阻止写入（预留给未来告警流程）
  - 查询函数：`getHardLockedFields()` / `getLocksByCatalogId()` / `upsertFieldLock()` / `removeFieldLock()`（同上文件）

### 5.8 Brand Token 层（TOKEN-08）

- `brands`：存储多品牌 token 覆盖（Migration 047）

| 列名        | 类型         | 说明                                                         |
|-------------|--------------|--------------------------------------------------------------|
| id          | uuid         | 主键，`gen_random_uuid()`                                    |
| slug        | text         | 品牌唯一标识（有效行内唯一部分索引）                          |
| name        | text         | 品牌显示名                                                   |
| overrides   | jsonb        | Brand 覆盖，形如 `{ "semantic": {...}, "component": {...} }` |
| created_at  | timestamptz  | 创建时间                                                     |
| updated_at  | timestamptz  | 由触发器 `brands_set_updated_at_trg` 自动维护                |
| deleted_at  | timestamptz  | 软删除时间戳，NULL 表示有效                                   |

  - `overrides` 顶层只允许 `semantic` / `component` 两个键（ADR-022 约束），由应用层 zod 校验；Primitive 层键被 TS 编译期 excess-property check 拦截
  - 查询函数：`getBrandBySlug()` / `listBrands()` / `upsertBrand()`（`apps/api/src/db/queries/brands.ts`）
  - 完整 TS 类型定义：`packages/design-tokens/src/brands/types.ts`（`Brand` / `BrandOverrides`）

---

## 6. 视频状态机（DB 强约束）

来源：Migration `023_enforce_video_state_machine_trigger.sql`

合法状态三元组（`review_status`, `visibility_status`, `is_published`）：

- `pending_review`: `(internal,false)` 或 `(hidden,false)`
- `approved`: `(public,true)` 或 `(internal,false)` 或 `(hidden,false)`
- `rejected`: `(hidden,false)`

跃迁白名单（Migration 033 更新）：

| 旧状态 | 允许跃迁至 |
|--------|-----------|
| `pending_review+internal` | `pending_review+hidden` / `approved+internal`（暂存）/ `approved+public`（直接上架）/ `rejected+hidden` |
| `pending_review+hidden` | `pending_review+internal` / `approved+internal`（暂存，034）/ `approved+hidden` / `approved+public` / `rejected+hidden` |
| `approved+public` | `approved+internal` / `approved+hidden` |
| `approved+internal` | `approved+public` / `approved+hidden` |
| `approved+hidden` | `approved+public` / `approved+internal` |
| `rejected+hidden` | `pending_review+hidden` / `pending_review+internal` |

附加硬约束：

- `is_published=true` 必须存在至少 1 条 active source。
- UPDATE 受 transition whitelist 约束，非法跳转直接抛 `check_violation`。

配套机制：

- `run_video_state_watchdog(auto_fix bool)`：巡检/可选修复。
- `video_state_watchdog_runs`：巡检记录。

---

## 7. 单一写入口与并发控制

后台视频状态写入口（`admin/videos`）：

- 推荐入口：`POST /admin/videos/:id/state-transition`
- 兼容入口：`PATCH /publish`、`PATCH /visibility`、`POST /review`

并发控制：

- `state-transition` 支持 `expectedUpdatedAt`，冲突返回 `409 STATE_CONFLICT`。
- 非法跃迁返回 `422 INVALID_TRANSITION`。
- DB trigger 是最终防线，防止跨模块直接写脏状态。

---

## 8. 前台可见性与检索约束

### 8.1 PostgreSQL 公共查询

公共视频查询统一要求：

- `is_published = true`
- `visibility_status = 'public'`
- `deleted_at IS NULL`

### 8.2 Elasticsearch 搜索约束

`SearchService` 当前强制过滤：

- `is_published=true`
- `visibility_status='public'`
- `review_status='approved'`
- `content_rating='general'`

结论：前台不展示成人内容（与后台开关无关）。

---

## 9. 成人内容策略（当前）

- `show_adult_content` 当前仅影响后台管理列表是否显示成人源站内容。
- 前台与搜索始终只展示 `content_rating='general'`。
- Migration 025 将成人源站视频收敛为：
  - `type='other'`
  - `visibility_status='hidden'`
  - `review_status='rejected'`
  - `is_published=false`

---

## 10. 采集链路与去重现实

主链路：

1. 后台创建 run/task
2. worker 消费并抓取
3. 解析视频与源
4. 写回视频/源/日志

当前已知现实：

- `videos.site_key` 仅在“新建视频”链路稳定写入。
- 命中已有视频时，若历史数据未回填，仍可能出现 `site_key=NULL`。
- 这会影响“按源站筛选/聚合”精度，不影响前台可见性约束。

---

## 11. Admin UX 架构要点（当前）

- 后台全局消息使用 `AdminToastHost`（右下角悬浮，不占布局）。
- 列表体系存在 ModernTable 与历史表并存，批量操作栏与交互尚未完全统一。
- 审核台入口以 `/admin/moderation` 为主，`/admin/submissions` 仍保留。

---

## 12. robots 与索引隔离

`apps/web/src/app/robots.ts` 现状：

- 屏蔽 `/admin/`、`/auth/`
- 基于 `routing.locales` 动态屏蔽 `/{locale}/admin/` 和 `/{locale}/auth/`

---

## 13. 迁移基线（001~036）

当前目录实际迁移文件：

- `001_init_tables.sql`
- `002_indexes.sql`
- `003_add_douban_id.sql`
- `004_add_rejection_reason.sql`
- `005_system_settings.sql`
- `006_crawler_sites_status.sql`
- `007_video_merge.sql`
- `008_crawler_sites_api_unique.sql`
- `009_crawler_task_logs.sql`
- `010_crawler_runs_and_task_control.sql`
- `011_add_paused_statuses.sql`
- `012_add_task_started_at.sql`
- `013_type_expansion.sql`
- `014_season_episode.sql`
- `015_content_format_backfill.sql`
- `016_review_visibility.sql`
- `018_partial_ingest_policy.sql`（017 不存在，历史序号空洞）
- `019_rebuild_video_type_genre.sql`
- `020_add_genre_source_content_rating.sql`
- `021_backfill_type_genre_content_rating.sql`
- `022_add_site_key_to_videos.sql`
- `023_enforce_video_state_machine_trigger.sql`
- `024_backfill_videos_episode_count_from_sources.sql`
- `025_enforce_adult_site_video_safety.sql`
- `026_create_media_catalog.sql`
- `027_create_external_raw_tables.sql`（外部原始暂存表）
- `028_videos_add_catalog_id.sql`
- `029_videos_drop_metadata_fields.sql`
- `030_video_aliases_to_catalog.sql`
- `031_genre_to_genres.sql`
- `032_videos_pipeline_status_fields.sql`（douban_status / source_check_status / meta_score）
- `033_update_state_machine_approve_staging.sql`
- `034_fix_approve_hidden_to_internal.sql`
- `035_seed_auto_publish_staging_enabled.sql`
- `036_external_data_schema.sql`（external_data schema：douban_entries / bangumi_entries）
- `037_source_health_events.sql`
- `038_crawler_sites_display_name.sql`
- `039_douban_entries_extend.sql`（META-01：douban_entries 补全 11 个字段）
- `040_douban_people.sql`（META-02：新建 external_data.douban_people）
- `041_video_external_refs.sql`（META-03：新建 video_external_refs 内外关联表）
- `042_media_catalog_extend.sql`（META-06：media_catalog 新增 aliases/languages/tags/official_site/backdrop_url/trailer_url/rating_votes/runtime_minutes）
- `043_video_metadata_provenance.sql`（META-09：新建 video_metadata_provenance 字段来源追踪表）
- `044_video_metadata_locks.sql`（META-09：新建 video_metadata_locks 精细化字段锁表）
- `045_fix_video_external_refs_unique.sql`（META bugfix：补建 uq_video_external_refs_vid_prov_ext UNIQUE INDEX，修复 ON CONFLICT 约束缺失）
- `046_video_sources_source_site_key.sql`（CHG-414：video_sources 新增 source_site_key 行级源站字段，存量 backfill 自 videos.site_key）

---

## 14. 当前与历史文档差异（已更正）

本次更新已对齐以下差异：

- 后台登录路径从 `auth/login` 迁移为 `admin/login`。
- `review_status/visibility_status` 去除历史 `blocked` 描述。
- 迁移文件名对齐为 `019_rebuild_video_type_genre.sql`。
- 增补 023/024/025 的状态机与成人内容治理。
- 增补 `clear-local-db.sh` 与当前调度/watchdog 机制。

---

## 15. 重写期路由拓扑（RW-SETUP-02 / ADR-035）

> 适用阶段：M2 开始至 M6-RENAME 完成前。

> ⚠️ **方向说明（防止歧义）**：`task_queue_patch_rewrite_track_20260418.md §2` 的 ASCII 图描述的是 M6-RENAME 后的**终态**（web-next 已被重命名为 web，成为新主），不是过渡期拓扑。过渡期拓扑（M2–M5）由 **ADR-035** 权威定义：`apps/web`（port 3000）是唯一对外入口网关，`apps/web-next`（port 3002）是内网 upstream。两者描述的时间截面不同，终态一致，中间架构以 ADR-035 为准。

### 拓扑概览

```
Browser / Crawler
       │
       ▼
apps/web (port 3000) ← 对外唯一入口
   middleware.ts
       │
       ├─ path in ALLOWLIST? ──Yes──► NextResponse.rewrite
       │                               ─────────────────────►  apps/web-next (port 3002)
       │                               headers: x-rewrite-source: web-next
       │                                        x-rewrite-rule: M2:home (示例)
       │
       └─ No ─► intlMiddleware (next-intl locale 协商)
                       │
                       ▼
               apps/web 各路由处理
```

### 里程碑与 ALLOWLIST 接管计划

| 里程碑 | 接管路径 | ALLOWLIST 条目（mode） |
|--------|---------|----------------------|
| RW-SETUP | `/next-placeholder` | prefix（验收用，M6 前退役） |
| M2 | `/`（含 `/en`、`/zh-CN`） | exact + localeAware |
| M3 | `/watch`、`/movie`、`/anime`、`/series`、`/variety`、`/others` | prefix |
| M4 | `/auth` | prefix |
| M5 | `/search` | prefix |
| M6 | 剩余路径全量接管 | 反向白名单或全 prefix |
| M6-RENAME | `git mv apps/web-next apps/web`；middleware + ALLOWLIST 退役 | — |

### ALLOWLIST 单一真源

`apps/web/src/lib/rewrite-allowlist.ts` — 禁止在任何其他位置（Nginx / Vercel / CDN）复制此列表。

### Kill-switch

设置环境变量 `REWRITE_ALLOWLIST_DISABLED=1` → middleware 短路，所有请求回旧 apps/web，无需重新部署（秒级回滚）。

### 观测

每次 rewrite 时 middleware 透传响应头：
- `x-rewrite-source: web-next`
- `x-rewrite-rule: <milestone>:<domain>`

DevTools Network 面板可直接确认是否命中，Playwright 可断言响应头。
