# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：**P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + NTLG-P2-a-A ✅ + NTLG-P2-a-B ✅**（maintenanceWorker 接入 DbTaskRunReporter + TaskAggregator 副源切 task_runs 持久登记，读切换零覆盖回归）。**下一可取：NTLG-P2-a-C**（parseTaskId 扩 taskrun- 分派 + AdminTaskControlTarget.kind 扩 'task_run' + bull 协作式取消 status='cancelling'，依赖 -B ✅，sonnet；**闭环 -B→-C 瞬时态**：taskrun- 项控制路径暂报错待 -C 修）；并行待取 **NTLG-P2-d**（purge worker，依赖 ADR-195 ✅，sonnet）/ **P2-b**（多渠道，依赖 P1-c ✅）/ **P2-c**（消息中心+SSE，依赖 P1-a ✅）。**SEQ-20260608-01** cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
