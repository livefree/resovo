# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 NTLG-NTF-DISMISS-B3 — dismiss 任务侧读过滤 + taskrun 终态守卫 + purge 清理（ADR-197 D-197-2/4/6）

- **所属序列**：SEQ-20260609-01 P3 dismiss（ADR-197 ✅ / -A ✅ / -B1 ✅ / -B2 ✅ 已交付）。**建议模型**：sonnet；**本会话执行模型**：claude-opus-4-8（人工覆盖，持续推进授权）。
- **问题理解**：补任务抽屉 dismiss（taskrun- 终态可移除）+ 任务侧读过滤 + 后台 dismissal 清理。
- **方案**（按 ADR-197 D-197-2/4/6）：① `TaskAggregator.list` +`userId?` + 终态 task 项 `selectDismissedKeys` 内存 anti-set 过滤；② `system-jobs` route 传 userId；③ taskrun- 终态 dismiss 守卫扩展——`NotificationService.dismiss/dismissBatch` 对 `^taskrun-\d+$` 查 task_runs 状态（终态 success/failed/cancelled 可 / running·pending·cancelling 拒），守卫从纯同步前缀升为含异步查库（复用既有 task_runs query）；④ `maintenanceWorker` purge step 接 `deleteStaleDismissals`（cutoff=NOW-90d，对齐 ADMIN_ACTION_TTL_DAYS，避早于真源 purge，黄线③避 early-return）；⑤ 单测。
- **涉及文件**（范围）：`apps/api/src/services/TaskAggregator.ts`、`apps/api/src/routes/admin/system-jobs.ts`、`apps/api/src/services/NotificationService.ts`、`apps/api/src/lib/dismiss-item-key.ts`（或新 task_runs 终态 query 复用）、`apps/api/src/workers/maintenanceWorker.ts`、对应单测。
- **不做**：UI（-C）；跨标签即时同步（MEDIUM-1 follow-up）。
- **子代理调用**：无（D-197-2/4/6 已 ADR-197 锁定，纯实施）。
- **原子化**：5 项（任务侧读过滤 + taskrun 写守卫 + purge + 测试）→ 单卡。
- **状态**：🔄 进行中（先 commit -B2 → TaskAgg 过滤 → jobs route → taskrun 守卫 → purge 接线 → 测试 → 门禁 → commit）

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
