/**
 * data-table types — DataTable v2 + useTableQuery 公开 API 类型
 * 真源：ADR-103 §4.1 + §4.2（CHG-SN-2-13）
 *       reference.md §4.4（CHG-DESIGN-02）— 扩展 framed table 系统（按 step 增量交付）
 */
import type { ReactNode } from 'react'

// ── DataTable v2（§4.1）────────────────────────────────────────────

export interface DataTableProps<T> {
  readonly rows: readonly T[]
  readonly columns: readonly TableColumn<T>[]
  readonly rowKey: (row: T) => string
  readonly mode: 'client' | 'server'
  readonly query: TableQuerySnapshot
  readonly onQueryChange: (next: TableQueryPatch) => void
  /** server 模式必填；client 模式由 rows.length 推导 */
  readonly totalRows?: number
  readonly loading?: boolean
  readonly error?: Error | undefined
  readonly emptyState?: ReactNode
  readonly selection?: TableSelectionState
  readonly onSelectionChange?: (next: TableSelectionState) => void
  readonly onRowClick?: (row: T, index: number) => void
  /**
   * 行密度（CHG-UX2-03b 新增 'poster'）：
   * - compact: row-h-compact 32px
   * - comfortable: row-h 40px（默认）
   * - poster: row-h-poster 80px（含 Thumb poster-md 48×72 封面的列表）
   */
  readonly density?: 'comfortable' | 'compact' | 'poster'
  readonly 'data-testid'?: string

  /**
   * @deprecated ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1（2026-05-23）
   * 此 prop 已废弃。新方案：点列名 → toggle asc/desc（互斥）+ 列名右侧 ⋯ 列级三点 +
   * toolbar 右端 ⋯ 统一矩阵 popover。本 prop 在 EP-1 阶段保留但 noop（不再触发任何效果），
   * EP-6 将完全删除（AMENDMENT 1 序列调整）。消费方应在 EP-4..EP-5 完成后由 EP-6 统一删除。详 ADR-149 §3 D-149-1/D-149-4 + AMENDMENT 1。
   */
  readonly enableHeaderMenu?: boolean

  /**
   * 列名右侧 ⋯ 列级三点触发器的可见性策略（ADR-149 D-149-3）。
   * - `auto`（默认）：static + dynamic 复合判定：列支持排序 OR 列有 filterContent OR
   *   列可隐藏 OR 列当前已过滤 OR 列当前已排序 → 显示 ⋯
   * - `always`：始终显示 ⋯（不可操作列点击 popover 内容全灰）
   * - `never`：不显示 ⋯（仅靠 thead 统一矩阵 popover；适合所有列均无单列操作场景）
   * 详 ADR-149 §3 D-149-3。
   */
  readonly columnTriggerVisibility?: 'auto' | 'always' | 'never'

  /**
   * 统一三点触发器（矩阵 popover 入口）的位置（ADR-149 D-149-2）。
   * - `toolbar-right`（默认）：toolbar 右端，与 search / trailing 同行
   * - `thead-right`：紧贴 thead 最后一列右侧；备选模式，仅在 toolbar.hidden=true 时建议
   * 当 `toolbar.hidden===true && headerMenuTriggerPosition==='toolbar-right'` 时，
   * 强制 fallback 到 `'thead-right'`（toolbar 不渲染时无处可挂）。
   * 详 ADR-149 §3 D-149-2 + R-149-3。
   */
  readonly headerMenuTriggerPosition?: 'toolbar-right' | 'thead-right'

  /**
   * 内置 toolbar（CHG-DESIGN-02 Step 4）：framed surface 顶部 search / trailing /
   * viewsConfig 三槽位。缺省时不渲染内置 toolbar（消费方可继续用外置 Toolbar 组件）。
   */
  readonly toolbar?: ToolbarConfig

  /**
   * 表内 sticky bottom bulk action bar 内容（CHG-DESIGN-02 Step 5）。
   * 仅在 selection.selectedKeys.size > 0 且 bulkActions 可渲染时显示。
   * 设计稿 .dt__bulk 视觉对应；取代外置 SelectionActionBar 浮条。
   */
  readonly bulkActions?: React.ReactNode

  /**
   * 行展开内容渲染器（可展开行场景，如 sources matrix 线路×集数）。
   * 提供时，DataTable 在每行之后按需渲染展开 panel；
   * 展开状态由消费方通过 expandedKeys + onRowClick 管理（DataTable 不持有展开状态）。
   * 展开 panel 不占用任何列 cell，宽度与 .dt__scroll 容器一致（ADR-117 D-117-5）。
   */
  readonly renderExpandedRow?: (row: T) => React.ReactNode

  /**
   * 当前展开行的 rowKey 集合。配合 renderExpandedRow 使用；
   * 消费方在 onRowClick 中切换 key，DataTable 只负责渲染展开内容。
   */
  readonly expandedKeys?: ReadonlySet<string>

