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
  readonly density?: 'comfortable' | 'compact'
  readonly 'data-testid'?: string

  /**
   * 启用表头集成菜单：表头点击不再直接排序，而是弹出 popover；
   * popover 内含升序/降序/清除排序/过滤/隐藏列。默认 false（保持现有 sort-on-click）。
   * 与外置 ColumnSettingsPanel 暂时共存（reference.md §4.4 / arch-reviewer C-2）。
   */
  readonly enableHeaderMenu?: boolean

  /**
   * 内置 toolbar（CHG-DESIGN-02 Step 4）：framed surface 顶部 search / trailing /
   * viewsConfig 三槽位。缺省时不渲染内置 toolbar（消费方可继续用外置 Toolbar 组件）。
   */
  readonly toolbar?: ToolbarConfig
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

export interface TableColumn<T> {
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
