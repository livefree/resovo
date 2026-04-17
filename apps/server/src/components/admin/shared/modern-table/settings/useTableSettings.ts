/**
 * useTableSettings — 表格列运行时设置 hook
 *
 * 管理每列的 visible / sortable 开关状态，持久化到 localStorage。
 * 遵循 useAdminTableState 的 hydration-safe 模式（首帧使用 defaultState，
 * mount 后从 localStorage 读回，hydratedStorageKey 守卫写入时机）。
 *
 * 存储 key：admin:table:settings:{tableId}:v1
 * （与现有 admin:table:{route}:{tableId}:v1 命名空间对齐，但独立存储）
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableColumn } from '../types'
import type {
  ColumnRuntimeSetting,
  ColumnRuntimeSettingsMap,
  PersistedTableSettings,
} from './types'

// ── 存储 key ──────────────────────────────────────────────────────────────────

const SETTINGS_VERSION = 'v1' as const

function buildStorageKey(tableId: string): string {
  return `admin:table:settings:${tableId}:${SETTINGS_VERSION}`
}

/** 旧 useAdminTableColumns 使用的 key 前缀（用于单次数据迁移） */
function buildLegacyStorageKey(tableId: string): string {
  return `admin:table:` // 旧 key 格式为 admin:table:{route}:{tableId}:v1
}

// ── 序列化 / 反序列化 ─────────────────────────────────────────────────────────

function serialize(settings: ColumnRuntimeSettingsMap, widths: Record<string, number>): string {
  const payload: PersistedTableSettings = { version: 'v1', settings, widths }
  return JSON.stringify(payload)
}

function deserialize(raw: string): { settings: ColumnRuntimeSettingsMap; widths: Record<string, number> } | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTableSettings>
    if (parsed.version !== 'v1' || typeof parsed.settings !== 'object' || parsed.settings === null) {
      return null
    }
    return { settings: parsed.settings, widths: parsed.widths ?? {} }
  } catch {
    return null
  }
}

// ── 存储访问 ──────────────────────────────────────────────────────────────────

function resolveStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function readFromStorage(
  storage: Storage | null,
  key: string,
  defaults: ColumnRuntimeSettingsMap,
): { settings: ColumnRuntimeSettingsMap; widths: Record<string, number> } {
  if (!storage) return { settings: defaults, widths: {} }
  try {
    const raw = storage.getItem(key)
    if (!raw) return { settings: defaults, widths: {} }
    const parsed = deserialize(raw)
    if (!parsed) {
      storage.removeItem(key)
      return { settings: defaults, widths: {} }
    }
    // 合并：default 优先保留新列，storage 优先保留用户偏好
    const merged: ColumnRuntimeSettingsMap = { ...defaults }
    for (const id of Object.keys(parsed.settings)) {
      if (id in merged) {
        merged[id] = { ...merged[id], ...parsed.settings[id] }
      }
    }
    return { settings: merged, widths: parsed.widths }
  } catch {
    return { settings: defaults, widths: {} }
  }
}

/**
 * 单次迁移：尝试从旧 useAdminTableColumns 的 localStorage 中读取 visible 字段，
 * 写入新 key 后删除旧 key（仅当新 key 不存在时执行）。
 *
 * 旧 key 格式：admin:table:{route}:{tableId}:v1
 * 旧 value 格式：{ version: 'v1', state: { columns: { [id]: { visible, width } } } }
 */
function migrateFromLegacy(
  storage: Storage | null,
  tableId: string,
  newKey: string,
  defaults: ColumnRuntimeSettingsMap,
): void {
  if (!storage) return
  // 如果新 key 已存在，跳过迁移
  if (storage.getItem(newKey) !== null) return

  // 扫描所有匹配 admin:table:*:{tableId}:v1 的旧 key
  try {
    const prefix = 'admin:table:'
    const suffix = `:${tableId}:v1`
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue
      // 排除新格式 key（admin:table:settings:...)
      if (key.startsWith('admin:table:settings:')) continue

      const raw = storage.getItem(key)
      if (!raw) continue

      const parsed = JSON.parse(raw) as {
        version?: string
        state?: { columns?: Record<string, { visible?: boolean; width?: number }> }
      }
      if (parsed.version !== 'v1' || !parsed.state?.columns) continue

      // 将旧 visible / width 字段写入新格式
      const migrated: ColumnRuntimeSettingsMap = { ...defaults }
      const migratedWidths: Record<string, number> = {}
      for (const [id, col] of Object.entries(parsed.state.columns)) {
        if (id in migrated) {
          if (typeof col.visible === 'boolean') {
            migrated[id] = { ...migrated[id], visible: col.visible }
          }
          if (typeof col.width === 'number') {
            migratedWidths[id] = col.width
          }
        }
      }
      storage.setItem(newKey, serialize(migrated, migratedWidths))
      return
    }
  } catch {
    // 迁移失败不影响正常使用
  }
}

// ── hook 入参 ────────────────────────────────────────────────────────────────

export interface UseTableSettingsColumn {
  id: string
  label: string
  defaultVisible?: boolean
  defaultSortable?: boolean
  required?: boolean
}

