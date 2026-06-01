/**
 * data-table-grid.ts — DataTable 网格模板 + cell 样式原语（DTR-A 拆自 data-table.tsx）
 *
 * 当前内容：SELECTION_COL_W / legacy buildGridTemplate（**字节级不变**）/ TH_STYLE / TD_STYLE。
 * DTR-B 将在此追加 `DEFAULT_COL_MIN_W` / `pickFlexColumnId` / `buildResizableGridTemplate`
 * （fixed-left + flex-last 布局）；legacy buildGridTemplate 不得改动（arch-reviewer C2）。
 */
import type { CSSProperties } from 'react'
import type { TableColumn } from './types'

export const SELECTION_COL_W = 40

export function buildGridTemplate<T>(
  columns: readonly TableColumn<T>[],
  colMap: ReadonlyMap<string, { visible: boolean; width?: number }>,
  hasSelection: boolean,
): string {
  const tracks: string[] = []
  if (hasSelection) tracks.push(`${SELECTION_COL_W}px`)
  for (const col of columns) {
    const pref = colMap.get(col.id)
    if (pref ? !pref.visible && !col.pinned : col.defaultVisible === false && !col.pinned) continue
    const width = pref?.width ?? col.width
    tracks.push(width ? `${width}px` : `minmax(${col.minWidth ?? 80}px, 1fr)`)
  }
  return tracks.join(' ')
}

export const TH_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '0 12px',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  // CHG-UX-05d：bg 必须不透明（sticky 表头滚动时下方 row 不能穿透）；
  // 与 [data-table] 容器同色（surface-raised），视觉与 CHG-UI-05a 透明继承等效
  background: 'var(--bg-surface-raised)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'default',
  userSelect: 'none',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

export const TD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  fontSize: 'var(--font-size-sm-tight)',
  color: 'var(--fg-default)',
  borderBottom: '1px solid var(--border-subtle)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}