  /**
   * 行 flash 动画触发集合（乐观更新场景，CHG-DESIGN-02 Step 5）。
   * 集合中的 rowKey 命中行会接收 data-flash="true"，触发 1.5s ease-out 高亮动画。
   * 时序所有权在消费方：DataTable 仅按当前 prop 渲染；1.5s 后清空集合由消费方
   * 自行 setTimeout 控制（避免业务 timer 泄漏到组件内）。
   */
  readonly flashRowKeys?: ReadonlySet<string>

  /**
   * 内置 pagination 渲染配置（CHG-DESIGN-02 Step 7A，设计稿 .dt__foot / .dt__pager）。
   *
   * 控制态（page / pageSize / 切换）沿用顶层 `query.pagination` + `onQueryChange`，
   * 本配置仅承载渲染相关参数（pageSizeOptions / summaryRender / hidden）。
   * 服务端模式总数权威源是顶层 `totalRows`；客户端模式由 processedRows.length 推导。
   *
   * **三态语义**（消费方需明确选择）：
   *   - `pagination` **省略**（不传 prop）→ 渲染 **summary-only** foot（仅 summary
   *     文本，**不渲染** pager / pageSize select）。保设计稿 §4.4.1 footer 一体性同时
   *     与现有外置 `PaginationV2` 消费方零冲突（不出现双 pager）。
   *   - `pagination={...}`（显式传 config，含空对象 `{}`）→ 渲染 **完整 foot**
   *     （summary + pager + pageSize select）。消费方明示选用一体化分页，应同时
   *     移除外置 PaginationV2 编排避免双 pager。
   *   - `pagination={{ hidden: true }}` → **完全不渲染** foot（嵌入式兜底）。
   */
  readonly pagination?: PaginationConfig
}

// ── Pagination（CHG-DESIGN-02 Step 7A）────────────────────────────

export interface PaginationConfig {
  /** 不渲染 .dt__foot（嵌入式兜底；消费方仍可外置 PaginationV2） */
  readonly hidden?: boolean
  /**
   * pageSize 切换可选项；缺省 `[10, 20, 50, 100]`。
   * 当 pageSizeOptions 长度 <= 1 时不渲染 pageSize 切换控件。
   */
  readonly pageSizeOptions?: readonly number[]
  /**
   * 自定义 summary 文案；缺省渲染 `共 {total} 条 · 第 {page}/{totalPages} 页`，
   * 当 selectedCount > 0 时尾部追加 ` · 已选 {selectedCount} 项`。
   * 返回 `null` 时不渲染 summary 区域。
   */
  readonly summaryRender?: (ctx: PaginationSummaryContext) => ReactNode
}

export interface PaginationSummaryContext {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
  readonly selectedCount: number
}

// ── Toolbar / Saved Views（CHG-DESIGN-02 Step 4）──────────────────

export interface ToolbarConfig {
  /**
   * 内置 280px 搜索框 slot。消费方传完整 input 元素，DataTable 仅承载布局。
   */
  readonly search?: React.ReactNode
  /** 工具栏右侧自定义节点（refresh / export / 新建按钮等） */
  readonly trailing?: React.ReactNode
  /** Saved views 配置；缺省不渲染视图按钮 */
  readonly viewsConfig?: ViewsConfig
  /** 不渲染 toolbar 容器（嵌入式场景；消费方仍可外置 Toolbar） */
  readonly hidden?: boolean
  /**
   * @deprecated ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1（2026-05-23）
   * 隐藏列 chip 在 ADR-149 中废弃，功能整合到 thead 右侧统一矩阵 popover。
   * 本 prop 在 EP-1 阶段保留 noop（不再渲染 chip 也不再读取此 prop），EP-6 将完全删除（AMENDMENT 1 调整：EP-3 删文件+JSX / EP-6 删类型）。
   * 详 ADR-149 §3 D-149-1 / D-149-10。
   */
  readonly hideHiddenColumnsChip?: boolean
  /**
   * @deprecated ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1（2026-05-23）
   * filter chips slot 在 ADR-149 中废弃。"已过滤状态"统一显示在矩阵 popover 过滤格；
   * trailing 槽位允许 read-only 业务摘要 chip（如 FilterChipBar，D-149-11 例外）。
   * 本 prop 在 EP-1 阶段保留 noop，EP-6 将完全删除（AMENDMENT 1 调整：EP-3 删 JSX / EP-6 删类型）。详 ADR-149 §3 D-149-1 / D-149-10 / D-149-11。
   */
  readonly hideFilterChips?: boolean
}

