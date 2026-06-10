# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：**P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + NTLG-P2-a ✅ + NTLG-P2-d ✅ + NTLG-P2-c-ADR ✅**（ADR-196 Accepted：SSE 架构 fetch-stream+Redis pub/sub / 消息中心读契约 / 收口 P1-c-C 3 项；归档 v1 deferred 用户裁定；arch-reviewer CONDITIONAL PASS 2 红线+4 黄线+1 分层项全处置）。**P2-c 下一可取**：**NTLG-P2-c-A**（消息中心页：list 端点扩展 cursor/q/过滤 + server-next 页，依赖 D-196-4，sonnet）/ **NTLG-P2-c-B**（SSE 实装：/stream 路由 + NotificationStreamService 共享 subscribe+内存连接表 + Redis pub/sub + fetch-stream 客户端 + 轮询 fallback，依赖 D-196-1/2/3，sonnet）。**门控**：**NTLG-P2-b**（邮件）须用户定 provider + 起 ADR。**SEQ-20260608-01** cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
