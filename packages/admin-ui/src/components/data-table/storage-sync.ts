'use client'

/**
 * storage-sync.ts — snapshot ↔ sessionStorage 互转（纯函数，零副作用）
 * 真源：ADR-103 §4.2.2 sessionStorage 同步规约（CHG-SN-2-13）
 *
 * 存储 key：`admin-ui:table:{tableId}:v1`
 * 持久化字段：pagination.pageSize + columns（visible + width）
 * 不持久化：page / sort / filters（走 URL）/ selection（瞬态）
 * 容错：JSON.parse 失败 / schema 不匹配 → console.warn + 静默清除 + 返回 undefined
 */
import type { TableQuerySnapshot, ColumnPreference } from './types'

const STORAGE_VERSION = 'v1'

function storageKey(tableId: string): string {
  return `admin-ui:table:${tableId}:${STORAGE_VERSION}`
}

export interface StoredPrefs {
  readonly pageSize: number
  readonly columns: Readonly<Record<string, { visible: boolean; width?: number }>>
}

function isStoredPrefs(val: unknown): val is StoredPrefs {
  if (typeof val !== 'object' || val === null) return false
  const v = val as Record<string, unknown>
  if (typeof v['pageSize'] !== 'number') return false
  if (typeof v['columns'] !== 'object' || v['columns'] === null) return false
  const cols = v['columns'] as Record<string, unknown>
  for (const entry of Object.values(cols)) {
    if (typeof entry !== 'object' || entry === null) return false
    if (typeof (entry as Record<string, unknown>)['visible'] !== 'boolean') return false
  }
  return true
}

export function readFromStorage(tableId: string): StoredPrefs | undefined {
  if (typeof window === 'undefined') return undefined
  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(storageKey(tableId))
  } catch (err) {
    console.warn(`[storage-sync] sessionStorage read error for "${tableId}":`, err)
    return undefined
  }
  if (raw === null) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`[storage-sync] JSON.parse failed for "${tableId}", clearing`)
    try { window.sessionStorage.removeItem(storageKey(tableId)) } catch { /* ignore */ }
    return undefined
  }
  if (!isStoredPrefs(parsed)) {
    console.warn(`[storage-sync] schema mismatch for "${tableId}", clearing`)
    try { window.sessionStorage.removeItem(storageKey(tableId)) } catch { /* ignore */ }
    return undefined
  }
  return parsed
}

export function writeToStorage(tableId: string, snapshot: TableQuerySnapshot): void {
  if (typeof window === 'undefined') return
  const prefs: StoredPrefs = {
    pageSize: snapshot.pagination.pageSize,
    columns: Object.fromEntries(
      Array.from(snapshot.columns.entries()).map(([id, pref]) => [
        id,
        { visible: pref.visible, ...(pref.width !== undefined ? { width: pref.width } : {}) },
      ]),
    ),
  }
  try {
    window.sessionStorage.setItem(storageKey(tableId), JSON.stringify(prefs))
  } catch (err) {
    console.warn(`[storage-sync] sessionStorage write error for "${tableId}":`, err)
  }
}

export function storedPrefsToColumnMap(
  prefs: StoredPrefs,
): ReadonlyMap<string, ColumnPreference> {
  return new Map(
    Object.entries(prefs.columns).map(([id, p]) => [
      id,
      { visible: p.visible, ...(p.width !== undefined ? { width: p.width } : {}) },
    ]),
  )
}