export interface ViewsConfig {
  readonly items: readonly TableView[]
  readonly activeId?: string
  readonly onChange?: (id: string | null) => void
  /**
   * 保存当前 query 为新视图。返回 Promise 时 UI 可显示 loading。
   * label 由消费方自管（设计稿真源 datatable.jsx DTViewList.onSaveCurrent 仅传 scope）。
   */
  readonly onSave?: (scope: ViewScope) => void | Promise<void>
}

export type ViewScope = 'personal' | 'team'

export interface TableView {
  readonly id: string
  readonly label: string
  readonly scope: ViewScope
  /** 持久化的 query 状态（不含 selection — 视图与选区无关） */
  readonly query: PersistedQuery
  readonly createdAt: string  // ISO
  readonly updatedAt: string  // ISO
  readonly createdBy?: string  // team scope 必填；personal scope 可选
}

export type PersistedQuery = Omit<TableQuerySnapshot, 'selection'>

interface TableColumnBase<T> {
  readonly id: string
  readonly header: ReactNode
  readonly accessor: (row: T) => unknown
  readonly width?: number
  readonly minWidth?: number
  readonly enableResizing?: boolean
  readonly enableSorting?: boolean
  readonly cell?: (ctx: TableCellContext<T>) => ReactNode
  readonly columnMenu?: ColumnMenuConfig
  readonly defaultVisible?: boolean
  readonly pinned?: boolean
  readonly overflowVisible?: boolean
  /**
   * @deprecated ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1（2026-05-23）
   * filter chips 整段废弃后本 prop 无消费方（Grep 实测 0 处使用）。
   * 自定义"已过滤状态摘要"应通过 `column.columnMenu.filterSummary: string` 提供。
   * 本 prop 在 EP-1 阶段保留 noop，EP-6 将完全删除（AMENDMENT 1 调整）。详 ADR-149 §3 D-149-6 / D-149-10。
   */
  readonly renderFilterChip?: (ctx: FilterChipContext) => ReactNode
}

// ── ADR-150 阶段 2 / 列固有自动过滤 discriminated union（D-150-5）─────────

/**
 * 自动过滤控件类型（ADR-150 D-150-2）。
 * 'enum' 多选 checkbox / 'text' input + IME / 'number' min-max range / 'date' from-to range。
 */
export type AutoFilterKind = 'enum' | 'text' | 'number' | 'date'

/**
 * distinct 选项（ADR-150 D-150-1 静态 filterOptions 或 D-150-3 distinct API 响应单元素）。
 * label 缺省 = value；count 由后端 D-150-3 distinct API 可选返回（v1 不实装）。
 */
export interface DistinctOption {
  readonly value: string
  readonly label?: string
  readonly count?: number
}

/**
 * 自动过滤 column 字段 — Active arc（ADR-150 D-150-5 union 守卫）。
 * filterable: true 时 filterFieldName **必填**（避免 M-SN-8 假装实现陷阱：
 * popover 渲染但后端静默忽略，用户以为过滤了实际看全量）。
 */
export interface AutoFilterColumnFieldsActive {
  readonly filterable: true
  readonly filterFieldName: string
  readonly filterKind?: AutoFilterKind
  readonly filterOptions?: readonly DistinctOption[]
  readonly filterDistinctEndpoint?: string
  readonly filterDistinctTable?: string
}

/**
 * 自动过滤 column 字段 — Inactive arc（ADR-150 D-150-5）。
 * filterable 缺省 / false 时，5 个 filter* 字段必须为 undefined（discriminated union 守卫）。
 */
export interface AutoFilterColumnFieldsInactive {
  readonly filterable?: false
  readonly filterFieldName?: never
  readonly filterKind?: never
  readonly filterOptions?: never
  readonly filterDistinctEndpoint?: never
  readonly filterDistinctTable?: never
}

/**
 * discriminated union — 编译期强制 filterable: true ↔ filterFieldName 必填配对。
 * 老消费方（12 个）未传 filterable → 自动 narrow 到 Inactive arc / 0 破坏。
 * 新消费方声明 filterable: true 强制必填 filterFieldName（D-150-5 守卫 / 反 M-SN-8 假装实现）。
 *
 * 互斥（运行时 dev warn）：filterable: true 时不应同时声明 columnMenu.filterContent。
 */
export type AutoFilterColumnFields =
  | AutoFilterColumnFieldsActive
  | AutoFilterColumnFieldsInactive

/**
 * TableColumn<T> — 列定义（ADR-150 阶段 2 起 = TableColumnBase + AutoFilterColumnFields union）。
 */
export type TableColumn<T> = TableColumnBase<T> & AutoFilterColumnFields

/**
 * FilterableColumn<T> — filterable: true 后的 narrow 类型（ADR-150 D-150-5 union 守卫）。
 * 用途：DataTableAutoFilter 入口接收此类型，filterFieldName 必填 / 不必再做 undefined 守卫。
 */
export type FilterableColumn<T> = TableColumnBase<T> & AutoFilterColumnFieldsActive

