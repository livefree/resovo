import type { ReactNode } from 'react'

export type TableSortDirection = 'asc' | 'desc'

export interface TableSortState {
  field: string
  direction: TableSortDirection
}

export interface TableCellContext<T> {
  row: T
  value: unknown
  rowIndex: number
}

/**
 * Per-column ⋮ 菜单配置。
 * canSort / canHide 控制菜单中哪些操作可见；
 * filterContent 为 domain-specific 筛选控件 slot（ReactNode）。
 */
export interface ColumnMenuConfig {
  /** 是否展示排序按钮（需同时满足 enableSorting + onSortChange 存在） */
  canSort?: boolean
  /** 是否展示"隐藏此列"按钮 */
  canHide?: boolean
  /** 列专属筛选控件（ReactNode，由调用方负责构造，含完整事件绑定） */
  filterContent?: ReactNode
  /** 是否展示筛选激活圆点指示器 */
  isFiltered?: boolean
  /** 清除当前列筛选的回调 */
  onClearFilter?: () => void
}

export interface TableColumn<T> {
  id: string
  header: ReactNode
  accessor: (row: T) => unknown
  width?: number
  minWidth?: number
  enableResizing?: boolean
  enableSorting?: boolean
  /** When true, cell uses overflow-visible so dropdown menus are not clipped */
  overflowVisible?: boolean
  cell?: (props: TableCellContext<T>) => ReactNode
  /** Per-column ⋮ 菜单配置；存在时列头右侧渲染 ⋮ 触发按钮 */
  columnMenu?: ColumnMenuConfig
}

export interface ResolvedTableColumn<T> extends TableColumn<T> {
  width: number
  minWidth: number
}
