# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-29
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

**任务 ID**：CHG-SN-3-07
**标题**：VideoEditDrawer（基础元数据字段）
**状态**：🔄 进行中
**开始时间**：2026-04-29
**执行模型**：claude-sonnet-4-6
**子代理调用**：无

**文件范围**：
- `apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx`（新建）
- `tests/unit/components/server-next/admin/videos/VideoEditDrawer.test.tsx`（新建）
- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（修改：接入 VideoEditDrawer）

**备注**：无
