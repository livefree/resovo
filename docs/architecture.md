# Resovo（流光） — 技术架构参考

> status: active
> owner: @engineering
> scope: system architecture and module boundaries
> source_of_truth: yes
> supersedes: architecture-current.md（2026-03-27 合并）
> superseded_by: none
> last_reviewed: 2026-03-27
>
> 本文件是架构的唯一权威来源。所有与架构相关的代码决策必须与本文件保持一致。
> 若代码实现与本文件有出入，以本文件为准并修改代码。

---

## 项目目录结构

```
resovo/
├── CLAUDE.md                        # Claude Code 工作总纲
├── docs/                            # 所有文档（不含业务代码）
│   ├── architecture.md
│   ├── decisions.md
│   ├── tasks.md
│   ├── task-queue.md
│   ├── changelog.md
│   └── rules/
│       ├── code-style.md
│       ├── api-rules.md
│       ├── db-rules.md
│       ├── ui-rules.md
│       ├── test-rules.md
│       └── admin-module-template.md
├── scripts/
│   ├── migrate.ts
│   ├── clear-crawled-data.ts
│   ├── stop-all-crawls.ts
│   ├── test-crawler-site.ts
│   └── ...
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (home)/page.tsx      # 首页
│   │   │   ├── browse/page.tsx      # 分类浏览
│   │   │   ├── search/page.tsx      # 搜索页
│   │   │   ├── movie/[slug]/page.tsx
│   │   │   ├── anime/[slug]/page.tsx
│   │   │   ├── series/[slug]/page.tsx
│   │   │   ├── variety/[slug]/page.tsx
│   │   │   ├── others/[slug]/page.tsx
│   │   │   ├── watch/[slug]/page.tsx # 播放页（CSR）
│   │   │   ├── auth/login/page.tsx
│   │   │   ├── auth/register/page.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx          # 数据看板
│   │   │       ├── videos/page.tsx
│   │   │       ├── sources/page.tsx
│   │   │       ├── users/page.tsx
│   │   │       ├── content/page.tsx
│   │   │       ├── submissions/page.tsx
│   │   │       ├── subtitles/page.tsx
│   │   │       ├── crawler/page.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       └── system/{cache,config,monitor,settings,migration,sites}/page.tsx
│   ├── components/
│   │   ├── admin/
│   │   │   ├── shared/
│   │   │   │   ├── modern-table/     # ModernDataTable + 列管理 hooks
│   │   │   │   ├── batch/            # SelectionActionBar, AdminBatchBar
│   │   │   │   ├── dropdown/         # AdminDropdown (portal 渲染)
│   │   │   │   ├── toolbar/          # AdminToolbar
│   │   │   │   ├── pagination/       # PaginationV2
│   │   │   │   ├── dialog/           # AdminDialogShell, ConfirmDialog
│   │   │   │   └── form/
│   │   │   ├── system/crawler-site/
│   │   │   │   ├── CrawlerSiteManager.tsx
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   └── services/crawlTaskService.ts
│   │   │   ├── videos/
│   │   │   ├── sources/
│   │   │   ├── users/
│   │   │   └── content/
│   │   ├── player/
│   │   │   ├── PlayerShell.tsx      # 播放器容器（壳层）
│   │   │   ├── ControlBar.tsx       # 控制栏
│   │   │   ├── EpisodeOverlay.tsx   # 选集浮层
│   │   │   ├── CCPanel.tsx          # 字幕面板
│   │   │   ├── SpeedPanel.tsx       # 倍速面板
│   │   │   ├── DanmakuBar.tsx       # 弹幕条
│   │   │   └── ResumePrompt.tsx     # 断点续播提示
│   │   ├── search/
│   │   │   ├── FilterBar.tsx        # 顶部筛选栏
│   │   │   ├── ResultCard.tsx       # 搜索结果卡片
│   │   │   └── MetaChip.tsx         # 可点击 meta chip
│   │   ├── video/
│   │   │   ├── VideoCard.tsx        # 视频卡片（首页/推荐用）
│   │   │   ├── VideoDetailHero.tsx  # 详情页 Banner
│   │   │   └── VideoMeta.tsx        # 视频 meta 区域
│   │   └── ui/                      # 通用 UI 原子组件
│   ├── api/                         # Fastify 后端（独立进程）
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── videos.ts
│   │   │   ├── search.ts
│   │   │   ├── sources.ts
│   │   │   ├── subtitles.ts
│   │   │   ├── danmaku.ts
│   │   │   ├── users.ts
│   │   │   └── admin/
│   │   ├── services/                # 业务逻辑层
│   │   │   ├── VideoService.ts
│   │   │   ├── SearchService.ts
│   │   │   ├── UserService.ts
│   │   │   ├── SourceService.ts
│   │   │   └── CrawlerService.ts
│   │   ├── db/                      # 数据库查询层
│   │   │   ├── queries/             # 原生 SQL 查询函数
│   │   │   └── migrations/          # 数据库迁移文件
│   │   ├── workers/
│   │   │   ├── crawlerWorker.ts
│   │   │   ├── verifyWorker.ts
│   │   │   └── crawlerScheduler.ts
│   │   └── lib/
│   │       ├── postgres.ts
│   │       ├── redis.ts
│   │       ├── queue.ts             # Bull 队列定义
│   │       └── elasticsearch.ts
│   ├── stores/
│   │   ├── playerStore.ts
│   │   ├── authStore.ts
│   │   └── themeStore.ts
│   ├── lib/
│   │   ├── api-client.ts            # 前端 API 请求封装
│   │   ├── utils.ts                 # cn() 等工具函数
│   │   └── constants.ts
│   └── types/                       # 统一类型入口
└── tests/
    ├── unit/
    └── e2e/
```

