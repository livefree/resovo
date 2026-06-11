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
- **server-next**（后台，CUTOVER 2026-06-08 / CHG-CUTOVER-EXECUTE 起独占 `/admin`）：Next.js App Router（`apps/server-next/src/app`，无 `[locale]`）— 端口 3003
  - ~~server（旧后台 v1，`apps/server`，端口 3001）~~ — **已物理退役**（apps/server 删除，nginx /admin 切到 :3003；详见 ADR-101 / 下文 §3.3.1 仅存历史）
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

**已切换并退场（CHG-CUTOVER-EXECUTE，2026-06-08）**：nginx `/admin/*` 已指向 server-next:3003，`apps/server` 已物理删除（详见 ADR-101；改名 `apps/server-next → apps/admin` 留后续卡 CHG-CUTOVER-RENAME-ADMIN）。下文 §3.3.1 apps/server v1 内容仅存历史。

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

#### 3.3.1 ~~apps/server v1（进程 server:3001）~~ — 已退役（CHG-CUTOVER-EXECUTE 2026-06-08，apps/server 物理删除；以下仅存历史参考）

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
- `bangumi_status`：`pending | matched | candidate | unmatched`（Migration 082 / ADR-170，BangumiService 写入；非 anime 恒 pending，镜像 douban_status）
- `source_check_status`：`pending | ok | partial | all_dead`（Migration 032，源活性批量检验结果）
- `meta_score`：`SMALLINT 0-100`（Migration 032，元数据完整度评分）
- `episode_count`：`INT NOT NULL DEFAULT 1`（Migration 001 / 爬虫推算）— **三层集数语义的第 1 层**："已收录最大集数"（`videos.crawler.ts:248` 通过 `GREATEST(episode_count, $2)` 单向递增写入；近似 *activeEpisodes* 语义 / 详 ADR-163 §3 D-163-2 命名保留依据 + §11 advisory）
- `total_episodes`：`INT NULL`（Migration 078，ADR-163 / CHG-367-B-A）— **第 2 层**：作品总集数（外部 metadata 真源 / NULL=未取到或电影类型 / 完结后定值 / 连载中可能 NULL 或预告值 / D-163-3 NULL 语义）。CHECK `total_episodes IS NULL OR total_episodes > 0`（正整数）；部分索引 `idx_videos_total_episodes WHERE total_episodes IS NOT NULL`。
- `current_episodes`：`INT NULL`（Migration 078，ADR-163 / CHG-367-B-A）— **第 3 层**：当前已播集数（外部 metadata 真源 / NULL=未取到 / 连载中持续更新 / 完结后等于 total_episodes 或外部源独立提供）。CHECK 正整数（同 total_episodes）。
  - **已 ship 写入路径（auto / CHG-367-B-A）**：MetadataEnrichService step2 网络豆瓣 + step3 bangumi 自动 enrich，按 `catalog.status` 派发（completed→total / 其他→current）/ `updateVideoEpisodes(auto)` COALESCE 仅写 NULL 字段 + WHERE 守卫保证 no-op 不触 updated_at。step1 本地豆瓣 dump 无 episodes 字段不写入（ADR-163 §11 A3 advisory）。
  - **已 ship 写入路径（manual / CHG-367-B-B）**：DoubanService.confirmSubject / confirmFields 走 `updateVideoEpisodes(manual)` 同时覆盖 `total_episodes` + `current_episodes` 为同一 detail.episodes 值（ADR-163 D-163-6 manual 优先级最高 / Y2 confirmFields fields 扩 `'episodes'` 合法键）。本地 dump 路径无 episodes 真源（A3 advisory / proposedEpisodes=null 时跳过）。
  - **已 ship 显示规约（CHG-367-B-B）**：审核台 TabDetail（`RightPane/TabDetail.tsx#formatEpisodesTriad`）三维显示 "已收 {episode_count} / 已播 {current_episodes} / 共 {total_episodes}"，按 NULL 状态降级；`currentEpisodes > totalEpisodes` 触发 Y1 防御（仅显示 current + 数据异常标记 / DB 层不强制 `total >= current` 不变式 / 外部源时序不一致可触发）；`type='movie'` 仅显示"已收"维度（电影无 total/current 语义）。
  - 不变量：admin-ui `LineAggregate.totalEpisodes`（行级 / "线路下 sources 行数"）与本 Video.totalEpisodes（视频实体级 / "作品共多少集"）**同名不同层级**，TypeScript 类型系统自然区分
- `country`：ISO 3166-1 alpha-2（'US' / 'CN' / 'JP' / ...）；显示层经 `formatCountryName(code, locale)` 本地化（CHG-366 / plan §10.4.3 / `packages/types/src/format-country-name.ts`），admin-ui 提供 `<CountryName>` React 组件 wrapper（cell 原语）。`videos.country` 与 `media_catalog.country` 字段统一以 ISO code 存储；search query 也以 ISO code 检索（显示本地化不污染 URL 真源）。
- `meta_quality`：`JSONB NOT NULL DEFAULT '{}'`（Migration 077，CHG-365-A2 / plan §10.4.1）。三处写入路径——MetadataEnrichService（auto enrich）+ DoubanService.confirmSubject/confirmFields（manual confirm）+ moderation.douban-ignore route（manual ignore）——共同维护"信号字典"，字段约定 `title_en_is_pinyin / douban_confidence / douban_match_method (imdb_id|title|alias|network|manual|manual_fields) / douban_match_status (auto_matched|candidate|manual_confirmed|unmatched) / enriched_at`，详 `packages/types/src/video.types.ts#VideoMetaQuality`；手动路径通过 `buildManualMetaQuality` helper merge 旧值保留 `title_en_is_pinyin` 等 enrich 信号（Codex stop-time review #8 防 stale 回归）；部分索引 `idx_videos_meta_quality_pinyin` 加速审核台"疑似拼音"筛选。

注意：历史文档中的 `blocked` 状态已不在当前 schema 中。

### 5.1a media_catalog（作品元数据层）

Migration 026 建表，Migration 042（META-06）新增 6 个扩展字段：

核心字段：
- `title` / `title_en` / `title_original` / `title_normalized`：标题四形态。
  - `title`：原始标题，**保留标点空格**（展示 + 前台搜索 `videos.title ILIKE`）。
  - `title_normalized`：**归并去重键**。**ADR-174（2026-06-01）起改为剥标点**（`normalizeMergeKey` = `stripExternalMatchPunct(normalizeTitle)`，剥 `\p{P}/\p{S}`），与外部源匹配键 `normalizeForExternalMatch` 对齐 —— 使「当前，正被打扰中！」与「当前正被打扰中」归并同一作品，根治同番裂多 catalog 行→抢绑同一 Bangumi subject 撞 `bangumi_subject_id` 唯一约束。**语义变更**（列 DDL 不变，内容契约从「保留标点」变「剥标点」）；存量 3124 行由 migration 084 + `scripts/backfill-merge-key.ts` 重算 + `scripts/dedup-catalog-084.ts` 合并 52 冗余行（删行前快照至 `_bak_*_084` 系列表，R4 可回滚）。写入入口统一 `normalizeMergeKey`（CrawlerService / VideoService / VideoMergesService / BangumiSeedService / buildMatchKey）。注意：`normalizeTitle`（保留标点）仍供 CrawlerRefetchService 相似度计算；dump 表 `external_data.*.title_normalized` 是独立基准（`[^\p{L}\p{N}]`），不受本变更影响。
- `type`：作品类型（与 videos.type 一致）
- `genres TEXT[]` / `genres_raw TEXT[]`：平台题材 / 原始题材
- `year INT` / `release_date TEXT`：年份与首播/上映日期
- `country TEXT` / `runtime_minutes INT`：国家地区 / 片长（分钟）
- `status TEXT`：作品完成状态
- `description TEXT` / `cover_url TEXT` / `rating NUMERIC` / `rating_votes INT`：简介/封面/评分/评分人数
- `director TEXT[]` / `cast TEXT[]` / `writers TEXT[]`：导演/演员/编剧（字符串数组）
- `imdb_id TEXT` / `tmdb_id INT` / `douban_id TEXT` / `bangumi_subject_id INT`：外部 ID
  - `bangumi_subject_id`：UNIQUE（`media_catalog_bangumi_subject_id_key`）。富集写入前经 `MediaCatalogService.resolveBangumiBinding` **运行时去重**（ADR-174 D-174-3）：subject 已被他 catalog 占用且 type 同 + year 差 <2 → `safe redirect`，把当前 video 重指向 existing catalog（改写 `videos.catalog_id`）写同值不撞唯一约束；不安全 → `conflict` 降级记 candidate 不写绑定、不炸事务（保留 unmatched，靠 Bull 重试收敛）。**运行时改 `videos.catalog_id` 后，下游所有以 catalogId 为输入的步骤（`MetadataEnrichService.step5MetaScore` 算分）必须改用 `effectiveCatalogId`**（D-174-7 / 红线 R13），防对 orphan catalog 算分。`douban/imdb/tmdb` 同构去重为 follow-up（沉淀通用原语 `linkExternalIdOrRedirect`）。
- `metadata_source TEXT`：元数据最近写入来源（manual/tmdb/bangumi/douban/crawler）
- `locked_fields TEXT[]`：已锁定字段列表（手动确认后不被自动覆盖）

CHG-VIR-11-C 新增字段（Migration 089 / ADR-175 D-175-1）：
- `original_language TEXT NULL`：`title_original` 的语种（BCP47 subtag：`ja`/`ko`/`zh-Hans`/`en`；NULL=未知）

CHG-VIR-12-B 新增字段（Migration 090 / ADR-176 D-176-2）：
- `season_number INT NULL`：正篇季号（1/2/…；NULL=非分季/单季/电影/特别篇；CHECK>0，详见下方 ADR-176 小节）

META-06 新增字段：
- `aliases TEXT[]`：别名/又名列表（**ADR-175 D-175-5 起降级只读缓存**，结构化真源 = `media_catalog_aliases` 表）
- `languages TEXT[]`：语言列表
- `official_site TEXT`：官网 URL
- `tags TEXT[]`：标签列表
- `backdrop_url TEXT`：横幅/背景图 URL
- `trailer_url TEXT`：预告片 URL

**ADR-175 多语种标题模型（schema 已落地 Migration 089 / CHG-VIR-11-C 2026-06-03）**

