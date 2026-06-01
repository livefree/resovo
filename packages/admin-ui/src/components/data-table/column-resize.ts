/**
 * column-resize.ts — DataTable 列宽可调纯函数（DTR-B / SEQ-20260531-01）
 *
 * 真源：执行 plan §3「列宽核心」+ arch-reviewer 落地约束 C1/C2/C4/C5。
 *
 * 职责（全部无副作用 / 可独立单测，DTR-E 覆盖）：
 *   - 钳制：`clampWidth`（下限 minWidth / 可选上限 maxWidth）
 *   - flex 列选取：`pickFlexColumnId`（最后一个可见非 action 且未定宽列，否则 null）
 *   - handle 可调判定：`isResizableColumn`
 *   - 列宽解析：`resolveColumnWidth`（含加载期钳制，供 aria/keyboard 基准）
 *   - 网格模板：`buildResizableGridTemplate`（fixed-left + flex-last + 加载期钳制 + 占位轨）
 *   - 内容测宽：`measureColumnContentWidth`（双击 auto-fit / 仅当前渲染页）
 *
 * **不改 legacy**（arch-reviewer C2）：legacy `buildGridTemplate` 留在 `./data-table-grid` 字节级不变；
 * 本文件仅在 `enableColumnResizing===true` 路径被引用，legacy 路径不引入任何 CSS 变量。
 */
import type { ColumnPreference } from './types'
import type { TableColumn } from './column-types'
import { SELECTION_COL_W } from './data-table-grid'

/** 未声明 width / minWidth 时的列宽默认值（px）。 */
export const DEFAULT_COL_W = 160
/** 未声明 minWidth 时的列宽下限默认值（px）。 */
export const DEFAULT_COL_MIN_W = 80
/** 双击 auto-fit 内容宽外加的水平 padding（= cell `padding: 0 12px` 两侧之和）。 */
export const AUTOFIT_PADDING_X = 24

type ColMap = ReadonlyMap<string, ColumnPreference>

/** 列种类（缺省 'data'）。 */
function columnKind<T>(col: TableColumn<T>): string {
  return col.kind ?? 'data'
}

/**
 * 列是否当前可见（与 data-table.tsx visibleColumns + data-table-grid buildGridTemplate 判定一致）。
 * pinned 恒可见；否则取 colMap.visible，缺省回退 `defaultVisible !== false`。
 */
function isVisible<T>(col: TableColumn<T>, colMap: ColMap): boolean {
  if (col.pinned) return true
  const pref = colMap.get(col.id)
  return pref !== undefined ? pref.visible : col.defaultVisible !== false
}

/** 列是否已定宽（pref.width 或静态 col.width 任一存在）。 */
function hasDefinedWidth<T>(col: TableColumn<T>, colMap: ColMap): boolean {
  return (colMap.get(col.id)?.width ?? col.width) !== undefined
}

/**
 * 列宽钳制到 [min, max]。
 * - 下限 min（至少 1px，防 0/负）；上限 max 仅在有限正数时生效（缺省无上限）。
 * - 返回整数 px（亚像素拖拽不污染存储）。
 */
export function clampWidth(w: number, min: number, max?: number): number {
  const lo = Math.max(min, 1)
  let v = Math.max(lo, w)
  if (max !== undefined && Number.isFinite(max)) v = Math.min(v, Math.max(max, lo))
  return Math.round(v)
}

/** 列宽下限（col.minWidth ?? 默认）。 */
export function columnMinWidth<T>(col: TableColumn<T>): number {
  return col.minWidth ?? DEFAULT_COL_MIN_W
}

/**
 * flex 列选取（arch-reviewer C5）：
 *   = 最后一个可见的**非 action** 列，且该列**未定宽**；
 *   否则（最后一个可见非 action 列已定宽 / 不存在非 action 列）→ `null`。
 *
 * 返回 null 时，`buildResizableGridTemplate` 在末尾追加 `minmax(0,1fr)` 占位轨吸收余量
 * （所有真实列固定 px，剩余空间不拉伸任何列）。
 */
