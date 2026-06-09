# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：P0 全部 ✅ + P1 地基 ADR（192〔+AMENDMENT〕/193）✅ + **NTLG-P1-a 整卡 ✅** + **NTLG-P1-b ✅** + **NTLG-P1-c-A ✅**（emit/Reporter 地基）+ **NTLG-P1-c-B-1 ✅**（crawler worker run 完成 digest 通知 emit 接入）。**下一可取：NTLG-P1-c-B-2**（8 类白名单事件领域服务/route 写入点 emit 双写——复用 NotificationService TITLE/LEVEL/HREF 映射 + DI 注入 NotificationEmitter；行为变更卡，先定各事件 type/scope/dedupKey 策略；依赖 P1-c-B-1 ✅，建议 sonnet）→ P1-c-C（list 迁新表 + 前端 markAllRead 接线 + 下线 audit 派生旧路径，破坏性切换）。后续 P2（NTLG-ADR-P2 起 ADR-194/195 → P2-a/b/c/d）。SEQ-20260608-01 cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
