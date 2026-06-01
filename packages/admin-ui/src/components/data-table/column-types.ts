/**
 * column-types.ts — DataTable 列定义 + 过滤值类型簇
 *
 * 拆分来源：types.ts（DTR-A 文件体积预拆 / SEQ-20260531-01）。
 * 原因：types.ts 超 500 行预算，列定义 union（TableColumnBase / 4 KindColumn /
 *   AutoFilterColumnFields / ColumnKind）+ 其叶子依赖（ColumnDescriptor / FilterValue /
 *   ColumnMenuConfig / TableCellContext / FilterChipContext）是一个内聚簇，整体搬出。
 *
 * 依赖方向：本文件**仅**依赖 react（ReactNode），不反向 import ./types，避免循环。
 * types.ts re-export 本文件全部导出，保证既有 `from './types'` 导入零改动。
 *
 * 真源：ADR-103 §4.1 + ADR-150 AMENDMENT 2（column.kind discriminated union）。
 */
import type { ReactNode } from 'react'

// ── 列类型枚举 / 自动过滤基础（ADR-150 AMENDMENT 2）────────────────────────

/**
 * 自动过滤控件类型（ADR-150 D-150-2 / AMD2-4 强化为默认运行）。
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
 * 列类型（ADR-150 AMENDMENT 2 D-150-AMD2-2 / 方案 A enum）。
 * - 'data'（缺省 / 隐含）— 数据列 / 默认 filterable + enableSorting / 进矩阵 popover / 走 inference
 * - 'action' — 行操作列 / type 层 filter 字段全 `never` / 不进矩阵 popover / 不走 inference
 * - 'media' — 媒体列（cover / thumbnail / avatar）/ 默认 false / 可显式 true / 不进矩阵 popover
 * - 'computed' — 派生计算列 / 默认 false / 可显式 true + filterFieldName 桥接
 */
export type ColumnKind = 'data' | 'action' | 'media' | 'computed'

/**
 * 过滤值（DataTable 内部 filters Map 的 value 形态）。
 */
export type FilterValue =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'bool'; readonly value: boolean }
  | { readonly kind: 'enum'; readonly value: readonly string[] }
  | { readonly kind: 'range'; readonly min?: number; readonly max?: number }
  | { readonly kind: 'date-range'; readonly from?: string; readonly to?: string }

// ── cell / menu / chip / descriptor（列定义的叶子依赖）────────────────────