export function pickFlexColumnId<T>(
  columns: readonly TableColumn<T>[],
  colMap: ColMap,
): string | null {
  let lastNonAction: TableColumn<T> | null = null
  for (const col of columns) {
    if (!isVisible(col, colMap)) continue
    if (columnKind(col) === 'action') continue
    lastNonAction = col
  }
  if (lastNonAction === null) return null
  if (hasDefinedWidth(lastNonAction, colMap)) return null
  return lastNonAction.id
}

/**
 * 列是否可调列宽（渲染右缘 handle）：
 *   `enableResizing !== false` && 非 action 列 && 非 flex 列（flex 列自适应不可拖）。
 * selection 列由调用方单独排除（恒 40px，不经此判定）。
 */
export function isResizableColumn<T>(
  col: TableColumn<T>,
  flexColumnId: string | null,
): boolean {
  if (col.id === flexColumnId) return false
  if (columnKind(col) === 'action') return false
  return col.enableResizing !== false
}

/**
 * 解析列当前固定宽（px / 已钳制），供 handle aria-valuenow + 键盘步进基准。
 * 解析链：pref.width ?? col.width ?? col.minWidth ?? DEFAULT_COL_W，再钳到 [min, max]。
 */
export function resolveColumnWidth<T>(col: TableColumn<T>, colMap: ColMap): number {
  const min = columnMinWidth(col)
  const raw = colMap.get(col.id)?.width ?? col.width ?? col.minWidth ?? DEFAULT_COL_W
  return clampWidth(raw, min, col.maxWidth)
}

/**
 * 构建 fixed-left + flex-last 网格模板（`enableColumnResizing===true` 专用）。
 *
 * - selection 列：`{SELECTION_COL_W}px`（恒 40px）。
 * - flex 列（`col.id === flexColumnId`）：`minmax(min,1fr)` 吸收余量。
 * - 其余可见列：固定 px = clampWidth(pref.width ?? col.width ?? col.minWidth ?? DEFAULT_COL_W, min, max)。
 *   **加载期钳制**：stored width 按当前 min/max 钳制，防跨版本 / 跨配置漂移。
 * - flexColumnId === null：末尾追加 `minmax(0,1fr)` 占位轨（C5）。
 *
 * @param override 拖拽预览：将指定列的固定宽临时替换为给定 width（不触发 setState / 仅改 CSS 变量）。
 */
export function buildResizableGridTemplate<T>(
  columns: readonly TableColumn<T>[],
  colMap: ColMap,
  hasSelection: boolean,
  flexColumnId: string | null,
  override?: { readonly colId: string; readonly width: number },
): string {
  const tracks: string[] = []
  if (hasSelection) tracks.push(`${SELECTION_COL_W}px`)
  for (const col of columns) {
    if (!isVisible(col, colMap)) continue
    const min = columnMinWidth(col)
    if (col.id === flexColumnId) {
      tracks.push(`minmax(${min}px, 1fr)`)
      continue
    }
    const raw = override !== undefined && override.colId === col.id
      ? override.width
      : (colMap.get(col.id)?.width ?? col.width ?? col.minWidth ?? DEFAULT_COL_W)
    tracks.push(`${clampWidth(raw, min, col.maxWidth)}px`)
  }
  if (flexColumnId === null) tracks.push('minmax(0, 1fr)')
  return tracks.join(' ')
}

/**
 * 测量某列**当前渲染页**所有可见 body cell 的最大内容宽度（双击 auto-fit）。
 *
 * 扫描 `[data-table-scroll]` 内带 `[data-col-id="{colId}"]` 的 cell；优先取其内部
 * `[data-dt-truncate]` 子项的 `scrollWidth`（截断态下仍反映完整内容宽），缺省回退 cell 自身。
 * server 模式下仅覆盖当前页行（文档化限制）。无 DOM / 无命中时返回 0。
 */
export function measureColumnContentWidth(
  scrollEl: HTMLElement | null | undefined,
  colId: string,
): number {
  if (!scrollEl) return 0
  const selector = `[data-col-id="${cssEscape(colId)}"]`
  let max = 0
  scrollEl.querySelectorAll(selector).forEach((cell) => {
    const inner = cell.querySelector('[data-dt-truncate]') ?? cell
    const w = (inner as HTMLElement).scrollWidth
    if (w > max) max = w
  })
  return max
}

/** CSS.escape 兜底（jsdom / 老环境无 CSS.escape 时退化为基础转义）。 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\\]]/g, '\\$&')
}
