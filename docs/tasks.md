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

## M5-CARD-SKELETON-01 — Skeleton primitive + 三档门槛

- **状态**：✅ 完成
- **开始时间**：2026-04-21
- **完成时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **文件范围**：
  - `packages/design-tokens/src/semantic/skeleton.ts`（新增）
  - `packages/design-tokens/src/semantic/index.ts`（修改）
  - `apps/web-next/src/app/globals.css`（修改，加 skeleton CSS vars + keyframe）
  - `apps/web-next/src/components/primitives/feedback/Skeleton.tsx`（新增）
  - `apps/web-next/src/hooks/useSkeletonDelay.ts`（新增）
  - `apps/web-next/src/components/primitives/feedback/ProgressBar.tsx`（新增）
  - `apps/web-next/src/components/video/VideoCard.tsx`（修改，VideoCard.Skeleton 用 Skeleton primitive）
  - `tests/unit/web-next/Skeleton.test.tsx`（新增）
- **备注**：16 个单元测试全通过；VideoCard.Skeleton 像素匹配实装
