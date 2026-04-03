# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-02
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 当前进行中（仅保留一条）

### CHG-351 — 爬虫命中已有视频时同步推进 episode_count

- 状态：🔄 进行中
- 关联序列：`SEQ-20260402-54`
- 目标：修复已有视频在持续采集时 `episode_count` 不增长的问题，避免前台误判为单集。
- 文件范围：`src/api/services/CrawlerService.ts`，`src/api/db/queries/videos.ts`
- 验收要点：命中 existing 分支后，`videos.episode_count` 可随新集数单调递增（只增不减）。
