# Resovo（流光） — 任务看板



> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-19
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

#### M3-DETAIL-02 — 5 种详情页路由新建 apps/web-next

- **状态**：🔄 进行中
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **创建时间**：2026-04-19
- **依赖**：M3-DETAIL-01 ✅
- **文件范围**：
  - 新增：`apps/web-next/src/app/[locale]/movie/[slug]/page.tsx`
  - 新增：`apps/web-next/src/app/[locale]/series/[slug]/page.tsx`
  - 新增：`apps/web-next/src/app/[locale]/anime/[slug]/page.tsx`
  - 新增：`apps/web-next/src/app/[locale]/tvshow/[slug]/page.tsx`
  - 新增：`apps/web-next/src/app/[locale]/others/[slug]/page.tsx`
  - 新增：`apps/web-next/src/app/[locale]/_lib/detail-page-factory.ts`（工厂函数）
