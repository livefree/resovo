# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

_（当前无进行中任务。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260609-01 进展**：**P0 ✅ + P1 ✅ + NTLG-ADR-P2 ✅ + NTLG-P2-a ✅ + NTLG-P2-d ✅ + NTLG-P2-c-ADR ✅ + NTLG-P2-c-A ✅ + NTLG-P2-c-B ✅ + NTLG-P2-c-C-1 ✅**（F6① crawler 并入 notifications 主 list〔出 ADR-152 background lane，成对移除 BackgroundEventService finished crawler 派生 + 死代码 buildRunDigest，黄线1〕+ F6③ 确认 v1 全 broadcast 无定向 emit → 继续 deferred）。**P2-c 下一可取**：**NTLG-P2-c-C-2**（F6② 红点改读 unread-count 解 BLOCKER-1：`admin-shell.tsx:175` `notifications.some(!read)` 改 unread-count 数字驱动 + 向后兼容 → **改 `packages/admin-ui/src/shell/types.ts` 公开 Props 须 arch-reviewer Opus 子代理 + commit `Subagents:` trailer** + server-next `useAdminNotifications` 新增 unreadCount〔端点初始/轮询 + SSE onUnread 实时〕+ admin-shell-client wire；依赖 -C-1 ✅）。**门控**：**NTLG-P2-b**（邮件）须用户定 provider + 起 ADR。**Follow-up**：e2e:admin SSE 端到端 + 消息中心 render 验证 / date·type 过滤 / 行点击已读 / 前端 mock finished crawler 数据一致性清理（非阻塞）。**SEQ-20260608-01** cutover 剩：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
