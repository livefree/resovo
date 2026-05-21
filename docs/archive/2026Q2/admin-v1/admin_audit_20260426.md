# Resovo 后台现状全面梳理与 9 大痛点定位

> status: snapshot
> owner: @engineering
> scope: admin console (apps/server) + admin API (apps/api/src/routes/admin) + 旧 apps/web 残留 + DB schema
> source_of_truth: yes（仅作快照报告，不替代 architecture.md）
> task: ADMIN-AUDIT-01（SEQ-20260426-01）
> generated_at: 2026-04-26 04:55
> 主循环模型：claude-sonnet-4-6
> 子代理调用：5 × Explore（视频/staging、视频源/线路、审核/筛选、标签/首页运营、表格基建/旧 web 残留）

> **本报告仅描述现状，不含修复方案。** 9 大痛点逐条定位 + P0/P1/P2 优先级标记，留待后续 CHG 卡分别拆开实施。

---

## 1. 总览

### 1.1 后台所属应用

- **后台主体**：`apps/server/`（Next.js App Router，端口 3001，路径 `/admin/*`，无 i18n locale）
- **API 后端**：`apps/api/`（Fastify，端口 4000，admin 路由前缀 `/v1/admin/*`）
- **新前台**：`apps/web-next/`（Next.js App Router，2026-04-18 起接替旧前台）
- **旧前台**：`apps/web/`（**已废弃但未删除**，详见 §5.4）
- **共享 packages**：`packages/types`、`packages/player-core`、`packages/logger`

### 1.2 文档与现状漂移

`docs/architecture.md:1a` 仍标注 `web → apps/web/src/app`，实际 `apps/web/src/` 已不存在（仅余 `.next/` 构建产物）。**架构文档与实际部署不一致**——M5/M6 重写期间未同步更新。

### 1.3 admin 模块拓扑（apps/server/src/app/admin/）

```
/admin
├─ login / 403 / fallback-preview
├─ videos          视频管理（CRUD + 上下架 + 批量）
├─ staging         暂存队列（采集后未发布）
├─ moderation      审核台（人工审）
├─ submissions     用户投稿
├─ sources         视频源/线路管理
├─ subtitles       字幕管理
├─ banners         首页 banner CRUD
├─ users           用户管理
├─ image-health    图片健康监控
├─ analytics       数据分析（含 ES 健康）
├─ content         内容运营汇总（submissions + subtitles 合并视图）
├─ design-tokens   设计 token 浏览
├─ crawler         采集控制台（任务/site/run）
├─ system/
│   ├─ settings    全局设置
│   ├─ sites       crawler-site 管理
│   ├─ cache       缓存管理
│   ├─ monitor     性能监控
│   ├─ config      运行时配置
│   └─ migration   迁移工具
└─ sandbox         开发沙箱
```

22 个顶层 admin 页面；admin API 16 个路由文件，共 **122 个端点**。

---

## 2. 模块清单（路由 / API / DB 表 / 主组件 四元组）

