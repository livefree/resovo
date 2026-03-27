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
}

export interface ResolvedTableColumn<T> extends TableColumn<T> {
  width: number
  minWidth: number
}