- **`media_catalog.original_language TEXT NULL`**（D-175-1 / **Migration 089 已落地**）：原语种 BCP47 subtag（`ja`/`ko`/`zh-Hans`/`en`；NULL=未知）标注 `title_original` 语种；已纳入 `CatalogUpdateData`（safeUpdate 三重保护自动覆盖）。首批回填（`scripts/catalog-multilingual-cleanup.ts --step=original-language`，确定性保守推断：假名→ja / 谚文→ko / 纯 ASCII 非拼音→en / 汉字按 country 映射）：ja=85 / en=14 / zh-Hans=5，置信不足留 NULL。
- **`title_en` 收紧为仅真英文**（D-175-1/R5）：拼音/罗马音迁出 `media_catalog_aliases`（`kind='romanization'` / `lang='zh'` / `script='Latn'`）。**迁出已执行**（2026-06-03 / 2551 条；catalog 层独立双判定 `isPinyin` + `isConcatenatedPinyin`〔连写 slug 形态，CHG-VIR-11-C 新增〕，**不复用 video 层 `title_en_is_pinyin`**〔红线-2 层级独立〕）；残留 712 条保守未迁（含数字 slug 364 + 阈值未达 348，宁漏勿错，follow-up）。alias 行保存原值 = 迁出可逆。
- **`media_catalog_aliases` 结构化升级**（D-175-2 / **Migration 089 已落地**）：新增 `region`（ISO 3166-1）/ `script`（ISO 15924 `Hans`/`Hant`/`Jpan`/`Latn`/`Kore`，**简繁区分不归一**）/ `kind`（`official`/`localized`/`romanization`/`abbreviation`/`aka`/`original`，代码常量真源 = `db/queries/catalogAliases.ts` `ALIAS_KINDS`）/ `confidence NUMERIC(4,2)` / `is_primary_for_locale BOOLEAN NOT NULL DEFAULT false`；partial unique `uq_catalog_aliases_primary_locale`（每 locale 至多一首选）。表为别名结构化**单一真源**（R3），写入经 `upsertStructuredCatalogAlias`（ON CONFLICT 升级结构化列 / 不覆盖 manual / 不降 confidence）；`aliases[]` 数组列降级只读缓存（D-175-5，存量→表迁移脚本已就绪，当前库数组列空 = no-op）。
- **display_title locale fallback（确定性 / D-175-3，消费方接入留 follow-up）**：requested locale primary alias → same language other region alias → `title` → `title_original` → `title_en` → raw observed title；同 locale 多候选按 `is_primary_for_locale DESC, confidence DESC NULLS LAST, source 优先级（复用 CATALOG_SOURCE_PRIORITY）, created_at ASC`。简繁**不字形归一**（不 OpenCC），仅选既有别名。`is_primary_for_locale` 选举遵 Y-175-2：先回填 lang/script/region 维度再选举（当前未选举）。
- **匹配分层**（对接 ADR-105a alias blocking key，接入留 follow-up）：同 `(lang,script)` 归一别名等值 = 强；跨语种 alias 桥接 = 中正；`romanization` 仅辅助、不单独构成强证据。

**ADR-176 catalog 按季粒度（schema 已落地 Migration 090 / CHG-VIR-12-B 2026-06-03）**

> 当前现状：`season_number` 列 + 唯一键改造 + `catalog_relations` 表已落地（Migration 090）；`media_catalog` 仍**无 `deleted_at`**（删行回滚范式为契约，实施 = catalog-catalog 合并卡 CHG-VIR-12-F）。真源详见 `docs/decisions.md` ADR-176 + AMENDMENT（2026-06-03 / D-176-7~10）。

- **`media_catalog.season_number INT NULL`**（D-176-2 / **Migration 090 已落地**）：正篇季号 1/2/…；NULL=非分季/单季/电影/特别篇；`CHECK >0`（`ck_media_catalog_season_number_positive`——唯一键哨兵 0 的正确性依赖此约束，**禁放宽 `>=0`**）。已纳入 `CatalogUpdateData`（safeUpdate 三重保护自动覆盖；**`CatalogInsertData` 不扩** = findOrCreate 不纳入 season 匹配 D-176-7）。存量 3585 行全 NULL **不批量回填**（D-176-9：建立首个显式分季 catalog 时执行「系列归位」，半回填态扫描脚本 = 12-C 交付）。
- **唯一键改造已执行**（Migration 090）：`uq_catalog_title_year_type` → `uq_catalog_title_year_type_season`（`(title_normalized, year, type, COALESCE(season_number,0)) WHERE 四外部 ID 全 NULL`）。存量 NULL→槽位 0 **逐值等价旧键**（真实 DB 验证：NULL 双行阻断 / season=2 与 NULL 共存解阻塞 / 同季双行阻断 / 带外部 ID 行不受约束）；**不改 `normalizeTitle` 剥季语义**，季由显式列承载。
- **catalog 按季粒度**：正篇第 N 季 / 剧场版 / SP / OVA 各独立 catalog；SP/OVA/剧场版用 `catalog_relations` 关联正篇（不塞 `season_number`）。`edition`（加长/导剪）仍归 video 层、`language_variant`（国语/粤语/字幕）仍归 source 层，不受影响。
- **`catalog_relations` 表**（D-176-3 / **Migration 090 已落地** / catalog-catalog 关系**单一真源**有向图）：`from_catalog_id`/`to_catalog_id`/`relation`（`season_of`/`edition_of`/`remake_of`/`spinoff_of`/`same_work_candidate`）/`confidence`/`source`(auto/manual) + `UNIQUE(from,to,relation)` + `from≠to` CHECK + **`same_work_candidate` 有序对 CHECK**（`ck_catalog_relations_swc_ordered`：from<to 文本序，防 (A,B)/(B,A) 双行）+ `idx_catalog_relations_to` 反查 + ON DELETE CASCADE。反对称四 relation 单向 + `season_of`/`edition_of` DAG 为**跨行不变量**，应用层守卫随首个写入卡（12-F）实装。**`series_group` 不建表**（D-176-8：`season_of`/`edition_of` 连通分量动态派生；锚 = DAG 入度 0 正篇节点，多锚歧义报告不猜测）。当前**零写入方**（写路径 = 12-F / 上卷 job）。
- **catalog 删行回滚范式**（`media_catalog` 无 `deleted_at`，删行不可逆 / 实施 = 12-F 运维脚本，**不起 admin 端点** D-176-10）：catalog-catalog 合并删行前全字段快照到 `_bak_*_<migration>`（继承 migration 084 / ADR-174 D-174-6），主表 + CASCADE 子表（catalog_episodes/characters）+ 孙表（catalog_character_actors）+ `catalog_relations`（端点命中被删 catalog 须**重指向 survivor** + old/new 双列快照回滚复位，类比 084 videos 指向）+ `catalog_external_refs` + provenance/locks + `videos.catalog_id` 指向全快照；provenance/locks 类子表**只插不删**（来源不可精确区分、信息论不可逆 / R11/R12 继承）。

### 5.2 video_sources