| 模块 | 后台路由 | Admin API | DB queries | 关键组件 |
|---|---|---|---|---|
| **videos** | `/admin/videos`、`/admin/videos/[id]/edit` | [admin/videos.ts](apps/api/src/routes/admin/videos.ts)（10 端点） | [videos.ts](apps/api/src/db/queries/videos.ts)、[mediaCatalog.ts](apps/api/src/db/queries/mediaCatalog.ts) | [VideoTable.tsx](apps/server/src/components/admin/videos/VideoTable.tsx)、AdminVideoForm、BatchPublishBar |
| **staging** | `/admin/staging` | [admin/staging.ts](apps/api/src/routes/admin/staging.ts)（10 端点） | [staging.ts](apps/api/src/db/queries/staging.ts) | StagingDashboard、StagingTable、StagingEditPanel、StagingRulesPanel |
| **moderation** | `/admin/moderation` | [admin/moderation.ts](apps/api/src/routes/admin/moderation.ts) | [moderation.ts](apps/api/src/db/queries/moderation.ts) | ModerationDashboard、ModerationList、ModerationPlayer |
| **submissions** | `/admin/submissions`、`/admin/content` | （归 content.ts） | （source_submissions 表） | SubmissionTable |
| **sources** | `/admin/sources`（4 tab） | [admin/media.ts](apps/api/src/routes/admin/media.ts)、（部分在 admin/videos.ts） | [sources.ts](apps/api/src/db/queries/sources.ts) | SourceTable、InactiveSourceTable、OrphanVideoTable、SubmissionsTable |
| **subtitles** | `/admin/subtitles`、`/admin/content` | [admin/content.ts](apps/api/src/routes/admin/content.ts) | [subtitles.ts](apps/api/src/db/queries/subtitles.ts) | SubtitleTable |
| **banners** | `/admin/banners`、`/admin/banners/new`、`/admin/banners/[id]` | [admin/banners.ts](apps/api/src/routes/admin/banners.ts)（6 端点） | [home-banners.ts](apps/api/src/db/queries/home-banners.ts) | BannerTable、BannerForm |
| **home-modules / Top10** | _（**无独立后台页面**）_ | _（**无 admin API 路由**）_ | [home-modules.ts](apps/api/src/db/queries/home-modules.ts)（CRUD 函数已写） | _（无 UI）_ |
| **users** | `/admin/users` | [admin/users.ts](apps/api/src/routes/admin/users.ts) | [users.ts](apps/api/src/db/queries/users.ts) | UserTable |
| **image-health** | `/admin/image-health` | [admin/image-health.ts](apps/api/src/routes/admin/image-health.ts) | [imageHealth.ts](apps/api/src/db/queries/imageHealth.ts) | ImageHealthDashboard（**无表格组件**） |
| **crawler** | `/admin/crawler`（含 sites/runs/tasks tab） | [admin/crawler.ts](apps/api/src/routes/admin/crawler.ts)、[admin/crawlerSites.ts](apps/api/src/routes/admin/crawlerSites.ts) | crawlerSites.ts、crawlerRuns.ts、crawlerTasks.ts、crawlerTaskLogs.ts | CrawlerSiteTable、CrawlerTaskTable |
| **system/sites** | `/admin/system/sites` | （归 admin/crawlerSites.ts、siteConfig.ts） | systemSettings.ts | SiteSettingsForm |
| **system/cache、monitor、config、migration** | `/admin/system/*` | [admin/cache.ts](apps/api/src/routes/admin/cache.ts)、performance.ts、analytics.ts、migration.ts | （多源） | CacheManager、PerformanceMonitor |
| **design-tokens** | `/admin/design-tokens` | [admin/design-tokens.ts](apps/api/src/routes/admin/design-tokens.ts) | brands.ts | TokenBrowser |

**关键缺口**：
- `home_modules` 表（迁移 050）已建，[home-modules.ts:listAdminHomeModules](apps/api/src/db/queries/home-modules.ts) 等 CRUD 查询函数已写，**但 admin API 路由与后台 UI 完全缺失**——Top10 / 推荐模块只能手工 SQL 操作。
- 视频"合并/拆分"动作：API、Service、UI **三层均无**入口（详见 §7 痛点 1）。

---

## 3. 链路与数据流

### 3.1 采集 → 入库 → 审核 → 上架 → 播放 时序

