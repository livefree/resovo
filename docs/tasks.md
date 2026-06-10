# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 NTLG-NTF-DISMISS-C1 — 通知抽屉 dismiss UI（移除按钮 + 清空，方案 b 零 types 改动）

- **所属序列**：SEQ-20260609-01 P3 dismiss（ADR-197 ✅ / -A ✅ / -B1 ✅ / -B2 ✅ / -B3 ✅ 后端全完成）。**建议模型**：sonnet；**本会话执行模型**：claude-opus-4-8（人工覆盖，持续推进授权）。
- **子代理设计**：arch-reviewer (claude-opus-4-8 / agentId a489b560dbd4f2551) CONDITIONAL PASS → **方案 (b) 组件内部 derive dismissable**（零 types.ts 字段改动 → 不触 mirror）。
- **问题理解**：通知抽屉加项级「移除」+「清空」按钮，软移除调端点 + 乐观移除 + reload。
- **方案**（按子代理设计）：① `notification-drawer.tsx` +`NotificationDrawerProps.onDismiss?: (itemKey: string) => void` + `onClearAll?: (itemKeys: readonly string[]) => void`（对齐 onCancel 范式）；② `isNotificationDismissable(item)` 内部纯函数（`category !== 'background'` 或 `id.startsWith('bg-audit:')` → 可；upcoming/active 不可）；③ **H-1 button-in-button 重构**：interactive 行从「整行 button」改「行容器 div + 主体 button/article + 移除按钮兄弟节点」（移除按钮独立 aria-label、不触发 onItemClick）；④ headerActions 加「清空」按钮（收集 `visibleItems.filter(isNotificationDismissable).map(id)`，空集 disabled，复用既有 BTN_STYLE token 零硬编码）；⑤ `useAdminNotifications` +`dismiss(itemKey)`/`dismissAll(itemKeys)`（乐观 split-state 双 filter〔generalItems+backgroundItems〕+ apiClient.post + reload + catch warn 降级，markAllRead 范式）；⑥ `admin-shell-client.tsx` wire onDismiss/onClearAll；⑦ 单测。
- **涉及文件**（范围）：`packages/admin-ui/src/shell/notification-drawer.tsx`、`apps/server-next/src/lib/admin-shell-notifications.ts`、`apps/server-next/src/app/admin/admin-shell-client.tsx`、`tests/unit/components/admin-ui/shell/notification-drawer.test.tsx`。
- **不做**：任务抽屉（-C2）；NotificationItem/TaskItem types.ts 加 dismissable 字段（方案 b 否决）；跨标签即时同步（MEDIUM-1）。
- **子代理调用**：arch-reviewer (claude-opus-4-8 / a489b560dbd4f2551)——设计 onDismiss/onClearAll 共享组件 API 契约（事件签名）；commit 带 `Subagents:` trailer（spawn 子代理审计）。**方案 b 不改 types.ts → mirror 不触发**。
- **原子化**：≤5 项单层（admin-ui UI + hook + wire）→ 单卡（-C2 任务抽屉拆出）。
- **状态**：🔄 进行中（先 commit -B3 → drawer Props+判定+H-1 重构+清空 → hook dismiss/dismissAll → wire → 测试 → 门禁 → commit）

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