---

## 核心数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | gen_random_uuid() |
| username | TEXT UNIQUE | 3-20字符 |
| email | TEXT UNIQUE | 登录用 |
| password_hash | TEXT | bcrypt |
| role | TEXT | user/moderator/admin |
| locale | TEXT | 默认 en，如 zh-CN |
| created_at | TIMESTAMPTZ | |

### videos
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| short_id | CHAR(8) UNIQUE | nanoid，URL 使用 |
| slug | TEXT | SEO 路径段 |
| title | TEXT | 中文标题 |
| title_en | TEXT | 英文原名 |
| description | TEXT | |
| cover_url | TEXT | 外链 URL（爬虫采集的源站封面，不下载到 R2，见 ADR-009） |
| type | TEXT | 内容形式（VideoType 11种），见下方枚举；Migration 019（CHG-176）重建 |
| source_content_type | TEXT | 爬虫原样写入的源站类型字符串，用于溯源与重分类 |
| normalized_type | TEXT | 平台规范化分类，可比 type 更细，供搜索/推荐使用 |
| content_format | TEXT | `movie` / `episodic` / `collection` / `clip` |
| episode_pattern | TEXT | `single` / `multi` / `ongoing` / `unknown` |
| source_category | TEXT | 爬虫原始分类字符串（直接来自源站 type_name，不做枚举约束） |
| genre | TEXT | 内容题材（VideoGenre 15种）：action/comedy/romance/thriller/horror/sci_fi/fantasy/history/crime/mystery/war/family/biography/martial_arts/other；初始 NULL，由管理员策展填写 |
| rating | FLOAT | 0-10 |
| year | INT | |
| country | TEXT | JP/US/CN 等 |
| episode_count | INT | 默认 1 |
| status | TEXT | ongoing/completed |
| director | TEXT[] | 导演列表 |
| cast | TEXT[] | 演员/声优列表 |
| writers | TEXT[] | 编剧列表 |
| site_key | VARCHAR(100) FK → crawler_sites(key) | 来源站点标识；Migration 022（CHG-246） |
| douban_id | VARCHAR(20) | 豆瓣 ID，nullable；CHG-23 migration 003 |
| is_published | BOOLEAN | **deprecated**，保留作兼容字段，由 service 层与 visibility_status 同步写入，见 ADR-018 |
| review_status | TEXT | `pending_review` / `approved` / `rejected` / `blocked`；默认 `pending_review` |
| visibility_status | TEXT | `public` / `hidden` / `internal` / `blocked`；主可见性控制字段，默认 `internal`；替代 `is_published` |
| review_reason | TEXT | 审核备注（拒绝/封锁原因） |
| review_source | TEXT | `system` / `ai` / `manual` |
| reviewed_by | UUID FK → users | 审核操作人 |
| reviewed_at | TIMESTAMPTZ | 审核时间 |
| needs_manual_review | BOOLEAN | 是否需要人工复核，默认 false |
| created_at | TIMESTAMPTZ | |

