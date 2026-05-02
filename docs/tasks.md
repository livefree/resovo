# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-02
>
> **并行模式**：当前有 2 条 Track 活跃（`sn4-05-api` + `sn4-06-worker`），工作台见各 `docs/tasks-<id>.md`。本文件仅用于 BLOCKER 监控与 Track 间仲裁。Track 注册表见 `docs/tracks.md`。
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

> 当前主干 main 无进行中任务（已激活并行模式，2026-05-02）。
>
> 活跃 Track（详见 `docs/tracks.md`）：
> - **sn4-05-api**（`track/sn4-05-api`）→ CHG-SN-4-05 后端 API；工作台 `docs/tasks-sn4-05-api.md`
> - **sn4-06-worker**（`track/sn4-06-worker`）→ CHG-SN-4-06 apps/worker；工作台 `docs/tasks-sn4-06-worker.md`
>
> 本文件 Track 仲裁规则：仅当出现 Track 间冲突域争用 / 跨 Track BLOCKER 升级时在此追加协调记录；正常任务执行不写入本文件。

---
