# 后台「消息 · 通知 · 提醒 · 日志」综合治理方案

> status: active proposal
> owner: @engineering
> scope: admin shell 通知/任务/侧边栏计数 · 审计与系统日志边界 · 后台任务执行结果摘要 · 通知存储与生命周期
> source_of_truth: design-plan
> supersedes: none（演进自 ADR-147 通知 hub MVP / ADR-152 后台事件铃铛 / ADR-155 EP-2 瘦身）
> superseded_by: none
> last_reviewed: 2026-06-08
> revision: r2 — 吸收 ntlg-review-1 / ntlg-review-2 评审（措辞校正 · per-user 已读混合模型 · P1 拆卡 · P0 端点 ADR 分配 · 契约签名收口）
> revision: r2.1 复核 — §4.3↔§2.1 cursor 对齐 · /unread-count 端点 ADR 归属 ADR-NN1 · finalizeRun→syncRunStatusFromTasks 名称校正 · §6 P2 编号 · §10↔§11 D9 去冗 · §9 补 cursor 基线断言

## 0. 背景与目标

后台的"消息/通知/任务/日志"是多次增量叠加出来的（ADR-147 通知 hub MVP → ADR-152 后台事件铃铛 → ADR-155 EP-2 瘦身合并），目前能跑但存在地基性缺陷与断链：

1. **通知无独立存储**：实时从 `admin_audit_log` 按 8 类白名单过滤派生（`NotificationService.list`），已读状态存浏览器 `localStorage`（`admin-shell-notifications.ts` 的 `lastViewedAt`）——非 per-user、清缓存即丢、无服务端未读计数。通知与审计两种本质不同的职责被强行耦合在同一张表。
2. **后台任务完成有"裸通知"但无结构化 digest**（r2 校正：原表述"完成 ≠ 通知"夸大缺口）。事实是：crawler 完成事件**已存在**——`crawlerWorker.ts:496` 已注册 `crawlerQueue.on('completed')`（只打 log `videos_upserted/sources_upserted/errors`，不发通知）；失败/部分失败**已触发** webhook（`crawlerWorker.ts:476` `crawler.run.failed`）；background-events 的 **finished lane 早已把采集完成映射成标题级通知**（`admin-shell-notifications.ts:103-117`）。**真实缺口**是：完成事件**无结构化执行结果摘要**（`crawler_runs.summary` 已聚合 `videosUpserted/sourcesUpserted/done/failed/errors`，但只露出为标题字符串，**富集成功率、新增合并候选数等无处可见**）、**无独立通知存储**、**无服务端已读**、**无统一 emit 契约**。`queue.ts` 的 `attachQueueLogger` 仅挂 `error/failed`，`completed` 回调在各 worker 内自行注册且只 log。
3. **侧边栏 4 个计数写死**：`moderation=484 / sources=1939 / image-health=597 / user-submissions=12`（`admin-nav.tsx`），仅 `merge` 接了真实轮询。
4. **交互链零散**：top bar 任务取消/重试是 toast stub（`admin-shell-client.tsx`，N1-147-4 无后端端点）；`NotificationsTab.tsx` 还留着"后端不发 webhook"的陈旧错误注释（WebhookDispatcher 实际已实装）；`submission.created` webhook 定义但无触发点；邮件通知只存 KV 无发送。
5. **缺少面向未来自动化的统一接口**：每加一种后台流程（采集、富集、图片健康、未来的自动化编排）都要各自手写"如何进任务中心 / 如何发通知"，没有可复用的产出契约。

**目标**：确立四象限职责边界 → 把通知升级为有独立存储与服务端已读的"消息中心" → 为所有后台任务定义统一的"执行结果摘要 + 通知"产出契约（为未来自动化预留）→ 打通 top bar / 侧边栏 / 抽屉 / 后台任务 / 通知的完整交互链与生命周期。

本方案为**逻辑完善的治理设计**（终态架构 + 现状治理映射）。本轮不拆 task 卡，落地仍走 `docs/tasks.md` 工作流。

## 1. 四象限职责边界（信息分类总纲 · 所有设计的根基）

