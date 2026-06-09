# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：P0 全部 ✅ + P1 地基 ADR（192〔+AMENDMENT〕/193）✅ + **NTLG-P1-a 整卡 ✅** + **NTLG-P1-b ✅** + **NTLG-P1-c-A ✅**（emit/Reporter 地基）+ **NTLG-P1-c-B 整卡 ✅**（-B1 crawler worker digest + -B2 8 类事件 emit 双写全量接入）。**下一可取：NTLG-P1-c-C**（list 迁新表 + 前端 markAllRead 接线〔替 localStorage〕+ 下线 audit 派生旧路径〔删 NOTIFICATION_ACTION_WHITELIST 派生 + list 直读 notifications 新表列〕；破坏性切换、前提 -B 双写已验证 ✅；category/read 投影由本卡处置；依赖 P1-c-B ✅，建议 sonnet）→ 收口 P1。后续 P2（NTLG-ADR-P2 起 ADR-194/195 → P2-a/b/c/d）。SEQ-20260608-01 cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