```
[Crawler Worker]
  │ 1. 抓取站点列表/详情
  ▼
[CrawlerService.processCrawlerTaskItem]  (apps/api/src/services/CrawlerService.ts:164)
  │ 2. 调用 MediaCatalogService.findOrCreate(payload)
  ▼
[MediaCatalogService.findOrCreate]  (apps/api/src/services/MediaCatalogService.ts)
  │ 3. 5 步匹配：imdb_id → tmdb_id → douban_id → bangumi_id → (title_normalized + year + type) 模糊匹配
  │    ★ 若 step 5 命中，新视频与旧视频共享 catalog_id ⇒ "合并"在此发生（黑盒，无审计）
  ▼
[videos 表 INSERT]
  │ 默认状态：is_published=false, visibility_status='internal', review_status='pending_review'
  ▼
[verifyWorker]  (apps/api/src/workers/verifyWorker.ts:48)
  │ 4. 对 video_sources 逐条 HEAD 请求 → 若 .m3u8 fallback GET + Content-Type 检验
  │    更新 video_sources.is_active + 聚合写回 videos.source_check_status (ok/partial/all_dead)
  ▼
[Admin moderation 台]  (apps/server/src/components/admin/moderation/ModerationList.tsx)
  │ 5. 人工审核：approve / reject / reopen
  │    POST /v1/admin/videos/:id/review → review_status='approved'
  ▼
[Admin staging 自动发布或手动上架]
  │ 6. POST /v1/admin/staging/:id/publish → is_published=true
  │    POST /v1/admin/videos/:id/visibility → visibility_status='public'
  ▼
[前台访问]  (apps/web-next/src/lib/video-detail.ts:39)
  │ 7. GET /v1/videos/{shortId}
  │    后端过滤 (apps/api/src/db/queries/videos.ts:263)：
  │       is_published=true AND deleted_at IS NULL AND visibility_status='public'
  │    任一条件不满足 → 404
```

### 3.2 关键转折点 / 黑盒

| 步骤 | 黑盒/风险 | 痛点关联 |
|---|---|---|
| Step 3 模糊匹配 | 无审计、无回滚、无人工预览 | **痛点 1** |
| Step 4 验证逻辑 | 仅 HEAD/GET + Content-Type，未与播放器 hls.js/dashjs 同源 | **痛点 3** |
| Step 7 默认 internal | 后台编辑默认 `visibility_status='internal'`，未主动切 public 即 404 | **痛点 5** |

---

## 4. 接口面（apps/api/src/routes/admin/*.ts，16 文件 / 122 端点）

| 文件 | 端点数 | 鉴权 | 主要资源 |
|---|---:|---|---|
| [admin/videos.ts](apps/api/src/routes/admin/videos.ts) | 10 | moderator+ | 视频 CRUD、上下架、可见性、审核、批量、refetch-sources |
| [admin/staging.ts](apps/api/src/routes/admin/staging.ts) | 10 | moderator+/admin | 暂存列表、单/批量发布、规则、豆瓣丰富/确认、meta 编辑 |
| [admin/moderation.ts](apps/api/src/routes/admin/moderation.ts) | ~8 | moderator+ | pending-review、history、batch-approve/reject、reopen |
| [admin/crawler.ts](apps/api/src/routes/admin/crawler.ts) | ~25 | admin | 任务管理、运行追踪、stop-all、单/批量 verify |
| [admin/crawlerSites.ts](apps/api/src/routes/admin/crawlerSites.ts) | ~10 | admin | crawler-site CRUD + 配置 |
| [admin/banners.ts](apps/api/src/routes/admin/banners.ts) | 6 | adminOnly | banner CRUD + 排序 |
| [admin/users.ts](apps/api/src/routes/admin/users.ts) | ~8 | admin | 用户列表、角色、禁用 |
| [admin/content.ts](apps/api/src/routes/admin/content.ts) | ~10 | moderator+ | submissions、subtitles 汇总 |
| [admin/media.ts](apps/api/src/routes/admin/media.ts) | ~10 | admin | sources 列表、submit、批量 |
| [admin/cache.ts](apps/api/src/routes/admin/cache.ts) | 2 | admin | cache stats / invalidate |
| [admin/analytics.ts](apps/api/src/routes/admin/analytics.ts) | ~5 | admin | 全局指标、内容质量、ES 健康 |
| [admin/performance.ts](apps/api/src/routes/admin/performance.ts) | ~5 | admin | 性能监控数据 |
| [admin/image-health.ts](apps/api/src/routes/admin/image-health.ts) | ~5 | admin | 图片健康指标 |
| [admin/migration.ts](apps/api/src/routes/admin/migration.ts) | ~3 | admin | 迁移工具 |
| [admin/siteConfig.ts](apps/api/src/routes/admin/siteConfig.ts) | ~5 | admin | 站点运行时配置 |
| [admin/design-tokens.ts](apps/api/src/routes/admin/design-tokens.ts) | ~5 | admin | 设计 token 查询 |

