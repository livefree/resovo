# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：**P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + NTLG-P2-a ✅ + NTLG-P2-d-A ✅**（task_runs 统一抽象层端到端 + purge-expired-notifications worker 机制）。**下一可取**：**NTLG-P2-d-B**（admin_action per-type TTL 策略注入，emit 层 type→days + Emitter 注入，D-195-1+黄线① admin_action ≥90 天，依赖 -A ✅，sonnet——激活 purge）。**门控待用户决策**：**NTLG-P2-b**（多渠道·邮件实装）⚠️ 项目无邮件基础设施（decisions.md:9898）+ 多渠道需单独 ADR（decisions.md:8855）→ 需先起 ADR + 定 email provider（外向服务/成本/新依赖，须用户拍板，不可自动引入触发 BLOCKER）。**NTLG-P2-c**（消息中心+SSE）跨 3 层大卡需先拆 + SSE 设计。**SEQ-20260608-01** cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
