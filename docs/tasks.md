# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 23+ commit / EP-3-A 全闭环 + sub B/C/D/E + AMD2-ADR/EP + PATCH-1/2 / 6 消费方迁移完成（Crawler/Audit/Users/Videos/ImageHealth/Merge/Subtitles/Sources）/ 待 @livefree dev server 走读 EP-3-E 或继续 EP-3-F/G）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / EP-3-E 后）：
1. `/admin/subtitles` 4 数据列 ⋯ 排序段可点（后端真支持）/ filter 段 disabled + tooltip（kind='computed'）
2. `/admin/subtitles` actions 列**无 ⋯ trigger**（kind='action'）
3. `/admin/sources` 5 列**无 ⋯ trigger**（kind='computed'）/ keyword search + Segment 4 tabs 保留
4. `/admin/sources` lineCount/sourceCount 列**不再显示假装排序按钮**（已删 pre-existing 反范式）
5. 6 消费方零回退

**通过 → EP-3-F 启动**：CrawlerClient + CrawlerRunDetailView（~0.2-0.3w）

**Follow-up 跟踪**（待 ADR-150 阶段 5 EP-4）：
- **sources sort 全栈打通**：后端 listVideoGroups SORT_FIELDS + queries ORDER BY + 前端 fetch
- ImageHealth missing 4 子查询列 sort 全栈（CTE 重写 SQL）
- Merge 候选表 sortField=score 全栈
- subtitles filter 全栈（语言 / 格式 enum 过滤）
- AMD2 共享层 sortableFields / filterableFields 白名单机制

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C（详见 changelog）
16. `68571ceb` **AMD2-ADR** ADR-150 AMENDMENT 2 起草
17. `d776f87b` **AMD2-EP** AMENDMENT 2 实施
18. `9888f7ac` **AMD2-PATCH-1** VideoListClient sort 守卫（反范式错误）
19. `2c6e3cf8` **AMD2-PATCH-2** 后端扩展 SORT_FIELDS / 撤回 PATCH-1 反范式
20. `0e625ac8` **EP-3-D** ImageHealth + Merge 9 列 kind='computed'
21. `<TBD>` **EP-3-E** SubtitlesListClient + SourcesClient 10 列 opt-out

总计 +4500+ lines / 80+ 新单测 / 0 回退 / 8 消费方迁移完成 / ADR-150 AMENDMENT 2 范式根本反转兑现 / 全质量门禁全过。
