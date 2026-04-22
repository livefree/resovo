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

<!-- 2026-04-22 SEQ-20260422-BUGFIX-01 进度：6/12 ✅（P0 全部完成） -->
<!--   META-10    bbac72a  豆瓣分类对齐 -->
<!--   CHORE-05   59a2a91  40 万行试验数据清空 -->
<!--   CRAWLER-05 e276b71  replaceSourcesForSite 按 source_site_key -->
<!--   ADMIN-13   0c237cb  /admin/sources 行级 COALESCE -->
<!--   CRAWLER-06 f8f8131  CrawlerRefetchService 补 sourceSiteKey -->
<!--   ADMIN-14   待 commit safeUpdate manual 覆盖自锁 + 反馈语义 -->
<!-- 下一阶段 P1：ADMIN-15 / ADMIN-16 / CRAWLER-07 / CRAWLER-08 -->