| 象限 | 定位（回答的问题） | 数据落点（终态） | 后台 UI | 受众 |
| --- | --- | --- | --- | --- |
| **审计日志** Audit | "谁在何时对什么做了什么"（合规取证、可回滚） | `admin_audit_log`（保持，`AuditLogService.write()` 中枢） | `/admin/audit` | 合规/管理员追溯 |
| **系统日志** SysLog | "进程内部发生了什么"（技术诊断、性能、错误堆栈） | pino → stdout/ndjson（保持，`packages/logger`） | **不建 UI**（留 stdout / 可观测性平台；与 logging-rules"prod 不落文件、PII 脱敏"决策一致） | 研发/运维（终端/平台） |
| **后台任务** Task | "某个异步作业进行到哪、结果如何"（生命周期 + 执行结果摘要） | `crawler_runs`/`crawler_tasks`/bull job + 新增 `task_runs` 统一抽象层 | top bar 任务抽屉 + `/admin/crawler` | 运营/管理员 |
| **通知** Notification | "有件需要我知道/处理的事"（用户面向的提醒，可已读、可归档） | 新增 `notifications` + `notification_reads` 表 | top bar 通知抽屉 + 未来"消息中心"页 | 运营/管理员 |

**边界规则（长期约束）：**

1. **系统日志不进后台 UI**。运维要在后台感知"某后台任务失败"，走的是**任务象限的失败态 + 通知象限的告警**，而非翻日志。日志只承担技术诊断。
2. **审计 ≠ 通知**。审计是"操作流水"（全量、合规驱动）；通知是"需要被看见的事件"（精选、人因驱动）。二者**解耦双写**：领域服务在发生事件时，按需各自调 `AuditLogService.write()`（若是 admin 操作）与 `NotificationService.emit()`（若需提醒人），`audit_log` 不再被通知反向依赖。
3. **任务结果摘要是连接"任务"与"通知"的桥**：任务完成时产出结构化 `TaskResultDigest`，既挂在任务象限（抽屉里看进度/结果），又据规则 emit 一条带摘要的通知（抽屉里看"发生了什么"）。

## 2. 终态数据模型

### 2.1 通知存储（独立表 + 服务端已读）

新增 migration（编号待分配，示意 `NNN_notifications.sql`）：

```
notifications
  id            BIGSERIAL PK
  type          TEXT NOT NULL          -- 语义键：'crawler.run.completed' / 'submission.created' / 'webhook.failed'
  level         TEXT NOT NULL          -- 'info' | 'warn' | 'danger'（与 NotificationItem.level 对齐）
  title         TEXT NOT NULL
  body          TEXT NULL
  payload       JSONB NULL             -- 结构化数据（含 TaskResultDigest、跳转上下文）
  href          TEXT NULL              -- 点击跳转
  source_kind   TEXT NOT NULL          -- 'task' | 'system' | 'moderation' | 'submission' | ...（产出象限）
  source_ref    TEXT NULL              -- 关联实体 id（run_id / submission_id ...，去重&反查）
  dedup_key     TEXT NULL              -- 幂等键（防 worker 重试/轮询重复 emit；partial unique index）
  scope         TEXT NOT NULL          -- 'broadcast'（全体 admin/mod）| 'role:moderator' | 'user:<id>'（未来定向）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  expires_at    TIMESTAMPTZ NULL       -- TTL 保留期（过期物理清理或软隐藏）
索引：created_at DESC、(scope, created_at)、dedup_key partial unique
```

**已读采用混合模型**（r2 吸收 review-2 缺口 1/2/3：纯逐行 reads 对 broadcast 有 per-user 未读基线 bug——新管理员首登会把全部历史 broadcast 算成未读）：

```
notification_read_cursor                -- broadcast/role 已读"高水位线"（per-user 一行，把 localStorage lastViewedAt 搬到服务端）
  user_id     UUID PK
  read_at     TIMESTAMPTZ NOT NULL      -- 此刻之前的 broadcast/role 通知视为已读
                                        -- 新用户的初始 cursor = 加入时间（NOW()），天然不回溯历史

notification_reads                      -- 仅"定向"通知（scope='user:<id>'）的逐行已读
  notification_id  BIGINT FK
  user_id          UUID FK
  read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  PK(notification_id, user_id)
```

