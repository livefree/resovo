# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + P2-a ✅ + P2-d ✅ + **P2-c 整卡 ✅**（-ADR/-A/-B/-C 全收口）+ **Follow-up NTLG-P2-c-E2E ✅**（通知链路浏览器级验收，e2e:admin 82 passed）+ **Follow-up NTLG-P2-c-UI-1 ✅**（2026-06-10 通知抽屉可见性增强：按 category 分组渲染「系统通知/后台动态」+ 解除 body 单行截断让采集 digest 摘要完整显示；notification-drawer 专项 26 测 / test:changed 999 passed；不改 Props 无 Opus）。**P2 剩**：**NTLG-P2-b**（多渠道/邮件）——⏸️ **暂缓**（用户裁定 2026-06-10；实质剩余仅 email 实装〔门控 provider+DNS+ADR〕，蓝图 task-queue line 1766）。**SEQ-20260609-01 实质收官**（P0→P2 除暂缓 P2-b 全收口）。**剩余 follow-up（均独立卡/门控）**：结构化 digest chips（需扩 NotificationItem.digest 跨 4 层 + Opus）/ 铃铛数字徽标（C-2 已留 number 契约）/ 真实 Redis SSE-push 端到端（流式 mock harness）/ date·type 过滤 / 行点击已读 markOneRead（D-192-DEV-4 设计门控）/ 归档 F5 v1 deferred（用户门控）。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
