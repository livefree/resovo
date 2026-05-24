/**
 * column-visibility.ts — 列可见性 patch 与查询工具（CHG-DESIGN-02 Step 7A）
 *
 * 抽出原因：HeaderMenu（单列上下文）和 HiddenColumnsMenu（全表上下文）共享
 * 同一份 colMap patch 语义，避免两处实现漂移。
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx 列可见性切换
 *
 * ADR-149 AMENDMENT 2 D-149-16 §(5)/§(6)（CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5）：
 * 新增 clearAllColumnFilters / resetColumnVisibility 两工具函数，供矩阵 popover
 * 批量按钮使用（业务 key 桥接 + 合并式 reset 不丢 width）。
 */
import type { ColumnDescriptor, ColumnPreference, FilterValue, TableColumn } from './types'

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

// ────────────────────────────────────────────────────────────────────
// ADR-149 AMENDMENT 2 D-149-16 §(5)/§(6) / EP-4.5 矩阵 popover 批量按钮工具
// ────────────────────────────────────────────────────────────────────

/**
 * 清除所有列的过滤（矩阵 popover "清除全部过滤" 按钮 / D-149-16 §(5)）。
 *
 * **BLOCKER 修订 R-AMEND-2-3** — 业务 key 桥接：
 * 不能直接 onPatch(new Map())，因为业务 filter key（如 VideoListClient 的
 * q/type/status）走消费方 URL searchParams 自管（D-149-15 桥接合约），不在
 * query.filters 内。直接清空只会清掉 column.id 命名空间过滤，业务 key 维度
 * 的 5 select 仍显示原值（M-SN-8 假装实现复刻）。
 *
 * 正确路径（与 column-matrix-menu.tsx handleFilterToggle line 318-325 对称）：
 *   1. 遍历 columns，优先调 column.columnMenu.onClearFilter（业务 key 桥接消费方自管）
 *   2. 清空 column.id 命名空间过滤（query.filters Map）
 *
 * 两条路径互不干涉：业务 key 桥接 + column.id 命名空间并存场景下均能正确清除。
 */
export function clearAllColumnFilters<T>(
  columns: readonly TableColumn<T>[],
  currentFilters: ReadonlyMap<string, FilterValue>,
  onPatch: (next: ReadonlyMap<string, FilterValue>) => void,
): void {
  // 1. 业务 key 桥接：优先调消费方提供的 onClearFilter
  for (const col of columns) {
    if (col.columnMenu?.onClearFilter) {
      col.columnMenu.onClearFilter()
    }
  }
  // 2. column.id 命名空间过滤：仅在非空时清，避免无谓 onQueryChange 触发 re-render
  if (currentFilters.size > 0) {
    onPatch(new Map())
  }
}

/**
 * 恢复默认列可见性（矩阵 popover "恢复默认列可见性" 按钮 / D-149-16 §(6)）。
 *
 * **修订 R-AMEND-2-4** — 合并式 reset 保留 width：
 * 不能直接 onPatch(new Map())，因为这会清空所有列偏好（含 width），消费方
 * 手工调整的 column width 全部丢失。
 *
 * 正确路径：每列写入 { visible: defaultVisible !== false, width: oldWidth }
 *   - visible 字段重置为 column.defaultVisible 默认值
 *   - width 字段保留消费方手工调整值（不丢 user state）
 */
export function resetColumnVisibility(
  columns: readonly ColumnDescriptor[],
  colMap: ReadonlyMap<string, ColumnPreference>,
): ReadonlyMap<string, ColumnPreference> {
  const next = new Map<string, ColumnPreference>()
  for (const col of columns) {
    const prev = colMap.get(col.id)
    next.set(col.id, {
      visible: col.defaultVisible !== false,
      ...(prev?.width !== undefined ? { width: prev.width } : {}),
    })
  }
  return next
}
