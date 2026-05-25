# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 18+ commit / EP-3-A 全闭环 + sub B + sub C / VideoListClient + UsersListClient + AuditClient + CrawlerRunsView 4 表格已迁 D-150 / 待 @livefree dev server 走读 sub C 或继续 EP-3-D）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / sub C 后）：
1. `/admin/videos` toolbar 4 旧 select 控件全消失（搜索 q / type / visibility / review_status）→ 保留 status + site 2 控件
2. 列名 ⋯ 触发 4 列 popover：
   - 标题列 → text popover（搜 title / D-150-4 桥接 column.id='title' / filterFieldName='q'）
   - 类型列 → enum popover（11 种 VIDEO_TYPE）
   - 可见性列 → enum popover（public/internal/hidden / D-150-4 桥接 visibility/visibilityStatus）
   - 审核列 → enum popover（pending_review/approved/rejected / D-150-4 桥接 review_status/reviewStatus）
3. 多列组合过滤 + 排序 → fetch 真过滤 + 真排序
4. saved views 切换正常（filtersMap 同 key 命名空间）
5. filter chips slot 外置 + 矩阵 popover 列固有过滤格状态 ✓

**通过 → EP-3-D 启动**（ImageHealthClient + MergeClient ~0.3w）

---

## 本会话已完成 commit 链

1-13. EP-3-A 全闭环（详见 changelog）
14. `82c45425` EP-3-B sub B UsersListClient 迁
15. `<TBD>` **EP-3-C sub C** VideoListClient 4 列 filter + VideoFilterBar 简化（StagingPageClient 跳过）

总计 +4000+ lines / 80+ 新单测 / 0 回退 / D-150-4 桥接 7 实证 / 全质量门禁全过。