- `season_number INT NOT NULL DEFAULT 1`
- `episode_number INT NOT NULL DEFAULT 1`（Migration 014 已将 NULL 统一回填为 1）
- `source_site_key VARCHAR(100) NULL`：行级源站 key（Migration 046，CHG-414）。爬虫写入时记录当前源站；JOIN 路径优先用此字段，NULL 时 fallback 到 `videos.site_key`，支持同一视频聚合多个源站线路时精确显示各自名称。
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`：admin 写路径乐观锁版本字段（Migration 061，CHG-SN-5-PRE-01-C / DEBT-SN-4-05-A）。
  - 写路径：`toggleVideoSource`（tx + SELECT FOR UPDATE + 比对 expectedUpdatedAt + STATE_CONFLICT 409 REVIEW_RACE）/ `disableDeadSources` 批量。两条路径都显式 `SET updated_at = NOW()`。
  - 不触发：probe 后台路径（SourceHealthWorker）继续只写 `last_checked` / `probe_status` / `latency_ms` 等信号列；与 admin 写路径解耦，避免 probe 异步抢占 ETag 导致乐观锁误报。
  - 路由契约：`PATCH /admin/videos/:id/sources/:sourceId` 接受可选 `expectedUpdatedAt`（ISO 8601）。
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
  - 关键字段：`bangumi_id`（UNIQUE）、`title_cn`、`title_jp`、`title_normalized`、`air_date`、`year`、`rating`、`episode_count`、`cover_url`
  - ADR-161 / Migration 077 扩展：`rank INT`（评分排名，seed 反向建库过滤用）、`nsfw BOOLEAN`（成人内容标记，seed 默认跳过）
  - 索引：`(title_normalized, year)` — Step3 动画匹配用；`rank` — seed 过滤用
  - 导入脚本：`scripts/import-bangumi-dump.ts`（ON CONFLICT DO UPDATE，幂等；CHG-BNG-02 起回填 rank/nsfw。archive subject dump 无 eps/images → episode_count/cover_url 由 REST API getSubject 在匹配时写入 media_catalog/videos）
- `external_data.douban_collection_items`（Migration 099 / ADR-187）：豆瓣 subject_collection **实时热度榜单切片**（16 合集：热门/热映/即将上映/Top250/口碑榜/分国别，电影 5 / 剧集 8 / 综艺 3，来源 `m.douban.com/rexxar/api/v2/subject_collection/{key}/items`）
  - 关键字段：`collection`、`domain`(movie|tv|show，注册表派生权威)、`category`(trending|ranking|upcoming)、`douban_id`、`rank`(分页拉取序位非评分，随全量替换重算)、`title`、`original_title`、`card_subtitle`、`info`、`year`、`rating_value`、`rating_count`、`cover_url`、`uri`、`release_date`、`subject_type`、`has_linewatch`、`raw JSONB`(整条 item 原始 JSON 已 strip comments)、`fetched_at`
  - 索引：`UNIQUE(collection, douban_id)`（同 douban_id 跨多合集合法）、`(collection, rank)`（合集内展示）、`(douban_id)`（与 douban_entries 关联/反查所属榜）
  - **不按站内映射过滤全量采集**（D-187-1）；与 `douban_entries` 并存、**零反哺**、经 `douban_id` 关联（D-187-6 INV-3）。抓取 job = maintenanceQueue `refresh-douban-collections`（分页全量 → 同事务全量替换）
- `external_data.douban_collection_sync_state`（Migration 099 / ADR-187 M3）：合集级采集新鲜度状态
  - 字段：`collection`(PK)、`last_attempt_at`、`last_success_at`、`last_status`('ok'|'failed'|'empty_guard')、`last_error`、`item_count`
  - 消费方据 `last_success_at` 判数据陈旧；`empty_guard` = 抓取成功但 items 骤降被守护跳过替换（防 key 失效静默清空，D-187-4）
- `external_data.bangumi_collection_items`（Migration 101 / ADR-189 D-189-3）：Bangumi **派生近期新番/排行/每日放送切片**（无原生合集端点 → `GET /v0/subjects?sort=date`(近期)/`sort=rank`(排行) + `GET /calendar` 派生；D-189-2 AMENDMENT：keyword-free 用 browse 端点非 search〔search 必填 keyword〕；落库范式对齐 099 douban）
  - 关键字段：`collection`(bgm_trending|bgm_ranking|bgm_calendar_mon..sun)、`category`(trending|ranking|calendar)、`bangumi_id`、`rank`(榜单/分页序位，随全量替换重算)、`title`(主显示名 name_cn 回退 name)、`name_cn`、`year`、`rating NUMERIC(4,1)`、`air_weekday SMALLINT`(1-7，**仅 calendar 非空**)、`cover_url`、`raw JSONB`(原始 item 兜底)、`fetched_at`
  - 索引/约束：`UNIQUE(collection, bangumi_id)`、`(collection, rank)`、`(bangumi_id)`、`CHECK(category='calendar' OR air_weekday IS NULL)`
  - 落库 = `bangumiCollectionsWorker`（trending/ranking search 分页保守延时 ≥500ms 各自替换；calendar **一拉七写**原子：单次 `GET /calendar` 整体失败则 7 weekday 全不替换，D-189-2）；bangumi 专属抓取常量**不复用豆瓣**（Token API vs 页面反爬）；分表非并表（与 douban 字段差异 >50%，ADR-189 D-189-3 / arch H2）
- `external_data.bangumi_collection_sync_state`（Migration 101 / ADR-189 D-189-3）：Bangumi 合集级新鲜度状态
  - 字段：`collection`(PK)、`last_attempt_at`、`last_success_at`、`last_status`('ok'|'failed'|'empty_guard')、`last_error`、`item_count`
  - empty_guard：trending/ranking per-collection 骤降守护（同豆瓣）；calendar 守护落「7 天总量」聚合基线（避免冷档单 weekday 波动误判，D-189-2）
- `external_data.external_fetch_log`（Migration 100 / ADR-188 D-188-3）：**provider 无关采集操作流水**（外部资源治理框架观测基石，豆瓣首接入）
  - 字段：`provider`(ProviderKey)、`operation`(detail|search|collection|comments|schedule|celebrity 内容类型)、`method`(offline|scrape|api = ACQUISITION_METHODS)、`status`(ok|fail|timeout)、`source`(enrich_worker|collections_worker|admin_search 触发方)、`target`(query/douban_id/collection key)、`item_count`、`duration_ms`、`error`、`created_at`
  - 索引：`(provider, created_at DESC)`（时间窗扫描）、`(provider, operation, created_at DESC)`（内容类型聚合/过滤）
  - **在线出口埋点**每次真实外部 HTTP 抓取记一行（doubanAdapter 3 函数 + lib/douban searchDouban，D-188-4）；**offline 本地 dump 召回不入表**（非外部 fetch，富集离线/在线分布另由 `video_external_refs.match_method` 聚合，D-188-3）；method scrape/api 属 `external.types.sourceFreshness` 的 online 细分（不回改既有类型，术语桥接）；30 天 purge 挂 maintenanceWorker（D-188-7，本期不建日级 rollup）。registry 真源 = `packages/types` `EXTERNAL_PROVIDERS`（D-188-2，apps/api + apps/server-next 同源消费）

注意：`external_*_raw` 表（Migration 027）用于构建 `media_catalog`，是导入暂存表，不用于运行时查询。

### 5.6 内外部关联表

- `video_external_refs`：记录内部视频与外部条目的匹配关系（Migration 041，META-03）
  - 关键字段：`video_id FK`、`provider`（douban/tmdb/bangumi/imdb）、`external_id`、`match_status`（auto_matched/manual_confirmed/candidate/rejected）、`confidence NUMERIC(4,2)`、`is_primary BOOLEAN`
  - 约束：`(video_id, provider)` 上的唯一部分索引（WHERE is_primary=true）—— 每视频每 provider 最多一个 primary 绑定
  - 查询函数：`upsertVideoExternalRef()` / `findPrimaryVideoExternalRef()`（`apps/api/src/db/queries/externalData.ts`）

**`catalog_external_refs`（schema 已落地 Migration 091 / CHG-VIR-12-B 2026-06-03）— catalog 级 canonical 外部身份映射真源**

> 当前现状：表 + 2 partial unique + 2 索引已落地（Migration 091，真实 DB 验证 7 项约束）；**表当前空**——既有四列数据迁移 = 12-C、写路径/R10 守卫 = 12-D、上卷 job + findOrCreate 旁路对照 = 12-E。过渡期 catalog 外部身份命中仍读 `media_catalog` 四列（cache，行为逐值不变 D-177-14）。真源详见 `docs/decisions.md` ADR-177 + AMENDMENT（2026-06-03 / D-177-11~14）+ 关系定档 `docs/designs/adr177-external-refs-relation_20260602.md`。

- **字段**：`catalog_id FK→media_catalog ON DELETE CASCADE` / `provider`(imdb/tmdb/douban/bangumi) / `external_id TEXT`（统一文本，tmdb/bangumi 数值转存）/ `external_kind`(show/season/movie/subject；**provider 映射 D-177-11**：bangumi/douban→`subject`〔豆瓣按季分条目精确级〕、imdb/tmdb 剧集→`show` 电影→`movie` 季→`season`) / `relation`(exact/parent/candidate/rejected) / `season_number INT`(NULL/CHECK>0，复用 ADR-176 哨兵口径) / `confidence` / `source`(auto/manual) / `is_primary` / `rollup_rule`（上卷派生溯源 YY-B）/ 审计列。
- **约束分级（partial unique，非全局 composite）**：① `exact` 全局唯一 `(provider,external_id,external_kind) WHERE relation='exact'`（精确实体↔catalog 一对一）；② 同 catalog 不重复挂同一关系 `(catalog_id,provider,external_id,external_kind,relation,COALESCE(season_number,0)) WHERE relation IN ('exact','parent')`；③ `candidate`/`rejected` **不进任一唯一约束**（保留审计历史，无需 `decision_id`）。哨兵 `COALESCE(...,0)` 与 ADR-176 唯一键口径统一（依赖 `CHECK season_number>0`）。
- **`external_kind` / `relation` 不变量（ADR-177 R10 / 上卷·写入路径校验）**：同 `(provider,external_id)` 的 `external_kind` 全局一致；`external_kind` 单调决定 relation 取值域（`show` 级 → 只可 `parent`；`season`/`movie`/`subject` 精确级 → 只可 `exact`），同一 `(provider,external_id,external_kind)` 不同时存在 `exact` 与 `parent`（findOrCreate 改读分流无歧义）。合并删行重指向 `exact` ref 须按索引① 预检去重（ON CONFLICT 单目标无法同覆盖①②）。
- **与 `video_external_refs` 关系 = 并存 + 上卷**（CHG-VIR-PRE-2 定档）：`video_external_refs` 保留 **video 实例级**真源不改（4 富集 Service 写入 + 后台审核台 `ExternalRefSummary` 只读展示链）；`catalog_external_refs` 承载 **catalog 作品级** canonical 身份，由确定性上卷桥接（多 video `is_primary AND manual_confirmed` 一致 + 精确级 → `exact`；auto/冲突 → `candidate`；show 级共享 ID → `parent` 一对多；exact 冲突 → `candidate` 归并信号，不靠唯一索引兜底）。
- **`media_catalog` 四列降级为 cache**：仅缓存 `relation='exact' AND is_primary=true` 的 ref；`parent`/`candidate`/`rejected` **不回填** cache 列（避免一对多污染单值唯一列，如 `bangumi_subject_id` UNIQUE）。`findOrCreate` 优先读 `catalog_external_refs`，cache 作读优化 fallback。
- **D-174-3 迁移**：catalog 层外部 ID 冲突（现降级记 `video_external_refs` candidate / 语义错位）→ 收敛归 `catalog_external_refs candidate`（过渡期双写，candidate `catalog_id` 归属按 D-174-7 redirect 两分支定 / 不写 orphan）。
- **删行回滚**：作为 `media_catalog` CASCADE 子表，纳入 ADR-176 D-176-4 `_bak_*_<migration>` 删行全字段快照 + 端点重指向 survivor + old/new 双列快照回滚复位范式。

### 5.6a 逐集元数据表 catalog_episodes（ADR-161 / Migration 077）

- `catalog_episodes`：作品逐集元数据（动漫逐集放送信息，来源 Bangumi `/v0/episodes`）
  - 关键字段：`catalog_id FK → media_catalog(id) ON DELETE CASCADE`、`source TEXT`（默认 'bangumi'，预留扩源）、`external_episode_id`、`ep_type SMALLINT`（0 本篇/1 SP/2 OP/3 ED）、`sort NUMERIC`、`ep INT`、`name`、`name_cn`、`airdate DATE`、`duration_seconds`、`description`
  - 约束：`(catalog_id, source, external_episode_id)` UNIQUE（逐集 upsert 幂等键）
  - 索引：`(catalog_id, ep_type, sort)` — 按类型 + 顺序读取
  - 设计：按 `catalog_id` 而非 bangumi_id 归属（与 media_catalog 同源），附 `source` 列便于将来 TMDB 等写入
  - 写入：`BangumiService.matchAndEnrich` auto 命中后拉 `/v0/episodes` upsert

- `catalog_characters` + `catalog_character_actors`：作品角色阵容 + 配音(CV)（动漫角色↔声优 N:M，来源 Bangumi `/v0/subjects/:id/characters`；Migration 083 / ADR-161 AMENDMENT / META-19）
  - `catalog_characters` 关键字段：`catalog_id FK → media_catalog(id) ON DELETE CASCADE`、`source TEXT`（默认 'bangumi'）、`external_character_id`（Bangumi 角色 id，NOT NULL）、`name`、`relation`（主角/配角/客串/闲角，原文存不枚举化）、`char_type SMALLINT`、`sort INT`（展示顺序）、`image_url`、`summary`
  - `catalog_character_actors` 关键字段：`character_id FK → catalog_characters(id) ON DELETE CASCADE`、`external_actor_id`（Bangumi person id）、`name`、`image_url`、`sort`（同角色多 CV 序）
  - 约束：`catalog_characters (catalog_id, source, external_character_id)` UNIQUE；`catalog_character_actors (character_id, external_actor_id)` UNIQUE
  - 索引：`catalog_characters (catalog_id, sort)`；`catalog_character_actors (character_id, sort)`
  - 设计：两表 normalized（角色 N:M CV，实测 52 角色 14 个多 CV，扁平/JSONB 不宜）；按 `catalog_id + source` 归属同 catalog_episodes 范式
  - 写入：`BangumiService.gatherEnrichmentData` 拉 `/v0/subjects/:id/characters`（成功返数组含 `[]` / 失败返 `null`）→ `applyEnrichmentDb` 经 `replaceCatalogCharacters` **delete-by-catalog-then-insert 全量替换（事务内 / 仅 fetch 成功时，含成功返回空也清陈旧；失败跳过防瞬时故障误删）**；覆盖 auto + 人工 confirmMatch 两路径

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

### 5.10 首页模块化编排（HANDOFF-02，ADR-052 + ADR-181，Migration 050/051/094）

- `home_modules`：首页模块化编排，支持 banner/featured/top10/type_shortcuts/hot_movies/hot_series/hot_anime 七类 slot（Migration 050 原 4 类 + Migration 094 热门 shelf 3 类，ADR-181）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，`gen_random_uuid()` |
| slot | text | `'banner'｜'featured'｜'top10'｜'type_shortcuts'｜'hot_movies'｜'hot_series'｜'hot_anime'`（后三类 Migration 094，ADR-181：热门 shelf pinned 头部专用，自动候选不落本表） |
| brand_scope | text | `'all-brands'｜'brand-specific'` |
| brand_slug | text | `brand_scope='brand-specific'` 时必填 |
| ordering | int | 排序序号，升序展示 |
| content_ref_type | text | `'video'｜'external_url'｜'custom_html'｜'video_type'`，与 slot 联合 CHECK |
| content_ref_id | text | 引用目标 ID（视频 UUID / URL / VideoType 字符串） |
| title | jsonb | 多语言标题映射（locale→string），NOT NULL DEFAULT '{}'（Migration 093，ADR-052 AMENDMENT 2026-06-05；与 home_banners.title 同构；空时消费端降级到视频标题） |
| image_url | text | 运营横图 URL，可空（video 类型消费端回退 videos.cover_url；Migration 093） |
| start_at / end_at | timestamptz | 时间窗，`start_at < end_at` CHECK |
| enabled | boolean | 下线开关 |
| metadata | jsonb | 非关键运营展示数据，NOT NULL DEFAULT '{}'（title 覆盖用法已被 ADR-052 AMENDMENT 取代 → 一等列） |
| created_at / updated_at | timestamptz | updated_at 触发器维护 |

  - slot × content_ref_type 约束（DB CHECK 强制，详见 ADR-052 + ADR-181）：banner 允许 video/url/html；featured/top10 仅 video；type_shortcuts 仅 video_type；hot_movies/hot_series/hot_anime 仅 video（Migration 094；Service 层 `applyBusinessRules` compat 映射为第 3 处同源规则，扩值须同卡同步）
  - brand_scope 查询协议：`WHERE brand_scope = 'all-brands' OR brand_slug = $1`（与 home_banners 对齐）
  - 索引：`(slot, brand_scope, brand_slug, ordering) WHERE enabled`（前台主查）+ `(start_at, end_at) WHERE enabled`（时间窗）+ `(content_ref_type, content_ref_id)`（级联失效反查）
  - TS 类型：`HomeModule` / `HomeModuleSlot` / `HomeModuleContentRefType` / `HomeBrandScope` / `CreateHomeModuleInput` / `UpdateHomeModuleInput` / `ReorderHomeModuleItem`（`packages/types/src/home-module.types.ts`）
  - DB 查询：`listActiveHomeModules / listAdminHomeModules / findHomeModuleById / createHomeModule / updateHomeModule / deleteHomeModule / reorderHomeModules / listHomeModulesByContentRef`（`apps/api/src/db/queries/home-modules.ts`）

- `videos.trending_tag`（Migration 051）：人工运营榜单标签，枚举值 `'hot'｜'weekly_top'｜'editors_pick'｜'exclusive'`，NULL 表示未标记；加部分索引 `WHERE trending_tag IS NOT NULL`
  - TS 类型：`TrendingTag`（`packages/types/src/video.types.ts`），`Video.trendingTag: TrendingTag | null`
  - DB 查询：`setVideoTrendingTag / clearVideoTrendingTag / listVideosByTrendingTag`（`apps/api/src/db/queries/videos.ts`）

- `home_section_settings`（Migration 095，ADR-182 D-182-3）：Home Curation 区块设置（7 区块 seed 恒存在；不可删，section 退役走 ADR + migration）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键；audit target_id 锚点（section key 非 UUID，D-182-5.3） |
| section | text | UNIQUE，HomeSectionKey 7 值 CHECK（`'banner'｜'type_shortcuts'｜'featured'｜'top10'｜'hot_movies'｜'hot_series'｜'hot_anime'`；section ≠ slot——banner section 真源是 home_banners） |
| autofill_mode | text | `'manual_only'｜'manual_plus_autofill'｜'suggest_only'｜'full_auto'` CHECK |
| refresh_interval_minutes | int | NULL = 不自动重算；worker 调度消费（ADR-183），CHECK > 0 |
| display_count | int | 区块槽位数，CHECK > 0；空卡片占位 = max(0, display_count − pinned − auto) |
| allow_duplicates | boolean | 跨区块去重豁免 |
| pinned_limit | int | full_auto 区块 pinned 头部上限；NULL = 不限，CHECK > 0 |
| settings | jsonb | 非关键扩展项，NOT NULL DEFAULT '{}'（禁关键策略字段） |
| updated_at | timestamptz | 触发器维护 |

  - migration 095 同时扩 `admin_audit_log.target_kind` CHECK 15 → 16（+`home_section`）；`AdminAuditActionType` +4（`home_section.{settings_update,apply_autofill,reorder,refresh_candidates}`）
  - TS 类型：`HomeSectionKey` / `HomeAutofillMode` / `HomeSectionSettings` / `UpdateHomeSectionSettingsInput` / `HomeSectionSummary` + 常量 `HOME_SECTION_KEYS` / `HOME_AUTOFILL_MODES`（`packages/types/src/home-section.types.ts`）
  - DB 查询：`listHomeSectionSettings / findHomeSectionSettings / updateHomeSectionSettings / countPinnedBySection`（`apps/api/src/db/queries/home-section-settings.ts`）
  - 端点（ADR-182 **7/7 全量落地**）：`GET /admin/home/preview`（整页预览聚合，跳缓存；`draft=true` 草稿叠加消费 = ADR-182 #1 显式预留的 Phase 4 兑现〔CHG-HOME-DRAFT-PUBLISH-B〕——配置三键改读 home_config_drafts 覆盖层、自动候选/快照/趋势仍为实时数据，无草稿降级发布态，响应 `context.draft` additive 回显；公开 shelf 链路恒 draft=false）+ `GET /admin/home/sections` + `PATCH /admin/home/sections/:section/settings` + `GET /admin/home/sections/:section/autofill-candidates`（候选快照只读，D-182-4.4：未生成 → 200 空 + snapshotAt null；include_filtered 附 filterReason + gaps additive D-183-7.3；appliedAt 由当前 slot pinned 行派生（快照不可变不回写）；不透出跨区块占用——占用结果以 preview #1 聚合权威为准）+ `POST /admin/home/sections/:section/apply-autofill`（候选转 pinned，D-182-4.5：逐候选重校验可见性/可播放性 + 已 pinned 重复 → 整体 409 携失效 ids 全有或全无；banner 不直接写 home_banners → 422 指引编辑器；pinnedLimit 超限 422；audit `home_section.apply_autofill` 载荷含 moduleIds+origins+policyVersion）+ `POST /admin/home/sections/:section/reorder`（区块内排序门面 = 画布唯一排序路径：banner → `home_banners.sort_order` / 其余 → `home_modules.ordering`，直调 queries 不经资源级 Service 避免嵌套审计；audit `home_section.reorder` 载荷硬约束 D-182-4.6，home_modules 排序回溯须联合 `home_module.reorder` ∪ `home_section.reorder` 两 actionType 查询）+ `POST /admin/home/sections/:section/refresh-candidates`（见上重算调度块）（`apps/api/src/routes/admin/home.ts` → `HomeCurationService`；schemas/preview 聚合拆分 `home-curation.{schemas,preview,preview-cards}.ts`，file-size-budget 500 行硬限）
  - preview DTO：`HomePreview / HomePreviewSection / HomePreviewCard`（source 四态 pinned/auto/fallback/empty + 风险态 flags 7 值 + D-181-3 时间窗统一映射 + 跨区块去重聚合层唯一权威 D-183-6——去重纯函数单一实现 `apps/api/src/services/home-autofill/dedup.ts`；`HomePreviewSection.consumedSnapshotAt?` additive = hot_* 自动补位实际消费的快照时间，ADR-184 D-184-3.5）
  - **公开消费（ADR-184）**：`GET /home/shelf?section=hot_movies|hot_series|hot_anime`（公开零鉴权，`routes/home.ts` → `HomeService.shelf()` → `home-curation.shelf.ts` 投影模块）——合成单一实现复用 `buildHomePreview` 整页合成（「preview ≡ 公开页」结构保证），投影丢 empty / 阻断 flags（missing_image 警告级放行，前台 SafeImage 降级链承接）/ 非 video 卡 + 读时 `listVideoCardsByIds` 批量复核为最终权威（快照 filtered 仅入口筛选；复核丢弃不回填）。响应 `HomeShelfResponse { items: { video, rank, isPinned }[], snapshotAt, generatedAt }`。缓存 Redis TTL 60s，key `home:shelf:{section}:b:{brand|none}`，一次 miss 填同 brand 三键（隔离硬约束）；`buildHomeShelfCacheKey` 导出为 Phase 4 CACHE-INVALIDATE 唯一失效接口位。`fetchAutoFill` hot_* 快照接线（D-184-4）：候选 origin/score 入 explain（score 口径 = D-183-4 策略分 0–1），快照缺失/候选不足走 trending 兜底（source=fallback）；前台 ShelfRow 切换消费归 CHG-HOME-FE-CONSUME-B

- `home_autofill_snapshots`（Migration 096，ADR-183 D-183-2）：自动填充候选快照（worker 整份写入不可变，写后零 UPDATE；每 section 保留最近 10 份，写入+清理同事务；系统产物不计 admin audit）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| section | text | HomeSectionKey 7 值 CHECK（与 095 两处同源字面量，扩值须同卡同步两表） |
| generated_at | timestamptz | 即端点 #4 snapshotAt（与 #2 摘要同语义同源） |
| trigger | text | `'scheduled'｜'manual'` CHECK（定时 vs 端点 #7 手动） |
| policy_version | text | 策略代码版本（D-183-5，初值 `hp-v1`；语义变更必须递增） |
| settings_snapshot | jsonb | 重算时的 section settings 快照（审计回溯链） |
| candidates | jsonb | `AutofillCandidate[]`（D-182-4.4 DTO 同构，含 filtered 条目；JSONB 数组论证见 D-183-2——无行级 WHERE 需求不触犯 ADR-052 守则） |
| gaps | jsonb | `ContentGap[]` 缺口 top-N（D-183-7.3 独立 DTO 无 videoId） |
| created_at | timestamptz | — |

  - 索引：`(section, generated_at DESC)`（端点 #4 取最新快照的唯一查询路径）
  - TS 类型：`HomeAutofillSnapshot` / `AutofillCandidate` / `AutofillVideoSummary` / `ContentGap` / `AutofillCandidatesResult`（`packages/types/src/home-section.types.ts`）
  - DB 查询：`insertHomeAutofillSnapshot`（+同事务清理保留 10）/ `findLatestHomeAutofillSnapshot` / `listLatestSnapshotSummaries`（`apps/api/src/db/queries/home-autofill-snapshots.ts`）
  - 策略层：`apps/api/src/services/home-autofill/`（policy 权重定版 D-183-4 / score 排序 / filters 过滤链 6 reason / dedup 去重纯函数 + douban/bangumi/trending 候选源生成集成 + recalculate 重算编排）；候选源 queries：`home-autofill-douban.ts`（映射桥三源 UNION + videos.type 分池 D-183-1 + 缺口扫描窗）/ `home-autofill-bangumi.ts`（rank 主序 + nsfw SQL 硬过滤双路径）

- `home_publish_versions`（Migration 097，ADR-185 D-185-1.2）：首页发布版本快照（整页 JSONB roll-forward 不可变归档；不设保留上限 D-185-1.6——版本数 > 1000 或单行 > 1MB 时评估归档）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键；audit `home_page.*` 的 target_id 锚点（D-185-3.5） |
| version_no | serial | UNIQUE 单调递增（事务回滚可留空洞，单调性不受影响） |
| source | text | `'publish'｜'rollback'` CHECK（回滚 roll-forward 自记新版本） |
| note | text | 可空发布备注 |
| config | jsonb | 整页快照三键 `{ banners, modules, settings }`（`HomePageConfig` camelCase DTO 同构；时间戳 ms 截断保证 round-trip 文本稳定） |
| published_by | uuid | FK users RESTRICT |
| published_at | timestamptz | — |

  - migration 097 同时扩 `admin_audit_log.target_kind` CHECK 16 → 17（+`home_page`）；`AdminAuditActionType` +2（`home_page.{publish,rollback}`，action_type 列无 DB CHECK——D-182-5.2 既有裁定）
  - 冷启动语义（D-185-1.5）：空表 = 历史直写期配置即事实发布态；首次 publish 拍 version 1

- `home_config_drafts`（Migration 098，ADR-185 D-185-1.3）：首页配置草稿覆盖层（全局单行 UNIQUE(scope)，scope 恒 `'global'` 为多 brand 扩展位；保存/丢弃不计 admin audit D-185-3.1）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| scope | text | UNIQUE，首版恒 `'global'` |
| config | jsonb | 整页覆盖层三键（与版本快照同构 `HomePageConfig`；草稿新建行可缺 id/时间戳，publish 时生成） |
| base_version_no | int | 创建草稿时最新版本号（陈旧检测锚 D-185-2.2；冲突更新不重置——重锚须 DELETE 后重建；无 FK，失锚即读作陈旧） |
| created_by / updated_by | uuid | FK users RESTRICT |
| created_at / updated_at | timestamptz | updated_at 触发器维护（乐观锁 + 陈旧信号②比较基准） |

  - TS 类型：`HomePageConfig` / `HomeConfig{Banner,Module,SectionSettings}Entry` / `HomeConfigDraft` / `HomePublishVersion(Summary)` + 常量 `HOME_PUBLISH_SOURCES`（`packages/types/src/home-publish.types.ts`）
  - DB 查询：`findHomeConfigDraft / upsertHomeConfigDraft / deleteHomeConfigDraft / findLatestVersionNo / findTruthTablesMaxUpdatedAt / publishHomeConfig`（`apps/api/src/db/queries/home-publish.ts`；publishHomeConfig 单事务 = 草稿乐观锁删除（id+updated_at 双匹配，竞态 → null）→ 三表全量替换（banners/modules DELETE+INSERT 保留 id/created_at——audit 链与 appliedAt 派生依赖；settings 按 section UPDATE，seed 行不可删）→ 回读拍版本）
  - 端点（ADR-185 **#1–#7 全量落地**）：`GET/PUT/DELETE /admin/home/draft`（无草稿 200 data:null；GET 附顶层 additive `staleness`（`HomeDraftStaleness` 双信号——编辑器提示用途，权威判定仍在 publish 时点，CHG-HOME-DRAFT-PUBLISH-B）+ `include_base=true` → 顶层 additive `base` 携当前发布态整页（**服务端单快照装配** `readPublishedHomeConfig`，REPEATABLE READ 三表一致读——惰性建稿基线，-B-FIX2 取代客户端 OFFSET 分页：页间并发增删可计数吻合仍漏行，全量替换语义下缺行即删行）；PUT 整页整体替换，zod 整页校验 = 7 区块 settings 全覆盖 + slot×refType 094 CHECK 镜像 + brand 约束）+ `POST /admin/home/publish`（无草稿 422；陈旧双信号 409 = base_version_no 失配 ∨ 三表 max(updated_at) 晚于草稿——直写通道（ADR-104 资源级 12 端点真·紧急通道 / 门面 #3/#5/#6 非画布旁路）写入即触发；发布时整页重校验 = modules video 引用可见性/可播性，D-182-4.5 口径挪点，失效 → 409 携 ids；audit `home_page.publish` afterJsonb 轻量摘要 `{versionNo, baseVersionNo, sectionsChanged, counts}` D-185-4.1，sectionsChanged 剥离 createdAt/updatedAt 元数据防 ms 截断伪报）+ `GET /admin/home/versions`（轻量行分页不含 config，D-185-3.3）+ `GET /admin/home/versions/:versionNo`（详情全量 config = **消费端 diff 数据源**，D-185-4.2——服务端不存不算 diff）+ `POST /admin/home/versions/:versionNo/rollback`（恢复三表 + roll-forward 拍新版本 source='rollback' note 自动携 `rollback to v{n}` + audit `home_page.rollback` afterJsonb 同构 publish + targetVersionNo；版本数 < 2 → 422 无可回滚目标 D-185-1.5；现存草稿不删——由陈旧信号②自然标记；复用 `publishHomeConfig` draft 省略路径；rollback 静态后缀先于详情路由注册）（`apps/api/src/routes/admin/home-publish.ts` → `HomePublishService` + `home-publish.schemas.ts`，独立子路由 D-185-6.1 防 home.ts 500 行硬限）
  - **行级 audit rollback 显式防御**（D-185-3.4 / MEDIUM-2）：`home_page.publish`/`home_page.rollback` 入 `AuditRollbackService.UNSUPPORTED_ACTION_TYPES`（整页版本回滚走专用端点，与 ADR-138 行级链操作对象不同；不依赖 TARGET_KIND_TABLE_MAP 缺映射的隐式兜底）+ 守卫测试
  - **版本历史 UI**（CHG-HOME-AUDIT-ROLLBACK）：画布工具栏「版本历史」→ `VersionHistoryPanel`（Drawer：列表 source pill/当前版本标记 + 「对比上一版」按列表序取相邻较旧版本——serial 可留空洞不可按 n-1 推算——两份详情经 `lib/home-curation/version-diff.ts` 纯函数本地比对〔section 粒度 added/removed/changed/settingsChanged，剥离时间戳元数据〕+ 回滚确认 modal，最新版本禁用回滚）；回滚成功 → preview 重拉 + 草稿双信号刷新
  - **画布写路径全量落草稿**（CHG-HOME-DRAFT-PUBLISH-B / D-185-2.1）：拖拽排序/跨区块移动（草稿内单次变换原子完成，取代发布态两步 PATCH+reorder 非原子链）/settings/候选应用（重校验挪 publish 时点）/空位添加/banner 创建经 `useHomeDraft.mutateConfig`（编辑即自动保存草稿，首次编辑惰性建稿——基线 = GET draft `include_base=true` 服务端单快照含 banner-slot 冻结存量，他端已并发建稿则采纳其 config 防覆盖；新建条目预生成 UUID = 拖拽身份锚 + publish 后正式行 id）；门面 #3/#5/#6 + 资源级直写**停止承接画布写**（保留为非画布旁路——list 视图/深链/API 直接消费维持直写，端点定性三层清单 D-185-2.2）；纯变异函数 `lib/home-curation/draft-mutations.ts`；发布确认 `PublishConfirmModal`（摘要 + 备注 + **横图三类警告标记**〔尺寸/比例/探测失败，§6 警告级不阻断——ERRATA 移交验收项〕+ 陈旧警示）
  - **发布后缓存主动失效**（CHG-HOME-CACHE-INVALIDATE / D-185-5）：publish/rollback 事务成功后 `schedulePublishedHomeCacheInvalidation` 事务外 fire-and-forget（`services/home-cache-invalidation.ts`）——**子前缀级精确 scan+UNLINK** `home:shelf:*`（D-184-5.2 接口位 `HOME_SHELF_CACHE_PREFIX`）+ `home:top10:*`（`HOME_TOP10_CACHE_PREFIX` 同卡导出），不复用 CacheService.clearCache type 级整删（`home:*` 整删会连带清非目标 home key，D-185-5.3）；失效失败 warn 不回滚发布（60s TTL 兜底自愈，D-185-5.2——主动失效是优化不是正确性前提）；扩前缀必须随对应缓存键族新增同卡同步 `HOME_PUBLISH_INVALIDATION_PREFIXES`
  - **重算调度（ADR-183 D-183-3）**：Bull `home-autofill-queue`（attempts 2 + fixed 30s）+ `workers/homeAutofillScheduler.ts`（单一 5min tick 扫描 settings，比对最新快照 generated_at + refresh_interval；不为每 section 建 timer，改配下一 tick 生效；`HOME_AUTOFILL_SCHEDULER_ENABLED` opt-out）+ `workers/homeAutofillWorker.ts`（委托 `recalculate.ts`：hot_movies/series→douban、hot_anime→bangumi、featured/top10/banner→站内 trending/rating、type_shortcuts 跳过；full_auto 不写运营表 D-181-4.3，重算 ≠ 生效）。jobId `autofill:${section}` 固定键幂等 + per-add removeOnComplete/removeOnFail true（jobId 释放是定频重入前提）。端点 #7 `POST /admin/home/sections/:section/refresh-candidates`（429 主动 getJob+getState / manual_only 422 / 入队失败 500 不静默；audit `home_section.refresh_candidates` 轻量载荷）。快照写入为系统产物不计 admin audit（方案 §11.2）

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

来源：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.4 §2 + ADR-109。SQL 落地详见 `apps/api/src/db/migrations/052_admin_audit_log.sql ～ 060_videos_review_source.sql`；types 在 `packages/types/src/admin-moderation.types.ts`。

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
| `fb_score` | 105 | NUMERIC NULL CHECK [0,1] | EMA 平滑播放成功率；写入侧即时半衰（feedback.ts `FB_HALF_LIFE_SECONDS`=7d，单条自引用 UPDATE 保并发安全）；NULL=无样本；P3-2 影子验证前只写不进评分（SRCHEALTH-P2-2）|
| `fb_sample_weight` | 105 | NUMERIC NULL CHECK ≥0 | EMA 有效样本权重；稳态上界≈1/(1-2^(-Δt̄/T))。⚠️ P3-2 消费 `min(1,w/N)` 须 `COALESCE(w,0)`——PG LEAST 忽略 NULL 误返 1 |
| `last_feedback_at` | 105 | TIMESTAMPTZ NULL | 最近播放反馈时间（半衰 decay 基准）；NULL→decay=0→首样本无先验初始化 |

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

### 5.13 M-SN-5 线路矩阵 schema（CHG-SN-5-11，Migration 061–063）

来源：ADR-114-NEGATED（复合键约束）/ CHG-SN-5-11 / SEQ-20260501-02

**video_merge_audit（Migration 062）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | 审计行 ID |
| `action` | TEXT NOT NULL CHECK ('merge'/'split') | 操作类型 |
| `source_video_ids` | UUID[] NOT NULL | 参与合并 / 被拆分的视频 ID 数组 |
| `target_video_ids` | UUID[] NOT NULL | 合并后保留 / 拆分后新建的视频 ID 数组 |
| `snapshot_jsonb` | JSONB NOT NULL | 操作前完整数据快照（支持 unmerge 还原）|
| `performed_by` | UUID FK users(id) ON DELETE RESTRICT | 操作人 |
| `reason` | TEXT NULL | 操作备注 |
| `performed_at` | TIMESTAMPTZ DEFAULT NOW() | 操作时间 |
| `reverted_at` / `reverted_by` / `reverted_reason` | NULL 或 三列同时非空 | unmerge 还原元数据（CHECK 约束）|

索引：`(action, performed_at DESC) WHERE reverted_at IS NULL` / GIN `source_video_ids` / GIN `target_video_ids`。

**source_line_aliases（Migration 063 / 079 / 081）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `source_site_key` | VARCHAR(100) PK（复合） | 站点标识，对应 `video_sources.source_site_key` |
| `source_name` | TEXT PK（复合） | 线路名，对应 `video_sources.source_name` |
| `display_name` | TEXT NOT NULL | 面向后台管理员的可读别名 |
| `codename` | VARCHAR(20) NULL | **三层路由命名 Layer B 运维短码**（如 "泰山-2"）；Migration 079 / ADR-164 D-164-2 / 永久绑定 (siteKey, sourceName) / 退役 90 天后可复用 |
| `priority` | SMALLINT NOT NULL DEFAULT 0 | **Layer A effective_score priority_bonus 通道**（0-100）；Migration 079 / ADR-164 D-164-3 / CHECK 约束 `priority BETWEEN 0 AND 100` / route-scoring 归一化 priority/100 |
| `retired_at` | TIMESTAMPTZ NULL | 线路退役软删时间戳；Migration 079 / ADR-164 D-164-4 / NULL = 在役 / NOT NULL = 退役（90 天冷却期后 codename 可复用，应用层判定）|
| `auto_retired` | BOOLEAN NOT NULL DEFAULT false | true = worker 自动退役（全 dead 180 天 / plan §10.5）/ false = 人工 POST retire 端点；Migration 079 / ADR-164 D-164-8 |
| `dead_since` | TIMESTAMPTZ NULL | alias 整体「全 dead」起始时间戳；Migration 081 / CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER（Wave 4 #5）/ NULL = 非全 dead 或未观察 / 由 auto-retire-line worker 单向维护（不影响 probe/render 写路径 / arch-reviewer Opus 评审方案 D'）/ 上升沿 alias 全 dead 且 NULL → SET NOW() / 下降沿 任一 source 转非 dead 或孤儿 → SET NULL / 触发 dead_since < NOW() - 180 days → UPDATE retired_at = NOW(), auto_retired = true |
| `updated_by` | UUID NULL FK users(id) ON DELETE SET NULL | 最后修改人 |
| `created_at` / `updated_at` | TIMESTAMPTZ | 时间戳 |

索引：
- `(source_site_key)` 支持按站点过滤（既有 Migration 063）
- `UNIQUE (codename) WHERE codename IS NOT NULL AND retired_at IS NULL`（Migration 079 / D-164-9）— 索引键 = codename / 部分索引覆盖在役行 codename 列。**真实用途**：① 唯一性约束物理保证（DB 强制 / 违反抛 23505 unique_violation）② 按 codename driving 查询活跃别名（GET codename-pool occupied 段 / 未来 codename 反查站点+线路）。**不适用**：① listSources / matrix JOIN（按 `(source_site_key, source_name)` 复合 PK 匹配 → 走 PRIMARY KEY 索引 / 与 codename 索引无关）② cooling lookup（`retired_at IS NOT NULL` 反向）③ 已退役行查询。
- `(retired_at) WHERE retired_at IS NOT NULL`（Migration 079）— 索引键 = retired_at / 部分索引覆盖已退役行 retired_at 列排序结构。候选路径（规划器选用取决于数据 selectivity / 留实测 EXPLAIN ANALYZE 验证）：① admin UI "已退役" tab `WHERE retired_at IS NOT NULL ORDER BY retired_at DESC`（CHG-368-B-B）② GET codename-pool cooling 段 `WHERE retired_at >= NOW() - 90 days` 范围扫描（CHG-368-B-A2）。**不适用**：① listSources / matrix JOIN（按 PK 复合键匹配 / 走 PRIMARY KEY 索引）② 按 codename 查询 cooling（`WHERE codename = $1 AND retired_at IS NOT NULL` / **当前 schema 无适用索引** / 全表扫描或经 idx_retired_at 范围扫后应用层过滤 codename / 未来如成为热路径可独立加 `(codename) WHERE retired_at IS NOT NULL` 部分索引）
- `(dead_since) WHERE dead_since IS NOT NULL AND retired_at IS NULL`（Migration 081 / Wave 4 #5）— 索引键 = dead_since / 部分索引覆盖「已进入 dead 观察期 + 未退役」alias / 服务 auto-retire-line worker 段 3 检测 SQL（`WHERE retired_at IS NULL AND dead_since < NOW() - 180 days`）+ ORDER BY dead_since ASC LIMIT 50 优先退役最老 alias（防雪崩）

注：listSources / matrix JOIN 主路径走表的 PRIMARY KEY `(source_site_key, source_name)` 复合唯一索引（PG 自动建立 / B-tree），不依赖 codename 或 retired_at 任何部分索引。retired_at 过滤条件（如 `sla.retired_at IS NULL` / CHG-368-B-A3 加）是在 PK lookup 后的额外谓词，由列扫描完成 selectivity 过滤。

**已 ship 数据层（CHG-368-B-A1）**：Migration 079 + SourceLineAlias 类型扩 4 字段 + sources-matrix queries SELECT 列同步 + `packages/types/src/route-codenames.ts` MOUNTAIN_CODENAMES 52 项山名常量（D-164-10 / 字库治理 / DB 不存）+ mapAliasRow helper（4 路径 DRY 沉淀）。零业务行为变化。

**已 ship 业务路径（CHG-368-B-A2a/-A2b/-A3）**：
- 3 新 admin 写端点 ship（POST `/admin/source-line-aliases/:siteKey/:sourceName/retire` + PUT `/.../priority` + GET `/.../codename-pool`）
- SourcesMatrixService 3 方法（`retireLineAlias` / `updateLineAliasPriority` / `getCodenamePool`）+ `upsertLineAliasWithFields`（扩签名）
- R-MID-1 audit RETRO 7 文件框架（D-164-7 / 2 新 actionType `source_line_alias.retire` + `.priority_update` / R-MID-1 第 29-30 次系统化 / payload 内容断言独立测试 6 case）
- route-scoring priority 通道激活（priority/100 替代 Phase 1 默认 0 / `SourceService.listSources` 内派发 / route-scoring.ts 公式无改动）
- `findActiveSourcesWithSignalsByVideoId` JOIN 加 `(sla.retired_at IS NULL OR sla.source_site_key IS NULL)` 双条件守卫（D-164-6 / 已退役行不出现 + LEFT JOIN miss 兼容）

**已 ship admin UI（CHG-368-B-B）**：admin UI 独立路径 `/admin/source-line-aliases`（`apps/server-next/src/app/admin/source-line-aliases/page.tsx` + `_client/SourceLineAliasesClient.tsx`）/ DataTable 一体化（CLAUDE.md 强约束遵守 / 不复用 ModernDataTable / 6 列结构：siteKey + sourceName + displayName + codename + priority + status + actions）/ AdminCard codename 池摘要（3-grid 可用/已占用/冷却中）/ Modal 编辑行（displayName + codename + priority 三字段）/ 行级退役（已退役行 retire 按钮自动隐藏 / 双重 confirm + 90 天冷却警告）

**未 ship UI（→ CHG-368-B-C 排期 / advisory）**：LinesPanel 行级 codename 标签 + 退役行 opacity（packages/admin-ui composite/lines-panel / advisory A-164-2）+ `docs/manual/route-labeling.md` §"Layer B 实施记录"（推荐落地 / 不阻塞主线路）。

用途：`/admin/sources` 线路矩阵渲染时，将 `(source_site_key, source_name)` 映射为 `display_name`；Layer B codename 用于运维日志 + Slack 告警 + 跨团队 IM（短 / 全局唯一 / 永久绑定）；Layer A priority 接入 effective_score 公式 5% 通道（CHG-352 已留 hook）。

**应用层：**

- 查询层：`apps/api/src/db/queries/sources-matrix.ts`（listVideoGroups / getVideoGroupStats / getVideoMatrix / listLineAliases / upsertLineAlias）
- 路由层：`apps/api/src/routes/admin/sources-matrix.ts`（5 端点，moderator+ 鉴权）
- 前端层：`apps/server-next/src/lib/sources/`（types + api）/ `apps/server-next/src/app/admin/sources/`（可展开矩阵表 + 全局别名面板）

### 5.14 users.preferences 用户偏好 schema（ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A1，Migration 080）

来源：ADR-165（ROUTE-LABEL-D 跨设备主题同步）/ CHG-369 + CHG-369-B 前置（5 内置主题 + 自定义主题 / 双 key localStorage）

**users 表 Migration 080 新增字段：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `preferences` | JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof = 'object') | Migration 080 / ADR-165 D-165-1 / 用户偏好（routeTheme / 未来 playerSettings / homeLayout）/ 跨设备同步通道 |

**preferences shape**（应用层 zod 校验 / DB 仅 jsonb_typeof 弱校验 / 与 ADR-159 + ADR-163 + ADR-164 JSONB 范式一致）：

```ts
// packages/types/src/user.types.ts (ADR-165 D-165-2)
UserPreferences = {
  routeTheme?: {
    themeId: string,        // 'jie_qi' | 'nato' | ... | 'custom'
    customTheme?: {
      displayName: string,  // ≤ 10 字符
      labels: string[],     // 1-30 个 / 每个 ≤ 10 字符
      deadLabel?: string,   // ≤ 10 字符
    }
  },
  // 未来扩: playerSettings? / homeLayout? / 等
}
```

**双 zod schema 范式（R-165-4）：**
- `UserPreferencesSchema` (**passthrough**)：server 持久化 / 未知字段保留（防演进期旧客户端误删 server 数据）
- `UserPreferencesStrictSchema` (**strict**)：客户端类型层开发期约束（拒绝拼写错误）
- `UserPreferencesPatchSchema` (**passthrough**)：PUT 顶层模块 PATCH 语义（R-165-3）/ undefined=不改 / null=删除 / 值=设置

**索引：** 无新增（PK users_pkey 完整覆盖 GET/PUT 路径 / 索引设计 4 步核验 4 步通过 / 详 Migration 080 注释）

**应用层：**
- 查询层：`apps/api/src/db/queries/userPreferences.ts`（getUserPreferences SELECT preferences 单列 / updateUserPreferences JSONB merge + delete 事务）
- 业务层：`apps/api/src/services/UserPreferencesService.ts`（zod passthrough 校验 + 调 queries）
- 路由层：`apps/api/src/routes/users.ts`（2 新端点 GET / PUT `/users/me/preferences` / preHandler: auth 强制 / ADR-110 既有 14 码 401/404/422）
- 前端层（→ CHG-SN-9-ROUTE-LABEL-D-A2）：`useUserPreferencesSync` NEW + `route-theme-storage.ts` 改造接入 hook + RouteThemeSelector syncing 状态

**安全：**
- preHandler `[fastify.authenticate]` 强制登录 + Service 层 userId 来自 JWT 解析（防 body IDOR）
- 仅当前用户可读写（D-165-9）/ admin 域 listAdminUsers 不拉 preferences（洞察 5 / RBAC 副作用规避）
- 当前 routeTheme 无 PII / 无加密需求 / JSONB CHECK 防 NULL / 数组 / 标量污染

---

### 5.15 视频身份解析层（Entity Resolution / ADR-105a / Phase 1a·2a·2b·2c·3 已落地）

> **现状基线（部分落地）**：SEQ-20260602-03 视频身份解析升级（设计 `docs/designs/video-identity-resolution-redesign_20260602.md` §4.2/§4.3）。**已落地**：`core_title_key`/facets 纯函数（Phase 1a CHG-VIR-5）+ 多证据评分 `apps/api/src/services/identity/` 模块（Phase 2a CHG-VIR-7）+ **`identity_candidate` 表（Phase 2b CHG-VIR-8 / Migration 086）** + 离线重算 Bull job + 候选来源读切换（Phase 2c CHG-VIR-9-A / `?source=identity|legacy`）+ **`identity_decisions` 人工裁定写路径（Phase 2c CHG-VIR-9-B / Migration 087+088 / ADR-178）** + UI 切换 + confirm/reject（Phase 2c CHG-VIR-9-C）+ **ingest 旁路 shadow scoring（Phase 3 CHG-VIR-10 / D-105a-16，无新表无端点：`identity_candidate` `trigger_source='ingest'` 复用 + pino `stage='ingest-shadow'` 结构化日志）** + **blocking 第二召回键 external_id（D-105a-17 / `blockingRecall.ts` core_title_key ∪ `provider:id` 并集，索引复用既有，无新 migration）** + **merge 默认翻 identity + pair→connected-component 页内折叠（CHG-VIR-9-D / D-105a-18：`collapsePairsToGroups.ts` union-find 纯函数，groupKey=成员升序 join；`POST /admin/video-merges` 扩 optional `candidateIds[]` 折叠组多锚点 confirm〔与单数 candidateId 互斥〕；unmerge 反查改复数循环 revert〔R8 对称〕；reject 逐 pair；total 维持 pair 数 + 同分量跨页拆行为已登记分页近似）**。**留后续**：自动绑定开关（默认 OFF，Phase 3 验收后另起 ADR）。真源详见 `docs/decisions.md` ADR-105a + ADR-178。

把 ADR-105 v1「`(mc.title_normalized, mc.year, v.type)` 三元组等值 + 单维 `source_overlap_ratio`」升级为 Entity Resolution（Blocking 并集召回 → 多证据 Scoring → 阈值分级 → 候选离线持久化 + 决策记忆）。要点：

- **`core_title_key`**（Phase 1a 落地 / `apps/api/src/services/TitleIdentityParser.ts`）：`parseTitle` 产出的**新增并行**确定性等值 blocking key（B-tree，**非 pg_trgm**），与 `normalizeTitle`/`normalizeMergeKey` 解耦、不改其语义、不写入 catalog 唯一约束（红线）。facets（`seasonNumber`/`edition`/`languageVariant`/`releaseMarker`/序号）解析保存不删除。
- **多证据评分**（Phase 2a 落地 / `apps/api/src/services/identity/`）：强正（external exact ID 饱和 0.95 / alias / 同源 canonical / source 指纹重叠）/ 中正（`core_title_key` 等值 / year±1 / type 兼容 / 集数结构 / metadata）/ 强负（external ID 冲突 / season 不同 / year 远且无 exact / type 不兼容 / 集数模式冲突 / 序号冲突 / **release_marker 不同** → 硬否决 veto）。阈值 `≥0.92` auto-eligible（自动绑定开关默认 OFF）/ `[0.75,0.92)` candidate / `<0.75` none / 任一强负 blocked。`identityScore` 与 `legacyScore`（`source_overlap_ratio`）字段分离（R3）。Phase 2a 候选行附加 evidence；外部 ID/集数/metadata 证据 Phase 2b 填实。
- **`identity_candidate`**（Phase 2b 落地 / **Migration 086**）：video-pair 候选 shadow 表 + 状态机 `pending`/`confirmed`/`rejected`/`superseded`。字段（D-105a-7）：`left_video_id`/`right_video_id`（FK CASCADE）/ `canonical_pair_key`（min\|max 有序）/ `status` / `parser_version` / `scorer_version` / `evidence_jsonb` / `evidence_hash`（D-105a-8 确定性 sha256）/ `legacy_score`（nullable）/ `identity_score` / `strong_negative_reasons[]` / `trigger_source`（`ingest`/`offline-rescore`/`manual-search`）/ `group_key` / `revived_from_candidate_id`·`superseded_by_candidate_id`（自引用 FK SET NULL，保复活链）/ `created_at`·`updated_at`。约束：`CHECK(left<>right)` + `CHECK(left::text<right::text)`（canonical 有序兜底）。索引：`uq_identity_candidate_pending`（partial unique `WHERE status='pending'` / R5 幂等）+ pair_key 反查 + `(status,scorer_version,parser_version)` + left/right video FK 反查 + `idx_title_observations_core_key`（blocking 召回支撑，表达式索引）。
- **离线生成**（Phase 2b 落地 / Bull `identity-candidate-queue` · `apps/api/src/workers/identityCandidateWorker.ts`）：Blocking **多 key 并集召回**（CHG-VIR-10 D-105a-17：段 ① `title_observations.coreTitleKey` 分桶 + 段 ② external_id `provider:id` 分桶〔双源 Y-105a-4：media_catalog 外部 ID 列上卷 ∪ video_external_refs manual_confirmed〕，禁 pairwise 全量 + MAX_BUCKET 护栏 + 全局 seen 去重 / `services/identity/blockingRecall.ts` 真源）→ Scoring（复用 `scorePair`）→ 单事务幂等 upsert（hash 比对 noop / 腾位 supersede + 新建 / 复活链；评分→hash→upsert 共享层 `pairScoringPersist.ts`，blockingKeys = 双方 core key + 共享 ext 桶 key 并集）。与现有实时 group-by 候选并行对照，实时端点轻量读 + 旧 group fallback；实时 p95 继承 ADR-105 ≤200ms，离线 job 另立 SLO。手动触发 `scripts/enqueue-identity-rescore.ts`（无自动 scheduler / shadow 阶段）；对比报表 `scripts/identity-compare-report.ts`（CHG-VIR-10 扩 trigger_source 切片 + `--source=` 过滤）。
- **ingest 旁路 shadow scoring**（Phase 3 CHG-VIR-10 落地 / D-105a-16 / `services/identity/ingestShadow.ts`）：CrawlerService `upsertVideo` Step 4 后 **fire-and-forget**（容错同 title_observations，失败不阻断采集）：blocking 双键召回对侧（单 video 口径与离线一致）→ scorePair → 候选 upsert（`trigger_source='ingest'`）→ shadow bind 判定（仅 exact 外部 ID 命中 + 无强负；outcome ∈ agree-bind / disagree-bind / candidate-only / none / no-counterpart）→ pino 结构化日志 `stage='ingest-shadow'`（含 `matchedStep` —— `MediaCatalogService.findOrCreateWithMatch` 透出的 5 步命中点，Service 内部契约）。**生产 `catalog_id` 绑定零变更（R9 + D-105a-12）**：任何分支不回写 videos.catalog_id、不触发 merge。
- **`identity_decisions`**（Phase 2c 落地 / **Migration 087** / ADR-178 D-178-5 + ADR-105a D-105a-11 闭环）：人工裁定决策表。字段：`id` UUID PK / `candidate_id`（FK identity_candidate ON DELETE CASCADE）/ `decision`（CHECK `'confirmed'`/`'rejected'`；reverted 由 confirmed 行原地置 `reverted_at` 表达，不改 decision 值）/ `video_merge_audit_id`（FK video_merge_audit ON DELETE RESTRICT，nullable——rejected 为 NULL）/ `performed_by`（FK users RESTRICT）/ `actor_type`（CHECK `'human'`/`'system'` DEFAULT human，auto 路径预留）/ `reason` / `reverted_at`·`reverted_by`·`reverted_reason`（对齐 video_merge_audit 范式）/ `created_at`。约束：**R8 CHECK** `decision<>'confirmed' OR video_merge_audit_id IS NOT NULL` + reverted 三列一致性 CHECK。索引：`uq_identity_decision_candidate_confirmed`（partial unique `(candidate_id) WHERE decision='confirmed'`，一 candidate 至多 confirm 一次）+ `idx_identity_decision_audit`（partial `WHERE video_merge_audit_id IS NOT NULL`，unmerge 联动反查）+ `idx_identity_decision_candidate`。
- **决策写路径**（Phase 2c CHG-VIR-9-B 落地 / ADR-178）：① confirmed→merge——`POST /admin/video-merges` Body optional `candidateId`（CHG-VIR-9-D 起 deprecate，扩 optional `candidateIds[]` 1-55〔cap=C(11,2)，merge 集合上限 11 视频完全图 pair 数 / Codex review FIX〕互斥：折叠组事务内循环挂 K 个 decision 同一 audit_id，任一 from-state 冲突整 merge ROLLBACK），merge 事务内（单 BEGIN/COMMIT / R8）挂 candidate `status='confirmed'`（from-state 守卫）+ decision(confirmed, audit_id)；② reject——`POST /admin/identity-candidates/:id/reject`（`IdentityCandidatesService.reject` 单事务 candidate rejected + decision(rejected)，复活归离线 job R6 链；折叠组 UI 逐 pair 调用）；③ unmerge 联动——经 `video_merge_audit_id` 反查**全部** confirmed decision 循环原地置 `reverted_at`（CHG-VIR-9-D `findConfirmedDecisionsByAuditId` 复数化，R8 对称；candidate 保持 confirmed，避撞 `uq_identity_candidate_pending`）。admin_audit_log：actionType `identity_candidate.reject` + targetKind `identity_candidate`（**Migration 088** CHECK 14→15）。

---

### 5.16 title_observations 标题观测 shadow 表（CHG-VIR-6 / Phase 1b，Migration 085）

来源：设计 `docs/designs/video-identity-resolution-redesign_20260602.md` §1b（**schema 真源 / 无独立 ADR**）。`core_title_key`/facets 解析器契约 = ADR-105a D-105a-1（`TitleIdentityParser.parseTitle`）。

> **现状基线**（非规划草案）：Migration 085 已落地。**纯观测 shadow 表**——采集链路记录各源观测到的原始标题 + 解析 facets，**不进任何唯一约束 / 不参与归并决策**（复核 F1）；去重聚合避免「每次采集快照」无限写。

**字段：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK DEFAULT gen_random_uuid() | 主键 |
| `video_id` | UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE | 所属视频（video 删除级联） |
| `source_site_key` | TEXT NULL | 采集站点 key（COALESCE('') 进去重键） |
| `source_name` | TEXT NULL | 播放源名（site 级标题观测通常 NULL） |
| `raw_title` | TEXT NOT NULL | 源站原始标题（未归一） |
| `raw_title_hash` | TEXT NOT NULL | `raw_title` 的 sha256 hex（窄化去重键） |
| `parser_version` | TEXT NOT NULL | `TITLE_PARSER_VERSION`（版本升级 → 不同 parser_version → 新观测行，旧行保留） |
| `parsed_facets_jsonb` | JSONB NOT NULL DEFAULT '{}'::jsonb | `{coreTitleKey, titleKind, confidence, facets}` 解析快照 |
| `observed_count` | INTEGER NOT NULL DEFAULT 1 | 同去重键重复观测累加（去重聚合，非快照） |
| `first_seen_at` / `last_seen_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | 首/末次观测时间 |

