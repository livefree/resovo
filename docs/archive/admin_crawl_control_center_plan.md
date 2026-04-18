# Admin 采集功能集中管理重构方案（CHG-96 基线）

> status: archived
> owner: @engineering
> scope: admin crawl control center consolidation plan
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


- **版本**：v1.1
- **日期**：2026-03-21
- **适用范围**：后台 `站点配置` / `视频源配置（拟重命名）` / `采集任务记录`

## 固定原则
自动采集配置唯一入口为“采集控制台”，其他页面仅保留只读提示或跳转，不再提供编辑能力。

## 执行硬约束（v1.1）

1. **先做 Phase A，不允许跳步**  
`A1 契约统一 -> A2 入口单点化 -> A3 orphan 可见` 未完成前，不进入页面重排与监控增强。

2. **唯一触发入口（强规则）**  
- 采集触发只允许在「采集控制台」。
- 「采集任务记录」只读，不允许触发采集。
- 其他页面最多保留跳转，不保留触发按钮。

3. **worker 硬约束前置（P0）**  
`C1` 必须提前：无 `runId/taskId` 的 crawl job 直接拒绝执行并记录错误日志。

4. **控制台固定系统状态条（常驻）**  
控制台顶部固定显示：
- scheduler 是否开启
- freeze 是否开启
- orphan task 数量

5. **监控区与表格区数据解耦（强制）**  
- `overview/running/recent` 独立轮询
- table 不参与高频刷新
- table 仅在明确用户操作后按需刷新

## 1. 推荐的新页面命名

候选名称：
1. 采集管理
2. 采集控制台
3. 源站采集管理
4. 数据源采集
5. 采集中心

推荐名称：**采集控制台**

推荐理由：
- 强调“统一操作 + 统一观察 + 统一配置”的中心定位。
- 能覆盖手动采集、自动采集、状态概览、任务跳转等完整职责。
- 与“采集任务记录”形成清晰主从关系（控制台负责控制，任务记录负责审计）。

兼容策略（命名迁移）：
- 导航名称先改为“采集控制台”。
- 旧入口（旧菜单名/旧路由别名）保留至少 1 个迭代周期。
- 旧入口页面展示“已迁移提示 + 一键跳转”。

## 2. 页面职责重构表

| 页面 | 保留 | 移出 | 新增 |
|---|---|---|---|
| 站点配置 | 站点基础参数、连通性参数、站点元信息维护 | 自动采集开关、采集策略配置 | 无 |
| 采集控制台（原视频源配置） | 单站采集、批量采集、全站采集、站点管理 | 任务历史明细浏览（深度日志查看） | 页面级采集概览、统一自动采集配置、任务记录跳转 |
| 采集任务记录 | 任务列表、执行结果、日志、失败原因 | 自动采集开关与策略编辑 | 按 run/task 维度筛选与追踪 |

## 3. 采集功能集中管理信息架构

后台信息架构建议：
1. 站点配置
2. 采集控制台（原视频源配置）
3. 采集任务记录

采集控制台页面分层：
1. 采集概览面板（全局态势）
2. 采集操作区（手动触发）
3. 自动采集设置区（唯一配置入口）
4. 站点管理表格（行级能力）
5. 任务记录跳转区（审计入口）

## 4. 自动采集配置模型（最小可用）

### 4.1 配置结构

```ts
interface AutoCrawlConfig {
  globalEnabled: boolean
  defaultMode: 'incremental' | 'full'
  scheduleType: 'daily'
  dailyTime: string // HH:mm
  onlyEnabledSites: boolean
  conflictPolicy: 'skip_running' | 'queue_after_running'
  perSiteOverrides: Record<string, {
    enabled: boolean
    mode: 'inherit' | 'incremental' | 'full'
  }>
}
```

### 4.2 生效范围说明（必须在 UI 明示）

1. 全局开关优先级：
- `globalEnabled=false` 时，不触发任何自动采集（无论单站是否开启）。
- `globalEnabled=true` 时，按站点级开关与规则继续判定。

2. `inherit` 含义：
- 单站 `mode=inherit` 时继承 `defaultMode`。
- 单站显式配置 `incremental/full` 时覆盖 `defaultMode`。

3. `onlyEnabledSites` 与单站覆盖冲突规则：
- 默认策略：`onlyEnabledSites=true` 时，`disabled` 站点不会被自动采集，即使 `perSiteOverrides.enabled=true`。
- 如未来需要突破该约束，新增高级策略字段，不在 MVP 阶段引入。

4. 手动与自动任务冲突策略：
- 推荐默认 `skip_running`：同站点已有活跃任务时，自动任务跳过并记录原因。

## 5. 统一任务流程图（文字版）

统一模型：**run = 批次，task = 单站执行**

- 单站手动采集：`1 run + 1 task`
- 批量采集：`1 run + N task`
- 全站采集：`1 run + N task`
- 定时采集：scheduler 创建 `1 run + N task`

