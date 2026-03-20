export type SortField =
  | 'name'
  | 'key'
  | 'apiUrl'
  | 'sourceType'
  | 'format'
  | 'weight'
  | 'isAdult'
  | 'disabled'
  | 'fromConfig'

export type SortDir = 'asc' | 'desc'

export type FilterState = {
  keyOrName: string
  apiUrl: string
  sourceType: 'all' | 'vod' | 'shortdrama'
  format: 'all' | 'json' | 'xml'
  isAdult: 'all' | 'yes' | 'no'
  disabled: 'all' | 'enabled' | 'disabled'
  fromConfig: 'all' | 'config' | 'manual'
  weightMin: string
  weightMax: string
}

export type ColumnId =
  | 'name'
  | 'apiUrl'
  | 'sourceType'
  | 'format'
  | 'weight'
  | 'isAdult'
  | 'fromConfig'
  | 'disabled'
  | 'lastCrawl'
  | 'crawlOps'
  | 'manageOps'

export type ColumnVisibility = Record<ColumnId, boolean>
export type ColumnWidthState = Record<ColumnId, number>

export const STORAGE_KEY = 'crawler-site-manager:v2'

export const DEFAULT_FILTERS: FilterState = {
  keyOrName: '',
  apiUrl: '',
  sourceType: 'all',
  format: 'all',
  isAdult: 'all',
  disabled: 'all',
  fromConfig: 'all',
  weightMin: '',
  weightMax: '',
}

export const DEFAULT_COLUMNS: ColumnVisibility = {
  name: true,
  apiUrl: true,
  sourceType: true,
  format: true,
  weight: true,
  isAdult: true,
  fromConfig: true,
  disabled: true,
  lastCrawl: true,
  crawlOps: true,
  manageOps: true,
}

export const COLUMN_META: Array<{ id: ColumnId; label: string }> = [
  { id: 'name', label: '名称/Key' },
  { id: 'apiUrl', label: 'API 地址' },
  { id: 'sourceType', label: '类型' },
  { id: 'format', label: '格式' },
  { id: 'weight', label: '权重' },
  { id: 'isAdult', label: '成人' },
  { id: 'fromConfig', label: '来源' },
  { id: 'disabled', label: '状态' },
  { id: 'lastCrawl', label: '最近采集' },
  { id: 'crawlOps', label: '采集操作' },
  { id: 'manageOps', label: '管理操作' },
]

export const REQUIRED_COLUMNS: ColumnId[] = ['name', 'manageOps']

export const DEFAULT_COLUMN_WIDTH: ColumnWidthState = {
  name: 220,
  apiUrl: 260,
  sourceType: 88,
  format: 88,
  weight: 88,
  isAdult: 88,
  fromConfig: 92,
  disabled: 106,
  lastCrawl: 180,
  crawlOps: 130,
  manageOps: 180,
}

export function readPersistedState() {
  const defaults = {
    sortBy: 'weight' as SortField,
    sortDir: 'desc' as SortDir,
    filters: DEFAULT_FILTERS,
    columns: DEFAULT_COLUMNS,
    columnWidths: DEFAULT_COLUMN_WIDTH,
  }
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as {
      sortBy?: SortField
      sortDir?: SortDir
      filters?: Partial<FilterState>
      columns?: Partial<ColumnVisibility>
      columnWidths?: Partial<ColumnWidthState>
    }
    return {
      sortBy: parsed.sortBy ?? defaults.sortBy,
      sortDir: parsed.sortDir ?? defaults.sortDir,
      filters: { ...defaults.filters, ...(parsed.filters ?? {}) },
      columns: { ...defaults.columns, ...(parsed.columns ?? {}) },
      columnWidths: { ...defaults.columnWidths, ...(parsed.columnWidths ?? {}) },
    }
  } catch {
    return defaults
  }
}