/**
 * filter chip 渲染上下文（CHG-DESIGN-02 Step 7A）。
 * 设计原则：消费方拿到 column 自身可访问 header；onClear 已绑定 query 修改路径，
 * 无需消费方再走 onQueryChange。
 */
export interface FilterChipContext {
  readonly filter: FilterValue
  readonly column: ColumnDescriptor
  readonly onClear: () => void
}

export interface TableCellContext<T> {
  readonly row: T
  readonly value: unknown
  readonly rowIndex: number
}

export interface TableSortState {
  readonly field: string | undefined
  readonly direction: 'asc' | 'desc'
}

export interface TableSelectionState {
  readonly selectedKeys: ReadonlySet<string>
  readonly mode: 'page' | 'all-matched'
}

export interface ColumnMenuConfig {
  readonly canSort?: boolean
  readonly canHide?: boolean
  readonly filterContent?: ReactNode
  readonly isFiltered?: boolean
  readonly onClearFilter?: () => void
  /**
   * 已过滤状态的摘要文本（ADR-149 D-149-6）。
   * 由消费方提供，矩阵 popover 过滤格右侧显示。
   * 缺省时矩阵格显示「已过滤」（无摘要详情）。
   *
   * 格式建议（消费方自行格式化）：
   * - text：`<值>`，长度 > 30 字符建议截断
   * - enum 单选：`类型: 电影`
   * - enum 多选 ≤ 2 项：`类型: 电影, 电视剧`
   * - enum 多选 > 2 项：`类型: 电影+3 项…`
   * - range：`8.0-10.0`
   * - date-range：`近7天` 或 `2026-05-01~05-23`
   *
   * 矩阵格 UI 处理：max-width: 200px / text-overflow: ellipsis / white-space: nowrap +
   * hover 显示 native `title` tooltip 全文（DataTable 内部完成）。
   *
   * 本字段当前锁定 `string`（不接 ReactNode）；富文本（chip 内嵌 icon / 颜色徽标 / 链接）
   * 走 N1-149-6 N1 follow-up 评估。详 ADR-149 §3 D-149-6 + R-149-4。
   */
  readonly filterSummary?: string
}

/**
 * TableColumn<T> 中与行类型 T 无关的纯元数据子集。
 * 用途：useTableQuery / ColumnSettingsPanel 只需列 id / header / 可见性 / 排序能力。
 * 原因：TableColumn<T> 含逆变函数参数（accessor / cell），TableColumn<Video> 无法赋值给
 * TableColumn<unknown>；任意 TableColumn<T> 在结构子类型下满足 ColumnDescriptor。
 */
export interface ColumnDescriptor {
  readonly id: string
  readonly header: ReactNode
  readonly defaultVisible?: boolean
  readonly pinned?: boolean
  readonly enableSorting?: boolean
  /** ADR-150 阶段 4：列固有自动过滤标志（matrix popover 识别"有过滤"判定 / 与 filterContent 二选一） */
  readonly filterable?: boolean
  /** ADR-150 阶段 4：业务 filter key（matrix popover / filters Map lookup 与 column.id 桥接） */
  readonly filterFieldName?: string
}

// ── useTableQuery（§4.2）──────────────────────────────────────────

export interface UseTableQueryOptions {
  readonly tableId: string
  readonly router: TableRouterAdapter
  readonly defaults?: Partial<TableQueryDefaults>
  readonly urlNamespace?: string
  /** ColumnDescriptor 而非 TableColumn<unknown>（逆变隔离，§4.10-10）*/
  readonly columns: readonly ColumnDescriptor[]
}

export interface TableRouterAdapter {
  readonly getSearchParams: () => URLSearchParams
  readonly replace: (next: URLSearchParams) => void
  readonly push?: (next: URLSearchParams) => void
}

export interface TableQuerySnapshot {
  readonly pagination: { readonly page: number; readonly pageSize: number }
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
  readonly columns: ReadonlyMap<string, ColumnPreference>
  readonly selection: TableSelectionState
}

export interface TableQueryPatch {
  readonly pagination?: Partial<TableQuerySnapshot['pagination']>
  readonly sort?: TableSortState
  readonly filters?: ReadonlyMap<string, FilterValue>
  readonly columns?: ReadonlyMap<string, ColumnPreference>
  readonly selection?: TableSelectionState
}

export interface ColumnPreference {
  readonly visible: boolean
  readonly width?: number
}

export type FilterValue =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'bool'; readonly value: boolean }
  | { readonly kind: 'enum'; readonly value: readonly string[] }
  | { readonly kind: 'range'; readonly min?: number; readonly max?: number }
  | { readonly kind: 'date-range'; readonly from?: string; readonly to?: string }

export interface TableQueryDefaults {
  readonly pagination: { readonly page: number; readonly pageSize: number }
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
}
