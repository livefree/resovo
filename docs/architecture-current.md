# Resovo（流光）— 技术架构（当前实现快照）

> 本文件基于当前代码仓库实现生成，用于记录“当前真实架构状态”。
> 若与 `docs/architecture.md` 有差异，以代码与本文件快照为准，后续需统一回主架构文档。

---

## 项目目录结构

```text
resovo/
├── CLAUDE.md
├── docs/
│   ├── architecture.md
│   ├── architecture-current.md
│   ├── tasks.md
│   ├── task-queue.md
│   ├── changelog.md
│   └── ...
├── scripts/
│   ├── migrate.ts
│   ├── clear-crawled-data.ts
│   ├── stop-all-crawls.ts
│   ├── test-crawler-site.ts
│   └── ...
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (home)/page.tsx
│   │   │   ├── browse/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── movie/[slug]/page.tsx
│   │   │   ├── anime/[slug]/page.tsx
│   │   │   ├── series/[slug]/page.tsx
│   │   │   ├── variety/[slug]/page.tsx
│   │   │   ├── watch/[slug]/page.tsx
│   │   │   ├── auth/login/page.tsx
│   │   │   ├── auth/register/page.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx
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
│   │   │   │   ├── table/useAdminTableState.ts
│   │   │   │   ├── table/useAdminTableColumns.ts
│   │   │   │   ├── table/useAdminTableSort.ts
│   │   │   │   ├── table/useAdminColumnFilter.ts
│   │   │   │   ├── toolbar/AdminToolbar.tsx
│   │   │   │   ├── batch/AdminBatchBar.tsx
│   │   │   │   ├── dialog/AdminDialogShell.tsx
│   │   │   │   └── form/*
│   │   │   ├── system/crawler-site/
│   │   │   │   ├── CrawlerSiteManager.tsx
│   │   │   │   ├── components/*
│   │   │   │   ├── hooks/*
│   │   │   │   └── services/crawlTaskService.ts
│   │   │   ├── videos/*
│   │   │   ├── sources/*
│   │   │   ├── users/*
│   │   │   └── content/*
│   │   ├── player/*
│   │   ├── search/*
│   │   ├── browse/*
│   │   └── ui/*
│   ├── api/
│   │   ├── server.ts
│   │   ├── lib/{postgres,redis,queue,elasticsearch}.ts
│   │   ├── plugins/{authenticate,metrics}.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── videos.ts
│   │   │   ├── sources.ts
│   │   │   ├── subtitles.ts
│   │   │   ├── search.ts
│   │   │   ├── users.ts
│   │   │   ├── danmaku.ts
│   │   │   └── admin/*.ts
│   │   ├── services/*.ts
│   │   ├── db/
│   │   │   ├── migrations/*.sql
│   │   │   └── queries/*.ts
│   │   └── workers/{crawlerWorker,verifyWorker,crawlerScheduler}.ts
│   ├── stores/{authStore,playerStore,themeStore}.ts
│   ├── lib/{api-client,utils,video-detail}.ts
│   └── types/*.ts
└── tests/
```

---

## 核心数据库表结构（当前）

### 用户与内容核心

- `users`
- `videos`（详见 `docs/architecture.md` videos 表；治理层字段见 ADR-017/018，待 Migration 013/016 落地）
- `video_sources`（`season_number` 字段待 Migration 014 落地，当前 `episode_number` 仍可为 NULL）
- `subtitles`
- `tags` / `video_tags`
- `lists` / `list_items` / `list_likes`
- `danmaku`
- `comments`
- `watch_history`（`season_number` 字段待 Migration 014 落地）
- `user_favorites`

### 系统配置

#### system_settings
| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(100) PK | 配置键 |
| value | TEXT | 配置值（JSON 字符串/普通字符串） |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### crawler_sites
> ⚠️ **注意**：`crawler_sites` 的主键是 `key VARCHAR(100)`，**没有** `id UUID` 字段。任何代码或 Migration 中若出现 `REFERENCES crawler_sites(id)` 均为错误写法，应改为 `REFERENCES crawler_sites(key)`，且外键列类型需为 `VARCHAR(100)`。

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

### 采集任务系统（run/task 模型）

#### crawler_runs
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

