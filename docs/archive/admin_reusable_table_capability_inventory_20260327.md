# 后台可复用表格能力盘点（2026-03-27）

> status: archived
> owner: @engineering
> scope: admin reusable table capability inventory
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 范围与目标
- 范围：`src/components/admin` 下后台表格相关“可复用能力”与其接入现状。
- 目标：明确当前“可复用表格”已经具备哪些能力、文件结构与核心变量命名、以及仍存在的非统一实现残留。

---

## 2. 可复用能力总览

### 2.1 表格核心渲染能力（ModernDataTable）
- 泛型列定义：`TableColumn<T>`，支持 `id/header/accessor/cell`。
- 列元信息：`width/minWidth/enableResizing/enableSorting/overflowVisible`。
- 状态渲染：加载态、空态、正常数据态。
- 行标识：`getRowId` 自定义行唯一键。
- 表头 sticky、横向滚动容器、固定表宽（基于列宽总和）。

对应文件：
- `src/components/admin/shared/modern-table/types.ts`
- `src/components/admin/shared/modern-table/ModernDataTable.tsx`
- `src/components/admin/shared/modern-table/ModernTableHead.tsx`
- `src/components/admin/shared/modern-table/ModernTableBody.tsx`

### 2.2 排序能力
- 表头点击升降序切换。
- 列级排序开关：`enableSorting`。
- 统一排序状态：`TableSortState`（`field`, `direction`）/ `AdminTableSortState`（`field`, `dir`）。
- `useAdminTableSort` 支持：
  - 默认排序注入 `defaultSort`
  - 可排序字段白名单（数组或 map）
  - `setSort/toggleSort/clearSort/isSortable/isSortedBy`

对应文件：
- `src/components/admin/shared/modern-table/ModernTableHead.tsx`
- `src/components/admin/shared/table/useAdminTableSort.ts`

### 2.3 列宽调整能力
- 鼠标拖拽改变列宽。
- 宽度边界控制：`minWidth/maxWidth` + clamp。
- 列级可调开关：`resizable/enableResizing`。

对应文件：
- `src/components/admin/shared/modern-table/ModernTableHead.tsx`
- `src/components/admin/shared/table/useAdminColumnResize.ts`
- `src/components/admin/shared/table/useAdminTableColumns.ts`

### 2.4 列显示/隐藏与列配置
- 列可见性：`visible`。
- 列宽持久化。
- 列状态重置。
- 统一列设置 UI：`ColumnSettingsPanel`（显示/隐藏 + 重置）。

对应文件：
- `src/components/admin/shared/table/useAdminTableColumns.ts`
- `src/components/admin/shared/table/ColumnSettingsPanel.tsx`

### 2.5 表格状态持久化能力
- 可持久化状态域：`sort/columns/pagination/filters/scroll`。
- key 组成：`admin:table:{route}:{tableId}:{version}`。
- 合并策略：`mergeAdminTableState`（对 `columns/filters/scroll` 有定制合并）。
- SSR/hydration 兼容：首帧 defaultState，挂载后回放 storage（避免 hydration mismatch）。

对应文件：
- `src/components/admin/shared/table/useAdminTableState.ts`

### 2.6 过滤能力（状态层）
- 列过滤 open/close/toggle 状态。
- 过滤值读写与清空。
- 过滤激活态判断（`isActiveValue`）。
- 过滤渲染上下文：`ColumnFilterRenderContext`。
- 过滤容器：`AdminColumnFilterContainer`（render-prop，UI 留给业务层实现）。

对应文件：
- `src/components/admin/shared/table/useAdminColumnFilter.ts`
- `src/components/admin/shared/table/AdminColumnFilterContainer.tsx`

### 2.7 分页能力（增强版）
- pageSize 切换：默认 `20/50/100`。
- 页码窗口 + 省略号。
- 上一页/下一页。
- 跳页输入 + Enter/按钮触发。

对应文件：
- `src/components/admin/PaginationV2.tsx`

### 2.8 批量操作能力
- 统一批量条：`SelectionActionBar`。
- 两种形态：`inline`（工具栏内）/ `sticky-bottom`（底部吸附）。
- 按钮语义样式：`default/primary/success/danger`。
- 计数显示与可测试标识。

对应文件：
- `src/components/admin/shared/batch/SelectionActionBar.tsx`
- `src/components/admin/shared/batch/AdminBatchBar.tsx`（兼容包装层）