**未发现的端点**（用户痛点直接对应）：
- `POST /admin/videos/:id/split` 或 `unmerge` → **不存在**
- `PATCH /admin/videos/:id/relink-catalog` → **不存在**
- `/admin/home-modules/*`（Top10/推荐模块管理）→ **路由文件不存在**

---

## 5. UI 与表格

### 5.1 共享组件能力矩阵

| 组件 | 路径 | 能力 |
|---|---|---|
| ModernDataTable | [apps/server/src/components/admin/shared/modern-table/ModernDataTable.tsx:30](apps/server/src/components/admin/shared/modern-table/ModernDataTable.tsx) | ✅ 服务端排序 / ✅ 列设置 / ✅ 列宽拖拽 / ✅ Sticky 表头 / ✅ 批量选择 |
| TableSettingsPanel/Trigger | [apps/server/src/components/admin/shared/modern-table/settings/](apps/server/src/components/admin/shared/modern-table/settings/) | 列显隐 + 可排序状态 |
| AdminDropdown | [apps/server/src/components/admin/shared/dropdown/AdminDropdown.tsx:7](apps/server/src/components/admin/shared/dropdown/AdminDropdown.tsx) | 行内操作菜单 |
| SelectionActionBar | [apps/server/src/components/admin/shared/batch/SelectionActionBar.tsx:24](apps/server/src/components/admin/shared/batch/SelectionActionBar.tsx) | 批量操作工具条 |
| PaginationV2 | [apps/server/src/components/admin/PaginationV2.tsx:13](apps/server/src/components/admin/PaginationV2.tsx) | 分页 + pageSize 切换 |

### 5.2 模块表格落地矩阵

| 模块 | ModernDataTable | 列设置 | 服务端排序 | PaginationV2 | 批量操作 |
|---|:-:|:-:|:-:|:-:|:-:|
| videos | ✅ | ✅ | ✅ | ✅ | ✅ |
| staging | ✅ | ✅ | ✅ | ✅ | ✅ |
| content/submissions | ✅ | ✅ | ✅ | ✅ | ✅ |
| content/subtitles | ✅ | ✅ | ✅ | ✅ | ✅ |
| banners | ✅ | ✅ | 部分 | ✅ | AdminDropdown |
| users | ✅ | ✅ | ✅ | ✅ | AdminDropdown |
| **moderation** | ❌ 原生 `<table>` | ❌ | ❌ | 手工分页 | ✅ |
| **sources（4 tab）** | 部分 | ❌ | ❌ | 自定义/无 | 部分 |
| **image-health** | ❌ 仪表盘式 | ❌ | ❌ | ❌ | ❌ |
| crawler-site | ✅ | ✅ | ✅ | ❌ | 部分 |
| system/monitor | ✅ | ✅ | 客户端 | ❌ | ❌ |
| system/cache | ✅ | ✅ | 客户端 | ❌ | ❌ |
| design-tokens | ✅ | ✅ | 客户端 | ❌ | ❌ |

**统计**：12 模块中 ModernDataTable 完全采纳 7 个（58%），完整 PaginationV2 采纳 6 个（50%）。

### 5.3 显著不一致实例