export interface UseTableSettingsOptions {
  tableId: string
  columns: UseTableSettingsColumn[]
  storage?: Storage | null
}

// ── hook 返回值 ───────────────────────────────────────────────────────────────

export interface UseTableSettingsReturn {
  /** 有序设置列表，用于面板渲染 */
  orderedSettings: ColumnRuntimeSetting[]
  /** 按 ID 查找的 map */
  settingsMap: ColumnRuntimeSettingsMap
  /** 切换单列单个维度 */
  updateSetting: (
    id: string,
    key: keyof Pick<ColumnRuntimeSetting, 'visible' | 'sortable'>,
    value: boolean,
  ) => void
  /** 更新单列宽度并持久化到 localStorage */
  updateWidth: (id: string, width: number) => void
  /** 恢复所有列到默认状态（含列宽），清除 localStorage */
  reset: () => void
  /**
   * 将设置应用到 TableColumn 数组：
   * - visible === false 的列被过滤掉
   * - sortable === false 的列 enableSorting 强制设为 false
   * - 持久化列宽覆盖列定义中的默认 width
   * - 未找到对应 setting 的列原样通过（仍应用列宽覆盖）
   */
  applyToColumns: <T>(columns: Array<TableColumn<T>>) => Array<TableColumn<T>>
}

// ── hook 实现 ─────────────────────────────────────────────────────────────────

export function useTableSettings(options: UseTableSettingsOptions): UseTableSettingsReturn {
  const { tableId, storage: storageOverride } = options

  // 快照初始 columns，避免非 memoize 传参触发无限循环
  const columnsRef = useRef<UseTableSettingsColumn[]>(options.columns)

  const storage = useMemo(() => resolveStorage(storageOverride), [storageOverride])
  const storageKey = useMemo(() => buildStorageKey(tableId), [tableId])

  // 从 columns 计算默认 settings map
  const defaultSettings = useMemo<ColumnRuntimeSettingsMap>(() => {
    return columnsRef.current.reduce<ColumnRuntimeSettingsMap>((acc, col) => {
      acc[col.id] = {
        id: col.id,
        label: col.label,
        visible: col.defaultVisible ?? true,
        sortable: col.defaultSortable ?? true,
        required: col.required,
      }
      return acc
    }, {})
  }, [])

  // 有序 ID 列表（保持 columns 传入顺序）
  const orderedIds = useMemo(
    () => columnsRef.current.map((c) => c.id),
    [],
  )

  // 首帧使用 defaultSettings（SSR 安全）
  const [settingsMap, setSettingsMap] = useState<ColumnRuntimeSettingsMap>(defaultSettings)
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

  // Mount 后从 localStorage 读回（含旧数据迁移）
  useEffect(() => {
    migrateFromLegacy(storage, tableId, storageKey, defaultSettings)
    const hydrated = readFromStorage(storage, storageKey, defaultSettings)
    setSettingsMap(hydrated.settings)
    setWidths(hydrated.widths)
    setHydratedStorageKey(storageKey)
  }, [storage, storageKey, tableId, defaultSettings])

  // 状态变化时写回 localStorage（hydration 完成后才写）
  useEffect(() => {
    if (!storage || hydratedStorageKey !== storageKey) return
    try {
      storage.setItem(storageKey, serialize(settingsMap, widths))
    } catch {
      // ignore quota / private mode
    }
  }, [storage, storageKey, settingsMap, widths, hydratedStorageKey])

  const orderedSettings = useMemo<ColumnRuntimeSetting[]>(
    () => orderedIds.map((id) => settingsMap[id]).filter(Boolean) as ColumnRuntimeSetting[],
    [orderedIds, settingsMap],
  )

  function updateSetting(
    id: string,
    key: keyof Pick<ColumnRuntimeSetting, 'visible' | 'sortable'>,
    value: boolean,
  ) {
    const current = settingsMap[id]
    if (!current) return
    // required 列不允许隐藏
    if (key === 'visible' && current.required && !value) return
    setSettingsMap((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }))
  }

  function updateWidth(id: string, width: number) {
    setWidths((prev) => ({ ...prev, [id]: width }))
  }

  function reset() {
    setSettingsMap(defaultSettings)
    setWidths({})
    if (!storage) return
    try {
      storage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  function applyToColumns<T>(columns: Array<TableColumn<T>>): Array<TableColumn<T>> {
    return columns.reduce<Array<TableColumn<T>>>((acc, col) => {
      const setting = settingsMap[col.id]
      const storedWidth = widths[col.id]
      const withWidth = storedWidth != null ? { ...col, width: storedWidth } : col
      if (!setting) {
        acc.push(withWidth)
        return acc
      }
      if (!setting.visible) return acc
      if (!setting.sortable) {
        acc.push({ ...withWidth, enableSorting: false })
        return acc
      }
      acc.push(withWidth)
      return acc
    }, [])
  }

  return {
    orderedSettings,
    settingsMap,
    updateSetting,
    updateWidth,
    reset,
    applyToColumns,
  }
}
