# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-23
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

<!-- HANDOFF-01 ✅ 2026-04-22 完成，arch-reviewer PASS，详见 changelog.md -->
<!-- HANDOFF-02 ✅ 2026-04-22 完成，arch-reviewer APPROVED，详见 changelog.md -->
<!-- HANDOFF-04 ✅ 2026-04-22 完成，arch-reviewer NEED_FIX→7条已修正，详见 changelog.md -->
<!-- HANDOFF-03 ✅ 2026-04-22 完成（pending-user §7 UI 复核签字 + commit 授权），arch-reviewer NEED_FIX→2必改+B/C加分已修，方案B合规PASS，ADR-054+SEQ-202605XX占位入队，详见 changelog.md -->
<!-- HANDOFF-05 ❌ 2026-04-23 整卡回滚（commit c9cdd9d revert），UI 复核 3 轮 🔴 改后用户拍板整卡回滚，需以 L 规模重新规划入队，详见 changelog.md HANDOFF-05-REVERT 条目 -->
<!-- LazyImage race hotfix ✅ 2026-04-23（commit 917c027），与 HANDOFF-05 无关的独立通用修复 -->
<!-- HANDOFF-07 🟡 stash 保留（stash@{0}: handoff-07-wip-before-cutover），tokens + primitives 已就绪但 VideoCard hover 定位 bug 未修；待 CUTOVER 完成 + UI 增量重做启动时决策恢复策略 -->
<!-- WEB-CUTOVER ✅ 2026-04-23 完成（待 commit），apps/web 退役、apps/web-next 升为 port 3000 对外唯一前端，tag pre-cutover-apps-web-snapshot 保留 snapshot；详见 changelog.md -->
<!-- HANDOFF-10 ✅ 2026-04-23 完成，arch-reviewer NEED_FIX→6条已修正 PASS，详见 changelog.md -->
<!-- HANDOFF-11 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->
<!-- HANDOFF-12 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->
<!-- HANDOFF-13 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->
<!-- HANDOFF-14 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->
<!-- HANDOFF-15 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->

<!-- HANDOFF-16 ✅ 2026-04-23 完成，typecheck/lint/test 全绿，详见 changelog.md -->
<!-- 单任务工作台：空，下一个任务 HANDOFF-17（Detail 页） -->