**未读计数语义**：
- broadcast / role 通知：`scope 命中` 且 `created_at > 该 user 的 read_cursor.read_at` → 由 `(scope, created_at)` 索引直接支撑（无需 anti-join，随表增长仍稳定）。
- 定向（`user:<id>`）通知：`scope='user:<当前>'` 且 `NOT EXISTS notification_reads` → 由 `PK(notification_id, user_id)` 支撑。
- `markAllRead` → broadcast/role 仅 upsert **一行** cursor（避免"用户 × N 条"写放大）；定向才逐行写 `notification_reads`。`markOneRead` 对 broadcast 项写一条 `notification_reads` 作为"单条已读覆盖 cursor"的例外位（cursor 之后但已单独读过）。
- 当前几乎全是 broadcast（admin/mod 看同样的事）：**P0/P1 可只实现 cursor 模型**，逐行 `notification_reads`（定向通知）随 P2 多渠道/定向能力一起落地。

### 2.2 后台任务统一抽象 `task_runs`（generalize 现有 crawler_runs 概念）

不重写 crawler/bull，新增统一只读投影 + 结果摘要承载层。两条路径**分阶段而非二选一**（r2 吸收两份评审：path A 为近期默认，path B 为 P2 终态、由 ADR-NN3 定夺）：

- **路径 A（近期默认，P1）**：不建新表，定义 `TaskResultDigest` 形状，扩展各 worker 在 `completed` 时把 digest 写回各自表（crawler 写 `crawler_runs.summary`，bull job 写 returnvalue），由现有 `TaskAggregator`（`apps/api/src/services/TaskAggregator.ts`，`/admin/system/jobs` 的真实实现，现已聚合 `crawler_runs` + bull active jobs 但**取了 `summary` 却未透出 digest**）+ background-events 投影成带 digest 的 `TaskItem`。
- **路径 B（终态，P2 / ADR-NN3）**：新增 `task_runs` 表作为所有后台作业的统一登记簿（crawler/富集/图片健康/未来自动化都登记），字段含 `kind / status / progress / started_at / finished_at / digest JSONB / error`。各 worker 通过统一 `TaskRunReporter` 写入。
  - **真源关系必须在 ADR-NN3 二选一**（避免双真源风险）：`task_runs` 是 crawler_runs 的**只读投影**（crawler_runs 仍是真源），还是**并行登记**（task_runs 成新真源、crawler_runs 降级为执行明细）。待 2–3 类后台流程接入后再决定，本方案不预设。

`TaskResultDigest`（共享类型，置于 `packages/types`）：

```ts
interface TaskResultDigest {
  readonly summary: string                     // 人读摘要："新增 42 视频 / 富集成功率 87% / 13 进入合并候选"
  readonly metrics: ReadonlyArray<{            // 结构化指标（可扩展，不写死字段名）
    readonly key: string                       // 'videos_added' | 'enrich_success_rate' | 'merge_candidates' ...
    readonly label: string
    readonly value: number | string
    readonly unit?: string                     // '%' | '个' ...
    readonly tone?: 'ok' | 'warn' | 'danger'
  }>
  readonly highlights?: ReadonlyArray<string>  // 需要注意的要点（失败站点、超时项）
}
```

`crawler_runs.summary` 现有 `videosUpserted/sourcesUpserted/done/failed/errors` 直接 map 成 `metrics`；富集成功率由富集 worker 在 `completed` 时补充。字段不写死——满足价值排序「可扩展性」。

### 2.3 面向未来自动化的产出契约（核心扩展点）

定义两个中枢 helper，与现有 `AuditLogService.write()` 同构，让任何新后台流程"实现一个接口即自动接入全链路"：

```ts
// 1) 任务登记/汇报（任务象限）—— worker 生命周期回调里调用
interface TaskRunReporter {
  start(input: { kind: string; title: string; ref?: string }): Promise<TaskRunId>
  progress(id: TaskRunId, pct: number): Promise<void>
  finish(id: TaskRunId, result: { status: TaskStatus; digest?: TaskResultDigest; error?: string }): Promise<void>
}

// 2) 通知发射（通知象限）—— 解耦双写，领域服务/任务完成时按规则调用
interface NotificationEmitter {
  emit(input: {
    type: string; level: Level; title: string; body?: string;
    payload?: unknown; href?: string; scope?: Scope; dedupKey?: string; expiresAt?: string;
  }): Promise<void>
}
```

未来自动化流程接入只需：在其 worker 里 `reporter.start/progress/finish`，并在 finish 时（按 emit 规则）`emitter.emit` 一条带 digest 的通知——自动出现在任务抽屉、通知抽屉、侧边栏计数，无需碰 UI。