1. **OrphanVideoTable** [components/admin/sources/OrphanVideoTable.tsx:116](apps/server/src/components/admin/sources/OrphanVideoTable.tsx) 用原生 `<table>`，无列设置/无分页。
2. **ModerationList** [components/admin/moderation/ModerationList.tsx](apps/server/src/components/admin/moderation/ModerationList.tsx) 手工分页（PAGE_SIZE=30），无 PaginationV2。
3. **SourceTable** [components/admin/sources/SourceTable.tsx:50-54](apps/server/src/components/admin/sources/SourceTable.tsx) searchParams 手工管理，多参数无统一同步。
4. **ImageHealthDashboard** 走仪表盘 + 矩阵图，无表格基础设施，与其他列表不可比。
5. **system/monitor、cache、design-tokens** 已用 ModernDataTable，但仅客户端排序，无服务端分页，无法承载大数据集。

### 5.4 旧 apps/web/ 残留

- 实际文件：仅 `.next/` 构建产物 9 个子目录（`build-manifest.json`、`trace` 等）
- 源码：**无**（无 `src/`、`pages/`、`app/`、`package.json`）
- workspace 注册：根 `package.json:workspaces` 含 `apps/*`，apps/web 仍被 glob 匹配
- 代码引用：`grep "apps/web\|@resovo/web"` 全仓库 0 命中
- 结论：**纯遗留物，可直接删除目录 + 从 workspace 隐式排除**

### 5.5 筛选/查询参数管理

**无统一机制**。各模块各写一套：
- VideoTable：`useSearchParams()` + 手工 URL 同步
- UserTable：debounce 搜索 + 自重置页码
- SourceTable：5 参数（keyword/title/siteKey/sortField/sortDir）独立管理
- ModerationList：useState 内存态，无 URL/storage 持久化
- 无 `useTableQuery` 或类似 hook

---

## 6. 数据管理状态

### 6.1 视频 ↔ catalog ↔ source 三方关系

```
videos                     media_catalog                video_sources
┌──────────┐               ┌──────────┐                ┌─────────────────────┐
│ id       │ N─────1       │ id       │       1─────N  │ video_id            │
│ catalog_id ────────────→ │ aliases  │                │ episode_number      │
│ short_id │               │ genres   │                │ source_url          │
│ status*  │               │ ...      │                │ source_name (线路)  │
└──────────┘               └──────────┘                │ source_site_key     │
   * status = is_published                              │ is_active           │
     + visibility_status                                │ last_checked        │
     + review_status                                    └─────────────────────┘
                                                       UNIQUE NULLS NOT DISTINCT
                                                       (video_id, episode_number, source_url)
                                                       — 迁移 007:64
```

### 6.2 唯一约束清单（关键）

| 表 | 约束 | 来源迁移 | 影响 |
|---|---|---|---|
| video_sources | `UNIQUE (video_id, episode_number, source_url)` | 007:64 | **不限制 site_key**，同一视频同一站点可有多条线路 |
| video_external_refs | `UNIQUE (video_id, provider, external_id)` | 045 | 单视频对单 provider 只能 1 条 |
| videos | （无 title 唯一约束） | — | 合并完全靠 catalog_id |
| home_banners | （无组合唯一） | 049 | 软删除依赖 deleted_at? |

### 6.3 视频状态三元组（Migration 023 触发器强约束）

- `is_published`：true/false
- `visibility_status`：'public' / 'internal' / 'hidden'
- `review_status`：'pending_review' / 'approved' / 'rejected'

合法迁移由 DB 触发器保证；**前台只接受 `is_published=true AND visibility_status='public'`**。

### 6.4 软删除一致性

各表 `deleted_at IS NULL` 过滤散落在 query 层，无统一中间件。grep 表明 videos.ts、sources.ts、banners.ts 各自实现，存在遗漏风险。

### 6.5 缓存层

- Redis：HomeService.topTen 缓存 60s（[apps/api/src/services/HomeService.ts](apps/api/src/services/HomeService.ts)）
- 后台修改 banner / home_modules 是否触发缓存失效——未在 admin/banners.ts 看到 `cache.invalidate` 调用，需 §8 进一步确认

---

## 7. 9 大痛点对照（含 P0/P1/P2 优先级）

