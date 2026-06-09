# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 P0 全部完成 + P1 地基 ADR 全部 ✅**（ADR-192 + ADR-193 Accepted）。**下一可取：NTLG-P1-a**（通知存储 + 读 API：migration 100 + `db/queries/notifications.ts` + NotificationService 编排 + unread-count 端点，依赖 ADR-192 ✅，建议 sonnet）→ P1-b（digest 类型 + crawler 投影，依赖 ADR-193 ✅，建议 sonnet）→ P1-c（解耦双写 emit 接入，依赖 P1-a+P1-b，建议 sonnet）。⚠️ P1-a/b/c 建议模型 sonnet——若续用本 opus 会话推进属人工覆盖（同 P0 先例「持续推进」授权），否则可新会话按建议 sonnet 启动。SEQ-20260608-01 cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
