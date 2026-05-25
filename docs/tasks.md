# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 24+ commit / 10 消费方迁移完成（Crawler/Audit/Users/Videos/ImageHealth/Merge/Subtitles/Sources/CrawlerRuns/CrawlerRunDetail）/ AMD2 client+server 范式区分实证 / 待 @livefree dev server 走读 EP-3-F 或继续 EP-3-G dev demo / 全表 e2e smoke / ADR-150 阶段 5 EP-4）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / EP-3-F 后）：
1. `/admin/crawler` 7 数据列 ⋯ trigger 默认显示（mode=client 前端过滤+排序）/ chevron + actions 列**无 ⋯ trigger**
2. `/admin/crawler/runs/[id]` 8 数据列 + ops 列**无 ⋯ trigger**（mode=server 防假装）
3. 10 消费方零回退

**通过 → EP-3-G 或 ADR-150 阶段 5 EP-4 启动**：
- **EP-3-G**：dev demo 表 + 任何剩余消费方 + 全表 e2e smoke（~0.2-0.3w）
- **ADR-150 阶段 5 EP-4**：sources/ImageHealth missing/Merge/CrawlerRunDetail sort 全栈打通 + e2e smoke 3 case + @livefree 走读 5 代表页

**Follow-up 跟踪**：
- sources sort 全栈打通（后端 listVideoGroups SORT_FIELDS）
- ImageHealth missing 4 子查询列 sort 全栈（CTE 重写）
- Merge 候选表 sortField=score 全栈
- CrawlerRunDetail sort 全栈
- AMD2 共享层 sortableFields / filterableFields 白名单机制

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C（详见 changelog）
16. `68571ceb` **AMD2-ADR** ADR-150 AMENDMENT 2 起草
17. `d776f87b` **AMD2-EP** AMENDMENT 2 实施
18. `9888f7ac` **AMD2-PATCH-1** VideoListClient sort 守卫（反范式错误）
19. `2c6e3cf8` **AMD2-PATCH-2** 后端扩展 SORT_FIELDS / 撤回 PATCH-1 反范式
20. `0e625ac8` **EP-3-D** ImageHealth + Merge 9 列 kind='computed'
21. `1bf423ba` **EP-3-E** SubtitlesListClient + SourcesClient 10 列 opt-out
22. `<TBD>` **EP-3-F** CrawlerSiteList + CrawlerRunDetailView 11 列 opt-out

总计 +4500+ lines / 80+ 新单测 / 0 回退 / 10 消费方迁移完成 / ADR-150 AMENDMENT 2 范式根本反转兑现 / 全质量门禁全过。