**契约收口约定**（r2 吸收 review-2 小问题 1/2/3，归入 ADR-NN2）：
- **`emit` 与 `write` 失败语义对齐**：现有 `AuditLogService.write(): void` 是 fire-and-forget（内部 catch，`AuditLogService.ts:275`）。`emit` 也应 **fire-and-forget（内部 catch、不阻塞领域操作）**，签名建议 `emit(...): void` 与 `write` 同构，避免"领域服务 await emit 却不 await write"导致的失败语义分叉。
- **`TaskRunReporter.start` 登记失败不阻断作业**：`start()` 是一次 DB 写换 `TaskRunId`，须明确"登记失败时任务照常跑"（与 audit fire-and-forget 哲学一致），失败仅 log warn、降级为无 task_run 关联。
- **`level` 三值收口**：`level ∈ {info,warn,danger}` 加 DB `CHECK` 约束或类型层收口防脏值；`scope` 保持开放（`broadcast`/`role:*`/`user:*`），按前缀在类型层校验而非 CHECK（保留扩展性）。
- **SQL 落点（r2 吸收 review-1 #3）**：`NotificationService`/`TaskAggregator` 现有 Service 直写 SQL 是历史债（`NotificationService.ts:82`、`TaskAggregator.ts:57`）。新增通知读写 SQL **必须落 `apps/api/src/db/queries/notifications.ts`**，Service 只编排，**不扩大** Service 直写 SQL 的反模式（db-rules 硬约束）。

## 3. 完整交互链全景（管理台 ↔ 侧边栏 ↔ top bar ↔ 后台任务 ↔ 通知）

```
                         ┌────────────────────────── 后台 worker / 自动化流程 ───────────────────────────┐
                         │ crawler / enrichment / imageHealth / maintenance / <future automation>        │
                         └──────┬───────────────────────┬──────────────────────────┬───────────────────┘
            reporter.start/finish│        emitter.emit() │（按规则）   audit.write()│（若是 admin 操作）
                                 ▼                       ▼                          ▼
                           ┌──────────┐           ┌──────────────┐          ┌───────────────┐
                           │ task_runs│           │ notifications │          │admin_audit_log│
                           │ (+digest) │          │(+cursor/reads) │         │  (保持不变)    │
                           └────┬─────┘           └──────┬───────┘          └──────┬────────┘
        GET /admin/system/jobs  │   GET /admin/notifications│  unread-count       │ GET /admin/audit
        (聚合 task_runs)         ▼                          ▼                      ▼
                    ┌───────────────────────── server-next BFF（60s polling / 未来 SSE）─────────────────┐
                    │  useAdminTasks()        useAdminNotifications()      useAdminNavCounts()           │
                    └──────┬───────────────────────┬───────────────────────────┬───────────────────────┘
                           ▼                        ▼                           ▼
                   top bar 任务闪电(running计数)  top bar 铃铛(未读红点/计数)   侧边栏分项徽标(真实计数)
                           │                        │                           │
                           ▼                        ▼                           ▼
                      任务抽屉(进度+digest)      通知抽屉(已读/全部已读+digest)  点击徽标→对应模块页
```

**信号 → 落面映射表**（治理后）：

| 后台信号 | task_runs | notifications | audit_log | sys log | top bar 任务 | top bar 通知 | 侧边栏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 采集批次进行中 | running | — | — | info | 闪电+1 | — | — |
| 采集批次完成（含 digest） | success+digest | 一条带摘要 | — | info | 转完成 | 未读+1 | — |
| 采集批次失败 | failed | danger | — | error | 失败态 | 未读+1 | — |
| 富集完成（成功率） | digest 补充 | 汇总进采集通知 or 独立 | — | info | — | 是 | — |
| 待审核积压超阈值 | — | warn | — | — | — | 是 | moderation 计数↑ |
| admin 手动合并/上架 | — | 保留现白名单语义 | 是 | info | — | 是 | merge 计数变化 |
| webhook 投递失败 | — | danger | 是 | warn | — | 是 | — |
| 全局采集冻结(高危) | — | danger | 是 | warn | — | 是 | — |

## 4. Top bar 展示方式与生命周期状态机

### 4.1 两个入口（保持现有 `topbar.tsx` 受控设计，不重构组件）

- **任务闪电图标**：`badge = running 计数`（`task_runs.status='running'`）；无 running 时不显徽标。
- **通知铃铛**：`红点 = 有未读`（服务端 unread-count > 0），可升级为数字徽标。

### 4.2 任务生命周期状态机（task_runs）

