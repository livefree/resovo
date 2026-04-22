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

## 任务卡：M5-CLEANUP-02

- **状态**：进行中
- **开始时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **目标**：StackedPosterFrame stackLevel 0|1|2 + CinemaMode 颜色 Token 化
- **文件范围**：
  - 修改 `apps/web-next/src/components/primitives/media/StackedPosterFrame.tsx`
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`（getStackLevel 映射）
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/CinemaMode.tsx`（颜色 Token 化）
- **验收要点**：typecheck ✅ / lint ✅ / unit ✅；StackedPosterFrame 接受 stackLevel=2；CinemaMode 无硬编码颜色

---

## 已完成任务卡：M5-CLEANUP-01

- **状态**：已完成（2026-04-21）
- **开始时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无（必要时 spawn haiku 做机械 grep 报告）
- **目标**：补齐 design-tokens 包中 4 个缺失 Token 分组（takeover / tabbar / shared-element / route-stack）+ tag/skeleton 细粒度补全 + 清理 player 组件内联 fallback
- **文件范围**：
  - 新增 `packages/design-tokens/src/semantic/takeover.ts`
  - 新增 `packages/design-tokens/src/semantic/tabbar.ts`
  - 新增 `packages/design-tokens/src/semantic/shared-element.ts`
  - 新增 `packages/design-tokens/src/semantic/route-stack.ts`
  - 修改 `packages/design-tokens/src/semantic/tag.ts`（lifecycle/trending 细粒度拆分）
  - 修改 `packages/design-tokens/src/semantic/skeleton.ts`（补 dark 变体）
  - 修改 `packages/design-tokens/src/semantic/index.ts`（导出新增模块）
  - 修改 `apps/web-next/src/app/globals.css`（新增 Token CSS 变量声明 + `--cinema-overlay-bg`）
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`（去除内联 fallback）
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/MiniPlayer.tsx`（去除内联 fallback）
  - 新增 `tests/unit/design-tokens/alias-coverage.test.ts`
- **验收要点**：typecheck ✅ / lint ✅ / unit ✅；内联 fallback 零命中；新增 Token 可 grep 于构建产物

---
