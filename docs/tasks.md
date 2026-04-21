# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-20
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

---

## IMG-09 — image-health 7 天破损趋势 sparkline

- **状态**：🔄 进行中
- **创建时间**：2026-04-20 18:00
- **实际开始**：2026-04-20 18:20
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **依赖**：IMG-08 ✅
- **文件范围**：
  - `apps/api/src/db/queries/imageHealth.ts`
  - `apps/api/src/routes/admin/image-health.ts`
  - `apps/server/src/services/image-health-stats.service.ts`
  - `apps/server/src/components/admin/image-health/TrendSparkline.tsx`（新建）
  - `apps/server/src/components/admin/image-health/ImageHealthDashboard.tsx`

---