| # | 痛点 | 现状定位 | 性质 | 优先级 |
|---|---|---|:-:|:-:|
| 1 | 采集错误合并 + 缺人工拆分 | [MediaCatalogService.findOrCreate](apps/api/src/services/MediaCatalogService.ts) step 5 模糊匹配 (`title_normalized + year + type`) 自动合并；`POST /admin/videos/:id/split` 类接口 / Service 方法 / UI 入口三层均无 | 缺失 | **P0** |
| 2 | 一视频一站点只能 1 线路 | **数据模型无此约束**——[video_sources unique 仅含 (video_id, episode_number, source_url)](apps/api/src/db/migrations/007_video_merge.sql) 迁移 007:64。真因是 [SourceTable](apps/server/src/components/admin/sources/SourceTable.tsx) UI 平铺展示，未按视频/线路分组，且视频详情页无线路管理区，导致管理员看不到多线路 | 设计漂移（UI） | **P1** |
| 3 | 验证 vs 实际播放不一致 | [verifyWorker.ts:48-77](apps/api/src/workers/verifyWorker.ts) 仅做 HEAD + .m3u8 fallback GET + Content-Type 检验，**与前台播放器（hls.js/mpegts.js）不同源**——播放器有更复杂的分片重试、超时策略，无法以单次 HEAD 推断可播性 | 设计漂移 | **P0** |
| 4 | 标签兼容不足（豆瓣"剧情"无映射） | [genreMapper.ts:61](apps/api/src/lib/genreMapper.ts) 显式定义 `'剧情': null` —— 设计上视为"万能标签无信息量"故意丢弃；映射表硬编码无 admin UI；豆瓣导入 [ExternalDataImportService.ts:332-346](apps/api/src/services/ExternalDataImportService.ts) **直接写 media_catalog.genres 原始值，未经 genreMapper 处理**——映射器与导入路径脱节 | 设计漂移 + 缺失 | **P1** |
| 5 | 前台详情/播放页"视频不存在或下架" | 前台严格 `is_published=true AND visibility_status='public'`（[videos.ts:263-279](apps/api/src/db/queries/videos.ts)）；后台编辑默认 `visibility_status='internal'`，管理员不主动切换即触发 404；后台列表无"前台可见"列提示 | 设计漂移（UX） | **P1** |
| 6 | 审核台筛选每处理一条就重置 | [ModerationDashboard.tsx:45-48](apps/server/src/components/admin/moderation/ModerationDashboard.tsx) 在 `handleReviewed` 内执行 `setListRefreshKey((k)=>k+1)` 触发 [ModerationList](apps/server/src/components/admin/moderation/ModerationList.tsx) `key={listRefreshKey}` 强制重挂载；ModerationList 所有筛选条件用 useState 内存态（无 URL/storage 持久化），重挂载即清零 | bug | **P0** |
| 7 | 首页 banner / Top10 / 推荐缺统一管理 | banner 已完整（[admin/banners.ts](apps/api/src/routes/admin/banners.ts) 6 端点 + UI）；**home_modules 表已建（迁移 050）但 admin API 路由 + UI 完全缺失**——Top10/推荐模块只能手工 SQL 操作 | 缺失 | **P1** |
| 8 | 视频源管理需按线路展示 + 可展开 | [SourceTable.tsx](apps/server/src/components/admin/sources/SourceTable.tsx) 4 tab（all / inactive / submissions / orphan）平铺所有源，无视频维度分组、无展开模式；视频详情页 [/admin/videos/[id]](apps/server/src/app/admin/videos/[id]) 无 source/线路管理区 | 设计漂移 | **P1** |
| 9 | 后台表格界面不统一 | ModernDataTable 采纳率 58%（详见 §5.2），moderation/sources/image-health 仍走原生表格或仪表盘；无统一 useTableQuery hook（详见 §5.5）；筛选与分页易脱同步 | 设计漂移 | **P1** |

**优先级分布**：P0 × 3（痛点 1 / 3 / 6）+ P1 × 6（痛点 2 / 4 / 5 / 7 / 8 / 9）+ P2 × 0