export interface TableCellContext<T> {
  readonly row: T
  readonly value: unknown
  readonly rowIndex: number
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
 * filter chip 渲染上下文（CHG-DESIGN-02 Step 7A）。
 * 设计原则：消费方拿到 column 自身可访问 header；onClear 已绑定 query 修改路径，
 * 无需消费方再走 onQueryChange。
 */
export interface FilterChipContext {
  readonly filter: FilterValue
  readonly column: ColumnDescriptor
  readonly onClear: () => void
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
  /** ADR-150 AMENDMENT 2 D-150-AMD2-2：列类型 enum marker（default 'data'） */
  readonly kind?: ColumnKind
}

// ── 列定义 union（ADR-150 AMENDMENT 2）────────────────────────────────────

interface TableColumnBase<T> {
  readonly id: string
  readonly header: ReactNode
  readonly accessor: (row: T) => unknown
  readonly width?: number
  readonly minWidth?: number
  /**
   * 列宽上限（px / DTR-B 列宽可调）。
   * 拖拽 / 键盘 / 双击 auto-fit 时 width 钳制到 [minWidth, maxWidth]；
   * 缺省时无上限（仅受 minWidth 下限约束）。
   * 仅在表级 `DataTableProps.enableColumnResizing===true` 时生效（静态门控）。
   */
  readonly maxWidth?: number
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

/**
 * 共用自动过滤字段（D-150-AMD2-3 filterFieldName 默认 fallback column.id）。
 * 在 DataKindColumn / MediaKindColumn / ComputedKindColumn 中复用。
 */
export interface AutoFilterColumnFields {
  /**
   * 是否启用列固有自动过滤。
   * - DataKindColumn 默认 `true`（D-150-AMD2-1 / 显式 false 可禁用）
   * - MediaKindColumn / ComputedKindColumn 默认 `false`（显式 true 启用）
   */
  readonly filterable?: boolean
  /**
   * 业务 filter key（D-150-4 桥接合约 / D-150-AMD2-3 默认 fallback column.id）。
   * 仅在 column.id ≠ 后端业务 key 时显式覆盖（如 `id: 'username', filterFieldName: 'q'`）。
   */
  readonly filterFieldName?: string
  /** filterKind 推断（D-150-2 / AMD2-4 默认运行 useFilterKindInference）；消费方显式优先 */
  readonly filterKind?: AutoFilterKind
  /** enum 静态选项（D-150-1 / AMD2-5 降级为覆盖路径 / 默认 rows distinct 派生） */
  readonly filterOptions?: readonly DistinctOption[]
  /** D-150-3 后端 distinct 端点（少数列需要 / 默认 rows 派生） */
  readonly filterDistinctEndpoint?: string
  /** D-150-3 后端 distinct 表名 */
  readonly filterDistinctTable?: string
}

/**
 * DataKindColumn — 数据列（默认 / kind 缺省时）。
 * D-150-AMD2-1：默认 filterable + enableSorting + 走 inference + 进矩阵 popover。
 */
export type DataKindColumn<T> = TableColumnBase<T> & {
  readonly kind?: 'data'
} & AutoFilterColumnFields

/**
 * ActionKindColumn — 行操作列（D-150-AMD2-2/8）。
 * type 层强制 filter 字段全 `never` / 不进矩阵 popover / 不走 inference。
 */
export type ActionKindColumn<T> = TableColumnBase<T> & {
  readonly kind: 'action'
  readonly filterable?: never
  readonly filterFieldName?: never
  readonly filterKind?: never
  readonly filterOptions?: never
  readonly filterDistinctEndpoint?: never
  readonly filterDistinctTable?: never
}

/**
 * MediaKindColumn — 媒体列（cover / thumbnail / avatar）。
 * 默认 filterable=false / 可显式 true（如允许 URL text filter）。
 */
export type MediaKindColumn<T> = TableColumnBase<T> & {
  readonly kind: 'media'
} & AutoFilterColumnFields

/**
 * ComputedKindColumn — 派生计算列。
 * accessor 返回派生值 / 默认 filterable=false / 可显式 true + filterFieldName 桥接业务 key。
 */
export type ComputedKindColumn<T> = TableColumnBase<T> & {
  readonly kind: 'computed'
} & AutoFilterColumnFields

/**
 * TableColumn<T> — 列定义 discriminated union by kind（ADR-150 AMENDMENT 2 D-150-AMD2-2/8）。
 *
 * 老消费方未传 kind → 自动 narrow 到 DataKindColumn / 默认 filterable + enableSorting
 * （行为变化：之前默认 false / 之后默认 true）→ 4 已迁消费方需 opt-out review actions 列
 *
 * 互斥（运行时 dev warn）：data kind + columnMenu.filterContent 同传时 D-150-6 dev warn。
 */
export type TableColumn<T> =
  | DataKindColumn<T>
  | ActionKindColumn<T>
  | MediaKindColumn<T>
  | ComputedKindColumn<T>

/**
 * FilterableColumn<T> — DataTableAutoFilter 入口接收类型（D-150-AMD2-8 重构）。
 * 仅 narrow filterable === true / filterFieldName 仍可缺省（fallback column.id 由 DataTable 处理）。
 */
export type FilterableColumn<T> = TableColumnBase<T> & {
  readonly filterable: true
  readonly filterFieldName?: string
  readonly filterKind?: AutoFilterKind
  readonly filterOptions?: readonly DistinctOption[]
  readonly filterDistinctEndpoint?: string
  readonly filterDistinctTable?: string
}

/** @deprecated AMD2 / D-150-5 NEGATED — 保留别名兼容旧 import 路径（FilterableColumn 替代） */
export type AutoFilterColumnFieldsActive = {
  readonly filterable: true
  readonly filterFieldName?: string
  readonly filterKind?: AutoFilterKind
  readonly filterOptions?: readonly DistinctOption[]
  readonly filterDistinctEndpoint?: string
  readonly filterDistinctTable?: string
}

/** @deprecated AMD2 / D-150-5 NEGATED — 保留别名（DataKindColumn 替代） */
export type AutoFilterColumnFieldsInactive = {
  readonly filterable?: false
  readonly filterFieldName?: never
  readonly filterKind?: never
  readonly filterOptions?: never
  readonly filterDistinctEndpoint?: never
  readonly filterDistinctTable?: never
}
