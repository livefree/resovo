# Resovo（流光） — 任务看板

---

## 当前进行中（仅保留一条）

#### CHG-122 建立 shared table state schema 与 storage key 规范

- **状态**：🔄 进行中
- **创建时间**：2026-03-21 11:20
- **计划开始时间**：2026-03-21 11:30
- **实际开始时间**：2026-03-21 11:30
- **完成时间**：
- **目标**：统一 `useAdminTableState` 的状态结构与持久化 key 规则，作为 admin 全列表迁移基线。
- **范围**：
  - `src/components/admin/shared/table/*`
  - `src/components/admin/system/crawler-site/tableState.ts`（仅通用层抽象）
- **依赖**：无
- **DoD**：
  - 统一 schema：`sorting/filters/hiddenColumns/columnWidths/pagination/scrollTop`
  - 统一存储 key：`admin.table.<pageId>.v1`，并给出兼容迁移策略
  - crawler-site 现有排序/显隐/列宽/持久化行为不回退
- **回滚方式**：回退本任务 commit，恢复旧 state hook 与旧 key 读写逻辑
- **备注**：
  - `/admin/crawler` 采集配置表仅作为 shared table 样板，不反向抽象采集控制台业务逻辑。
  - 默认“后端分页优先”；仅明确低数据量页面允许前端排序作为过渡。
