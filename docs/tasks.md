# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

（空 — 本会话累计 31 commit / Merge 候选表 sort 全栈打通 PATCH-2 范式复刻 4 字段（score/videoCount/year/titleNormalized）/ Service 层 sort + zod 白名单 + 前端 enableSorting / 待 @livefree dev server 走读 /admin/merge sort 切换）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / HOTFIX-PATCH-2A + 2B 双卡 落地后）：
1. `/admin/sources` 列名 ⋯ → 排序段 video / lineCount / sourceCount 真生效（PATCH-2A）
2. 矩阵 popover → actions 列已 opt-out / 5 列可过滤：updatedAt + probeStatus + renderStatus + **siteKey hidden**（PATCH-2B）
3. 列内 ⋯ → DataTableAutoFilter popover：probeStatus / renderStatus 静态 4 态 / siteKey 走 distinct 端点动态拉取
4. siteKey 多选 → 后端 EXISTS ANY 过滤

**Follow-up 跟踪**：
- **PATCH-2C** probe/renderStatus 聚合语义校正（HAVING 或 migration 加视频级 render_check_status / 条件触发 / 0.3-0.5w + ADR）
- ImageHealth missing 4 子查询列 sort 全栈（需 CTE 重写 SQL / ~0.3-0.5w）
- Merge 候选表 sortField=score 全栈（~0.15w）
- CrawlerRunDetail sort 全栈（~0.15w）
- e2e smoke 3 case + @livefree 走读 5 代表页
- AMD2 共享层 sortableFields / filterableFields 白名单机制（消费方声明）
- distinctFetcher AbortSignal 支持（DataTable API follow-up / search 快速切换防 stale response）

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
26. `9f4486e1` **HOTFIX-PATCH-2A** sources sort BUG 回填 + 4 列 filter 全栈扩展（actions opt-out + updatedAt 真生效 + probeStatus/renderStatus enum 4 态）
27. `223b4867` **HOTFIX-PATCH-2B** siteKey enum filter 全栈 / distinct 端点首次消费实证 / DataTableProps API 扩展 Opus A- 评审通过
28. `ec442527` **HOTFIX-PATCH-2B-FIX1** siteKey 列 cell 显站点 csv（hidden column 改 visible / 后端 STRING_AGG DISTINCT + Service+raw 透传 + 前端 cell hover title）
29. `<TBD>` **MERGE-SORT-FULLSTACK** Merge 候选表 sortField=score/videoCount/year/titleNormalized 全栈打通（Service 层 sort 4 字段白名单 / PATCH-2 范式复刻 / 5 文件 + 32 单测 +5 case）

总计 +5100+ lines / 110+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式完整 + sources 6 列 filter + Merge 4 字段 sort + distinct 端点首消费 / 全质量门禁全过。
