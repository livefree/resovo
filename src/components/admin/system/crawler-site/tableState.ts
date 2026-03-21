export type SortField =
  | 'name'
  | 'key'
  | 'typeFormat'
  | 'weight'
  | 'isAdult'
  | 'enabled'
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
  | 'key'
  | 'typeFormat'
  | 'weight'
  | 'isAdult'
  | 'fromConfig'
  | 'enabled'
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
  key: true,
  typeFormat: true,
  weight: true,
  isAdult: false,
  fromConfig: false,
  enabled: true,
  lastCrawl: true,
  crawlOps: true,
  manageOps: true,
}

export const COLUMN_META: Array<{ id: ColumnId; label: string }> = [
  { id: 'name', label: '名称' },
  { id: 'key', label: 'Key' },
  { id: 'typeFormat', label: '类型 · 格式' },
  { id: 'weight', label: '权重' },
  { id: 'isAdult', label: '成人' },
  { id: 'fromConfig', label: '来源' },
  { id: 'enabled', label: '启用状态' },
  { id: 'lastCrawl', label: '最近采集' },
  { id: 'crawlOps', label: '采集操作' },
  { id: 'manageOps', label: '操作' },
]

export const REQUIRED_COLUMNS: ColumnId[] = []

export const DEFAULT_COLUMN_WIDTH: ColumnWidthState = {
  name: 180,
  key: 220,
  typeFormat: 140,
  weight: 110,
  isAdult: 80,
  fromConfig: 100,
  enabled: 110,
  lastCrawl: 120,
  crawlOps: 130,
  manageOps: 120,
}

export function readPersistedState() {
  const defaults = {
    sortBy: 'name' as SortField,
    sortDir: 'asc' as SortDir,
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
