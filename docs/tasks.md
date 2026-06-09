# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：**P0 全部 ✅ + P1 全部 ✅ + NTLG-ADR-P2 ✅**（ADR-194 task_runs 只读投影真源裁定 + ADR-195 通知 TTL/dedup/scope 策略，arch-reviewer Opus PASS）。**下一可取：NTLG-P2-a**（task_runs migration + DbTaskRunReporter + TaskAggregator 投影收敛 + ADR-191 re-point，依赖 ADR-194 ✅，建议 opus 数据模型）；并行可取 **NTLG-P2-d**（purge-expired-notifications 清理 worker，依赖 ADR-195 ✅，建议 sonnet）/ **NTLG-P2-b**（多渠道订阅，依赖 P1-c ✅）/ **NTLG-P2-c**（消息中心页 + SSE，依赖 P1-a ✅）。SEQ-20260608-01 cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