#### crawler_tasks
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 单站任务 ID |
| run_id | UUID nullable FK -> crawler_runs | 所属批次 |
| type | TEXT | `full-crawl` / `incremental-crawl` / `verify-source` / `verify-single` |
| trigger_type | TEXT nullable | `single` / `batch` / `all` / `schedule` |
| source_site | TEXT | 站点 key |
| target_url | TEXT | 目标接口 |
| status | TEXT | `pending` / `running` / `paused` / `done` / `failed` / `cancelled` / `timeout` |
| cancel_requested | BOOLEAN | 协作式取消标记 |
| timeout_at | TIMESTAMPTZ nullable | 超时点 |
| heartbeat_at | TIMESTAMPTZ nullable | 心跳时间 |
| retry_count | INT | 重试计数 |
| result | JSONB | 结果与错误详情 |
| scheduled_at | TIMESTAMPTZ | 调度时间 |
| finished_at | TIMESTAMPTZ nullable | 完成时间 |

#### crawler_task_logs
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 日志 ID |
| task_id | UUID nullable FK -> crawler_tasks | 任务 |
| source_site | TEXT nullable | 站点 |
| level | TEXT | `info` / `warn` / `error` |
| stage | TEXT | 阶段标识 |
| message | TEXT | 日志文案 |
| details | JSONB | 结构化细节 |
| created_at | TIMESTAMPTZ | 创建时间 |

---

## API Base URL 与版本

- 默认后端 API：`http://localhost:4000/v1`
- 前端读取：`NEXT_PUBLIC_API_URL`
- 鉴权：
  - `Authorization: Bearer <access_token>`
  - `refresh_token` 通过 HttpOnly Cookie
- 通用错误格式：`{ error: { code, message, status } }`

---

## 后端模块边界（当前约束）

- `routes/*`：参数校验、鉴权、响应整形
- `services/*`：业务编排（例如 run 创建+入队）
- `db/queries/*`：SQL 与映射
- `workers/*`：异步执行与状态写回
- `lib/queue.ts`：Bull 队列定义与可用性检查

### 采集链路（必须解耦页面生命周期）

1. 前端调用 `POST /admin/crawler/runs`（或兼容入口 `/admin/crawler/tasks`）
2. `CrawlerRunService` 创建 `crawler_runs` + `crawler_tasks`
3. worker 从 `crawler-queue` 消费任务执行采集
4. worker 协作式检查 `freeze/cancel/pause/timeout`
5. DB 写回 `task` 与 `run` 状态
6. 前端通过 overview/runs/tasks 接口轮询展示，不驱动执行

---

## 采集控制与调度能力

### 调度器

- 文件：`src/api/workers/crawlerScheduler.ts`
- 启动条件：`CRAWLER_SCHEDULER_ENABLED=true`
- tick 周期：60 秒
- 调度行为：只创建 run/task 并入队，不直接执行采集

### 全局止血/冻结

- `POST /admin/crawler/stop-all`
  - 可设置 `crawler_global_freeze=true`
  - 标记活跃 run 为 cancelling
  - 取消 pending/paused/running tasks
  - 可移除 repeatable tick
- `POST /admin/crawler/freeze`
  - 设置冻结开关
- `GET /admin/crawler/system-status`
  - 暴露 `schedulerEnabled` / `freezeEnabled` / `orphanTaskCount`

### Worker 硬约束

- 无 `runId/taskId` 的 crawl job 拒绝执行
- 运行中支持协作式：
  - pause（转 `paused` 并延迟重排队）
  - cancel（转 `cancelled`）
  - timeout（转 `timeout`）

---

## 前端状态所有权（当前）

### authStore
| 状态字段 | 写入方 | 说明 |
|---------|--------|------|
| user | `login/logout/tryRestoreSession` | 持久化 |
| accessToken | `setAccessToken/login/tryRestoreSession` | 仅内存，不落盘 |
| isLoggedIn | `login/logout/tryRestoreSession` | 持久化 |
| isRestoring | `tryRestoreSession` | 会话恢复过程标识 |

### playerStore
| 状态字段 | 写入方 | 说明 |
|---------|--------|------|
| shortId/currentEpisode | 播放页初始化与切集动作 | 播放上下文 |
| isPlaying/currentTime/duration | 播放器回调 | 播放状态 |
| mode | 播放控制区 | default/theater |

### themeStore
| 状态字段 | 写入方 | 说明 |
|---------|--------|------|
| theme | ThemeToggle / initTheme | light/dark/system |
| resolvedTheme | `setTheme/syncSystemTheme` | 实际生效主题 |

---

## Admin 列表共享能力（CHG-122 ~ CHG-132 基线）

### 共享状态协议

文件：`src/components/admin/shared/table/useAdminTableState.ts`