流程：
1. 触发方（用户操作或 scheduler）发起请求。
2. 后端 run service 统一创建 run，并生成关联 tasks。
3. 后端 enqueue 入队，立即返回 `runId`（与首批 `taskId`）。
4. worker 独立执行 task，更新 `queued/running/success/failed/cancelled/timeout`。
5. 前端通过 overview/runs/tasks latest 轮询观察状态。
6. 页面离开后任务持续执行（执行链路完全独立于页面生命周期）。

职责分工：
- 触发：前端 / scheduler
- 创建：后端 run/task service
- 执行：queue worker
- 展示：采集控制台（态势）+ 采集任务记录（审计）

## 6. 新页面模块划分建议（采集控制台）

1. `CrawlOverviewPanel`
- 总站点数、可用站点数、运行中任务数、最近失败任务数、今日采集视频数

2. `CrawlActionBar`
- 全站增量/全量采集
- 批量增量/全量采集
- 与表格选择状态联动

3. `AutoCrawlSettingsPanel`
- 全局自动采集开关
- 每日采集时间
- 默认采集模式
- onlyEnabledSites
- 生效范围说明（固定文案）

4. `SourceManagementTable`
- 站点基础信息
- 采集能力
- 自动采集状态
- 最近采集状态
- 行内单站操作（增量/全量）

5. `TaskRecordEntry`
- 跳转“采集任务记录”
- 快捷查看日志、失败原因

## 7. 分阶段实施计划（Plan Only, v1.1 顺序）

### A1：契约统一（runId/taskId）
1. 前后端触发接口统一到 run/task 口径。
2. 前端移除 `jobId` 旧口径与映射。
3. 类型层统一 run/task/status 定义，删除重复旧类型。

DoD：
- 单站/批量/全站触发返回统一字段：`runId`, `taskIds|taskId`, `enqueuedSiteKeys`, `skippedSiteKeys`。
- 前端无 `jobId` 依赖。

回滚：
- 接口层提供临时兼容字段开关（只读兼容，不恢复旧写链路）。

### A2：入口单点化（控制台唯一触发）
1. 任务记录页移除触发按钮。
2. 采集控制台保留全部触发动作。
3. 其他页面仅保留跳转。

DoD：
- 全站仅一处可触发采集（采集控制台）。

回滚：
- UI 层 feature flag 恢复旧按钮（仅紧急回滚使用）。

### A3：orphan task 显式可见
1. 增加 orphan task 查询与聚合指标。
2. 控制台显示 orphan 告警（数量 + 跳转排查）。

DoD：
- 可一眼识别“运行中但不归属 run”的异常任务。

回滚：
- 指标展示可单独关闭，不影响采集链路。

### C1：worker 硬约束（前置）
1. worker 执行前校验：无 `runId/taskId` 直接拒绝。
2. 记录错误日志并更新任务状态（若 task 存在）。

DoD：
- 无孤儿执行链路；不再出现“面板看不见的实际采集执行”。

回滚：
- 仅放宽为 warn 模式（不建议，除非紧急）。

### C2：stop-all / freeze 正式化
1. 后端接口与脚本对齐统一返回结构。
2. 控制台接入 stop-all / freeze 操作与反馈。
3. 收敛策略统一（pending/running/paused）。

DoD：
- 可通过控制台或命令一键止血并确认收敛结果。

回滚：
- 保留现有脚本能力，UI 可临时隐藏。

### B1：控制台容器拆分与 query model 收拢
1. 容器拆分：监控、动作、表格、自动采集设置分离。
2. 建立统一 query model 管理 `overview/running/recent/systemFlags`。
3. 强制监控区与表格区解耦刷新。

DoD：
- 监控高频轮询不影响表格状态（筛选/排序/列宽/滚动）。

回滚：
- 组件级回滚，不触及 run/task 后端链路。

### D1：健康状态条 + 深链体验完善
1. 控制台新增固定健康状态条（scheduler/freeze/orphan）。
2. 运行批次与任务记录深链完善（runId/taskId）。
3. 最近结果区补齐失败原因与日志入口。

DoD：
- 运维可一眼判断系统是否可控，排障路径明确。

回滚：
- 可回退到旧展示，不影响执行链路。

## 8. 风险点与回滚策略

主要风险：
1. 双入口并存期造成误操作。
2. 配置迁移期间新旧字段语义不一致。
3. 展示口径不一致（控制台 vs 任务记录）。
4. 自动与手动并发导致重复执行。

控制策略：
1. 迁移提示 + 入口限流（编辑入口单点化）。
2. 配置兼容层（读旧写新）+ 审计日志。
3. 统一以 run/task 聚合接口作为展示口径。
4. 冲突策略默认 `skip_running`，并记录跳过原因。

回滚原则：
1. 优先回滚 UI 层（feature flag）。
2. 维持接口向后兼容，避免中断运行任务。
3. 执行链路（queue/worker）不与页面耦合，不做破坏性回滚。