**索引：**
- `uq_title_observations_dedupe` UNIQUE `(video_id, COALESCE(source_site_key,''), COALESCE(source_name,''), raw_title_hash, parser_version)` —— 去重唯一键（设计 §1b）；upsert ON CONFLICT 命中即 `observed_count+1` + 刷新 `last_seen_at`
- `idx_title_observations_video` `(video_id)` —— 按 video 聚合反查（离线身份解析分析）

**应用层（分层：解析/哈希组装在 Service 层，DB query 层仅纯 SQL 不 import Service）：**
- 查询层：`apps/api/src/db/queries/titleObservations.ts`（`recordTitleObservation`：ON CONFLICT 去重 upsert / `TitleObservationInput` 入参契约）
- 组装层：`apps/api/src/services/titleObservation.builder.ts`（`buildTitleObservation`：`parseTitle` facets 快照 + sha256 raw_title_hash → `TitleObservationInput`；独立模块供 Phase 2 离线 job 复用）
- 采集链路 hook：`apps/api/src/services/CrawlerService.ts` `upsertVideo` Step 5 后 **fire-and-forget** `void recordTitleObservation(this.db, buildTitleObservation(...)).catch(log)`（复核 F3：容错，写失败不阻断采集入库主流程）

---

### 5.17 通知独立存储 + 已读混合模型（ADR-192 / NTLG-P1-a，Migration 100）

