# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-146 — 采集配置拖拽实现 shared 化

- **状态**：🔄 进行中
- **创建时间**：2026-03-22 00:10
- **计划开始时间**：2026-03-22 02:10
- **实际开始时间**：2026-03-22 00:30
- **完成时间**：
- **目标**：将 crawler-site 专用拖拽实现提炼进 shared 并复用。
- **范围**：
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns.ts`
  - `src/components/admin/shared/table/useAdminTableColumns.ts`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx`
- **依赖**：CHG-145
- **DoD**：
  - crawler-site 不再依赖专用拖拽状态管理
  - shared 拖拽体验与 crawler 现有基线一致
  - 不影响列宽持久化与筛选排序
- **回滚方式**：
  - 回退 CHG-146 提交
- **备注**：
  - CHG-145 已完成并通过回归检查，继续下一原子任务。