### video_sources
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| season_number | INT NOT NULL DEFAULT 1 | 季号；电影/单集内容 = 1，见 ADR-016 |
| episode_number | INT NOT NULL DEFAULT 1 | 集号；电影/单集内容 = 1，不再使用 NULL（见 ADR-016） |
| source_url | TEXT | 第三方直链 |
| source_name | TEXT | 如"线路1" |
| quality | TEXT | 1080P/720P 等 |
| is_active | BOOLEAN | 爬虫维护 |
| submitted_by | UUID FK → users | NULL 表示爬虫 |
| last_checked | TIMESTAMPTZ | |

### subtitles
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| episode_number | INT | |
| language | TEXT | BCP 47，如 zh-CN |
| file_url | TEXT | R2 存储 URL |
| format | TEXT | vtt/srt/ass |
| uploaded_by | UUID FK → users | |
| is_verified | BOOLEAN | 版主审核 |
| created_at | TIMESTAMPTZ | |

### lists（播放列表 & 片单）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| short_id | CHAR(8) UNIQUE | |
| owner_id | UUID FK → users | |
| type | TEXT | playlist/collection |
| title | TEXT | |
| description | TEXT | |
| cover_url | TEXT | |
| visibility | TEXT | public/private/unlisted |
| item_count | INT | 冗余计数 |
| like_count | INT | 冗余计数 |
| view_count | INT | 冗余计数 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### list_items
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| list_id | UUID FK → lists | |
| video_id | UUID FK → videos | |
| position | INT | 拖拽排序 |
| added_at | TIMESTAMPTZ | |

### danmaku
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| user_id | UUID FK → users | |
| episode_number | INT | |
| time_seconds | INT | 出现时间点 |
| content | TEXT | |
| color | CHAR(7) | 默认 #ffffff |
| type | TEXT | scroll/top/bottom |
| created_at | TIMESTAMPTZ | |

### system_settings
| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(100) PK | 配置键 |
| value | TEXT | 配置值（JSON 字符串/普通字符串） |
| updated_at | TIMESTAMPTZ | 更新时间 |

### crawler_sites
> ⚠️ **主键是 `key VARCHAR(100)`，没有 `id UUID` 字段。** 任何代码或 Migration 中若出现 `REFERENCES crawler_sites(id)` 均为错误写法，应改为 `REFERENCES crawler_sites(key)`，且外键列类型需为 `VARCHAR(100)`。

| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(100) PK | 站点唯一标识（同时是 FK 被引用列，非 UUID） |
| name | VARCHAR(200) | 站点名 |
| api_url | TEXT UNIQUE INDEX | API 地址（唯一） |
| detail | TEXT | 站点说明/主页 |
| source_type | VARCHAR(20) | `vod` / `shortdrama` |
| format | VARCHAR(10) | `json` / `xml` |
| weight | INTEGER | 0-100 |
| is_adult | BOOLEAN | 成人源标记 |
| disabled | BOOLEAN | 是否禁用 |
| from_config | BOOLEAN | 是否来自配置文件 |
| last_crawled_at | TIMESTAMPTZ | 最近采集时间 |
| last_crawl_status | VARCHAR(20) | `ok` / `failed` / `running` |
| ingest_policy | JSONB | 站点级采集策略（Migration 018-partial，见 ADR-019）；默认值：`{"allow_auto_publish":false,"allow_search_index":true,"allow_recommendation":true,"allow_public_detail":true,"allow_playback":true,"require_review_before_publish":true}` |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

### crawler_runs
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 批次 ID |
| trigger_type | TEXT | `single` / `batch` / `all` / `schedule` |
| mode | TEXT | `incremental` / `full` |
| status | TEXT | `queued` / `running` / `paused` / `success` / `partial_failed` / `failed` / `cancelled` |
| control_status | TEXT | `active` / `pausing` / `paused` / `cancelling` / `cancelled` |
| requested_site_count | INT | 请求站点数 |
| enqueued_site_count | INT | 入队站点数 |
| skipped_site_count | INT | 跳过站点数 |
| timeout_seconds | INT | 批次超时参数 |
| created_by | UUID nullable | 创建者 |
| schedule_id | TEXT nullable | 定时任务标识 |
| summary | JSONB | 聚合统计 |
| started_at | TIMESTAMPTZ nullable | 开始时间 |
| finished_at | TIMESTAMPTZ nullable | 完成时间 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

