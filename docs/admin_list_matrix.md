# Admin List Capability Matrix（后台列表能力矩阵）

> status: reference
> owner: @engineering
> scope: admin list capability inventory matrix
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 记录时间：2026-03-21
> 范围：`/admin` 下所有列表页

---

## 字段说明

1. 排序：是否支持列排序。
2. 列显隐：是否支持显示/隐藏列。
3. 列宽拖拽：是否支持拖拽列宽。
4. 截断：是否对长文本进行截断并可查看完整内容。
5. 固定行高：是否保证行高一致。
6. 容器滚动：是否有表格容器独立滚动。
7. 分页：是否有分页能力。
8. 状态持久化：离页返回后是否保留列表状态。
9. 排序/分页位置：前端/后端。
10. 风险等级：低/中/高（按数据规模与性能风险评估）。
11. 迁移优先级：P0/P1/P2/P3。

---

## 能力矩阵

| 页面 | 主要组件 | 排序 | 列显隐 | 列宽拖拽 | 截断 | 固定行高 | 容器滚动 | 分页 | 状态持久化 | 排序/分页位置 | 风险等级 | 迁移优先级 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/admin/crawler`（采集配置） | `CrawlerSiteTable` | ✅ | ✅ | ✅ | ✅ | △ | ✅ | ❌ | ✅ | 排序前端 / 无分页 | 高 | P0（样板） |
| `/admin/crawler?tab=tasks`（任务记录） | `AdminCrawlerPanel` | ❌ | ❌ | ❌ | ✅ | △ | △（仅横向） | ✅ | △（runId URL） | 排序无 / 分页后端 | 高 | P1 |
| `/admin/videos` | `VideoTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 高 | ✅ 已迁移 |
| `/admin/sources` | `SourceTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 高 | ✅ 已迁移 |
| `/admin/users` | `UserTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 中 | ✅ 已迁移 |
| `/admin/content`（投稿审核 Tab） | `SubmissionTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 中 | ✅ 已迁移 |
| `/admin/content`（字幕审核 Tab） | `SubtitleTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 中 | ✅ 已迁移 |
| `/admin/submissions`（旧） | `AdminSubmissionList` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 中 | ✅ 已迁移（兼容入口） |
| `/admin/subtitles`（旧） | `AdminSubtitleList` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 排序前端 / 分页后端 | 中 | ✅ 已迁移（兼容入口） |
| `/admin/analytics`（爬虫最近任务） | `AdminAnalyticsDashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | 排序前端 / 无分页 | 低 | ✅ 已迁移 |
| `/admin/system/cache` | `CacheManager` | ✅ | ✅ | ✅ | △（字段短） | ✅ | ✅ | ❌ | ✅ | 排序前端 / 无分页 | 低 | ✅ 已迁移 |
| `/admin/system/monitor`（慢请求） | `PerformanceMonitor` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | 排序前端 / 无分页 | 低 | ✅ 已迁移 |

---

## 结论

1. 高/中/低风险列表页已完成 shared 基线迁移，形成一致交互能力。
2. 仍未纳入 shared 的是 `crawler tasks` 任务记录页（按业务口径单独管理）。
3. 后续新增列表默认复用 shared 基线，不再新增独立 localStorage 或表格状态实现。
