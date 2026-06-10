# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### SRCHEALTH-P1-4 — sources 页探测完成后外层聚合行联动刷新（B3）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260610-02
- **建议模型**：sonnet
- **执行模型**：claude-fable-5（用户会话人工覆盖——「批准开始 v2 拆卡准备开发」持续推进授权）
- **子代理调用**：无
- **实际开始**：2026-06-10 12:53
- **文件范围**：`apps/server-next/src/app/admin/sources/_client/SourceLinesExpand.tsx`、`apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（+ 必要时 `apps/server-next/src/lib/sources/api.ts` 单行取数）
- **验收口径**：`/admin/sources` 行展开区内任一探测/试播动作（单集/批量）成功后，外层行 probe/render 聚合展示与服务端一致，无需手动刷新。
- **真源**：`docs/designs/source-health-feedback-loop-plan_20260610.md` §2.1 B3 + §3 P1-4；参照范式 CHG-358（审核台 `onSourceHealthChanged` 联动）。
- **完成备注**：_（完成后填写）_

---

_（历史提示：取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