```
        enqueue            worker pick           finish(success|partial)
pending ─────────▶ pending ──────────▶ running ──────────────────────▶ success ─┐
                                          │  finish(failed/timeout)             │ digest 落库
                                          ├────────────────────────▶ failed ────┤ + emit 通知
                                          └── cancel ──────────────▶ cancelled ─┘
```

抽屉展示规则：

- `running`：显示进度条（determinate 用 progress%，未知用 indeterminate）+ 取消按钮（新增 `POST /admin/tasks/:id/cancel`，补 N1-147-4）。
- 终态：进入"近期完成"区（窗口默认 6h / 最多 N 条），显示 `TaskResultDigest`（摘要 + metrics chips）；`failed` 显示 errorMessage + 重试按钮（新增 `POST /admin/tasks/:id/retry`）。
- **`:id` 的指向分阶段**（r2 吸收 review-2 张力 2）：task_runs 是 P2 才建，**P0 阶段 `:id` 指向现有 bull `jobId` 或 crawler `runId`**（已验证可行：`crawlerWorker` 有 abortController + control-check timer 支持协作式取消，bull 原生 `job.retry()`）；P2 建 task_runs 后再 re-point 到统一 `task_run_id`。端点契约需在响应里标注 target 类型，避免实现者卡在"id 是什么"。
- 保留/清理：active 永远显示；finished 只在时间窗内显示（与 background-events `windowHours` 一致），窗外仅留通知象限的历史记录。

### 4.3 通知生命周期状态机（notifications）

```
created(unread) ──打开抽屉/全部已读 → 推进 read_cursor──▶ read（broadcast/role 走 cursor · 定向走 reads）──过 expires_at──▶ expired(清理/归档)
   │
   └── dedup_key 命中已存在 → 不新建（幂等，防轮询/worker 重试重复）
```

规则（已读=cursor 混合模型，与 §2.1 一致）：

- **已读语义改服务端（cursor 高水位，非批量写 reads）**：`markAllRead` → broadcast/role **upsert 一行 `notification_read_cursor.read_at = NOW()`**（替代 localStorage `lastViewedAt`，避免"用户 × N 条"写放大）；定向（`scope='user:<id>'`）通知才逐行写 `notification_reads`。`markOneRead` 对 broadcast 项写一条 `notification_reads` 作为 cursor 之后的"单条已读例外位"。跨设备/清缓存不丢、per-user 准确，且**新管理员首登不回溯历史**（cursor 初值=加入时间）。
- **未读计数**：新增 `GET /admin/notifications/unread-count`（top bar 红点/数字数据源）。
- **去重**：`dedup_key`（如 `crawler.run.<runId>.completed`）防止 60s 轮询期间或 worker 重试重复 emit。
- **保留**：`expires_at` 默认 30 天；过期由维护 worker 清理（或软隐藏）。"消息中心"页（P2）可看全量历史与检索。

## 5. 侧边栏计数治理（去写死）

- 新增聚合端点 `GET /admin/system/nav-counts` → 一次批量返回 `{ moderation, sources, imageHealth, userSubmissions, merge }`（各模块已有 count query，聚合即可）。
- `useAdminNavCounts`（现仅查 merge）改为消费该端点，填充 `AdminNavCountProvider`（`packages/admin-ui/src/shell/types.ts` 现成契约）。
- `apps/server-next/src/lib/admin-nav.tsx` 删除 4 个写死 `count`（保留 `badge` 语义作为颜色），runtime 值优先（`sidebar.tsx` 已支持 runtime > static 优先级）。

## 6. 现状断链清单 → 治理优先级映射（P0/P1/P2）

优先级 = 先修高价值低成本断链，再做架构升级，最后做增强。本轮只定优先级，不拆卡。

**P0 · 修断链 / 去 mock（低成本高价值，不动数据模型）**

1. 侧边栏 4 写死计数 → `GET /admin/system/nav-counts` 接真实数据（§5）。
2. 修 `NotificationsTab.tsx` 陈旧错误注释（WebhookDispatcher 已实装）。
3. 任务取消/重试端点 `POST /admin/tasks/:id/{cancel,retry}`，替换 topbar toast stub（`admin-shell-client.tsx`）。
4. 采集完成映射成通知：把 `crawler.run.completed` 纳入当前 background-events finished lane 已做的范围里补 digest 文案（过渡态，正式版见 P1）。

**P1 · 通知架构升级 + 任务结果摘要（地基）**

