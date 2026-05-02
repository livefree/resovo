# Resovo（流光）— 技术架构（现状基线）

> status: active  
> owner: @engineering  
> scope: system architecture and module boundaries  
> source_of_truth: yes  
> supersedes: none  
> superseded_by: none  
> last_reviewed: 2026-04-28

---

## 1. 系统总览

Resovo 采用同域多进程独立部署：

- **web-next**（新前台）：Next.js App Router（`apps/web-next/src/app`，含 `[locale]`，i18n）— 端口 3000
- **server**（旧后台，将退役）：Next.js App Router（`apps/server/src/app`，无 `[locale]`）— 端口 3001
- **api**：Fastify API（`apps/api/src`，统一前缀 `/v1`）— 端口 4000
- **数据**：PostgreSQL + Elasticsearch
- **异步**：Redis + Bull（crawler/verify 队列）

**立项中**：
- **server-next**（新后台）：Next.js App Router（`apps/server-next/src/app`，无 `[locale]`）— 端口 3003（开发期），M-SN-7 cutover 后接管 /admin/* 并改名为 `apps/admin`

关键边界：

- 前台与后台仅通过 `/v1` API 与数据库建立联系，不共享代码路径。
- 业务规则收敛在 `services` + `db/queries` + DB 触发器；页面层不做状态机判定。
- 视频状态（三元组）由数据库触发器强约束（Migration 023）。
- server-next 工程实施计划详见 `docs/server_next_plan_20260427.md`。

---

## 1a. 部署拓扑（Monorepo 多进程；server-next 时代）

> **2026-04-30 修订（CHG-DESIGN-11）**：原拓扑只描述 :3001 旧后台。当前实际有 3 阶段：
> 开发期 / staging 演练 / 生产 cutover。详见下方分阶段拓扑。

### 1a.1 当前生产（M-SN-7 cutover 之前）

```
                    ┌─────────────────────────────────────────┐
                    │           Nginx 反向代理（:80）           │
                    │                                         │
                    │  /v1/*    ──→  api:4000   (Fastify)     │
                    │  /admin/* ──→  server:3001 (Next.js v1) │
                    │  /*       ──→  web:3000   (Next.js)     │
                    └─────────────────────────────────────────┘
                           │              │              │
                    ┌──────┘       ┌──────┘       ┌─────┘
                    ▼              ▼              ▼
             web:3000          server:3001     api:4000
             前台 Next.js      后台 Next.js    Fastify API
             apps/web-next/    apps/server/   apps/api/
             [locale]/*        admin/*        /v1/*
                    │              │              │
                    └──────┬───────┘              │
                           │                      │
                    ┌──────▼──────────────────────▼──────┐
                    │  PostgreSQL  │  Elasticsearch  │  Redis │
                    └────────────────────────────────────┘
```

### 1a.2 开发期（M-SN-2 ~ 当前）

server-next（`apps/server-next`）在本地以独立进程 `:3003` 运行，**不**进入 nginx 转发：

```
本地开发：
  /admin/*   ──→  server:3001       （v1 后台，仍是开发期入口）
  /admin-next 或访问 :3003 直连  ──→  server-next:3003   （重写后台，独立验证）
```

server-next 不复用 apps/server 的 `/admin/*` 路由空间——开发者通过直连 `:3003` 验证新后台；
任何 server-next 任务卡的 e2e 测试在 :3003 独立运行（详见 playwright.config.ts admin-next-chromium project）。

### 1a.3 Staging 演练（CHG-SN-3-12，已暂停 → SEQ-20260429-02 收敛后恢复）

在 staging 环境通过 nginx 临时把 `/admin/*` 的 upstream 切到 `:3003`，验证 cookie 透明传递、
切换零 session 丢失、回滚无损。**不**采用 ADR-035 风格的 ALLOWLIST / 逐页 rewrite。

### 1a.4 生产 cutover（M-SN-7）

一次性 nginx upstream 切换：

```
                    │  /admin/* ──→  server-next:3003 (Next.js v2，新后台)
```

切换后 apps/server 停服并退场（详见 ADR-101）。

---

**同域 Cookie 传递**：`refresh_token` 由 API（`/v1/auth/`）设置，`Path=/`，`HttpOnly`，`SameSite=Lax`。
开发期 / cutover 后所有进程共享同一域名，浏览器自动携带该 Cookie。staging 演练验收 cookie
跨服务（server ↔ server-next）切换时透明。

**静态资源路由**：
- `server`（v1）在生产环境设置 `assetPrefix=/admin`（`NEXT_PUBLIC_ASSET_PREFIX` 环境变量）。
- `server-next`（v2，cutover 后）继承同一 `assetPrefix=/admin`，nginx 剥除 `/admin` 前缀转发到 `:3003/_next/...`。
- 浏览器请求 `/admin/_next/...` → nginx 剥除前缀 → server / server-next（视 cutover 状态）。
- `web` 应用的 `/_next/...` 直接路由到 `web:3000`，互不干扰。

**Monorepo 结构**：

```text
resovo/                         ← Turbo + npm workspaces 根
├── apps/
│   ├── web-next/               ← 新前台 Next.js（@resovo/web-next，port 3000，已上线）
│   ├── server/                 ← 旧后台 Next.js（@resovo/server，port 3001，将退役）
│   ├── server-next/            ← 新后台 Next.js（@resovo/server-next，port 3003，开发中）
│   └── api/                    ← Fastify API（@resovo/api，port 4000）
├── packages/
│   ├── player/                 ← 共享播放器组件（@resovo/player，legacy）
│   ├── player-core/            ← 播放器核心层（@resovo/player-core，M3+，ADR-036）
│   ├── types/                  ← 共享类型（@resovo/types）
│   ├── design-tokens/          ← 设计系统 Token（base / semantic / admin-layout 三层）
│   └── admin-ui/               ← 后台共享组件库（M-SN-1 启动后）
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
│   ├── web-next/                    # 新前台 Next.js（@resovo/web-next，已上线）
│   │   ├── src/
│   │   │   ├── app/                 # App Router（[locale]/...）
│   │   │   ├── components/          # 前台组件（含 player shell）
│   │   │   ├── lib/                 # api-client、工具函数
│   │   │   ├── stores/              # Zustand 状态
│   │   │   ├── types/               # 前台本地类型
│   │   │   └── contexts/            # BrandProvider / ThemeProvider（ADR-038/039）
│   │   ├── messages/                # i18n 翻译文件（en/zh-CN）
│   │   └── middleware.ts            # 品牌识别中间件（cookie → header）
│   ├── server/                      # 旧后台 Next.js（@resovo/server，将退役）
│   │   └── src/
│   │       ├── app/                 # App Router（/admin/...）
│   │       └── components/admin/    # 后台管理组件（遗留）
│   ├── server-next/                 # 新后台 Next.js（@resovo/server-next，开发中，M-SN）
│   │   └── src/
│   │       ├── app/                 # App Router（/admin/...）
│   │       ├── components/          # server-next 业务组件
│   │       ├── lib/                 # apiClient / 鉴权 / utils
│   │       ├── stores/              # zustand（如需）
│   │       ├── contexts/            # BrandProvider / ThemeProvider（沿用 ADR-038/039）
│   │       └── middleware.ts
│   └── api/                         # Fastify API（@resovo/api）
│       └── src/
│           ├── routes/              # 路由层（参数校验、鉴权）
│           ├── services/            # 业务编排层
│           ├── db/queries/          # SQL 读写层
│           └── workers/             # 异步任务执行
├── packages/
│   ├── player/                      # 共享播放器组件（@resovo/player，legacy）
│   ├── player-core/                 # 播放器核心层（@resovo/player-core，M3+，ADR-036）
│   ├── types/                       # 共享类型（@resovo/types）
│   ├── design-tokens/               # 设计系统 Token（base / semantic / admin-layout）
│   └── admin-ui/                    # 后台共享组件库（M-SN-1 创建空骨架）
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── tasks.md
│   ├── task-queue.md
│   ├── changelog.md
│   └── server_next_plan_20260427.md # M-SN 工程实施 Plan（source_of_truth）
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

> **2026-04-30 修订（CHG-DESIGN-11）**：登录入口分两套，cutover 状态决定生效路径。

- **apps/server v1（开发期 / cutover 前生产）**：`/admin/login`（独立进程 :3001，无 `[locale]` 前缀）
- **apps/server-next v2（M-SN-2+，cutover 后生产）**：`/login`（独立路由，**不进入** AdminShell；登录后跳转 `/admin`）
- 前台登录/注册路由仍存在文件，但已下线为 `notFound()`：
  - `/[locale]/auth/login`
  - `/[locale]/auth/register`

### 3.3 后台路由

#### 3.3.1 apps/server v1（进程 server:3001，cutover 前生产 / 当前开发期）

- `/admin`（首页）
- `/admin/{videos,sources,users,content,submissions,subtitles,crawler,analytics,moderation}`
- `/admin/403`

中间件约束（`apps/server/middleware.ts`）：
- `/admin/**`（除 `/admin/login`、`/admin/403`）要求存在 `refresh_token`。
- `user_role=user` 拒绝进入后台。
- moderator 不能访问 admin-only（`/admin/users`、`/admin/crawler`、`/admin/analytics`）。

#### 3.3.2 apps/server-next v2（进程 server-next:3003，开发期独立 / cutover 后生产）

> 当前真源：IA v1（21 主路由 + 5 system 子 + 1 login = 27 路由占位，详见 ADR-100 + plan §4.1）
> 与 v1 路由命名有差异，详见 `docs/server_next_plan_20260427.md` §4.1（IA 修订段）。

- `/admin`（dashboard）+ `/admin/moderation`（运营中心）
- `/admin/{videos,sources,merge,subtitles,image-health}`（内容资产）
- `/admin/{home,submissions}`（首页运营）
- `/admin/crawler` + `/admin/staging`（采集中心）
- `/admin/{users,settings,audit}` + 5 个 system 子（系统管理；CHG-DESIGN-06 规划收敛回单入口）
- `/login`（登录，不进 Shell）
- `/admin/403`（鉴权拒绝）

中间件约束（`apps/server-next/src/middleware.ts`）：双因素拦截 + 品牌识别 cookie → header（ADR-039 沿用）；
角色矩阵与 v1 一致（cutover 后行为透明）。

### 3.4 前台中间件（`apps/web-next/src/middleware.ts`）

负责品牌识别（cookie → header，ADR-039）+ next-intl 国际化路由，不含鉴权逻辑。

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

### 5.9 首页 Banner（M5-API-BANNER-01，Migration 049）

- `home_banners`：首页 Banner 管理，支持时间窗激活 + 多品牌 + 多语言标题（Migration 049）

| 列名          | 类型         | 说明                                                              |
|---------------|--------------|-------------------------------------------------------------------|
| id            | uuid         | 主键，`gen_random_uuid()`                                         |
| title         | jsonb        | 多语言标题，形如 `{ "zh-CN": "...", "en": "..." }`               |
| image_url     | text         | Banner 图片地址                                                   |
| link_type     | text         | `'video'` \| `'external'`                                        |
| link_target   | text         | 跳转目标（video short_id 或外部 URL）                             |
| sort_order    | int          | 排序序号，升序展示                                               |
| active_from   | timestamptz  | 生效开始时间，NULL 表示立即生效                                   |
| active_to     | timestamptz  | 生效结束时间，NULL 表示永久                                       |
| is_active     | boolean      | 手动开关，false 时不参与时间窗查询                               |
| brand_scope   | text         | `'all-brands'` \| `'brand-specific'`                             |
| brand_slug    | text         | `brand_scope = 'brand-specific'` 时指定品牌 slug                 |
| created_at    | timestamptz  | 创建时间                                                         |
| updated_at    | timestamptz  | 由触发器 `home_banners_set_updated_at_trg` 自动维护              |

  - 索引：`(is_active, active_from, active_to, sort_order)` 覆盖公开列表查询；`(brand_scope, brand_slug) WHERE is_active = true` 覆盖品牌过滤
  - 查询函数：`listActiveBanners()` / `listAllBanners()` / `findBannerById()` / `createBanner()` / `updateBanner()` / `deleteBanner()` / `updateBannerSortOrders()`（`apps/api/src/db/queries/home-banners.ts`）
  - 公开 API：`GET /v1/banners?locale=&brand_slug=`（无需认证，返回 `BannerCard[]`）
  - Admin API：`GET/POST/PUT/DELETE /v1/admin/banners`、`PATCH /v1/admin/banners/reorder`（需 admin 角色）
  - TS 类型：`Banner` / `BannerCard` / `CreateBannerInput` / `UpdateBannerInput`（`packages/types/src/banner.types.ts`）

### 5.10 首页模块化编排（HANDOFF-02，ADR-052，Migration 050/051）

- `home_modules`：首页模块化编排，支持 banner/featured/top10/type_shortcuts 四类 slot（Migration 050）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，`gen_random_uuid()` |
| slot | text | `'banner'｜'featured'｜'top10'｜'type_shortcuts'` |
| brand_scope | text | `'all-brands'｜'brand-specific'` |
| brand_slug | text | `brand_scope='brand-specific'` 时必填 |
| ordering | int | 排序序号，升序展示 |
| content_ref_type | text | `'video'｜'external_url'｜'custom_html'｜'video_type'`，与 slot 联合 CHECK |
| content_ref_id | text | 引用目标 ID（视频 UUID / URL / VideoType 字符串） |
| start_at / end_at | timestamptz | 时间窗，`start_at < end_at` CHECK |
| enabled | boolean | 下线开关 |
| metadata | jsonb | 非关键运营展示数据，NOT NULL DEFAULT '{}' |
| created_at / updated_at | timestamptz | updated_at 触发器维护 |

  - slot × content_ref_type 约束（DB CHECK 强制，详见 ADR-052）：banner 允许 video/url/html；featured/top10 仅 video；type_shortcuts 仅 video_type
  - brand_scope 查询协议：`WHERE brand_scope = 'all-brands' OR brand_slug = $1`（与 home_banners 对齐）
  - 索引：`(slot, brand_scope, brand_slug, ordering) WHERE enabled`（前台主查）+ `(start_at, end_at) WHERE enabled`（时间窗）+ `(content_ref_type, content_ref_id)`（级联失效反查）
  - TS 类型：`HomeModule` / `HomeModuleSlot` / `HomeModuleContentRefType` / `HomeBrandScope` / `CreateHomeModuleInput` / `UpdateHomeModuleInput` / `ReorderHomeModuleItem`（`packages/types/src/home-module.types.ts`）
  - DB 查询：`listActiveHomeModules / listAdminHomeModules / findHomeModuleById / createHomeModule / updateHomeModule / deleteHomeModule / reorderHomeModules / listHomeModulesByContentRef`（`apps/api/src/db/queries/home-modules.ts`）

- `videos.trending_tag`（Migration 051）：人工运营榜单标签，枚举值 `'hot'｜'weekly_top'｜'editors_pick'｜'exclusive'`，NULL 表示未标记；加部分索引 `WHERE trending_tag IS NOT NULL`
  - TS 类型：`TrendingTag`（`packages/types/src/video.types.ts`），`Video.trendingTag: TrendingTag | null`
  - DB 查询：`setVideoTrendingTag / clearVideoTrendingTag / listVideosByTrendingTag`（`apps/api/src/db/queries/videos.ts`）

### 5.11 图片治理层（IMG-01，ADR-046，Migration 048）

**`media_catalog` 新增治理字段**（与 `cover_url`/`backdrop_url` 同层，不在 `videos`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `poster_blurhash` | text | P0 竖封面 BlurHash 字符串 |
| `poster_primary_color` | text | P0 主色（OKLCH；极端亮度置 null）|
| `poster_width/height` | int | P0 原图尺寸 |
| `poster_status` | text CHECK | ok/missing/broken/low_quality/pending_review |
| `poster_source` | text CHECK | crawler/tmdb/douban/manual/upload |
| `backdrop_blurhash/primary_color/status` | text | P1 横版同上 |
| `logo_url/status` | text | P2 透明艺术字 |
| `banner_backdrop_url/blurhash/status` | text | P2 Banner 专属横图 |
| `stills_urls/meta` | jsonb NOT NULL DEFAULT '[]' | P3 剧照集合，CHECK jsonb_typeof = 'array' |

**`videos` 新增**：`image_governance_status`（ok/pending/missing_poster/broken_poster）汇总发布门控；不再存图片 URL。

**`broken_image_events`（新建表）**：记录图片健康异常事件，去重唯一约束 `(video_id, image_kind, url_hash_prefix, bucket_start)`；`video_id FK ON DELETE CASCADE`。
- `url_hash_prefix`：sha256(url) 前 16 位（去重用）
- `bucket_start`：floor(time, 10min)（时间窗口 key）
- 查询函数：`upsertBrokenImageEvent()` / `getImageHealthStats()` / `getTopBrokenDomains()`（`apps/api/src/db/queries/imageHealth.ts`）

**`video_episode_images`（新建表）**：剧集缩略图，UNIQUE `(video_id, season_number, episode_number)`；替代不存在的 episodes 表。`video_id FK ON DELETE CASCADE`。
- 查询函数：`apps/api/src/db/queries/imageHealth.ts`

**前台消费链路**：`media_catalog`（新字段）→ `VIDEO_FULL_SELECT`（追加 6 列 `mc.poster_blurhash/status/backdrop_blurhash/status/logo_url/status`）→ `mapVideoRow/mapVideoCard` → `Video`/`VideoCard` 类型（`packages/types/src/video.types.ts`）→ API 响应。

### 5.12 M-SN-4 审核台 schema（CHG-SN-4-03，Migration 052–060）

来源：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §2 + ADR-109。SQL 落地详见 `apps/api/src/db/migrations/052_admin_audit_log.sql ～ 060_videos_review_source.sql`；types 在 `packages/types/src/admin-moderation.types.ts`。

**新建表：**

| 表 | Migration | 说明 |
|---|---|---|
| `admin_audit_log` | 052（M-SN-4 序列首位）| admin 写操作审计日志（M-SN-2 欠账，D-18 前置补建）。`actor_id UUID NOT NULL FK users(id) ON DELETE RESTRICT` / `action_type TEXT NOT NULL`（plan §3.0.5 枚举为唯一真源）/ `target_kind TEXT NOT NULL CHECK 6 值`（video/video_source/staging/review_label/crawler_site/system）/ `target_id UUID NULL` / `before_jsonb JSONB NULL` / `after_jsonb JSONB NULL` / `request_id TEXT NULL`（pino 透传）/ `ip_hash TEXT NULL`（hash(IP) 头 8 字节，PII 红线）。索引：`(actor_id, created_at DESC)` / `(target_kind, target_id, created_at DESC)` / `(action_type, created_at DESC)` / `request_id` partial。 |
| `review_labels` | 056 | 预设审核标签字典（plan §2.5）。`label_key TEXT NOT NULL UNIQUE` / `label TEXT NOT NULL`（中文文案）/ `applies_to TEXT NOT NULL CHECK 3 值`（reject/approve/any）DEFAULT 'reject' / `display_order INT NOT NULL DEFAULT 0` / `is_active BOOLEAN NOT NULL DEFAULT true`。种子 8 行：all_dead/duplicate/violation/cover_missing/incomplete_meta/low_quality/region_blocked/other。索引：`(applies_to, is_active, display_order) WHERE is_active=true`。 |

**`videos` 新增字段：**

| 字段 | Migration | 类型 | 说明 |
|---|---|---|---|
| `staff_note` | 055 | TEXT NULL | 审核员过程备注，不随状态迁移清空，可多次编辑（plan §5.1） |
| `review_label_key` | 055 | TEXT NULL | 拒绝/标记时选用的预设标签 key；软引用 `review_labels.label_key`（不加 FK 防演进锁死）；partial index `WHERE deleted_at IS NULL AND review_label_key IS NOT NULL` |
| `review_source` | 060 | TEXT **NOT NULL** DEFAULT 'manual' CHECK 3 值 | 审核来源：auto/manual/crawler；右侧元数据面板显示极小 tag。**三步幂等模式**部署（v1.4 safe convergence；详见 plan §2.10 + §12）|

**`video_sources` 新增字段：**

| 字段 | Migration | 类型 | 说明 |
|---|---|---|---|
| `probe_status` | 054 | TEXT NOT NULL DEFAULT 'pending' CHECK 4 值 | 探测态（reachability，HEAD / m3u8 manifest）。pending/ok/partial/dead；存量行按 `videos.source_check_status` + `is_active` 粗回填，精确值由 SourceHealthWorker（CHG-SN-4-06）首次运行后写回 |
| `render_status` | 054 | TEXT NOT NULL DEFAULT 'pending' CHECK 4 值 | 渲染态（playability，manifest parse + segment）。同上 4 值 |
| `latency_ms` | 054 | INT NULL | 首个 segment / manifest 响应延迟毫秒 |
| `last_probed_at` | 054 | TIMESTAMPTZ NULL | Level 1 probe 最后执行时间 |
| `last_rendered_at` | 054 | TIMESTAMPTZ NULL | Level 2 render check 最后执行时间 |
| `quality_detected` | 059 | TEXT NULL CHECK 7 值 | 实测分辨率档位：4K/2K/1080P/720P/480P/360P/240P；前端 fallback `quality_detected ?? quality` |
| `quality_source` | 059 | TEXT **NOT NULL** DEFAULT 'crawler' CHECK 4 值 | 分辨率来源：crawler/manifest_parse/player_feedback/admin_review。**三步幂等模式**部署（v1.4 safe convergence）|
| `resolution_width` | 059 | INT NULL | 实测视频宽度（像素）|
| `resolution_height` | 059 | INT NULL | 实测视频高度（像素）；按 plan §2.8 应用层映射规则解析为 `quality_detected` |
| `detected_at` | 059 | TIMESTAMPTZ NULL | 实测时间 |

**`crawler_sites` 新增字段：**

| 字段 | Migration | 类型 | 说明 |
|---|---|---|---|
| `user_label` | 057 | TEXT NULL | 面向前端用户的线路别名（"主线"/"超清线"/"备用线"）。前端 fallback 链：`user_label ?? display_name ?? key`（plan §1 D-11）|

**`source_health_events` 扩展（继承 037 既有表）：**

| 字段 | Migration | 类型 | 说明 |
|---|---|---|---|
| `source_id` | 058 | UUID NULL FK `video_sources(id)` ON DELETE CASCADE | 关联单条线路；存量行 NULL 兼容；新行由 worker / feedback 写入；partial index `WHERE source_id IS NOT NULL` |
| `error_detail` | 058 | TEXT NULL | 错误细节文案（HTTP 状态码 / 错误类型 / manifest parse 失败原因）|
| `http_code` | 058 | INT NULL | HTTP 响应码 |
| `latency_ms` | 058 | INT NULL | 响应延迟毫秒 |
| `processed_at` | 058a | TIMESTAMPTZ NULL | feedback-driven recheck queue 消费标记；NULL = 未处理；非 NULL = worker 已入队（CHG-SN-4-05 §1.4）。partial index `WHERE processed_at IS NULL AND origin = 'feedback_driven'` 供 CHG-SN-4-06 worker 拉取待处理队列信号 |

注：037 既有 origin 列实际值为 `'island_detected' / 'auto_refetch_success' / 'auto_refetch_failed'`（无 CHECK 约束）；M-SN-4 worker 新增写入 `'scheduled_probe' / 'render_check' / 'manual_recheck' / 'feedback_driven' / 'circuit_breaker'`，无需 schema 迁移即可兼容。types 见 `SourceHealthEventOriginLegacy ∪ SourceHealthEventOriginWorker` union。

**058a 前置 patch（CHG-SN-4-05，本卡内落地）：** `apps/api/src/db/migrations/058a_source_health_events_processed_at.sql`；runner 字典序 `058 < 058a < 059` 保证部署顺序正确；ApiResponse 信封沿用 api-rules.md 现行 `{ data }` / `{ data, pagination }` / `{ error: { code, message, status } }` 三形态。详细信封 / ErrorCode 真源归属决策见 `docs/decisions.md` ADR-110（CHG-SN-4-05 完成后复评发现 `packages/types/src/api.types.ts` 已存在 `ApiResponse<T>` / `ApiListResponse<T>` / `ApiError` / `ErrorCode` 7 码 union；ADR-110 正式化"信封三形态 + ErrorCode 单一真源 packages/types + AppError 留 apps/api"决策；纠正本段历史"不引入包装类型"误述）。

**部署顺序（plan v1.4 §2.10）：** `scripts/migrate.ts:50–52` 字典序遍历 → 052 → 053 → … → 060。052 audit_log 占 M-SN-4 序列首位 = runner 字典序自动保证 audit 表先于其他写端点上线（v1.3 重排消除"优先 deploy 不可强制"硬伤）。

**应用层 / types 同步：** `apps/api/src/db/queries/videos.ts` `VideoStateTransitionAction` + 'staging_revert'（详见 §6）；`apps/server-next/src/lib/videos/types.ts` `StateTransitionAction` re-alias；`packages/types/src/admin-moderation.types.ts` 集中导出 `ReviewLabel / SourceHealthEvent / AdminAuditLog / VideoQueueRow / VideoSourceLine / StagingRow / DualSignalState / ResolutionTier / QualitySource / ReviewSource / ModerationErrorCode` 等（禁止 apps 内重复定义）。

---

## 6. 视频状态机（DB 强约束）

来源：Migration `023_enforce_video_state_machine_trigger.sql`（基线）→ `033` → `034` → `053`（M-SN-4 D-01 新增暂存退回）

合法状态三元组（`review_status`, `visibility_status`, `is_published`）：

- `pending_review`: `(internal,false)` 或 `(hidden,false)`
- `approved`: `(public,true)` 或 `(internal,false)` 或 `(hidden,false)`
- `rejected`: `(hidden,false)`

跃迁白名单（Migration 053 更新；含 M-SN-4 staging_revert）：

| 旧状态 | 允许跃迁至 |
|--------|-----------|
| `pending_review+internal` | `pending_review+hidden` / `approved+internal`（暂存）/ `approved+public`（直接上架）/ `rejected+hidden` |
| `pending_review+hidden` | `pending_review+internal` / `approved+internal`（暂存，034）/ `approved+hidden` / `approved+public` / `rejected+hidden` |
| `approved+public` | `approved+internal` / `approved+hidden` |
| `approved+internal` | `approved+public` / `approved+hidden` / **`pending_review+internal`**（053 新增：暂存退回审核）|
| `approved+hidden` | `approved+public` / `approved+internal` / **`pending_review+hidden`**（053 新增：暂存退回审核）|
| `rejected+hidden` | `pending_review+hidden` / `pending_review+internal` |

**053 新增**（M-SN-4 plan v1.4 §1 D-01）：
- `approved+internal+0` → `pending_review+internal+0`（暂存 internal 退回）
- `approved+hidden+0` → `pending_review+hidden+0`（暂存 hidden 退回）
- `approved+public+1`（已发布）**不允许**直接退回 — 必须先 `unpublish` 再 `staging_revert`，由 trigger 白名单兜底拒绝
- 应用层入口：`transitionVideoState({action: 'staging_revert'})`（apps/api `VideoStateTransitionAction` + apps/server-next `StateTransitionAction` re-alias 同步）

**053 同步收紧 `transitionVideoState 'reject'` 应用层守门：**
- v1.4 之前（033/034 时代）：`'reject'` 应用层允许 `review_status IN ('pending_review', 'approved')` 入参，但 trigger 白名单仅含 `pending → rejected_hidden`；approved 入参生产环境会被 trigger 拒绝（500/400 不友好）
- v1.4 053 收紧（与 D-01 同卡）：`'reject'` 应用层限制为仅 `pending_review` 入参；approved 视频撤回须经 `staging_revert → pending → reject` 两步流（D-01 设计意图）
- 三层守门一致：(1) `transitionVideoState` 应用层 INVALID_TRANSITION / (2) 端点层 batch-reject 已限制 pending / (3) DB trigger 白名单
- 回归测试：`tests/unit/db/migrations/053_state_machine_regression.test.ts` 含 `reject: approved+internal/hidden/public → INVALID_TRANSITION` 三个反向用例

附加硬约束：

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

`apps/web-next/src/app/robots.ts` 现状：

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

> **[DEPRECATED 2026-04-28]** `apps/web/` 已物理删除（M-SN-0 / R11 / C1），ADR-035 灰度切流阶段结束（web-next 直接保留名称未执行 M6-RENAME）。本节仅作 M5/M6 重写期历史参考，所有 `apps/web/...` 路径引用现实中已不存在；后续仍指向 web-next（已上线）。

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
| M3 | `/movie`、`/series`、`/anime`、`/tvshow`、`/others`（批 1）、`/watch`（批 2）| prefix（共 6 条，tvshow 替代 variety URL 段）|
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

---

## 16. apps/web-next 能力层（REGRESSION 阶段补齐，ADR-037）

> 本节记录 REGRESSION 序列（SEQ-20260420-REGRESSION-M1/M2/M3）在 apps/web-next 端补齐的三大能力层。参见 `docs/milestone_alignment_20260420.md` 的完整 19 条对齐表。

### 8.1 品牌与主题系统（方案 M1 → REG-M1-01/02）

**BrandProvider**（`apps/web-next/src/contexts/BrandProvider.tsx`）：

- SSR 安全双 Context：ThemeContext（data-theme 写入）+ BrandContext（slug/name/overrides）
- `useBrand()` / `useTheme()` / `useSetTheme()` Hook 供消费方调用
- `DEFAULT_BRAND_NAME = 'Resovo'` 统一品牌名称常量（`lib/brand-detection.ts`）
- layout 传入 `initialBrand`（从 cookie 读取），避免客户端首帧 flash

**middleware 品牌识别分层**（`apps/web-next/src/middleware.ts`，ADR-039）：

- Edge runtime：读取 `resovo-brand` / `resovo-theme` cookie → 注入 `x-resovo-brand` / `x-resovo-theme` 请求头
- `parseBrandSlug()` / `parseTheme()` 为纯函数，可在 server component / layout 中直接调用
- brand/theme 识别与 next-intl 国际化 middleware 分离（先品牌→后 next-intl）

### 8.2 全局骨架 + Primitives（方案 M2 → REG-M2-01～06）

**Root layout 四件套**（`apps/web-next/src/app/[locale]/layout.tsx`，ADR-040）：

```
BrandProvider
  └── Nav（顶部导航，消费 useBrand）
  └── main#main-content.main-slot（页面内容槽）
  └── div#global-player-host-portal（播放器宿主 Portal，pointer-events: none）
  └── GlobalPlayerHost（dynamic ssr:false）
  └── RoutePlayerSync（路由 ↔ 播放器状态同步）
  └── Footer（底部，消费 useBrand）
```

**Primitives**（`apps/web-next/src/components/primitives/`）：

| Primitive | 文件 | 状态 |
|-----------|------|------|
| PageTransition | `page-transition/{PageTransition,PageTransitionController}.tsx` | ✅ 实装（View Transitions API 三态降级） |
| SharedElement | `shared-element/{SharedElement,registry}.tsx` | ⚠️ API 合约冻结，FLIP 数学 M5 实装 |
| RouteStack | `route-stack/RouteStack.tsx` | ⚠️ noop stub，M5 Tab Bar 实装 |
| LazyImage + BlurHash | `lazy-image/{LazyImage,BlurHashCanvas}.tsx` | ✅ IntersectionObserver + blurhash@2.x |
| ScrollRestoration | `scroll-restoration/ScrollRestoration.tsx` | ✅ sessionStorage 记忆 |
| PrefetchOnHover | `prefetch-on-hover/PrefetchOnHover.tsx` | ✅ hover 150ms + matchMedia 能力检测 |

**SafeImage + FallbackCover**（`apps/web-next/src/components/media/`，ADR-045）：

- SafeImage：四级降级链（真实图 → BlurHash 占位 → FallbackCover → CSS 渐变内嵌于 FallbackCover）
- FallbackCover：纯 CSS + 内联 SVG，颜色全部来自 CSS 变量，零硬编码
- image-loader：passthrough 实现，预留 Cloudflare Images URL 模板（env: NEXT_PUBLIC_IMAGE_LOADER=cloudflare）

### 8.3 GlobalPlayerHost 播放器系统（方案 M3 → REG-M3-01～04）

**状态机**（`apps/web-next/src/stores/playerStore.ts`，ADR-041）：

```
HostPlayerMode: 'closed' | 'full' | 'mini' | 'pip'

LEGAL_TRANSITIONS:
  closed → ['full']
  full   → ['closed', 'mini', 'pip']
  mini   → ['closed', 'full', 'pip']
  pip    → ['closed', 'full', 'mini']
```

- sessionStorage 持久化（key: `resovo:player-host:v1`）：mini/pip 跨路由保持；full 刷新降级为 closed
- `isHydrated` flag 防止 SSR 闪烁

**Portal 架构**（`apps/web-next/src/app/[locale]/_lib/player/`，ADR-041）：

```
layout.tsx
  └── #global-player-host-portal（position: fixed; z-index: 40; pointer-events: none）
        └── GlobalPlayerHost（createPortal，dynamic ssr:false）
              ├── hostMode=full  → GlobalPlayerFullFrame（PlayerShell portalMode）
              ├── hostMode=mini  → MiniPlayer（固定右下，FLIP CSS transition）
              └── hostMode=pip   → PipSlot（空容器，浏览器 PiP 窗口控制画面）
```

**路由切换语义**（ADR-042）：

- `RoutePlayerSync`：usePathname 监听，离开 /watch 且 hostMode=full → setHostMode('mini')
- `/watch/[slug]` 页：WatchPageClient（thin client）+ useWatchSlugSync（slug mismatch 检测）+ ConfirmReplaceDialog
- PlayerShell 新增 `slug?` + `portalMode?` prop，支持 Portal 内渲染与传统页面级渲染两种模式

**pip 封装**（`apps/web-next/src/app/[locale]/_lib/player/pip.ts`）：

- `isPipSupported()` / `requestPip(videoEl)` / `exitPip()` / `onPipLeave(videoEl, onClose)` 四 API
- leavepictureinpicture 事件通过 onPipLeave 回调桥接 → 自动切回 mini/full 态

## 17. Design Tokens v2（HANDOFF-01，2026-04-22）

`packages/design-tokens/` 新增以下 token（约 30 个新 CSS 变量，零破坏性改动）：

### 新增语义 token

| 文件 | 新增内容 | CSS 变量前缀 |
|------|----------|-------------|
| `semantic/tag.ts` | 5 种类型 chip × 2 主题（movie/series/anime/tvshow/doc）| `--tag-chip-*-bg/fg` |
| `semantic/pattern.ts`（新建）| dots/grid/noise 背景图案 × 2 主题 | `--pattern-*` |
| `semantic/route-transition.ts`（新建）| PC 路由切换 fade/slide/shared/reduced 参数 | `--route-transition-*` |

### 新增 primitive token

| 文件 | 新增字段 | 说明 |
|------|----------|------|
| `primitives/shadow.ts` | `cardHover` | 卡片 hover 升高阴影，避免消费端用 xl 过重 |
| `primitives/motion.ts` | `duration.fade/push/snap/shimmer` | 动效语义别名（不改变已有键值） |

### 扩展组件 token

- `components/player.ts` — `mini` 子节点新增 13 个字段：几何（width/height/minWidth/maxWidth/aspectRatio/dockX/dockY/snapThreshold）+ 交互（dragHandleHeight/closeButtonSize/resizeHandleSize/transitionIn/transitionOut）；同步调整 radius `md→lg`、shadow `lg→xl`
- CSS 变量前缀：`--player-mini-*`（主题无关，写入 `:root`）

### build-css.ts 变更

- 新增 `buildThemeIndependentVars()`：将 `routeTransition` 和 `player` 组件 token 扁平化写入 `:root`（主题无关）
- `buildSemanticVars()` 扩展：新增 `tag` 和 `pattern` 的 light/dark 生成
- 所有已有变量值不变（tokens.css diff 只含新增）

---

## 17a. Token 4+1 层结构（CHG-SN-1-03，2026-04-28，对齐 ADR-102）

CHG-SN-1-03 摸现状发现 `packages/design-tokens` 已是 4 层成熟系统（primitives / semantic / components / brands）。ADR-102 原"3 层（base/semantic/admin-layout）"措辞修订为"在现有 4 层基础上新增 admin-layout 层"。详见 ADR-102 修订记录段。

### 4+1 层结构

| 层 | 角色 | 共享范围 | 由谁支撑 | 本卡变更 |
|---|---|---|---|---|
| **primitives/** | 原子 token（color / typography / space / radius / shadow / motion / z-index / size） | web-next + server-next 共享 | ADR-022/023/032 | 无 |
| **semantic/** | 语义 token（state / tag / surface / border / route-stack / stack 等 18 文件） | web-next + server-next 共享 | ADR-022 | 新增 `dual-signal.ts`（probe/render，admin 主用） |
| **admin-layout/** *(新增顶层目录)* | admin 专属布局变量（shell / table / density） | server-next 专属（前台 0 消费） | ADR-102 | 全新增（3 子文件 + index.ts） |
| **components/** | 组件级 token（table / modal / input / player / button / card / tooltip / tabs 等 8 文件） | web-next + server-next 共享 | ADR-022 隐式容纳 | 无 |
| **brands/** | 多品牌 token（default + _validate / _patch / _resolve） | web-next + server-next 共享 | ADR-038/039 | 无 |

### 设计稿 v2.1 → packages/design-tokens 映射表

设计稿源：`docs/designs/backend_design_v2.1/styles/tokens.css`

| v2.1 字段 | 落点（CHG-SN-1-03 后） | 状态 |
|---|---|---|
| `:root` 基础调色（accent / accent-hover / accent-soft / accent-border） | `semantic/accent.ts`（已有，未改）| 现有 token 已等价表达 |
| `--ok / --warn / --danger / --info / --neutral` + soft 变体 | `semantic/state.ts`（已有，未改）+ `primitives/color.ts`（已有 success/warning/error/info） | 现有 token 已等价表达；admin 设计专属 hex 命名直接由 v2.1 css 注入（不污染前台） |
| `--probe / --render` + soft 变体 | **`semantic/dual-signal.ts`（本卡新增）** | ✅ 落地 |
| `--shadow-sm/md/lg` | `primitives/shadow.ts`（已有）| 现有 token 等价 |
| `--fs-*` / `--s-*` / `--r-*` | `primitives/typography.ts` / `space.ts` / `radius.ts`（已有）| 现有 token 等价 |
| `--sidebar-w / --sidebar-w-collapsed / --topbar-h` | **`admin-layout/shell.ts`（本卡新增）** | ✅ 落地 |
| `--row-h / --row-h-compact / --col-min-w` | **`admin-layout/table.ts`（本卡新增）** | ✅ 落地 |
| `--density-comfortable / --density-compact` | **`admin-layout/density.ts`（本卡新增，M-SN-1 占位）** | ✅ 落地 |
| `[data-theme="light"]` 主题覆盖 | dark-first 已是默认；light 在 base/semantic 现有覆盖机制中（未改）| 沿用现有 |

### 跨域消费禁令（dual-signal + admin-layout）

- **dual-signal token**（`--dual-signal-probe` / `--dual-signal-render` 及 soft）和 **admin-layout token**（`--sidebar-w` / `--topbar-h` / `--row-h` / `--col-min-w` / `--density-*`）—— apps/web-next 任何路由 0 消费
- 守卫：CHG-SN-1-07 落 ESLint `no-restricted-imports` + ts-morph CI 兜底脚本（plan §4.6 / ADR-100 架构约束）
- CHG-SN-1-03 验证：grep 全仓 `apps/web-next/src` 内 0 命中（已验）

### build pipeline 变更

- `build.ts` `buildSemanticVars()` 追加 `dual-signal` source；`buildLayoutVars()` 追加 admin-layout 三组扁平输出（与 layout 同模式）；`buildJs()` `buildDts()` 同步导出 `adminLayout: { adminShell, adminTable, adminDensity }`
- `scripts/build-css.ts` 同步：`buildSemanticVars()` 加 `dual-signal`；`buildThemeIndependentVars()` 末尾追加 admin-layout 三组
- `src/index.ts` 顶级导出新增 `./admin-layout/index.js`
- `src/semantic/index.ts` 追加 `dualSignal` 导出
- 现有变量值 0 改动；新增 8 个 admin-layout CSS 变量 + 8 个 dual-signal CSS 变量（light + dark 各 4）
