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

## 任务卡：M5-PAGE-BANNER-FE-01

- **状态**：已完成
- **开始时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **目标**：HeroBanner 前端重塑，消费真实 `/v1/banners` API；PC Ken Burns + 移动端 embla 轮播；`--banner-accent` 1s 过渡
- **文件范围**：
  - 修改 `apps/web-next/src/components/video/HeroBanner.tsx`
  - 新增 `apps/web-next/src/components/video/KenBurnsLayer.tsx`
  - 新增 `apps/web-next/src/components/video/BannerCarouselMobile.tsx`
- **验收要点**：typecheck ✅ / lint ✅ / unit ✅

---