### 2.9 下拉菜单能力
- 统一菜单组件：`AdminDropdown`。
- 支持 `danger/disabled` 菜单项。
- 交互关闭策略：点击外部关闭、`Esc` 关闭。
- 菜单 portal 到 `document.body`，减少容器裁切。

对应文件：
- `src/components/admin/shared/dropdown/AdminDropdown.tsx`

### 2.10 复用单元格能力（cells）
- `TableTextCell`：文本截断、fallback。
- `TableDateCell`：绝对/相对时间显示。
- `TableUrlCell`：URL 片段显示 + 复制。
- `TableBadgeCell`：状态徽标。
- `TableCheckboxCell`：checkbox + indeterminate。
- `TableSwitchCell`：异步切换 + 回滚。
- `TableImageCell`：封面图/fallback。

对应文件：
- `src/components/admin/shared/modern-table/cells/*`

---

## 3. 文件结构（表格能力相关）

### 3.1 共享表格主目录

```text
src/components/admin/shared/
├─ modern-table/
│  ├─ ModernDataTable.tsx
│  ├─ ModernTableHead.tsx
│  ├─ ModernTableBody.tsx
│  ├─ types.ts
│  ├─ useModernTable.ts           # 旧状态hook（当前业务未接入）
│  ├─ useColumnResize.ts          # 旧列宽hook（当前业务未接入）
│  └─ cells/
│     ├─ TableTextCell.tsx
│     ├─ TableDateCell.tsx
│     ├─ TableUrlCell.tsx
│     ├─ TableBadgeCell.tsx
│     ├─ TableCheckboxCell.tsx
│     ├─ TableSwitchCell.tsx
│     ├─ TableImageCell.tsx
│     └─ index.ts
├─ table/
│  ├─ useAdminTableState.ts
│  ├─ useAdminTableColumns.ts
│  ├─ useAdminTableSort.ts
│  ├─ useAdminColumnFilter.ts
│  ├─ useAdminColumnResize.ts
│  ├─ ColumnSettingsPanel.tsx
│  ├─ AdminColumnFilterContainer.tsx
│  ├─ AdminTableFrame.tsx         # 旧包裹层（仍有页面使用）
│  └─ *.demo.tsx
├─ dropdown/
│  └─ AdminDropdown.tsx
├─ batch/
│  ├─ SelectionActionBar.tsx
│  └─ AdminBatchBar.tsx
└─ toolbar/
   └─ AdminToolbar.tsx
```

### 3.2 分页组件
- `src/components/admin/PaginationV2.tsx`（新）
- `src/components/admin/Pagination.tsx`（旧）

---

## 4. 核心变量与常量命名（当前主干）

### 4.1 表格列与排序命名
- `TableSortDirection`, `TableSortState`
- `TableColumn<T>`, `ResolvedTableColumn<T>`, `TableCellContext<T>`
- `enableSorting`, `enableResizing`, `overflowVisible`
- `sort.field`, `sort.direction`（modern-table层）
- `sort.field`, `sort.dir`（admin state层）

### 4.2 后台表格状态命名
- `ADMIN_TABLE_STATE_VERSION`
- `AdminTableState`
- `AdminTableSortState`
- `AdminTableColumnState`
- `AdminTablePaginationState`
- `AdminTableFiltersState`
- `AdminTableScrollState`
- `PersistedAdminTableState`
- `buildAdminTableStorageKey`
- `mergeAdminTableState`
- `serializeAdminTableState` / `deserializeAdminTableState`

### 4.3 列配置命名
- `AdminColumnMeta`
- `AdminResolvedColumnMeta`
- `adaptColumnsState`
- `setColumnVisible`, `toggleColumnVisibility`, `setColumnWidth`, `resetColumnsMeta`

### 4.4 过滤命名
- `ColumnFilterRenderContext`
- `filters`, `activeMap`
- `isFilterOpen/openFilter/closeFilter/toggleFilter`
- `getColumnFilterValue/setColumnFilterValue/clearColumnFilter`
- `isColumnFiltered`

### 4.5 批量与菜单命名
- `SelectionActionVariant`
- `SelectionAction`
- `SelectionActionBar` 的 `variant='inline'|'sticky-bottom'`
- `AdminDropdownItem`
- `AdminDropdown` 的 `align='left'|'right'`

