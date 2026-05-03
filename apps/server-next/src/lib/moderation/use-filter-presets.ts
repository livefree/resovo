/**
 * use-filter-presets.ts — 审核台筛选预设管理 hook（CHG-SN-4-FIX-F · plan v1.6 §1 G7）
 *
 * 职责：
 *   - localStorage 持久化预设列表（key: `admin.moderation.presets.v1`）
 *   - 暴露 CRUD：save / update / remove / setDefault
 *   - 暴露 applyDefaultIfApplicable：仅当 URL 无筛选参数时返回 default 预设的 query
 *   - 跨 Tab 隔离：每条预设有 tab 字段（pending/staging/rejected/all）
 *
 * 不变约束：
 *   - localStorage 失效（隐私模式 / quota）降级为内存态，无报错
 *   - 不跨设备同步（plan v1.6 §1 G7 决策）
 *   - 单一 Tab 最多 1 个 isDefault=true（其他设默认时自动清除已有）
 */
import { useState, useEffect, useCallback } from 'react'

export type FilterPresetTab = 'pending' | 'staging' | 'rejected' | 'all'

export interface FilterPresetQuery {
  type?: string
  sourceCheckStatus?: string
  doubanStatus?: string
  hasStaffNote?: boolean
  needsManualReview?: boolean
}

export interface FilterPreset {
  id: string
  name: string
  tab: FilterPresetTab
  query: FilterPresetQuery
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface PresetsStorageV1 {
  version: 'v1'
  presets: FilterPreset[]
}

const STORAGE_KEY = 'admin.moderation.presets.v1'
const STORAGE_VERSION = 'v1' as const

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // 简单兜底（jsdom 环境某些 polyfill 缺失）
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function safeRead(): PresetsStorageV1 {
  if (typeof window === 'undefined') return { version: STORAGE_VERSION, presets: [] }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: STORAGE_VERSION, presets: [] }
    const parsed = JSON.parse(raw) as PresetsStorageV1
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.presets)) {
      return { version: STORAGE_VERSION, presets: [] }
    }
    return parsed
  } catch {
    return { version: STORAGE_VERSION, presets: [] }
  }
}

function safeWrite(data: PresetsStorageV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota / privacy 模式 — 内存态保留，不报错
  }
}

function isTabMatch(preset: FilterPreset, tab: FilterPresetTab): boolean {
  return preset.tab === 'all' || preset.tab === tab
}

export interface SavePresetInput {
  name: string
  tab: FilterPresetTab
  query: FilterPresetQuery
  isDefault?: boolean
}

export interface UseFilterPresetsReturn {
  /** 全部预设（未按 tab 过滤；消费方按需 filter）*/
  readonly presets: readonly FilterPreset[]
  /** 当前 Tab 适用的预设（tab === currentTab || tab === 'all'）*/
  readonly applicablePresets: readonly FilterPreset[]
  /** 当前 Tab 的默认预设（applicablePresets 中 isDefault=true 的第一条；最多 1 条）*/
  readonly defaultPreset: FilterPreset | null
  /** 保存新预设；返回新 preset */
  readonly save: (input: SavePresetInput) => FilterPreset
  /** 更新已有预设的部分字段 */
  readonly update: (id: string, patch: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => void
  /** 删除预设；返回被删除条（用于撤销） */
  readonly remove: (id: string) => FilterPreset | null
  /** 恢复（撤销删除）*/
  readonly restore: (preset: FilterPreset) => void
  /** 设默认（同一 tab 下其他预设的 isDefault 自动清除） */
  readonly setDefault: (id: string) => void
}

export function useFilterPresets(currentTab: FilterPresetTab): UseFilterPresetsReturn {
  const [presets, setPresets] = useState<FilterPreset[]>([])

  useEffect(() => {
    setPresets(safeRead().presets)
  }, [])

  const persist = useCallback((next: FilterPreset[]) => {
    setPresets(next)
    safeWrite({ version: STORAGE_VERSION, presets: next })
  }, [])

  const save = useCallback((input: SavePresetInput): FilterPreset => {
    const now = new Date().toISOString()
    const newPreset: FilterPreset = {
      id: makeId(),
      name: input.name,
      tab: input.tab,
      query: input.query,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    }
    setPresets((prev) => {
      let next = [...prev, newPreset]
      // 如新预设 isDefault=true，清除同 tab 其他默认
      if (newPreset.isDefault) {
        next = next.map((p) =>
          p.id === newPreset.id ? p
            : (isTabMatch(p, newPreset.tab as FilterPresetTab) || newPreset.tab === 'all') && p.isDefault
              ? { ...p, isDefault: false, updatedAt: now }
              : p,
        )
      }
      safeWrite({ version: STORAGE_VERSION, presets: next })
      return next
    })
    return newPreset
  }, [])

  const update = useCallback((id: string, patch: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => {
    setPresets((prev) => {
      const target = prev.find((p) => p.id === id)
      if (!target) return prev
      const now = new Date().toISOString()
      const willBecomeDefault = patch.isDefault === true && !target.isDefault
      let next = prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p))
      // 设默认时清除同 tab 其他默认
      if (willBecomeDefault) {
        const targetTab = (patch.tab ?? target.tab) as FilterPresetTab
        next = next.map((p) =>
          p.id === id ? p
            : (isTabMatch(p, targetTab) || targetTab === 'all') && p.isDefault
              ? { ...p, isDefault: false, updatedAt: now }
              : p,
        )
      }
      safeWrite({ version: STORAGE_VERSION, presets: next })
      return next
    })
  }, [])

  const remove = useCallback((id: string): FilterPreset | null => {
    // 同步读取当前 state 以稳定返回值（StrictMode setState updater 会双调 → 不能在 updater 内赋值给外层）
    const removed = presets.find((p) => p.id === id) ?? null
    if (removed) {
      setPresets((prev) => {
        const next = prev.filter((p) => p.id !== id)
        safeWrite({ version: STORAGE_VERSION, presets: next })
        return next
      })
    }
    return removed
  }, [presets])

  const restore = useCallback((preset: FilterPreset) => {
    setPresets((prev) => {
      // 防重复 id（极小概率：同一 session 内已恢复过一次）
      if (prev.some((p) => p.id === preset.id)) return prev
      const next = [...prev, preset]
      safeWrite({ version: STORAGE_VERSION, presets: next })
      return next
    })
  }, [])

  const setDefault = useCallback((id: string) => {
    update(id, { isDefault: true })
  }, [update])

  const applicablePresets = presets.filter((p) => isTabMatch(p, currentTab))
  const defaultPreset = applicablePresets.find((p) => p.isDefault) ?? null

  return {
    presets,
    applicablePresets,
    defaultPreset,
    save,
    update,
    remove,
    restore,
    setDefault,
  }
}

/** 把 query snapshot 渲染成简述字符串（Popover 显示用）*/
export function summarizeQuery(query: FilterPresetQuery): string {
  const parts: string[] = []
  if (query.type) parts.push(query.type)
  if (query.sourceCheckStatus) parts.push(`source:${query.sourceCheckStatus}`)
  if (query.doubanStatus) parts.push(`豆瓣:${query.doubanStatus}`)
  if (query.hasStaffNote === true) parts.push('有备注')
  if (query.needsManualReview === true) parts.push('需人工')
  return parts.length > 0 ? parts.join(' · ') : '无筛选'
}
