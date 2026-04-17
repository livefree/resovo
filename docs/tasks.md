# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-14
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

### CHG-414 — P3：video_sources 新增 source_site_key 列，display_name JOIN 改走行级
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260414-04
- **实际开始**：2026-04-17 15:00
- **文件范围**：
  - src/api/db/migrations/046_video_sources_source_site_key.sql (新建)
  - src/api/db/queries/sources.ts
  - src/api/services/CrawlerService.ts
  - docs/architecture.md
- **完成备注**：_（完成后填写）_