> **P0 判定理由**：
> - **痛点 1**：错误合并不可逆，每天采集每多一天损失越大；缺少救济通道。
> - **痛点 3**：审核台核心信号失真，会放过失效源 / 误杀有效源，直接污染线上。
> - **痛点 6**：审核效率门槛——筛选重置等于强制全量翻找，影响每天审核吞吐。

---

## 8. 风险与盲区

### 8.1 调研中发现的隐性问题（非用户提出，但建议跟进）

| # | 隐性问题 | 证据 | 建议优先级 |
|---|---|---|:-:|
| H-1 | `apps/web/` 完全废弃但仍占 workspace、未删 `.next/` | §5.4 | P2（一行 rm + workspace 调整） |
| H-2 | `docs/architecture.md` §1/§1a 仍写 `apps/web/src/app`，与现实脱节 | §1.2 | P2（文档维护） |
| H-3 | banner / home_modules 修改后未见 cache.invalidate 调用 | [admin/banners.ts](apps/api/src/routes/admin/banners.ts) 全文 grep | P1（潜在缓存脏数据） |
| H-4 | ExternalDataImportService 写入 media_catalog.genres 原始值，绕过 genreMapper | §7 痛点 4 | 与痛点 4 合并 |
| H-5 | 视频默认 `visibility_status='internal'` 是否合理需复盘——若改为 'public' 则痛点 5 自然消解 | §3.2 step 7 | 与痛点 5 合并 |
| H-6 | 软删除过滤无统一中间件，散落 query 层 | §6.4 | P2（重构机会） |
| H-7 | 122 admin endpoints 鉴权混用 `auth` / `adminOnly` / `moderator+`，未见统一鉴权矩阵文档 | §4 表格 | P2（合规审计风险） |
| H-8 | crawler-site 表格无分页（数据量增长后会卡） | §5.2 | P2 |

### 8.2 调研边界（本报告未覆盖）

- 性能压测数据（admin 列表页响应时间分布）——超出只读调研范围
- 审核台日均处理量、合并错误率——需埋点数据，当前不在 logging-rules 覆盖
- 多语言支持：admin 是否有 i18n 计划——未涉及（admin 当前无 locale）
- 权限细粒度（moderator vs admin 实际操作差异）——只看了路由前置鉴权，未看 service 层二次校验

### 8.3 后续 CHG 卡建议归并方向（**仅供规划参考，本任务不创建**）

依据用户指示，本报告**不**草拟修复任务。但建议后续按以下边界拆 CHG：

- **CHG-A 采集合并治理**：痛点 1 + H-4
- **CHG-B 验证-播放同源化**：痛点 3
- **CHG-C 审核台重构**：痛点 6 + 痛点 5 的"前台可见性提示"
- **CHG-D 视频源 / 线路管理重构**：痛点 2 + 痛点 8（同一域，合卡）
- **CHG-E 标签映射收口**：痛点 4 + H-4
- **CHG-F 首页运营位统一**：痛点 7 + H-3
- **CHG-G 表格基建统一 + 旧 web 清理**：痛点 9 + H-1 + H-2

---

## 附录 A. 子代理调用清单

| 主题 | subagent | model | 输出长度 |
|---|---|---|---|
| 视频 + staging + 前台 404（痛点 1/5） | Explore | claude-sonnet-4-6 | ~1100 字 |
| 视频源 + 线路 + 视频源管理（痛点 2/8） | Explore | claude-sonnet-4-6 | ~950 字 |
| 审核台 + 验证 + 筛选重置（痛点 3/6） | Explore | claude-sonnet-4-6 | ~1100 字 |
| 标签映射 + 首页运营位（痛点 4/7） | Explore | claude-sonnet-4-6 | ~1100 字 |
| 表格基建 + 旧 web 残留（痛点 9） | Explore | claude-sonnet-4-6 | ~1300 字 |

主循环模型：claude-sonnet-4-6（汇总 + 报告撰写）。

— END —
