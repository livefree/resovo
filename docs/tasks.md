# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 26+ commit / 12 消费方完整闭环 + sources sort 全栈打通 / ADR-150 AMENDMENT 2 范式根本反转 + PATCH-2 sort 范式标准化复刻 / 待 @livefree dev server 走读 sources sort）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / EP-4 sources sort 后）：
1. `/admin/sources` video / lineCount / sourceCount 3 列 ⋯ → 排序段可点 + 真排序
2. filter 段 disabled + tooltip（kind='computed' 业务无意义）
3. keyword search + Segment 4 tabs + probeStatus/renderStatus sort disabled 保留
4. 12 消费方零回退

**Follow-up 跟踪**（待 ADR-150 阶段 5 EP-4 剩余）：
- ImageHealth missing 4 子查询列 sort 全栈（**需 CTE 重写 SQL** / 工时较高 ~0.3-0.5w）
- Merge 候选表 sortField=score 全栈（~0.15w）
- CrawlerRunDetail sort 全栈（~0.15w）
- sources filter 全栈（业务需求待评估）
- e2e smoke 3 case + @livefree 走读 5 代表页
- AMD2 共享层 sortableFields / filterableFields 白名单机制（消费方声明）

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C
16. `68571ceb` **AMD2-ADR** ADR-150 AMENDMENT 2 起草
17. `d776f87b` **AMD2-EP** AMENDMENT 2 实施
18. `9888f7ac` **AMD2-PATCH-1** VideoListClient sort 守卫（反范式错误）
19. `2c6e3cf8` **AMD2-PATCH-2** 后端扩展 SORT_FIELDS / 撤回反范式
20. `0e625ac8` **EP-3-D** ImageHealth + Merge 9 列 kind='computed'
21. `1bf423ba` **EP-3-E** SubtitlesListClient + SourcesClient 10 列 opt-out
22. `240e7109` **EP-3-F** CrawlerSiteList + CrawlerRunDetailView 11 列
23. `05a6e802` **EP-3-G** StagingPageClient / 12 消费方闭环
24. `<TBD>` **AMD2-PHASE5-EP4-SOURCES** sources sort 全栈打通

总计 +4500+ lines / 80+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式根本反转 + sources sort 真实施 / 全质量门禁全过。