> r2 吸收 review-1 #2：P1 跨 schema/API/service/worker/UI，按 CLAUDE.md 原子化判据（schema/api-service/UI 跨 3 层必拆 · 范围 ≥5 项必拆）**必须拆为至少 3 张卡**，不得作为单卡推进：

- **卡 P1-a · 通知存储 + 读 API**：`notifications` + `notification_read_cursor`（+ 定向预留 `notification_reads`）migration；SQL 落 `db/queries/notifications.ts`；`NotificationService` 编排 `emit / list / markAllRead / unreadCount`（cursor 模型）；端点 `GET /admin/notifications`（迁移到新表）+ `GET /admin/notifications/unread-count`。**先空跑兼容**：暂仍由旧 audit 派生回填，验证读路径。
- **卡 P1-b · digest 类型 + crawler 投影**：`TaskResultDigest` 共享类型（`packages/types`）；`crawler_runs.summary` → `metrics` 映射；`TaskAggregator` 透出 digest 到 `/admin/system/jobs` 的 `TaskItem`；任务抽屉展示 digest chips（path A，不建 task_runs）。
- **卡 P1-c · 解耦双写 emit 接入**：`NotificationEmitter` 中枢（fire-and-forget）；现 8 类白名单事件改由领域服务主动 `emit`（audit 与通知双写、互不依赖）；crawler/富集 worker `on('completed')` 补 `emit` 带 digest 通知（富集成功率、新增视频、新增合并候选数）。完成后下线"audit 派生通知"旧路径。

**P2 · 增强 / 未来自动化（终态收口）**

- **卡 P2-a** · `task_runs` 统一抽象层（§2.2 路径 B），所有后台流程统一登记，UI 收敛到单一投影。
- **卡 P2-b** · 多渠道通知统一订阅（webhook 已有 / 邮件实装 / `submission.created` 补触发点）；通知偏好。
- **卡 P2-c** · "消息中心"页（全量历史 + 检索 + 归档）；未读计数升级为 SSE 实时推送（替代 60s 轮询）。
- **卡 P2-d** · 维护 worker 清理 `expires_at` 过期通知。

## 7. 需起的 ADR（决策点，编号待分配）

| ADR | 决策内容 | 阶段 | 影响 |
| --- | --- | --- | --- |
| **ADR-NN0a** | 端点 ADR：`GET /admin/system/nav-counts`（聚合口径 + 权限边界 + 单模块 403 不拖垮整包） | **P0 前 PASS** | 新 admin route（`verify:endpoint-adr` 门禁，纯聚合也需 ADR） |
| **ADR-NN0b** | 端点 ADR：`POST /admin/tasks/:id/{cancel,retry}`（P0 `:id` 指 crawler runId/bull jobId） | **P0 前 PASS** | 新 admin route（门禁），P2 再 re-point task_runs |
| ADR-NN1 | 通知与审计**解耦双写**模型 + `notifications`/`notification_read_cursor`(+定向 `notification_reads`) schema + 已读混合模型（缺口 1/2/3）+ **兼作 `GET /admin/notifications/unread-count` 端点 ADR** | P1 前 | 跨 3+ 消费方 schema（强制 Opus 子代理设计，CLAUDE.md §模型路由 2）+ 新 admin route 门禁 |
| ADR-NN2 | `TaskResultDigest` + `TaskRunReporter`/`NotificationEmitter` 共享契约（emit fire-and-forget 对称 + 登记失败容错） | P1 前 | 新共享组件 API 契约（强制 Opus 子代理，CLAUDE.md §模型路由 1） |
| ADR-NN3 | `task_runs` 统一抽象层 + **真源关系（只读投影 vs 并行登记）二选一** | P2 前 | 后台任务数据模型 |
| ADR-NN4 | 通知保留期/TTL/去重/`scope` 定向规则 | P2 前 | 生命周期策略 |

