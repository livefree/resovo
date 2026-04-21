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

## M5-CARD-ROUTESTACK-01 — RouteStack 边缘返回手势实装

- **状态**：✅ 完成
- **开始时间**：2026-04-21
- **完成时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **文件范围**：
  - `apps/web-next/src/hooks/useEdgeSwipeBack.ts`（新增）
  - `apps/web-next/src/components/primitives/route-stack/RouteStack.tsx`（修改）
  - `tests/unit/web-next/RouteStack.test.tsx`（新增）
  - `tests/e2e-next/edge-swipe-back.spec.ts`（新增）
- **备注**：e2e 全部 test.skip 等待 M5-PAGE-DETAIL-01；jsdom 中 Touch.clientX 需特殊处理（speed mock + direction check）
