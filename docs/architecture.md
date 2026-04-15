# Resovo（流光）— 技术架构（现状基线）

> status: active  
> owner: @engineering  
> scope: system architecture and module boundaries  
> source_of_truth: yes  
> supersedes: none  
> superseded_by: none  
> last_reviewed: 2026-04-05

---

## 1. 系统总览

Resovo 当前采用前后端解耦部署：

- 前端：Next.js App Router（`src/app`）
- 后端：Fastify API（`src/api`，统一前缀 `/v1`）
- 数据：PostgreSQL + Elasticsearch
- 异步：Redis + Bull（crawler/verify 队列）

关键边界：

- 前端不直连数据库，仅通过 `/v1` API。
- 业务规则收敛在 `services` + `db/queries` + DB 触发器；页面层不做状态机判定。
- 视频状态（三元组）由数据库触发器强约束（Migration 023）。

---

## 2. 目录与模块边界（当前）

```text
resovo/
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── tasks.md
│   ├── task-queue.md
│   └── changelog.md
├── scripts/
│   ├── migrate.ts
│   ├── clear-crawled-data.ts
│   ├── clear-local-db.sh
│   ├── stop-all-crawls.ts
│   ├── test-crawler-site.ts
│   └── verify-*.{sh,mjs,ts}
└── src/
    ├── app/                         # Next.js App Router
    ├── api/                         # Fastify API + workers + db queries
    ├── components/                  # 前端/后台组件
    ├── lib/                         # api-client、工具函数
    ├── stores/                      # Zustand 状态
    └── types/
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

- 后台登录：`/[locale]/admin/login`
- 前台登录/注册路由仍存在文件，但已下线为 `notFound()`：
  - `/[locale]/auth/login`
  - `/[locale]/auth/register`

### 3.3 后台路由

- `/[locale]/admin`
- `admin/{videos,sources,users,content,submissions,subtitles,crawler,analytics,moderation}`
- `admin/403`

中间件约束（`src/middleware.ts`）：

- `/admin/**`（除 `/admin/login`、`/admin/403`）要求存在 `refresh_token`。
- `user_role=user` 拒绝进入后台。
- moderator 不能访问 admin-only（`/admin/users`、`/admin/crawler`、`/admin/analytics`）。

---

## 4. API 架构

服务入口：`src/api/server.ts`

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

### 5.2 video_sources

- `season_number INT NOT NULL DEFAULT 1`
- `episode_number INT NOT NULL DEFAULT 1`（Migration 014 已将 NULL 统一回填为 1）
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

`src/app/robots.ts` 现状：

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

---

## 14. 当前与历史文档差异（已更正）

本次更新已对齐以下差异：

- 后台登录路径从 `auth/login` 迁移为 `admin/login`。
- `review_status/visibility_status` 去除历史 `blocked` 描述。
- 迁移文件名对齐为 `019_rebuild_video_type_genre.sql`。
- 增补 023/024/025 的状态机与成人内容治理。
- 增补 `clear-local-db.sh` 与当前调度/watchdog 机制。
