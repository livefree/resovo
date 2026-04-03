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

### CHG-350 — 审核台多源播放器改造为“线路+选集”双维

- 状态：🔄 进行中
- 关联序列：`SEQ-20260402-54`
- 目标：修复审核页将分集行误当“多源”的建模偏差，改为“线路选择 + 选集选择”。
- 文件范围：`src/components/admin/moderation/ModerationDetail.tsx`
- 验收要点：同一 `source_name` 只出现一个线路入口；切换线路后仍可按集数播放。