来源：ADR-192（通知与审计解耦双写 + 通知独立存储 + 已读混合模型）/ 治理方案 `docs/designs/notification-task-log-governance-plan_20260608.md` §2.1。通知脱离 `admin_audit_log` 派生（ADR-147 MVP 历史债），独立成新真源；已读从浏览器 localStorage 升级为服务端 per-user cursor。

**Migration 100 新增 3 表：**

| 表 | 说明 |
|---|---|
| `notifications` | 通知独立真源。`id BIGSERIAL PK` / `type TEXT NOT NULL`（语义键）/ `level TEXT NOT NULL CHECK (level IN ('info','warn','danger'))`（D-192-6，对齐 AdminNotificationItem.level）/ `title TEXT NOT NULL` / `body TEXT NULL` / `payload JSONB NULL`（结构化数据，承载 TaskResultDigest ADR-193）/ `href TEXT NULL` / `source_kind TEXT NOT NULL`（产出象限 task/system/moderation/...）/ `source_ref TEXT NULL`（关联实体 id 反查）/ `dedup_key TEXT NULL`（幂等键）/ `scope TEXT NOT NULL`（broadcast/role:*/user:* 无 CHECK，类型层前缀校验 D-192-6）/ `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` / `expires_at TIMESTAMPTZ NULL`（TTL 保留期，策略数值归 ADR-195）。 |
| `notification_read_cursor` | broadcast/role 已读高水位线（per-user 一行，替代 localStorage lastViewedAt，D-192-3）。`user_id UUID PK FK users(id) ON DELETE CASCADE` / `read_at TIMESTAMPTZ NOT NULL`（之前的 broadcast/role 视为已读；新用户初值=加入时间 users.created_at，由 P1-a-B upsert，不回溯历史）。 |
| `notification_reads` | 定向通知逐行已读 + broadcast 单条已读例外位（P1 仅建表预留，写路径随 P2，D-192-DEV-1）。`PK(notification_id, user_id)` 双 FK ON DELETE CASCADE / `read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`。 |
| `notification_dismissals` | 抽屉级软移除 per-user per-item（ADR-197 D-197-1 / Migration 104）。`PK(user_id, item_key)` / `user_id UUID FK users(id) ON DELETE CASCADE` / `item_key TEXT`（抽屉项最终 id 原值跨源：general 行 id 纯数字串 / `bg-audit:<id>` / 终态 `taskrun-<id>`，**无 FK**——派生项无 notifications 行可挂）/ `dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`。dismiss ≠ 物理删除（ADR-195 purge）≠ 已读（cursor/reads，D-197-5）；drawer list `NOT EXISTS` 排除〔general〕+ Service 内存 anti-set〔派生 audit/task〕，消息中心 history 不排除（D-197-4）；清理走 purge worker `deleteStaleDismissals` age N≥90d（D-197-6，无 FK CASCADE）。 |

