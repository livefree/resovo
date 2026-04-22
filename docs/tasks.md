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

## 进行中：M5-CLEANUP-04 — VideoCard 双出口反转 + TagLayer 溢出

- **序列**：SEQ-20260421-M5-CLEANUP-2
- **状态**：🔄 进行中
- **创建时间**：2026-04-21
- **建议模型**：sonnet
- **主循环模型**：claude-sonnet-4-6
- **子代理调用**：无
- **对应缺陷**：#1（VideoCard 双出口反转 + TagLayer 溢出 + lifecycle 标签文字溢出）
- **文件范围**：
  - `apps/web-next/src/components/video/VideoCard.tsx`
  - `apps/web-next/src/components/video/TagLayer.tsx`
  - `apps/web-next/src/components/primitives/media/StackedPosterFrame.tsx`（仅配合修）
  - `apps/web-next/src/app/globals.css`（VideoCard 布局局部）
- **验收**：
  - 点击封面→Fast Takeover；点击文字→跳详情；悬浮封面出播放按钮；悬浮文字无
  - lifecycle 标签不溢出文字区
  - typecheck / lint / unit ✅；card-to-watch.spec.ts 不回退
- **备注**：

---
