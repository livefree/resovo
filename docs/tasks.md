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

## HANDOFF-16 — Search 浮层 + 搜索页

- **状态**：🔄 进行中
- **创建时间**：2026-04-23 17:10
- **实际开始**：2026-04-23 17:10
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 问题理解

搜索分两层：Nav 浮层（快速跳转，640px 宽面板）+ 搜索页（type tab + 结果卡 token 驱动）。
两层已存在骨架但未对齐 spec §13。Nav search 硬编码 maxWidth:480px 需替换为 token。

### 方案

1. `globals.css` — 追加 `--search-*` token alias
2. `SearchOverlay.tsx`（新建）— 640px 浮层，grouped results，thumbnail 40px
3. `Nav.tsx` — 替换 `maxWidth: '480px'` → `var(--search-input-max-w)`，接入 SearchOverlay
4. `SearchPage.tsx` — 容器 max-w-page，input 56px，加 type tab bar，结果卡间距走 token

### 涉及文件

- `apps/web-next/src/app/globals.css`
- `apps/web-next/src/components/search/SearchOverlay.tsx`（新建）
- `apps/web-next/src/components/layout/Nav.tsx`
- `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`