### crawler_tasks
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 单站任务 ID |
| run_id | UUID nullable FK → crawler_runs | 所属批次 |
| type | TEXT | `full-crawl` / `incremental-crawl` / `verify-source` / `verify-single` |
| trigger_type | TEXT nullable | `single` / `batch` / `all` / `schedule` |
| source_site | TEXT | 站点 key |
| target_url | TEXT | 目标接口 |
| status | TEXT | `pending` / `running` / `paused` / `done` / `failed` / `cancelled` / `timeout` |
| cancel_requested | BOOLEAN | 协作式取消标记 |
| timeout_at | TIMESTAMPTZ nullable | 超时点 |
| heartbeat_at | TIMESTAMPTZ nullable | 心跳时间 |
| started_at | TIMESTAMPTZ nullable | 开始时间（CHG-156） |
| retry_count | INT | 重试计数 |
| result | JSONB | 结果与错误详情 |
| scheduled_at | TIMESTAMPTZ | 调度时间 |
| finished_at | TIMESTAMPTZ nullable | 完成时间 |

### crawler_task_logs
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 日志 ID |
| task_id | UUID nullable FK → crawler_tasks | 任务 |
| source_site | TEXT nullable | 站点 |
| level | TEXT | `info` / `warn` / `error` |
| stage | TEXT | 阶段标识 |
| message | TEXT | 日志文案 |
| details | JSONB | 结构化细节 |
| created_at | TIMESTAMPTZ | 创建时间 |

---

## videos 表补充字段（Migration 013/016）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | TEXT | — | 内容形式，11 种：`movie`/`series`/`anime`/`variety`/`documentary`/`short`/`sports`/`music`/`news`/`kids`/`other`；Migration 019（CHG-176）从旧 12 种重建 |
| `source_content_type` | TEXT | NULL | 爬虫原始类型字符串，不规范化 |
| `normalized_type` | TEXT | NULL | 平台规范化分类，当前与 `type` 保持一致 |
| `content_format` | TEXT | NULL | `movie`/`episodic`/`collection`/`clip` |
| `episode_pattern` | TEXT | NULL | `single`/`multi`/`ongoing`/`unknown` |
| `visibility_status` | TEXT | `internal` | **主可见性字段**；`public`/`hidden`/`internal`/`blocked`；替代 `is_published`（见 ADR-018） |
| `review_status` | TEXT | `pending_review` | `pending_review`/`approved`/`rejected`/`blocked` |
| `review_reason` | TEXT | NULL | 审核备注 |
| `review_source` | TEXT | NULL | `system`/`ai`/`manual` |
| `reviewed_by` | UUID | NULL | FK → users |
| `reviewed_at` | TIMESTAMPTZ | NULL | 审核时间 |
| `needs_manual_review` | BOOLEAN | `false` | 是否需要人工复核 |
| `is_published` | BOOLEAN | `false` | **deprecated**；保留用于向后兼容，由 `VideoService`/`CrawlerService` 与 `visibility_status` 同步写入，不得在新代码中直接写入（见 ADR-018 方案 B） |
| `site_key` | VARCHAR(100) | NULL | FK → crawler_sites(key)；Migration 022（CHG-246） |

**前台 API 约束（Migration 016 后）**：所有面向用户的视频查询使用 `WHERE visibility_status = 'public'`（旧代码逐步从 `is_published = true` 迁移）。

**索引补充：**
```sql
-- 旧索引（保留兼容期）
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published) WHERE is_published = true;
-- 新索引（Migration 016）
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility_status);
CREATE INDEX IF NOT EXISTS idx_videos_review_status ON videos(review_status);
```

---

## API Base URL 与版本

- 生产后端 API：`https://api.resovo.tv/v1`
- 开发后端 API：`http://localhost:4000/v1`（由 `NEXT_PUBLIC_API_URL` 环境变量控制）
- 所有响应格式：JSON
- 认证：`Authorization: Bearer <access_token>`（refresh_token 通过 HttpOnly Cookie）
- 错误格式：`{ "error": { "code": "...", "message": "...", "status": 4xx } }`

---

## 模块边界（严格遵守）