```ts
type AdminTableState = {
  sort?: { field: string; dir: 'asc' | 'desc' }
  columns?: Record<string, { visible: boolean; width?: number }>
  pagination?: { page: number; pageSize: number }
  filters?: Record<string, string | number | boolean | null>
  scroll?: { top?: number; left?: number }
}
```

- 版本：`v1`
- 存储键：`admin:table:{route}:{tableId}:v1`
- 能力：`getState` / `setState` / `updatePartial` / `reset`

### 共享列能力

文件：`useAdminTableColumns.ts`

- 列显隐持久化
- 列宽拖拽（min/max/resizable）
- 默认列元数据与持久化状态合并

### 共享排序与筛选容器

文件：`useAdminTableSort.ts` / `useAdminColumnFilter.ts`

- 排序 API：`setSort/toggleSort/clearSort`
- 列筛选容器：open/close/active/clear 协议
- 业务筛选项由页面注入，不在 shared 层固化

---

## 前台路由结构（当前）

```text
/[locale]
/[locale]/browse
/[locale]/search
/[locale]/movie/[slug]
/[locale]/anime/[slug]
/[locale]/series/[slug]
/[locale]/variety/[slug]
/[locale]/watch/[slug]
/[locale]/auth/login
/[locale]/auth/register
/[locale]/admin/*
```

---

## /admin 路由结构（当前）

```text
/admin                          # 数据看板
/admin/videos
/admin/videos/new
/admin/sources
/admin/users
/admin/content                  # 投稿/字幕审核双 Tab
/admin/submissions              # 兼容入口
/admin/subtitles                # 兼容入口
/admin/crawler                  # 采集域统一入口（目标 4 Tab，见 ADR-014 / CHG-169）
/admin/analytics
/admin/system/cache
/admin/system/config            # 系统参数（爬虫配置段待迁移至 /admin/crawler?tab=settings）
/admin/system/monitor           # 应用级监控（采集面板待迁移至 /admin/crawler）
/admin/system/settings
/admin/system/migration
/admin/system/sites             # 307 redirect → /admin/crawler?tab=sites
/admin/403
```

### 采集控制台 Tab 目标结构（CHG-169 完成后）

| Tab | 内容 | 来源 |
|-----|------|------|
| Sites（站点） | crawler_sites 管理、ingest_policy 配置、单站触发 | 原 `/admin/system/sites` |
| Console（控制台） | crawler_runs 批次、crawler_tasks 任务、stop-all/freeze | 原有控制台内容 |
| Logs（日志） | crawler_task_logs 查询 | 当前内嵌于 Console，独立为 tab |
| Settings（设置） | 自动采集 auto-config、调度设置、爬虫 API 配置 | 原 `/admin/system/config` 爬虫段 |

---

## 管理端鉴权与访问控制

- API 路由通过 `authenticate + requireRole` 控制
- 前端 `api-client` 统一携带 token，401 自动 refresh 一次并重试
- refresh 失败时清理 authStore 并跳转登录页

---

## 运行与命令（当前）

- 前端开发：`npm run dev`
- API 开发：`npm run api`
- 迁移：`npm run migrate`
- 一键清空采集数据：`npm run clear:crawled-data`
- 止血停止采集：`npm run crawler:stop-all`
- 单站脚本采集验证：`npm run test:crawler-site -- --site=<key> --hours=24`


---

## 后台管理开发现状快照（2026-03-22）

> 本节记录后台 Admin 系统截至 CHG-174 的完成状态，作为结构重组前的基线。

### 已完成任务序列

| 序列 | 主题 | 包含任务 |
|------|------|----------|
| SEQ-...-01~04 | 用户/视频/播放源/搜索基础 API | AUTH-xx、VIDEO-xx、SEARCH-xx |
| SEQ-...-05 | 批次 A：爬虫控制台大重构 | CHG-140 ~ CHG-155 |
| SEQ-...-06 | 批次 B：技术债清理 | CHG-156 ~ CHG-159 |
| SEQ-...-07 | 维护 P1/P2：接口退场 + 轮询合并 + Bull 超时 | CHG-160 ~ CHG-163 |
| SEQ-...-08 | 维护 P3：AbortController 独立控制定时器 | CHG-164 ~ CHG-165 |
| SEQ-...-09 | 维护 P3：Shared table 合规清单 + 审计修复 | CHG-166 ~ CHG-168 |
| SEQ-...-10 | Crawler 域导航收归（4-tab 合并） | CHG-169 |
| SEQ-...-11 | DB Schema Phase 1：类型扩展 + S/E 统一模型 | CHG-170 ~ CHG-172 |
| SEQ-...-12 | DB Schema Phase 2：内容治理基础层 | CHG-173 ~ CHG-174 |