**索引（db-rules 4 步核验见 migration 注释）：**
- `idx_notifications_created_at` `(created_at DESC)` —— 全 scope 混合时间线兜底 + 维护清理按 created_at 扫描。
- `idx_notifications_scope_created_at` `(scope, created_at)` —— **unread-count 核心索引**（scope 等值 + created_at 范围扫描，D-192-5）；cursor 把「全体已读」压成一行高水位，**不补 anti-join**（D-192-4）。
- `uq_notifications_dedup_key` `(dedup_key) WHERE dedup_key IS NOT NULL` —— partial unique 幂等（emit ON CONFLICT DO NOTHING）；反向 invariant：dedup_key IS NULL 不受唯一约束。

**未读计数口径（D-192-5）：** broadcast/role 未读 = `scope ∈ broadcastScopes 且 created_at > COALESCE(cursor.read_at, users.created_at)`；定向未读 = `scope = 'user:<uid>'`；两者皆排除已过期（expires_at <= NOW()）+ 已逐行读（NOT EXISTS notification_reads）。

**应用层（P1-a-A 已落地数据层；service/路由归 P1-a-B）：**
- 查询层：`apps/api/src/db/queries/notifications.ts`（insertNotification ON CONFLICT 幂等 / listNotifications / countUnreadNotifications / getReadCursor / upsertReadCursor；SQL 全集中 queries 层，db-rules）
- 业务层（→ P1-a-B）：`NotificationService` 编排 list 迁新表 / unreadCount / markAllRead（cursor upsert）
- 路由层（→ P1-a-B）：`GET /admin/notifications`（迁新表沿用 ADR-147 契约）+ `GET /admin/notifications/unread-count`（ADR-192 新端点）
- emit 写入（→ ADR-193 + P1-c）：领域服务解耦双写，emit 只写 notifications 不写 admin_audit_log

