# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 P3 dismiss 软移除**：**ADR-197 ✅ + 后端全完成**（-A schema migration 104 / -B1 写端点+守卫 / -B2 通知侧读过滤 / -B3 任务侧读过滤+taskrun 终态守卫+purge 清理）——通知/任务抽屉 dismiss API 端到端就绪（写守卫 + 读过滤 + dismissal 自动清理）。**剩 -C UI**（用户裁定 2026-06-10 新会话做，避 context 压力保 H-1 重构质量）：**NTLG-NTF-DISMISS-C1（通知抽屉）+ -C2（任务抽屉）**——arch-reviewer (a489b560dbd4f2551) CONDITIONAL PASS **方案 (b) 组件内部 derive dismissable〔零 types.ts 改动、不触 mirror〕**；onDismiss(itemKey)/onClearAll(itemKeys) 对齐 onCancel 范式 + 乐观移除+reload+catch warn（markAllRead 范式）+ **H-1 通知行 button-in-button 重构**（移除按钮移行外兄弟节点）+ useAdminNotifications/useAdminTasks dismiss/dismissAll（split-state 双 filter）+ admin-shell-client wire。详见 task-queue -C bullet + 子代理 transcript（SendMessage a489b560dbd4f2551 可继续）。-C commit 带 `Subagents: arch-reviewer` trailer。**前置可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
