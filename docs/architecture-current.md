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
- `videos`
- `video_sources`
- `subtitles`
- `tags` / `video_tags`
- `lists` / `list_items` / `list_likes`
- `danmaku`
- `comments`
- `watch_history`
- `user_favorites`

### 系统配置

#### system_settings
| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(100) PK | 配置键 |
| value | TEXT | 配置值（JSON 字符串/普通字符串） |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### crawler_sites
| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(100) PK | 站点 key |
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
/admin/crawler                  # 采集控制台（3 Tab）
/admin/analytics
/admin/system/cache
/admin/system/config
/admin/system/monitor
/admin/system/settings
/admin/system/migration
/admin/system/sites             # 重定向到 /admin/crawler
/admin/403
```

### 采集控制台三 Tab（当前命名）

1. 采集配置
2. 任务记录
3. 高级设置

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

