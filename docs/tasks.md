# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 NTLG-NTF-DISMISS-B2 — dismiss 读过滤三处接入（ADR-197 D-197-4）

- **所属序列**：SEQ-20260609-01 P3 dismiss（ADR-197 ✅ / -A ✅ / -B1 ✅ 已交付）。**建议模型**：sonnet；**本会话执行模型**：claude-opus-4-8（人工覆盖，持续推进授权）。
- **拆卡依据**：原 -B 7 改动点 >5 → -B1（写）✅ / **-B2（读过滤）** / -B3（清理+taskrun 守卫）。
- **问题理解**：dismiss 落库后须在抽屉读路径排除，移除才"生效"（不再显示）；消息中心 history 不排除（保留全量，D-197-4）。
- **方案**（按 ADR-197 D-197-4，HIGH-1 分层：general SQL NOT EXISTS、派生 Service 内存 anti-set）：① `routes/admin/notifications.ts` GET list drawer 模式（`!isHistoryMode`）传 `excludeDismissedForUser=userId`、history 模式不传 → `NotificationService.list` 透传到 `buildNotificationFilter`（-A 已备谓词）；② `BackgroundEventService.list` 入参加 `userId` + finished 项 `selectDismissedKeys` 内存 anti-set 过滤（`bg-${event.id}` 比对）；③ `TaskAggregator.list` 入参加 `userId` + 终态项内存过滤；④ 2 route（systemBackgroundEvents/system-jobs）传 `request.user!.userId`；⑤ 单测/集成。
- **涉及文件**（范围）：`apps/api/src/routes/admin/notifications.ts`、`apps/api/src/services/NotificationService.ts`、`apps/api/src/services/BackgroundEventService.ts`、`apps/api/src/services/TaskAggregator.ts`、`apps/api/src/routes/admin/systemBackgroundEvents.ts`、`apps/api/src/routes/admin/system-jobs.ts`（实际文件名以 grep 为准）、对应单测。
- **不做**：taskrun- 终态 dismiss 守卫扩展（查 task_runs）+ maintenanceWorker purge deleteStaleDismissals 接线（-B3）；UI（-C）。
- **子代理调用**：无（D-197-4 分层口径已 ADR-197 锁定，纯实施）。
- **原子化**：5 项（读过滤同主题强内聚 4 处接入 + 测试）→ 单卡。
- **状态**：🔄 进行中（先 commit -B1 → list 接入 → BgEvent/TaskAgg userId 过滤 → 2 route → 测试 → 门禁 → commit）

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