---

### 5.18 task_runs 统一抽象层（ADR-194 / NTLG-P2-a，Migration 102 + 103）

来源：ADR-194（task_runs 统一抽象层 path B + 真源关系裁定「只读投影」）/ 治理方案 §2.2。**Migration 103**（`task_runs_status_cancelling.sql`）幂等补 status CHECK 第 6 态 `cancelling`（D-194-DEV-4，令已应用旧版 102〔5 态〕的库收敛——102 就地补 6 态只惠及 fresh DB，旧库经 migrate 跳过 102 须靠 103 ALTER）。**仅登记当前无持久 run 表的 bull 作业**（enrichment/imageHealth/maintenance/未来自动化）——这些瞬时 bull job 终态即丢、无持久记录；crawler **不写本表**（`crawler_runs` 保持采集批次唯一真源，D-194-1），统一视图由 `TaskAggregator` 读时对 `crawler_runs ∪ task_runs` 做只读 union 投影（D-194-2，零同步路径、最强反漂移）。

**Migration 102 新增 1 表：**

| 表 | 说明 |
|---|---|
| `task_runs` | 后台作业统一登记层。`id BIGSERIAL PK`（`id::text` 对齐 `TaskRunId=string` ADR-193）/ `kind TEXT NOT NULL`（作业类型语义键，无 CHECK，类型层校验保扩展 D-194-DEV-3）/ `title TEXT NOT NULL` / `ref TEXT NULL`（关联实体/bull jobId 反查）/ `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','cancelling','success','failed','cancelled'))`（**6 态**统一状态机 §4.2 + `cancelling` 协作式取消中间态〔running→cancelling→cancelled，D-194-6，bull worker 轮询信号；D-194-DEV-4〕；cancelled 保真终态，投影映射 AdminTaskItem.status='failed'）/ `progress SMALLINT CHECK (0–100 或 NULL)`（NULL=indeterminate）/ `digest JSONB NULL`（承载 TaskResultDigest ADR-193，finish 落库）/ `error TEXT NULL` / `started_at` / `finished_at` / `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` / `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`。 |

