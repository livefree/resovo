# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-22
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

<!-- 2026-04-22 M6 QA hotfix 已修 2 项 -->
<!-- 137fc89 LOCAL_UPLOAD_PUBLIC_URL 默认端口 3001 → 4000 -->
<!-- 待 commit CHORE-09 采集 poster health-check 入队 + backfill admin 入口 -->
<!-- unit 1555 → 1563（+8） -->
<!-- 下一步：用户重启 apps/api 继续 QA；或手动 POST /admin/image-health/backfill 刷存量 -->