**当前无待执行任务，无 BLOCKER。**

---

### 已落地 Migration 列表

| 文件 | 内容 | 状态 |
|------|------|------|
| `011_add_paused_statuses.sql` | crawler_tasks 状态扩展 | ✅ |
| `012_add_task_started_at.sql` | crawler_tasks.started_at | ✅ |
| `013_type_expansion.sql` | videos.type 枚举 4→12 种；series→drama 数据迁移；新增 source_content_type / normalized_type / content_format / episode_pattern | ✅ |
| `014_season_episode.sql` | video_sources + watch_history 新增 season_number NOT NULL；episode_number NOT NULL DEFAULT 1 | ✅ |
| `015_content_format_backfill.sql` | 存量 content_format / episode_pattern 按 type+episode_count+status 规则回填 | ✅ |
| `016_review_visibility.sql` | videos 新增 review_status / visibility_status / review_reason / review_source / reviewed_by / reviewed_at / needs_manual_review | ✅ |
| `018_partial_ingest_policy.sql` | crawler_sites.ingest_policy JSONB（站点级采集策略，allow_auto_publish 等） | ✅ |

---

### 后台 UI 模块接入状况

#### 已完整接入（API + UI + 单元测试）

| 模块 | 前端路由 | API 前缀 | 备注 |
|------|----------|----------|------|
| 视频管理 | `/admin/videos` | `/admin/videos` | 列表/搜索/上下架/批量/元数据编辑/豆瓣同步 |
| 播放源管理 | `/admin/sources` | `/admin/sources` | CRUD/软删除/批量 |
| 爬虫控制台 | `/admin/crawler`（4-tab） | `/admin/crawler/*` | 站点/控制台/日志/设置；站点含 ingest_policy toggle |
| 用户管理 | `/admin/users` | `/admin/users` | 列表/封禁/解封/角色 |
| 数据看板 | `/admin/analytics` | `/admin/analytics` | 系统统计/队列告警 |
| 数据导入导出 | `/admin/system/migration` | `/admin/import` `/admin/export` | JSON 批量导入播放源 |
| 缓存管理 | `/admin/system/cache` | `/admin/cache` | Redis 清理 |
| 站点配置 | `/admin/system/settings` | `/admin/system/settings` | 全局参数 |
| 配置文件编辑 | Crawler Settings tab | `/admin/system/config` | 已归入 /admin/crawler?tab=settings |

#### Schema 已落地但 UI 尚未接入（已知缺口）

| 字段/功能 | 所在表 | 缺少的 UI |
|-----------|--------|-----------|
| `review_status` / `visibility_status` | videos | 审核队列页面（待 pending_review 视频列表 + approve/reject 操作） |
| `content_format` / `episode_pattern` | videos | 视频编辑表单中的判定字段展示/编辑 |
| `review_reason` / `reviewed_by` / `reviewed_at` | videos | 审核记录详情 |
| `ingest_policy` 完整字段（search_index 等） | crawler_sites | 当前只暴露 allow_auto_publish |
| `/admin/submissions` | — | 路由存在，投稿列表 UI 为空壳 |
| `/admin/content` | — | 路由存在，内容审核 UI 为空壳 |

---

### 当前后台导航结构（基线）

```
AdminSidebar
├── 内容管理
│   ├── 视频管理         /admin/videos
│   ├── 播放源管理       /admin/sources
│   └── 内容审核（空壳） /admin/content
└── 系统管理（admin only）
    ├── 采集控制台       /admin/crawler
    ├── 站点配置         /admin/system/settings
    ├── 用户管理         /admin/users
    └── 数据看板         /admin/analytics
```

**问题**：字幕管理、投稿管理、数据导入/导出、缓存管理等已有 API 的模块均未挂载到侧边栏；审核类功能和运营类功能混放在"内容管理"下缺少层次；"用户管理"与"数据看板"放在"系统管理"下语义不准确。

---

### 单元测试状态

- 测试文件：55 个
- 通过用例：542 / 542
- 覆盖范围：API 路由、DB 查询层、核心 Service（SourceParserService / CrawlerService / MigrationService）、前端组件（DataTable / AdminVideoList / shared table hooks）