> r2 吸收 review-2 张力 1：P0 的 3 个新端点触发 `verify:endpoint-adr`——**每个新 admin route 必须先有 ADR + Opus PASS**（CLAUDE.md §绝对禁止 R7 MUST-8）。`nav-counts`/`cancel`/`retry` 在原表无对应 ADR，会在 P0 第一刀被门禁挡，故新增 ADR-NN0a/NN0b 并标注"P0 前 PASS"。
> r2 吸收 review-1 #6：`nav-counts` 聚合需确认各 count 业务口径与权限边界——**moderator 可能无 merge/部分模块权限**（现 `useAdminNavCounts` 已对 401/403 静默降级），聚合端点须**逐模块容错**（某模块无权返回该项缺省，不致整包失败），写入 ADR-NN0a。
> r2.1 复核补漏（残留 B）：P1-a 新增 `GET /admin/notifications/unread-count` 是**新 `fastify.get`**（现仅 `GET /admin/notifications` 存在于 `notifications.ts:29`，迁实现到新表不算新路由），同样触发 `verify:endpoint-adr`。**由 ADR-NN1 兼作该端点的 endpoint-ADR**（NN1 本就是 P1 前 PASS 的通知地基 ADR），避免 P1-a 第一刀被门禁挡——与张力 1 同类，不另起 NN0c。

## 8. 关键文件索引（落地时的改动锚点）

| 关注点 | 文件 |
| --- | --- |
| 通知服务（改编排，SQL 外移） | `apps/api/src/services/NotificationService.ts`（现仅 `list` 且**直写 SQL**:82——历史债，不扩大） |
| 通知 SQL 新落点（P1-a 新建） | `apps/api/src/db/queries/notifications.ts`（db-rules：SQL 集中 queries 层） |
| 任务聚合（`/admin/system/jobs` 真实实现） | `apps/api/src/services/TaskAggregator.ts`（现聚合 crawler_runs+bull active，取 `summary`:57 但未透出 digest） |
| 后台事件聚合 | `apps/api/src/services/BackgroundEventService.ts` |
| 通知/任务前端 hook（已读改服务端 cursor） | `apps/server-next/src/lib/admin-shell-notifications.ts`（现 localStorage `lastViewedAt`） |
| 侧边栏计数 hook | `apps/server-next/src/lib/admin-shell-nav-counts.ts`（现仅 merge，已对 401/403 静默降级） |
| 写死计数 | `apps/server-next/src/lib/admin-nav.tsx` |
| topbar 入口（受控，不重构） | `packages/admin-ui/src/shell/topbar.tsx` |
| 通知/任务抽屉 | `packages/admin-ui/src/shell/notification-drawer.tsx` / `task-drawer.tsx` |
| 共享类型 SSOT | `packages/admin-ui/src/shell/types.ts`（`NotificationItem`/`TaskItem`） + `packages/types/src/admin-shell.types.ts`（API 镜像） |
| 任务结果底料 | `apps/api/src/db/queries/crawlerRuns.ts`（`summary` JSONB，由 `syncRunStatusFromTasks`:307 聚合落库:357） |
| crawler 完成/失败事件（接 emit） | `apps/api/src/workers/crawlerWorker.ts`（`on('completed')`:496 只 log；`crawler.run.failed` webhook:476） |
| 队列 logger（仅 error/failed） | `apps/api/src/lib/queue.ts`（`attachQueueLogger`:144；completed 在各 worker 内注册） |
| 陈旧注释（P0-2 修正） | `apps/server-next/src/app/admin/settings/_tabs/NotificationsTab.tsx` |
| 审计中枢（解耦参照系 / emit 同构范本） | `apps/api/src/services/AuditLogService.ts`（`write(): void` fire-and-forget:275） |

## 9. 验证方式（落地各阶段的端到端校验）

- **类型/构建门禁**：`npm run typecheck` / `npm run lint` / `npm run verify:adr-contracts`（端点-ADR 合规）/ `npm run verify:endpoint-adr`（新 admin 端点必须有 ADR）。
- **P0 验证**：登录后台 → 侧边栏 4 模块徽标显示真实数（非 484/1939/597/12）；触发采集 → top bar 任务闪电出现 running，完成后转完成态；点取消/重试不再是 toast。
- **P1 验证**：A 设备标记已读 → B 设备/清缓存后仍为已读（服务端 per-user 生效）；`GET /admin/notifications/unread-count` 与铃铛红点一致；采集完成的通知正文含"新增 N 视频 / 富集成功率 X% / M 进入合并候选"。
- **P1 cursor 基线断言**（混合模型关键新语义）：**新建管理员账号首次登录 → 历史 broadcast 通知不应全标未读**（cursor 初值=加入时间，不回溯历史）；`markAllRead` 后 `notification_read_cursor` 仅多一行（非"用户 × N 条" reads 写放大）。
- **单测/E2E**：`NotificationService` CRUD + 去重单测；`TaskResultDigest` 映射单测；`npm run test:e2e:admin`（任务抽屉/通知抽屉交互）。
- **boundary 守卫**：确认系统日志仍不进后台 UI；新通知不写 `admin_audit_log`（解耦验证）。

