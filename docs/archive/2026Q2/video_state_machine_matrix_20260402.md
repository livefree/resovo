# 视频治理状态机矩阵（2026-04-02）

> status: archived
> owner: @engineering
> scope: video governance state machine matrix
> source_of_truth: no
> supersedes: none
> superseded_by: docs/architecture.md
> last_reviewed: 2026-04-24

## 1. 目的

统一 `review_status`（审核）、`visibility_status`（可见性）、`is_published`（上/下架）三字段的业务语义，禁止不合理组合继续写入数据库。

---

## 2. 当前数据库现状（审计快照）

审计范围：`videos WHERE deleted_at IS NULL`

已出现组合：

1. `approved + hidden + false`：813
2. `approved + hidden + true`：412
3. `approved + public + true`：4
4. `pending_review + hidden + false`：8
5. `pending_review + internal + false`：1406
6. `pending_review + internal + true`：706
7. `pending_review + public + true`：2
8. `rejected + hidden + false`：2

关键异常：

1. `is_published=true` 但不满足 `approved+public`：1120
2. `pending_review + is_published=true`：708

---

## 3. 目标状态机（允许组合）

| review_status | visibility_status | is_published | 是否允许 | 说明 |
|---|---|---:|---|---|
| pending_review | internal | false | 允许 | 默认待审态 |
| pending_review | hidden | false | 允许 | 高风险先隐藏待审 |
| approved | public | true | 允许 | 可在前台可见且可播放 |
| approved | internal | false | 允许 | 已过审但未对外发布 |
| approved | hidden | false | 允许 | 已过审但主动下线/隐藏 |
| rejected | hidden | false | 允许 | 拒绝态必须下线隐藏 |
| 其他任意组合 | - | - | 禁止 | DB 触发器拒绝 |

核心不变式：

1. `is_published=true` 必须且仅能出现在 `approved + public`。
2. `visibility_status=public` 必须且仅能出现在 `approved + is_published=true`。
3. `rejected` 必须是 `hidden + false`。

---

## 4. UI 禁用与拦截规则

### 4.1 视频管理页（列表行操作）

1. 上架开关（publish toggle）仅在 `review_status=approved 且 visibility_status=public` 时允许上架。
2. `pending_review/rejected` 行的上架按钮禁用，提示：
   - 待审：`待审核内容不可上架，请先审核通过`
   - 已拒绝：`已拒绝内容不可上架`
3. 当 `visibility_status` 切到 `internal/hidden` 时，前端应联动将上架态显示为 `false`（或提示“将自动下架”）。
4. `rejected` 行的可见性控件禁用为 `hidden`（只读）。

### 4.2 审核台（/admin/moderation）

1. 审核通过：目标状态固定为 `approved + public + true`。
2. 审核拒绝：目标状态固定为 `rejected + hidden + false`。
3. 拒绝后不允许直接上架；需重新进入审核流后再通过。

### 4.3 交互优先级

1. 审核动作优先级高于可见性/上架动作（审核会覆盖后两者到合法组合）。
2. 可见性动作次之（`public` 与上架强绑定；`internal/hidden` 强制未上架）。
3. 上架动作最后执行，且必须通过前置校验。

---

## 5. DB 触发器方案（已给出迁移）

迁移文件：`src/api/db/migrations/023_enforce_video_state_machine_trigger.sql`

迁移内容：

1. 一次性修复历史脏数据（保守策略：不自动“曝光”内容）。
2. 新增 `BEFORE INSERT/UPDATE` 触发器 `trg_videos_state_machine`。
3. 触发器函数 `enforce_videos_state_machine()` 对非法组合直接 `RAISE EXCEPTION`。
4. 触发器增加 `OLD -> NEW` 跳转白名单（非法跨级直接拒绝）。
5. 新增“上架必须有活跃源”校验（无活跃源时拒绝上架）。

修复策略（保守）：

1. `rejected` 统一修复为 `hidden + false`。
2. `pending_review` 统一修复为未上架，且不允许 `public`（降级为 `internal`）。
3. `approved + public + false` 降级为 `approved + internal + false`（不自动上架）。
4. `approved + (internal|hidden) + true` 修复为未上架。

---

## 6. 实施顺序建议

1. 先发 DB 迁移（修复历史 + 触发器落地）。
2. 再发前端禁用规则与提示文案。
3. 最后补后端接口层友好错误码映射（将 trigger 异常转业务错误文案）。

---

## 7. 收敛增强（结构性风险补丁）

### 7.1 Transition 白名单

数据库层新增 `OLD->NEW` 白名单，不仅检查终态合法，还检查迁移路径合法：

1. `pending_review|internal|0 -> pending_review|hidden|0 | approved|public|1 | rejected|hidden|0`
2. `pending_review|hidden|0 -> pending_review|internal|0 | approved|public|1 | rejected|hidden|0`
3. `approved|public|1 -> approved|internal|0 | approved|hidden|0`
4. `approved|internal|0 <-> approved|hidden|0`，且可回 `approved|public|1`
5. `rejected|hidden|0 -> pending_review|hidden|0 | pending_review|internal|0`（复审入口）

### 7.2 单一写入口

新增统一状态 API：

`POST /admin/videos/:id/state-transition`

action：

1. `approve`
2. `reject`
3. `reopen_pending`
4. `publish`
5. `unpublish`
6. `set_internal`
7. `set_hidden`

旧路由（publish/visibility/review）改为复用同一状态转换逻辑，避免多入口分叉。

### 7.3 并发控制

1. 行级锁：状态转换在事务内 `SELECT ... FOR UPDATE`。
2. 乐观锁参数：支持 `expectedUpdatedAt`，冲突返回 `STATE_CONFLICT`（409）。

### 7.4 Reconcile + Watchdog

迁移新增：

1. `video_state_watchdog_runs` 运行日志表。
2. `run_video_state_watchdog(auto_fix boolean)` 函数：
   - `auto_fix=false`：巡检并记录异常样本
   - `auto_fix=true`：按保守策略自动修复

建议调度：

1. 每 10 分钟 `auto_fix=false`（监控）
2. 每日低峰 `auto_fix=true`（纠偏）
