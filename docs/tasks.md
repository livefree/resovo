# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-151 — 全量回归与文档收口（BLOCK 修复序列）

- **状态**：✅ 已完成
- **创建时间**：2026-03-22 14:41
- **计划开始时间**：2026-03-22 14:46
- **实际开始时间**：2026-03-22 14:46
- **完成时间**：2026-03-22 14:47
- **目标**：完成 CHG-149/150 全量验收并闭环文档记录，结束本阻断修复序列。
- **范围**：
  - 全量 `typecheck/lint/test:run`
  - `docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-150
- **DoD**：
  - 全量检查通过
  - `SEQ-20260322-03` 状态与任务时间戳完整
  - 文档记录与代码提交一致
- **回滚方式**：
  - 回退 CHG-151 文档提交
- **备注**：
  - `SEQ-20260322-03` 已完成，下一任务待分配。

---

#### CHG-152 — 提交未追踪文档

- **状态**：🔄 进行中
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：2026-03-22 15:00
- **实际开始时间**：2026-03-22 15:00
- **完成时间**：_
- **目标**：将 branch_handoff_report.md、admin_ui_unification_plan.md、architecture-current.md 纳入版本控制
- **范围**：`docs/branch_handoff_report.md`、`docs/admin_ui_unification_plan.md`、`docs/architecture-current.md`
- **依赖**：CHG-151
- **DoD**：三个文件已提交，`git status` 无 `??`
- **回滚方式**：`git revert` 该 commit
- **完成备注**：_（AI 填写）_

---

#### CHORE-02 — 执行 codex-takeover-20260319 → main --no-ff merge

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：2026-03-22 15:05
- **实际开始时间**：_
- **完成时间**：_
- **目标**：将分支合并入 main，保留完整 commit 历史
- **范围**：git merge 操作
- **依赖**：CHG-152
- **DoD**：merge 成功，main 上全量检查通过
- **回滚方式**：`git revert -m 1 <merge-commit>`
- **完成备注**：_（AI 填写）_

---

#### CHG-153 — watchdog 周期 sync 活跃 run + 独立心跳定时器

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：修复 run 列表滞后（NB-01）并补充 worker 独立心跳 timer（风险提示 A）
- **范围**：`crawlerRuns.ts`、`crawlerScheduler.ts`、`crawlerWorker.ts`、对应测试
- **依赖**：CHORE-02
- **DoD**：watchdog sync 活跃 run、worker timer 3min 心跳、测试覆盖
- **回滚方式**：回退 CHG-153 提交
- **完成备注**：_（AI 填写）_

---

#### CHG-154 — triggerSiteCrawlTask 迁移到 /runs 触发路径

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：统一单站触发调用 POST /admin/crawler/runs，消除双路径（NB-02）
- **范围**：`crawlTaskService.ts`、`crawler.ts`（POST /tasks 加 deprecated 注释）
- **依赖**：CHG-153
- **DoD**：单站触发走 /runs 路径，响应字段兼容，旧路由注释 deprecated
- **回滚方式**：回退 CHG-154 提交
- **完成备注**：_（AI 填写）_

---

#### CHG-155 — 批次 A 回归与文档收口

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：合并后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：完成 SEQ-20260322-05 全量验收与文档闭环
- **范围**：`docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-154
- **DoD**：typecheck/lint/test 通过，文档记录一致
- **回滚方式**：回退 CHG-155 文档提交
- **完成备注**：_（AI 填写）_

---

#### CHG-156 — migration 012: crawler_tasks.started_at

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：补充 task 实际开始时间字段（NB-04）
- **范围**：`012_add_task_started_at.sql`、`crawlerTasks.ts`、`crawler.ts`（mapTaskDto）、`crawlerWorker.ts`
- **依赖**：CHG-155
- **DoD**：migration 幂等，mapTaskDto.startedAt 有值时不为 null
- **回滚方式**：回退 CHG-156 提交
- **完成备注**：_（AI 填写）_

---

#### CHG-157 — useAdminTableState defaultState ref 稳定化

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：防止非 memoize defaultState 触发无限 re-render（NB-06）
- **范围**：`useAdminTableState.ts`
- **依赖**：CHG-156
- **DoD**：useRef 固定初始值，JSDoc 补充说明，现有测试通过
- **回滚方式**：回退 CHG-157 提交
- **完成备注**：_（AI 填写）_

---

#### CHG-158 — docs 追踪规范补充

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：CLAUDE.md 补充 docs/ 文档必须立即追踪的规范（NB-05）
- **范围**：`CLAUDE.md`
- **依赖**：CHG-157
- **DoD**：CLAUDE.md 新增对应规则条目
- **回滚方式**：回退 CHG-158 提交
- **完成备注**：_（AI 填写）_

---

#### CHG-159 — 批次 B 回归与文档收口

- **状态**：⬜ 待开始
- **创建时间**：2026-03-22 15:00
- **计划开始时间**：批次 A 完成后
- **实际开始时间**：_
- **完成时间**：_
- **目标**：完成 SEQ-20260322-06 全量验收与文档闭环
- **范围**：`docs/changelog.md`、`docs/run-logs.md`、`docs/tasks.md`、`docs/task-queue.md`
- **依赖**：CHG-158
- **DoD**：typecheck/lint/test 通过，文档记录一致
- **回滚方式**：回退 CHG-159 文档提交
- **完成备注**：_（AI 填写）_
