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

### CHG-352 — 历史 episode_count 漂移回填 migration

- 状态：🔄 进行中
- 关联序列：`SEQ-20260402-54`
- 目标：修复历史数据中 `videos.episode_count` 与 `video_sources` 实际集数不一致问题。
- 文件范围：`src/api/db/migrations/024_backfill_videos_episode_count_from_sources.sql`
- 验收要点：执行 migration 后，仅当 `MAX(episode_number)` 更大时推进主表 `episode_count`。