### 4.6 分页命名
- `PaginationV2`
- `buildPageWindow`
- `page/pageSize/total/totalPages`
- `onPageChange/onPageSizeChange`

---

## 5. 已接入现状（摘要）
- 已大规模接入 `ModernDataTable + useAdminTableColumns + ColumnSettingsPanel + PaginationV2` 的页面：
  - 视频管理
  - 用户管理
  - 内容审核相关表格（Submission/Subtitle）
  - 播放源管理相关表格
  - 部分系统页（crawler-site）
- 行操作下拉普遍已改用 `AdminDropdown`。

---

## 6. 非统一实现残留（重点）

### 6.1 过滤能力“有 hook、少接入”
- `useAdminColumnFilter` 目前主要停留在 demo，用于生产表格的接入极少。
- 结果：业务继续在表格外自建过滤 UI，未形成统一“列内过滤”体验。

证据：
- `src/components/admin/shared/table/useAdminColumnFilter.ts`
- `src/components/admin/shared/table/useAdminColumnFilter.demo.tsx`

### 6.2 仍有旧式表格容器与手写 `<table>`
- 旧容器 `AdminTableFrame` 仍被多个页面使用（如 crawler panel / monitoring）。
- 部分页面仍直接手写 `<table>`（dashboard、monitoring、crawler panel）。
- 结果：列宽/排序/过滤/菜单关闭行为难统一复用。

典型文件：
- `src/components/admin/shared/table/AdminTableFrame.tsx`
- `src/components/admin/AdminCrawlerPanel.tsx`
- `src/components/admin/system/monitoring/PerformanceMonitor.tsx`
- `src/components/admin/system/monitoring/CacheManager.tsx`
- `src/components/admin/dashboard/AnalyticsCards.tsx`
- `src/components/admin/dashboard/ContentQualityTable.tsx`

### 6.3 crawler-site 存在独立列菜单体系
- 使用 `CrawlerSiteTableHead + ColumnMenu + ColumnFilterPanel` 自定义列菜单过滤体系。
- 与通用 `useAdminColumnFilter/AdminColumnFilterContainer/ColumnSettingsPanel` 并行。
- 结果：同样“列菜单/过滤/隐藏”功能存在重复实现与行为偏差风险。

典型文件：
- `src/components/admin/system/crawler-site/components/CrawlerSiteTableHead.tsx`
- `src/components/admin/system/crawler-site/components/ColumnMenu.tsx`
- `src/components/admin/system/crawler-site/components/ColumnFilterPanel.tsx`
- `src/components/admin/system/crawler-site/hooks/useCrawlerSiteTableColumns.tsx`

### 6.4 分页组件双轨
- `PaginationV2` 与旧 `Pagination` 并存。
- 结果：分页交互与测试标识存在潜在分叉。

典型文件：
- `src/components/admin/PaginationV2.tsx`
- `src/components/admin/Pagination.tsx`

### 6.5 旧 hooks 残留未接入
- `useModernTable`, `useColumnResize` 存在但当前业务未引用。
- 结果：维护成本上升，易误导后续开发者选型。

典型文件：
- `src/components/admin/shared/modern-table/useModernTable.ts`
- `src/components/admin/shared/modern-table/useColumnResize.ts`

---

## 7. 当前统一性结论
- 结论1：后台“可复用表格能力”基础已经完整，尤其是排序、列宽、列显隐、分页、批量操作、下拉菜单。
- 结论2：真正缺口不在“有没有组件”，而在“是否强制统一接入”。
- 结论3：最大分叉点是“过滤体系”和“旧表格容器/手写表格”并存。

---

## 8. 后续统一建议（用于下一轮任务拆分）
- 建议A：以 `ModernDataTable + useAdminTableColumns + useAdminTableSort + useAdminColumnFilter + ColumnSettingsPanel + PaginationV2 + AdminDropdown + SelectionActionBar` 作为唯一标准栈。
- 建议B：将 crawler-site 自定义列菜单能力逐步迁移到共享过滤体系，避免双栈。
- 建议C：逐页替换 `AdminTableFrame/手写<table>`，并最终清理旧分页、旧hooks。
- 建议D：将“列过滤”能力明确纳入统一表格 API 规范与验收清单，禁止仅做外部筛选而跳过表内能力。