## 10. 待定夺岔路 → 见 §11 D9

通知与审计解耦的**双写**实现已并入 §11 决策清单 **D9**，此处不再重复列举：

- 默认 **(a) 领域服务双写**：服务发生事件时分别调 `audit.write()` 与 `notification.emit()`，语义清晰、两表独立演进，不引新依赖（符合 CLAUDE.md 技术栈约束）。
- 备选 **(b) 出站事件总线**（领域事件进内部 bus、audit/notification 各自订阅）因引入新机制、超出当前技术栈、可能触发 BLOCKER 而**不采**。

> 决策落点与风险见 §11 D9；落地前在 ADR-NN1 最终确认。

## 11. 落地前置决策清单（r2 新增 · 起 ADR 前必须拍板）

汇总两份评审（ntlg-review-1 / ntlg-review-2）抽出的、起对应 ADR 前必须二选一/敲定的条目。未敲定不得进入 `docs/tasks.md` 实施：

| # | 决策项 | 归属 ADR | 本方案推荐 | 风险（不定的后果） |
| --- | --- | --- | --- | --- |
| D1 | broadcast 已读用「per-user cursor」还是「逐行 reads」 | ADR-NN1 | **混合**：broadcast/role 走 cursor，定向走逐行 | 逐行 → 新管理员全历史未读 + markAllRead 写放大 |
| D2 | unread-count 索引是否够用（cursor 模型下） | ADR-NN1 | cursor + `(scope,created_at)` 够用，ADR 写明理由不补 anti-join 索引 | 用 anti-join 全表扫，随表增长变慢 |
| D3 | `emit` 是否 fire-and-forget（与 `write` 对称） | ADR-NN2 | **是**，`emit(): void` 内部 catch | 不对称 → 领域服务失败语义分叉 |
| D4 | `TaskRunReporter.start` 登记失败是否阻断作业 | ADR-NN2 | **不阻断**，降级无 task_run 关联 | 阻断 → DB 抖动拖垮后台作业 |
| D5 | path A vs path B 的启用时机 | ADR-NN3 | P1 走 A（digest 进 TaskAggregator 投影），B 待 2–3 流程接入后定 | 过早建 task_runs → 地基期重写 crawler/bull |
| D6 | `task_runs` 与 `crawler_runs` 真源关系 | ADR-NN3 | 留 ADR-NN3 二选一（只读投影 / 并行登记） | 两可 → 双真源数据不一致 |
| D7 | P0 三端点的 ADR 是否前置 PASS | ADR-NN0a/b | **必须 P0 前 PASS**（否则 `verify:endpoint-adr` 挡合入） | 不前置 → P0 第一刀被 CI 挡 |
| D8 | nav-counts 逐模块容错口径 | ADR-NN0a | 单模块无权/失败返回该项缺省，不拖垮整包 | 整包失败 → moderator 侧边栏全空 |
| D9 | 解耦双写实现 (a) 服务双写 vs (b) 事件总线 | ADR-NN1 | **(a)**（不引新依赖） | (b) → 触发新依赖 BLOCKER |

**评审采纳记录**：

- **r2** 已就地吸收 ntlg-review-1（措辞精确化 · P1 拆 3 卡 · SQL 落 queries 层 · path A 近期默认 · nav-counts 权限边界）与 ntlg-review-2（§0.2 措辞校正 · 缺口 1/2/3 已读混合模型 · 张力 1/2/3 端点 ADR 与 :id 指向与真源关系 · 契约签名对称性 · level CHECK）。
- **r2.1** 复核修正 4 项残留：**A** §4.3 状态机/规则改 cursor 语义、与 §2.1 对齐（原系 r1 遗留逐行 reads 表述，自相矛盾）；**B** P1-a 新端点 `/admin/notifications/unread-count` 归属 ADR-NN1 兼任 endpoint-ADR（同张力 1，避门禁）；**C** §8 `finalizeRun` 名称错→`syncRunStatusFromTasks:307`（落库:357，函数实际不存在）；**D** §3 ASCII 改 `+cursor/reads`、§6 P2 编号统一 P2-a..d、§10 折叠指向 §11 D9 去冗、§9 补 cursor 基线断言。

两份评审 + 本复核均未发现需推翻的方案主干问题；四象限边界、解耦双写、digest 契约判断成立。