- **前端**不直接查询数据库，所有数据通过 API 获取
- **前端**不包含任何业务逻辑，只做渲染和状态管理
- **API 路由层**：参数校验、鉴权、响应整形；不得包含业务逻辑
- **services/**：业务编排（业务逻辑的唯一收敛点）；不直接拼 SQL
- **db/queries/**：SQL 与映射
- **workers/**：异步执行与状态写回
- **爬虫任务**通过 Bull 队列异步执行，不在 API 请求生命周期内运行

### 采集链路（必须解耦页面生命周期）

1. 前端调用 `POST /admin/crawler/runs`（或兼容入口 `/admin/crawler/tasks`）
2. `CrawlerRunService` 创建 `crawler_runs` + `crawler_tasks`
3. worker 从 `crawler-queue` 消费任务执行采集
4. worker 协作式检查 `freeze/cancel/pause/timeout`
5. DB 写回 `task` 与 `run` 状态
6. 前端通过 overview/runs/tasks 接口轮询展示，不驱动执行

### Worker 硬约束

- 无 `runId/taskId` 的 crawl job 拒绝执行
- 运行中支持协作式：pause（转 `paused` 并延迟重排队）、cancel（转 `cancelled`）、timeout（转 `timeout`）

---

## 采集控制与调度能力

### 调度器

- 文件：`src/api/workers/crawlerScheduler.ts`
- 启动条件：`CRAWLER_SCHEDULER_ENABLED=true`
- tick 周期：60 秒
- 调度行为：只创建 run/task 并入队，不直接执行采集

### 全局止血/冻结

- `POST /admin/crawler/stop-all`：可设置 `crawler_global_freeze=true`；标记活跃 run 为 cancelling；取消 pending/paused/running tasks；可移除 repeatable tick
- `POST /admin/crawler/freeze`：设置冻结开关
- `GET /admin/crawler/system-status`：暴露 `schedulerEnabled` / `freezeEnabled` / `orphanTaskCount`

---

## 状态所有权表（State Ownership）

> AI 修改任何组件前必须查阅此表。
> 每个状态字段只能由"写入方"修改，其他组件只读。
> 违反此规则会导致跨组件状态冲突。

### playerStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `isPlaying` | boolean | `VideoPlayer` 组件 | 所有播放器子组件 |
| `currentTime` | number | `VideoPlayer` 组件 | `ControlBar`、`DanmakuBar` |
| `duration` | number | `VideoPlayer` 组件 | `ControlBar` |
| `volume` | number | `ControlBar` | `VideoPlayer` |
| `isMuted` | boolean | `ControlBar` | `VideoPlayer` |
| `speed` | number | `SpeedPanel`（通过 `ControlBar`） | `VideoPlayer` |
| `currentEpisode` | number \| null | `EpisodeOverlay`、`ControlBar` | 所有播放器子组件 |
| `currentSource` | VideoSource \| null | `ControlBar`（线路选择） | `VideoPlayer` |
| `availableSources` | VideoSource[] | `PlayerShell`（数据加载） | `ControlBar` |
| `activeSubtitle` | Subtitle \| null | `CCPanel`（通过 `ControlBar`） | `VideoPlayer` |
| `availableSubtitles` | Subtitle[] | `PlayerShell`（数据加载） | `CCPanel` |
| `mode` | `'default'` \| `'theater'` | `ControlBar` 唯一（仅桌面端） | `PlayerShell` |
| `speedPanelOpen` | boolean | `ControlBar` 唯一 | `usePlayerShortcuts`（键盘状态机） |
| `episodeOverlayOpen` | boolean | `EpisodeOverlay`、`ControlBar` | `usePlayerShortcuts`（键盘状态机） |
| `resumePromptVisible` | boolean | `VideoPlayer`（进度检测后） | `ResumePrompt` 组件 |
| `resumeFromSeconds` | number \| null | `VideoPlayer`（读取存储后） | `ResumePrompt` 组件 |
| `danmakuEnabled` | boolean | `DanmakuBar` 唯一 | `VideoPlayer` |
| `danmakuOpacity` | number | `DanmakuBar` 唯一 | `VideoPlayer` |
| `danmakuFontSize` | number | `DanmakuBar` 唯一 | `VideoPlayer` |

### authStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `user` | User \| null | `authStore.login`、`authStore.logout`、`tryRestoreSession` | 所有需要用户信息的组件 |
| `accessToken` | string \| null | `authStore`（含自动刷新） | `api-client.ts` 唯一 |
| `isLoggedIn` | boolean | `login`、`logout`、`tryRestoreSession` | 持久化 |
| `isRestoring` | boolean | `tryRestoreSession` | 会话恢复过程标识 |

### themeStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `theme` | `'dark'` \| `'light'` \| `'system'` | `ThemeToggle` 组件唯一 | 所有组件（只读） |
| `resolvedTheme` | `'dark'` \| `'light'` | `setTheme`/`syncSystemTheme` | 实际生效主题 |

### adminStore

后台管理相关状态独立存放 `adminStore`，不混入 `playerStore` 或 `authStore`：

| 状态字段 | 唯一写入方 | 说明 |
|---------|-----------|------|
| `selectedVideoIds` | 视频管理列表组件 | 批量操作选中的视频 |
| `crawlerStatus` | 爬虫管理页面 | 当前各资源站运行状态 |
| `pendingCounts` | 后台 layout（轮询） | 各审核队列待处理数量（导航角标） |

---

## Admin 列表共享能力

### useAdminTableState 协议

文件：`src/components/admin/shared/table/useAdminTableState.ts`

```typescript
type AdminTableState = {
  sort?: { field: string; dir: 'asc' | 'desc' }
  columns?: Record<string, { visible: boolean; width?: number }>
  pagination?: { page: number; pageSize: number }
  filters?: Record<string, string | number | boolean | null>
  scroll?: { top?: number; left?: number }
}
```

- 存储键：`admin:table:{route}:{tableId}:v1`
- 能力：`getState` / `setState` / `updatePartial` / `reset`

### 列管理 Hook

文件：`useAdminTableColumns.ts`
- 列显隐持久化
- 列宽拖拽（min/max/resizable）
- 默认列元数据与持久化状态合并

### 排序与筛选

文件：`useAdminTableSort.ts` / `useAdminColumnFilter.ts`
- 排序 API：`setSort`/`toggleSort`/`clearSort`
- 列筛选容器：open/close/active/clear 协议
- 业务筛选项由页面注入，不在 shared 层固化

---

## 采集接口字段映射（苹果CMS → Resovo（流光） 数据库）

> CrawlerService 解析接口数据时必须严格按此映射表处理，不得自行猜测字段含义。

### 元数据映射（接口字段 → videos 表）

| 接口字段 | 数据库字段 | 类型转换 / 处理规则 |
|---------|-----------|-------------------|
| `vod_name` | `title` | 直接映射，trim 空白 |
| `vod_en` | `title_en` | 直接映射，可为空 |
| `vod_pic` | `cover_url` | 直接存外链 URL，不下载（ADR-009） |
| `type_name` | `category` | 标准化映射，见下方分类映射表 |
| `vod_year` | `year` | 转 INT，无效值存 NULL |
| `vod_area` | `country` | 标准化为 ISO 3166-1 代码，见下方地区映射表 |
| `vod_actor` | `cast` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_director` | `director` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_writer` | `writers` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_content` | `description` | 用 `striptags` 清理 HTML 标签 |
| `vod_remarks` | `status` | 含"完结"→`completed`，其余→`ongoing` |
| `type_name` | `type` | 见下方类型映射表 |
| `vod_id` | （不存 videos 表）| 存入 `crawler_tasks.result.source_vod_id`，用于增量更新对比 |

### 播放源映射（接口字段 → video_sources 表）

接口中播放源在 `vod_play_url` 字段（JSON 格式）或 `<dl><dd>` 节点（XML 格式）：

```
# 原始格式（单个线路）：
第01集$https://cdn.example.com/ep01.m3u8#第02集$https://cdn.example.com/ep02.m3u8

# 解析规则：
1. 按 # 拆分得到每集字符串
2. 按 $ 拆分得到 [集名, URL]
3. 从集名提取集数（正则：/(\d+)/），未提取到时默认 1
4. season_number 默认写 1（苹果CMS 接口无季字段）
5. 电影/单集（episode_count=1）：season_number=1, episode_number=1（不再使用 NULL，见 ADR-016）
```

| 解析结果 | 数据库字段 | 说明 |
|---------|-----------|------|
| 线路标识（flag 属性） | `source_name` | 如 "jsm3u8"、"heimuer" |
| 季号（默认 1） | `season_number` | INT NOT NULL DEFAULT 1，见 ADR-016 |
| 集数（从集名解析） | `episode_number` | INT NOT NULL DEFAULT 1；电影/单集写 1，不再使用 NULL |
| m3u8/mp4 URL | `source_url` | 第三方直链（ADR-001） |
| URL 后缀判断 | `type` | `.m3u8`→`hls`，`.mp4`→`mp4` |

### 类型映射表（type_name → VideoType）— Migration 019 更新后

> `source_content_type` 存爬虫原始字符串；`type` 是内容形式枚举（11种）；`source_category` 存爬虫原始分类字符串；`genre` 是平台策展题材（15种，初始 NULL）。
> VideoType（内容形式）与 VideoGenre（内容题材）严格正交，同一词不同时出现在两个维度（见 `docs/db-rebuild-naming-plan.md`）。

| 接口值（`vod_type_name` / `type_name`） | `videos.type` | `videos.source_content_type` |
|----------------------------------------|--------------|------------------------------|
| 电影、Movie、film | `movie` | 原样写入 |
| 电视剧、连续剧、国产剧、美剧、韩剧、日剧、港剧、台剧 | `series` | 原样写入 |
| 动漫、卡通、动画、anime | `anime` | 原样写入 |
| 综艺、真人秀、晚会、脱口秀、游戏、电竞 | `variety` | 原样写入 |
| 短剧、微剧、竖屏剧 | `short` | 原样写入 |
| 纪录片、documentary | `documentary` | 原样写入 |
| 音乐、MV、演唱会 | `music` | 原样写入 |
| 体育、sports、赛事 | `sports` | 原样写入 |
| 新闻、资讯 | `news` | 原样写入 |
| 少儿、儿童节目 | `kids` | 原样写入 |
| 其他 / 未知 / 未匹配 | `other` | 原样写入 |

**未匹配规则**：凡 `type_name` 不在上表中的，`type` 写 `other`，`source_content_type` 保留原始值，供后续重分类。

### 地区映射表（vod_area → country）

| 接口值 | ISO 代码 |
|--------|---------|
| 中国大陆、大陆、国产、华语 | `CN` |
| 香港、港剧 | `HK` |
| 台湾 | `TW` |
| 日本、日剧 | `JP` |
| 韩国、韩剧 | `KR` |
| 美国、美剧 | `US` |
| 英国 | `GB` |
| 泰国 | `TH` |
| 其他 / 未知 | `NULL` |

### 去重规则

1. **精确匹配**：`title` + `year` 完全相同 → 视为同一视频，只新增 `video_sources` 记录
2. **模糊匹配**：标题去掉标点和空格后相同 → 同上处理
3. **无法匹配**：新建 `videos` 记录

去重时以第一个采集到的资源站数据为准（元数据不覆盖），后续采集只追加播放源。

---

## 爬虫任务类型

| 任务名 | 队列 | 触发方式 | 说明 |
|--------|------|---------|------|
| `full-crawl` | `crawler-queue` | 手动 / 初始化时 | 全量采集，按分页遍历所有内容 |
| `incremental-crawl` | `crawler-queue` | 每日凌晨 2:00 | 增量采集，`?h=24` 只拉最近更新 |
| `verify-source` | `verify-queue` | 每日凌晨 4:00 | 验证所有 `is_active=true` 的播放源 |
| `verify-single` | `verify-queue` | 用户举报时触发 | 验证单条播放源可用性 |

---

## 用户角色体系

```typescript
type UserRole = 'user' | 'moderator' | 'admin'
```

权限继承：admin ⊃ moderator ⊃ user

---

## 前台路由结构

```
# 首页
/[locale]                              ← 首页

# 分类浏览页
/[locale]/browse                       ← 全部内容浏览
/[locale]/browse?type=movie            ← 电影

# 视频详情页（SSR，按类型分路径，利于 SEO）
/[locale]/movie/[slug]                 ← 电影详情（type=movie）
/[locale]/anime/[slug]                 ← 动漫详情（type=anime）
/[locale]/series/[slug]                ← 剧集详情（URL 保留 /series/ 兼容 SEO，见 ADR-017）
/[locale]/variety/[slug]               ← 综艺详情（type=variety）
/[locale]/others/[slug]                ← 其他类型统一入口（type=short/documentary/music/sports/news/kids/other）

# 视频播放页（CSR）
/[locale]/watch/[slug]                 ← 播放页（?ep=N 指定集数）

# 搜索
/[locale]/search                       ← 搜索结果页

# 片单
/[locale]/collections                  ← 片单列表
/[locale]/collections/[id]             ← 片单详情

# 用户
/[locale]/auth/login                   ← 登录
/[locale]/auth/register                ← 注册
/[locale]/profile                      ← 个人中心

# 后台
/[locale]/admin/...
```

**slug 格式**：`{title-en-kebab}-{shortId}`，例：`attack-on-titan-aB3kR9x`

**URL 前缀 ↔ VideoType 映射**：

| URL 路径前缀 | `videos.type` 值 | 说明 |
|-------------|-----------------|------|
| `/movie/` | `movie` | 电影 |
| `/anime/` | `anime` | 动漫 |
| `/series/` | `series` | 连续剧 / 剧集 |
| `/variety/` | `variety` | 综艺 |
| `/others/` | `short` / `documentary` / `music` / `sports` / `news` / `kids` / `other` | 其他类型统一入口 |
| `/watch/` | 任意 | 播放页，不区分类型 |

---

## /admin 路由结构（当前）

```
/admin                          ← 重定向到 /admin/dashboard（数据看板）

# 内容管理区（moderator + admin）
/admin/videos                   ← 视频列表（含上下架、待审筛选）
/admin/videos/new               ← 手动添加视频
/admin/sources                  ← 播放源列表（含失效筛选）
/admin/content                  ← 投稿/字幕审核双 Tab
/admin/submissions              ← 兼容入口 → /admin/content?tab=submissions
/admin/subtitles                ← 兼容入口 → /admin/content?tab=subtitles

# 系统管理区（admin only）
/admin/users                    ← 用户列表（封号/解封/角色管理）
/admin/crawler                  ← 采集域统一入口（4 tab：Sites/Console/Logs/Settings，见 ADR-014）
/admin/analytics                ← 数据看板（流量/播放/搜索统计）
/admin/system/cache             ← Redis 清理
/admin/system/settings          ← 全局参数
/admin/system/config            ← 系统参数（爬虫配置段待迁移至 /admin/crawler?tab=settings）
/admin/system/migration         ← 数据导入/导出
/admin/system/monitor           ← 应用级监控
/admin/system/sites             ← 307 redirect → /admin/crawler?tab=sites
/admin/403                      ← 无权限
```

**采集控制台 Tab 目标结构（CHG-169 后）：**

| Tab | 内容 | 来源 |
|-----|------|------|
| Sites（站点） | crawler_sites 管理、ingest_policy 配置、单站触发 | 原 `/admin/system/sites` |
| Console（控制台） | crawler_runs 批次、crawler_tasks 任务、stop-all/freeze | 原有控制台内容 |
| Logs（日志） | crawler_task_logs 查询 | 当前内嵌于 Console，独立为 tab |
| Settings（设置） | 自动采集 auto-config、调度设置、爬虫 API 配置 | 原 `/admin/system/config` 爬虫段 |

**访问控制规则（Next.js middleware 层实现）：**
- `/admin/*` 全部路径：未登录 → 重定向 `/auth/login`；`role === 'user'` → 重定向 `/admin/403`
- `/admin/users`、`/admin/crawler`、`/admin/analytics`：`role !== 'admin'` → 重定向 `/admin/403`

---

## 管理端鉴权与访问控制

- API 路由通过 `authenticate + requireRole` 控制
- 前端 `api-client` 统一携带 token，401 自动 refresh 一次并重试
- refresh 失败时清理 authStore 并跳转登录页

---

## 已落地 Migration 列表

| 文件 | 内容 | 状态 |
|------|------|------|
| `011_add_paused_statuses.sql` | crawler_tasks 状态扩展（paused/cancelled/timeout） | ✅ |
| `012_add_task_started_at.sql` | crawler_tasks.started_at | ✅ |
| `013_type_expansion.sql` | videos.type 枚举 4→12 种；新增 source_content_type / normalized_type / content_format / episode_pattern | ✅ |
| `014_season_episode.sql` | video_sources + watch_history 新增 season_number NOT NULL；episode_number NOT NULL DEFAULT 1 | ✅ |
| `015_content_format_backfill.sql` | 存量 content_format / episode_pattern 按 type+episode_count+status 规则回填 | ✅ |
| `016_review_visibility.sql` | videos 新增 review_status / visibility_status / review_reason / review_source / reviewed_by / reviewed_at / needs_manual_review | ✅ |
| `018_partial_ingest_policy.sql` | crawler_sites.ingest_policy JSONB（站点级采集策略） | ✅ |
| `019_rebuild_video_type.sql` | videos.type 从旧 12 种重建为 11 种（CHG-176） | ✅ |
| `022_add_site_key_to_videos.sql` | videos.site_key VARCHAR(100) FK → crawler_sites(key)；用于来源筛选（CHG-246） | ✅ |

---

## 运行与命令

```bash
# 开发
npm run dev                         # 前端开发服务器
npm run api                         # 后端 Fastify 开发服务器
npm run migrate                     # 执行数据库迁移

# 爬虫工具
npm run clear:crawled-data          # 一键清空采集数据
npm run crawler:stop-all            # 止血停止采集
npm run test:crawler-site -- --site=<key> --hours=24  # 单站脚本采集验证

# 测试
npm run typecheck                   # 类型检查
npm run lint                        # Lint
npm run test -- --run               # 单元测试
npm run test:coverage               # 单元测试 + 覆盖率
npm run test:e2e                    # E2E 测试
```
