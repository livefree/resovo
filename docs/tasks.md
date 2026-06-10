# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + P2-a ✅ + P2-d ✅ + **P2-c 整卡 ✅**（-ADR〔ADR-196〕/-A〔消息中心页〕/-B〔SSE 未读实时推送双模式〕/-C〔C-1 crawler 并入 list + C-2 红点改 unread-count 解 BLOCKER-1 + F6③ deferred〕全收口）。**P2 剩**：**NTLG-P2-b**（多渠道/邮件）——⏸️ **暂缓**（用户裁定 2026-06-10，零核心影响：email 叶子功能无下游依赖 / webhook 通道已可替代外发；拆卡蓝图已沉淀 task-queue line 1766——**实质剩余仅 email 实装（门控 provider+DNS+ADR）**；治理方案列的其余项核实后或已完成或为孤儿〔submission.created 触发点门控于已下线的用户投稿功能复活，CHG-VSR-8〕）。**SEQ-20260609-01 实质收官**（P0→P2 除暂缓 P2-b 全收口）。**Follow-up**：e2e:admin SSE 端到端验收 + 消息中心 render / date·type 过滤 / 行点击已读 / 归档 F5 v1 deferred（独立卡）/ 前端 mock finished crawler 一致性清理。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
