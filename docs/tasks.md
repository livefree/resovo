# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-21
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## M5-PAGE-GRID-01 — 分类页 Grid 重塑（Sibling 首激活）

- **状态**：🔄 进行中
- **任务 ID**：M5-PAGE-GRID-01
- **所属序列**：SEQ-20260420-M5-PAGE
- **创建时间**：2026-04-20 19:00
- **实际开始**：2026-04-21 15:30
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 目标

新建分类页列表 `[type]/page.tsx`，激活 PageTransition Sibling variant（CSS fade-in 160ms），VideoGrid.Skeleton 导出，TopSlot 容器，ScrollRestoration 接入。

### 文件范围

- 新增 `apps/web-next/src/app/[locale]/[type]/page.tsx`
- 新增 `apps/web-next/src/components/layout/TopSlot.tsx`
- 修改 `apps/web-next/src/components/primitives/page-transition/types.ts`（添加 variant）
- 修改 `apps/web-next/src/components/primitives/page-transition/PageTransitionController.tsx`（sibling 实现）
- 修改 `apps/web-next/src/app/globals.css`（sibling 动画 CSS）
- 修改 `apps/web-next/src/components/video/VideoGrid.tsx`（添加 Skeleton 导出）
- 修改 `apps/web-next/src/app/[locale]/layout.tsx`（添加 ScrollRestoration）

### 验收要点

- `/en/movie`、`/en/series`、`/en/anime` 等路由正常渲染分类列表
- 页面入场 fade-in 160ms（CSS animation，reduced-motion 降级）
- VideoGrid.Skeleton 正确导出
- ScrollRestoration 在 locale layout 中生效
- typecheck ✅ / lint ✅ / unit ✅

---

