# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：P0 全部 ✅ + P1 地基 ADR（192/193）✅ + **NTLG-P1-a-A**（通知存储 schema + queries 层地基，migration 100 已应用 dev DB）✅。**下一可取：NTLG-P1-a-B**（NotificationService 编排 list迁新表/unreadCount/markAllRead + `GET /admin/notifications` 迁移 + `GET /admin/notifications/unread-count` 端点 + unread-count DTO + 空跑兼容回填 + service/route 测试，依赖 P1-a-A ✅，建议 sonnet）。⚠️ -B 须核 markAllRead 是否需新写端点（ADR-192 端点契约仅列 unread-count；若需写端点须确认归属或 ADR 补登）。后续 P1-b（digest 投影，依赖 ADR-193）→ P1-c（emit 接入，依赖 P1-a+P1-b）。SEQ-20260608-01 cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
