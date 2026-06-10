# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 NTLG-NTF-DISMISS-B1 — dismiss 端点 + Service 写路径（ADR-197 D-197-2/3）

- **所属序列**：SEQ-20260609-01 P3 dismiss（ADR-197 ✅ / -A ✅ 已交付 commit 待提）。**建议模型**：sonnet；**本会话执行模型**：claude-opus-4-8（人工覆盖，持续推进授权）。
- **拆卡依据**：原 ADR-197 -B 蓝图 7 改动点（2 端点+守卫+Service+三处读过滤+purge+ErrorCode）>5 → 拆 **-B1（写路径：端点+Service dismiss）/ -B2（读过滤接入+purge 清理）**（ADR-197 已预留 -B1/-B2 逃生口）。
- **问题理解**：dismiss 写入口——前端调端点移除单条/清空，后端守卫可 dismiss 范围（D-197-2）+ 落库（复用 -A insertDismissals）。
- **方案**（按 ADR-197 D-197-2/3）：① `routes/admin/notifications.ts` 加 2 端点 `POST /admin/notifications/dismiss`（body `{itemKey}`）+ `/dismiss-batch`（body `{itemKeys[]}`，前端回传可见集），preHandler admin+moderator；② 白名单守卫（通知抽屉可 dismiss：`^\d+$`〔general〕∪ `^bg-audit:`〔finished 审计〕；拒 upcoming `^bg-auto_crawl:`/`^bg-scheduler_timer:` + active `^bg-crawler_run:` → 422 `ITEM_NOT_DISMISSABLE`；batch 逐条 skip 计 `skipped`）；③ `NotificationService.dismiss(userId,itemKey)`/`dismissBatch(userId,itemKeys)`（守卫 + 复用 `insertDismissals`，Route 无业务逻辑）；④ ErrorCode `ITEM_NOT_DISMISSABLE` 登记 ApiResponse 真源（ADR-110）；⑤ 端点/service 单测。
- **涉及文件**（范围）：`apps/api/src/routes/admin/notifications.ts`、`apps/api/src/services/NotificationService.ts`、ErrorCode 真源文件（`packages/types` ApiResponse / ADR-110）、`apps/api/src/lib/dismiss-item-key.ts`（白名单守卫纯函数，可测）、对应单测。
- **不做**：三处读过滤接入（list drawer/history 区分 + BackgroundEventService/TaskAggregator userId 内存过滤）+ purge deleteStaleDismissals 接线（-B2）；UI（-C）。
- **子代理调用**：无（端点契约 + 白名单已 ADR-197 D-197-2/3 锁定 + arch-reviewer PASS，纯实施；新端点已本序列 ADR-197 endpoint-ADR 覆盖，不另起 ADR）。
- **原子化**：4 项 ≤5、写路径 api 层 → 单卡。
- **状态**：🔄 进行中（先 commit -A → 守卫纯函数 → Service → 端点 → ErrorCode → 测试 → 门禁 → commit）

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
