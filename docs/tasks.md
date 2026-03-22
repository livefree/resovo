# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-150 — 增加 worker 显式心跳保活（BLOCK-02）

- **状态**：🔄 进行中
- **创建时间**：2026-03-22 14:41
- **计划开始时间**：2026-03-22 14:44
- **实际开始时间**：2026-03-22 14:44
- **完成时间**：
- **目标**：在 worker 层增加显式 heartbeat 保活，避免长任务被 stale-heartbeat watchdog 误判超时。
- **范围**：
  - `src/api/workers/crawlerWorker.ts`
  - `src/api/db/queries/crawlerTasks.ts`
  - 相关单测与文档记录
- **依赖**：CHG-149
- **DoD**：
  - 新增轻量 heartbeat touch 能力
  - worker 在长任务执行期按节流刷新 heartbeat
  - 不改变任务状态语义与现有触发接口
  - typecheck/lint/test 通过
- **回滚方式**：
  - 回退 CHG-150 提交（worker/query 心跳逻辑）
- **备注**：
  - CHG-149 已完成；后续执行 CHG-151 做全量回归与收口。
