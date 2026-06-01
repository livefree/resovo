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
 * 列是否**允许设置/自适应列宽**（与 flex 无关 / DTR-F）：
 *   - `kind:'action'`：**默认否**，须显式 `enableResizing:true` opt-in（避免其他消费表操作列
 *     突然可调 / 零回归）；
 *   - 其余列（data/media/computed）：`enableResizing !== false` 即允许。
 * 用途：auto-fit 全列时需**包含 flex 列**（flex 列也按内容定宽，余量归占位轨 / F3），故此谓词不排除 flex。
 */
export function isWidthAdjustable<T>(col: TableColumn<T>): boolean {
  if (columnKind(col) === 'action') return col.enableResizing === true
  return col.enableResizing !== false
}

/**
 * 列是否**渲染右缘拖拽 handle**：在 isWidthAdjustable 基础上**额外排除 flex 列**
 *   （flex 列自适应吸收余量、不给 handle）。selection 列由调用方单独排除（恒 40px）。
 */
export function isResizableColumn<T>(
  col: TableColumn<T>,
  flexColumnId: string | null,
): boolean {
  if (col.id === flexColumnId) return false
  return isWidthAdjustable(col)
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
 * 测量某列**当前渲染页**所有 cell + 表头 label 的最大**内容几何宽**（auto-fit / 双击）。
 *
 * 对每个 `[data-col-id="{colId}"]` 元素用 `Range.getBoundingClientRect` 测其**内容布局几何宽**：
 *   - 文本内容 → 测 glyph 几何宽（`nowrap` 完整文本宽），**不受 `flex:1` 填充 / `overflow:hidden` /
 *     当前列宽影响**；
 *   - 元素内容（pill/chip/复合）→ 测其 box 几何宽（content-sized 元素 = 内容宽）。
 *   - resize handle（`[data-dt-resize-handle]`）非内容，跳过。
 * server 模式下仅覆盖当前页行（文档化限制）。无 DOM / 无 Range / 无命中 → 0。
 *
 * **为何用 Range 而非 scrollWidth**（DTR-F-FIX4 统一）：`[data-dt-truncate]`（表头 label + 默认 cell）
 *   有 `flex:1` 会填满容器 → 其 `scrollWidth = 列宽`（文本不溢出时），不反映内容 → 致 pill 过宽 /
 *   表头 label 填充使 auto-fit 每次只缩一点渐进到 min / drift 等连环问题（FIX1/2/3 的 scrollWidth 路径根因）。
 *   Range 测的是内容几何（glyph / box），与元素填充宽无关，截断态下仍是完整文本宽 → 一次到位 + 幂等无漂移。
 */
export function measureColumnContentWidth(
  scrollEl: HTMLElement | null | undefined,
  colId: string,
): number {
  if (!scrollEl) return 0
  const selector = `[data-col-id="${cssEscape(colId)}"]`
  let max = 0
  scrollEl.querySelectorAll(selector).forEach((el) => {
    if (el.hasAttribute('data-dt-resize-handle')) return
    // 默认 cell / 表头 label 文本在 `[data-dt-truncate]`（flex:1 填满列宽）内：
    // 须 Range **truncate 元素本身**（其内容是文本节点 → Range 取 glyph 几何宽）；
    // 若 Range 它的 wrapper，selectNodeContents 选中的是被填满的 span **元素 box**=列宽（DTR-F-FIX5）。
    // 自定义 cell（无 truncate / pill/chip content-sized）→ Range wrapper 内容（元素 box=内容宽）。
    const target = el.matches('[data-dt-truncate]') ? el : (el.querySelector('[data-dt-truncate]') ?? el)
    const w = measureRangeWidth(target)
    if (w > max) max = w
  })
  return max
}

/** CSS.escape 兜底（jsdom / 老环境无 CSS.escape 时退化为基础转义）。 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\\]]/g, '\\$&')
}

/**
 * 测元素内容（文本节点 + 子元素）的**布局几何宽**（`Range.selectNodeContents` + getBoundingClientRect）。
 * 文本在 `nowrap` 下几何宽 = 完整文本宽（截断态下仍是完整宽），元素内容取其 box 几何；
 * **均不受元素自身 flex 填充 / overflow:hidden / 当前列宽影响**（区别于 scrollWidth）。
 * 无 Range / SSR / 异常时返回 0（jsdom 无 layout 时亦 0，单测需 mock createRange）。
 */
function measureRangeWidth(el: Element): number {
  const doc = el.ownerDocument
  if (!doc || typeof doc.createRange !== 'function') return 0
  try {
    const range = doc.createRange()
    range.selectNodeContents(el)
    const w = range.getBoundingClientRect().width
    return Number.isFinite(w) && w > 0 ? Math.ceil(w) : 0
  } catch {
    return 0
  }
}

/**
 * 构建「自适应列宽」（auto-fit 全列）的全量 colMap（DTR-F / 矩阵「自适应列宽」按钮）。
 *
 * 纯函数：DOM 测宽由调用方（控制器）完成后以 `measured`（colId → 内容宽，含表头列名）传入。
 * 规则（arch-reviewer F2/F3/F4）：
 *   - 从 `colMap` **全量克隆**起步（保留每列 visible + 不可调列/隐藏列原 width）。
 *   - 仅对 `isWidthAdjustable===true` 且 `measured>0` 的列覆盖 width = clamp(measured+padding, min, max)。
 *   - **flex 列也写宽**（F3：isWidthAdjustable 不排除 flex）：写入后该列 hasDefinedWidth=true → 下一帧
 *     pickFlexColumnId 返回 null → 余量归末尾 `minmax(0,1fr)` 占位轨；全列定宽、无单列被拉伸。
 *   - **测不到内容（measured<=0）的列保持原宽**（F4）：不进入覆盖、**禁止**用声明宽/DEFAULT 兜底
 *     （防 jsdom/空表把全列写成兜底值污染存储 + 破坏校准声明宽）。
 */
export function buildAutoFitColumnMap<T>(
  columns: readonly TableColumn<T>[],
  colMap: ColMap,
  measured: ReadonlyMap<string, number>,
): ReadonlyMap<string, ColumnPreference> {
  const next = new Map<string, ColumnPreference>(colMap)
  for (const col of columns) {
    if (!isWidthAdjustable(col)) continue
    const content = measured.get(col.id) ?? 0
    if (content <= 0) continue
    const width = clampWidth(content + AUTOFIT_PADDING_X, columnMinWidth(col), col.maxWidth)
    const prev = next.get(col.id)
    next.set(col.id, { visible: prev?.visible ?? col.defaultVisible !== false, width })
  }
  return next
}