**索引（db-rules 4 步核验见 migration 注释）：**
- `idx_task_runs_created_at` `(created_at DESC)` —— listTaskRuns 时间倒序分页 / 终态窗口 / 无 status 过滤的全量时间线。
- `idx_task_runs_status` `(status, created_at DESC)` —— 任务闪电 running 计数（`status='running'`，§4.1）+ 终态列表 status 过滤（status 等值首列 + created_at 排序）。

**真源关系（D-194-1，只读投影）：** crawler_runs 唯一真源，task_runs 仅登记无持久表 bull 作业 → 不构成双真源（它们本无别的真源）。crawler 不接 TaskRunReporter（digest 走 path A summary 投影，D-194-DEV-2）。

**应用层（P2-a-A 数据层 + P2-a-B worker 接入/投影收敛 已落地；re-point 归 P2-a-C）：**
- 查询层：`apps/api/src/db/queries/taskRuns.ts`（insertTaskRun / updateTaskRunProgress / finishTaskRun / listTaskRuns；SQL 全集中 queries 层，db-rules）
- 中枢实装：`apps/api/src/services/TaskRunReporter.ts` `DbTaskRunReporter`（替 Noop，interface 零改动 D-194-4；start 失败降级 sentinel 不阻断 §11 D4）
- worker 接入（P2-a-B 已落地）：**代表性 worker = `maintenanceWorker`**（run 级批次作业，`runMaintenanceJobWithReporter` 包裹 start→finish〔success+digest / failed+error〕，digest 由 `maintenanceWorker.taskrun.ts` 投影聚合结果）——enrichment/imageHealth 为逐微作业不接（per-job 接入会以海量微行淹没 task_runs，且其队列原不在副源快照），按价值排序 #1 正确性改选 maintenance（ADR §影响文件候选集内）
- 投影收敛（P2-a-B 已落地）：`TaskAggregator` 副源由「bull active 瞬时快照」切「task_runs 持久登记」（`listTaskRuns` 读，`taskrun-${id}` 前缀 + `TASK_RUN_STATUS_MAP` 6→4 态〔cancelled→failed / cancelling→running〕）；`queueCounts` 仍取 bull `getJobCounts` 供任务闪电 running 计数（§4.1，Redis 不可用降级）
- 控制路径（P2-a-C 已落地）：`routes/admin/tasks.ts parseTaskId` 扩 `taskrun-{id}` 分派（bull- → taskrun- → crawler 顺序）+ `AdminTaskControlTarget.kind` 扩 `'task_run'`（加性 D-194-6，未镜像 admin-ui）+ `getTaskRunById`（`/^\d+$/` 守卫防非法 `::bigint`）。**cancel**：终态 no-op cancelled=false / running-ish → **409 诚实暴露**（D-194-6 黄线②：maintenance 批次 service 无 abortController → 退回 ADR-191 P0 的 409，协作式取消 status='cancelling' 待 worker 具备 abortController 后启用，schema 已预留）。**retry**：failed → 经 `run.kind`→queue 映射 + `run.ref`(bull jobId) `getJob().retry()`（作业已清理→409）。**worker 未改**（黄线② fallback）。**-B→-C 瞬时态已闭环**（taskrun- 不再落 crawler 分支 500）

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
- `076_auto_crawl_daily_times_array.sql`（CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1C-1a / ADR-155 D-155-6：system_settings KV seed `auto_crawl_last_trigger_marks = '{}'` JSON object 容器 — daily 多 dailyTime 防重维度从 date 升级为 `{YYYY-MM-DD HH:MM: isoTs}`，允许同日不同时间各触发一次；047–075 migration 列表 drift 待独立 docs 清理卡补全）
- `077_bangumi_metadata.sql`（ADR-161 / CHG-BNG-01：external_data.bangumi_entries 扩 rank/nsfw + 新建 catalog_episodes 逐集元数据表）
- `082_videos_bangumi_status.sql`（ADR-170 / META-07：videos.bangumi_status 列 + idx_videos_bangumi_status，镜像 032 douban_status；078–081 列表 drift 同上待清理卡补全）
- `083_bangumi_characters.sql`（ADR-161 AMENDMENT / META-19：新建 catalog_characters + catalog_character_actors 角色↔CV 入库表，来源 Bangumi `/v0/subjects/:id/characters`）
- `099_douban_collection_items.sql`（ADR-187 / CHG-DOUBAN-HOT-STORE-A：新建 external_data.douban_collection_items 豆瓣 subject_collection 实时热度榜单切片 + external_data.douban_collection_sync_state 合集级新鲜度状态；084–098 列表 drift 同上待清理卡补全）
- `100_external_fetch_log.sql`（ADR-188 / CHG-EXT-RES-STORE-A：新建 external_data.external_fetch_log provider 无关采集操作流水——外部资源治理框架观测基石；在线出口埋点 + offline 不入表 + 30天 purge）
- `101_bangumi_collection_items.sql`（ADR-189 / CHG-BNG-RES-STORE-2A：新建 external_data.bangumi_collection_items Bangumi 派生近期新番/排行/每日放送切片〔GET /v0/subjects sort=date/rank + GET /calendar；D-189-2 AMENDMENT browse 非 search〕+ external_data.bangumi_collection_sync_state 合集级新鲜度；分表非并表 + air_weekday 仅 calendar CHECK + calendar 一拉七写原子）

> **MediaCatalogService.CATALOG_SOURCE_PRIORITY 调整**（ADR-161 决策要点 2）：`bangumi` 优先级 3 → 4（> douban:3，= tmdb:4，< manual:5）。anime 下 Bangumi 优先于豆瓣；bangumi 来源仅对 anime 写入，非 anime 不受影响。

> **system_settings 新增键**（ADR-155 D-155-6）：
> - `auto_crawl_last_trigger_marks` （JSON object 字符串 / EP-1C-1b scheduler 写入 `{date#HH:MM: isoTs}` / Y-155-2 scheduler tick GC 7 天前 keys）

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

> 本节记录 REGRESSION 序列（SEQ-20260420-REGRESSION-M1/M2/M3）在 apps/web-next 端补齐的三大能力层。参见 `docs/archive/2026Q2/milestone_alignment_20260420.md`（已归档）的完整 19 条对齐表。

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
