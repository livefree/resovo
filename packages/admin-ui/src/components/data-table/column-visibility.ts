/**
 * column-visibility.ts — 列可见性 patch 与查询工具（CHG-DESIGN-02 Step 7A）
 *
 * 抽出原因：HeaderMenu（单列上下文）和 HiddenColumnsMenu（全表上下文）共享
 * 同一份 colMap patch 语义，避免两处实现漂移。
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx 列可见性切换
 */
import type { ColumnDescriptor, ColumnPreference } from './types'

/**
 * 设置列可见性，返回新的 colMap（不可变更新）。
 * 保留已存在的 width；缺省 width 不写入（避免污染未设置 width 的列）。
 */
export function setColumnVisibility(
  colMap: ReadonlyMap<string, ColumnPreference>,
  colId: string,
  visible: boolean,
): ReadonlyMap<string, ColumnPreference> {
  const next = new Map(colMap)
  const prev = colMap.get(colId)
  next.set(colId, {
    visible,
    ...(prev?.width !== undefined ? { width: prev.width } : {}),
  })
  return next
}

/**
 * 判断列当前是否可见。pinned 列恒可见。
 * 与 data-table.tsx visibleColumns useMemo 中的判定保持一致。
 */
export function isColumnVisible(
  col: ColumnDescriptor,
  colMap: ReadonlyMap<string, ColumnPreference>,
): boolean {
  if (col.pinned) return true
  const pref = colMap.get(col.id)
  return pref !== undefined ? pref.visible : col.defaultVisible !== false
}

/**
 * 列出当前所有"可被隐藏"的列（pinned 列恒可见，不计入"可隐藏"集合，
 * 但作为 UI 中"已锁定"项展示是消费方决定）。
 */
export function getHidableColumns(
  columns: readonly ColumnDescriptor[],
): readonly ColumnDescriptor[] {
  return columns.filter((c) => !c.pinned)
}

/**
 * 当前隐藏列数（用于 toolbar chip "已隐藏 N 列"）。
 * 不计 pinned 列（pinned 永远可见）。
 */
export function countHiddenColumns(
  columns: readonly ColumnDescriptor[],
  colMap: ReadonlyMap<string, ColumnPreference>,
): number {
  let n = 0
  for (const col of columns) {
    if (col.pinned) continue
    if (!isColumnVisible(col, colMap)) n++
  }
  return n
}
