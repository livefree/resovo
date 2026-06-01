'use client'

/**
 * use-column-resize.ts — DataTable 列宽拖拽控制器 hook（DTR-B / SEQ-20260531-01）
 *
 * 集中持有列宽可调的全部接线，让 data-table.tsx 仅消费 3 个出口（rootRef/rootStyle/headerContext）：
 *   - `rootRef`：挂到 `[data-table]` 根；drag 期间命令式改其 `--dt-grid-template`（一处全行对齐）。
 *   - `rootStyle`：根 inline style —— `position:relative`（+ enable 时 `--dt-grid-template` CSS 变量初值）。
 *   - `gridTemplate`（memo）：当前 fixed-left + flex-last 模板字符串（CSS 变量初值 / 提交后权威值）。
 *   - `headerContext`：注入 DataTableHeaderRow 的 resize 上下文（disabled 时 undefined → legacy 表头）。
 *
 * 仅在 `enabled===true` 时计算/生效；`enabled===false` 时全 no-op（legacy 路径不引 CSS 变量 / C2）。
 */
import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { ColumnPreference, TableColumn, TableQueryPatch } from './types'
import {
  AUTOFIT_PADDING_X,
  buildAutoFitColumnMap,
  buildResizableGridTemplate,
  clampWidth,
  columnMinWidth,
  isWidthAdjustable,
  measureColumnContentWidth,
  pickFlexColumnId,
  resolveColumnWidth,
} from './column-resize'

/**
 * 列宽 resize 上下文（注入 DataTableHeaderRow）。enabled 时由本 hook 构造，
 * 缺省（undefined）即 legacy 表头（无 handle / 无截断 / 无 position:relative）。
 */
export interface HeaderRowResizeContext<T> {
  readonly flexColumnId: string | null
  /** 解析列当前固定宽（handle aria-valuenow + 键盘基准）。 */
  readonly resolveWidth: (col: TableColumn<T>) => number
  readonly onPreview: (colId: string, width: number) => void
  readonly onCommit: (colId: string, width: number) => void
  readonly onRollback: () => void
  readonly onAutoFit: (colId: string) => void
}

export interface UseColumnResizeOptions<T> {
  readonly enabled: boolean
  readonly columns: readonly TableColumn<T>[]
  readonly colMap: ReadonlyMap<string, ColumnPreference>
  readonly hasSelection: boolean
  /** 提交列宽变更：本 hook 内包装为 onQueryChange({ columns })。 */
  readonly onQueryChange: (patch: TableQueryPatch) => void
}

export interface ColumnResizeController<T> {
  readonly rootRef: React.RefObject<HTMLDivElement | null>
  readonly rootStyle: CSSProperties
  /** 当前网格模板（enabled=false 时为空串，调用方不消费）。 */
  readonly gridTemplate: string
  readonly headerContext: HeaderRowResizeContext<T> | undefined
  /**
   * 自适应全列列宽（矩阵 popover「自适应列宽」/ DTR-F）：对所有可调列按当前渲染页内容 + 表头列名
   * auto-fit 测宽后一次性提交；测不到内容的列保持原宽。
   */
  readonly autoFitAllWidths: () => void
}

export function useColumnResizeController<T>({
  enabled,
  columns,
  colMap,
  hasSelection,
  onQueryChange,
}: UseColumnResizeOptions<T>): ColumnResizeController<T> {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const flexColumnId = useMemo(
    () => (enabled ? pickFlexColumnId(columns, colMap) : null),
    [enabled, columns, colMap],
  )

  const gridTemplate = useMemo(
    () => (enabled ? buildResizableGridTemplate(columns, colMap, hasSelection, flexColumnId) : ''),
    [enabled, columns, colMap, hasSelection, flexColumnId],
  )

  const setRootTemplate = useCallback((template: string) => {
    rootRef.current?.style.setProperty('--dt-grid-template', template)
  }, [])

  const previewWidth = useCallback(
    (colId: string, width: number) => {
      setRootTemplate(
        buildResizableGridTemplate(columns, colMap, hasSelection, flexColumnId, { colId, width }),
      )
    },
    [columns, colMap, hasSelection, flexColumnId, setRootTemplate],
  )

  const rollbackPreview = useCallback(() => {
    setRootTemplate(gridTemplate)
  }, [gridTemplate, setRootTemplate])

  const commitWidth = useCallback(
    (colId: string, width: number) => {
      const col = columns.find((c) => c.id === colId)
      if (col === undefined) return
      const clamped = clampWidth(width, columnMinWidth(col), col.maxWidth)
      const next = new Map(colMap)
      next.set(colId, { visible: colMap.get(colId)?.visible ?? col.defaultVisible !== false, width: clamped })
      onQueryChange({ columns: next } satisfies TableQueryPatch)
    },
    [columns, colMap, onQueryChange],
  )

  const autoFit = useCallback(
    (colId: string) => {
      const content = measureColumnContentWidth(rootRef.current, colId)
      if (content <= 0) return // 无 DOM / 测不到内容 → 不动列宽
      commitWidth(colId, content + AUTOFIT_PADDING_X)
    },
    [commitWidth],
  )

  const resolveWidth = useCallback(
    (col: TableColumn<T>) => resolveColumnWidth(col, colMap),
    [colMap],
  )

  const autoFitAllWidths = useCallback(() => {
    // 遍历所有可调列测当前渲染页内容宽（measureColumnContentWidth 的 selector 天然命中
    // 表头列名 span，故已含「容得下列名」/ arch-reviewer F1）；测不到的列不进 measured。
    const measured = new Map<string, number>()
    for (const col of columns) {
      if (!isWidthAdjustable(col)) continue // 含 flex 列（auto-fit 全列 / F3）
      const w = measureColumnContentWidth(rootRef.current, col.id)
      if (w > 0) measured.set(col.id, w)
    }
    if (measured.size === 0) return // 全测不到（无 DOM / 空表）→ 不动列宽
    onQueryChange({ columns: buildAutoFitColumnMap(columns, colMap, measured) } satisfies TableQueryPatch)
  }, [columns, colMap, onQueryChange])

  const rootStyle = useMemo<CSSProperties>(
    () =>
      enabled
        ? ({ position: 'relative', '--dt-grid-template': gridTemplate } as CSSProperties)
        : { position: 'relative' },
    [enabled, gridTemplate],
  )

  const headerContext = useMemo<HeaderRowResizeContext<T> | undefined>(
    () =>
      enabled
        ? {
            flexColumnId,
            resolveWidth,
            onPreview: previewWidth,
            onCommit: commitWidth,
            onRollback: rollbackPreview,
            onAutoFit: autoFit,
          }
        : undefined,
    [enabled, flexColumnId, resolveWidth, previewWidth, commitWidth, rollbackPreview, autoFit],
  )

  return { rootRef, rootStyle, gridTemplate, headerContext, autoFitAllWidths }
}
