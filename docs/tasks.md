# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

（空 — 本会话累计 28 commit / sources sort BUG 回填 + filter 全栈扩展 PATCH-2A 落地 / 待 @livefree dev server 走读 / siteKey 推 PATCH-2B follow-up）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / HOTFIX-PATCH-2A 后）：
1. `/admin/sources` video / lineCount / sourceCount 3 列 ⋯ → **真排序生效**（4df39524 漏改 api.ts 已回填）
2. 矩阵 popover：actions 列已不在矩阵中（kind='action' opt-out）
3. `/admin/sources` 列内 ⋯ → 4 列可过滤：**probeStatus** + **renderStatus** + **updatedAt** + （+ keyword search + Segment）
4. probeStatus / renderStatus 多选 enum filter（4 态 pending/ok/partial/dead）
5. updatedAt 日期范围 filter（YYYY-MM-DD / 含到日全天）
6. siteKey 仍走 Segment（PATCH-2B 后入矩阵 popover）

**已知语义限制**：probeStatus / renderStatus filter 走 raw `video_sources.probe_status = ANY()` EXISTS（"含至少一条线路 status=X 的视频"），不严格对应 SignalPill 聚合显示。若用户反馈不可接受 → PATCH-2C 起 ADR 改 HAVING 或 migration 加视频级聚合列。

**Follow-up 跟踪**：
- **PATCH-2B** siteKey enum filter 全栈（distinct 端点首次消费实证 / 前端 distinctFetcher 注入 / ~0.15-0.2w）
- ImageHealth missing 4 子查询列 sort 全栈（**需 CTE 重写 SQL** / 工时较高 ~0.3-0.5w）
- Merge 候选表 sortField=score 全栈（~0.15w）
- CrawlerRunDetail sort 全栈（~0.15w）
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
24. `4df39524` **AMD2-PHASE5-EP4-SOURCES** sources sort 全栈打通（漏改 api.ts）
25. `4ef5b55c` **EP-4.5-HOTFIX-5** 矩阵 popover hint 文案 + aria/title 旧引导句移除
26. `<TBD>` **HOTFIX-PATCH-2A** sources sort BUG 回填（api.ts URL 透传）+ 4 列 filter 全栈扩展（actions opt-out + updatedAt 真生效 + probeStatus/renderStatus enum 4 态）

总计 +4700+ lines / 95+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式根本反转 + sources 完整可用 / 全质量门禁全过。
