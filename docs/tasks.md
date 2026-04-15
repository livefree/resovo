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

### CHG-412 — P2：crawler_sites.display_name 进入前台线路命名链路
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260414-02
- **实际开始**：2026-04-14 18:26
- **文件范围**：
  - `src/types/video.types.ts`（VideoSource 新增 siteDisplayName）
  - `src/api/db/queries/sources.ts`（findActiveSourcesByVideoId JOIN crawler_sites）
  - `src/lib/line-display-name.ts`（buildLineDisplayName 新增 siteDisplayName 参数）
  - `src/components/player/PlayerShell.tsx`（传入 siteDisplayName）
- **完成备注**：_（完成后填写）_

