/**
 * use-filter-presets.ts — 审核台筛选预设管理 hook
 *
 * 历史：
 *   - 初版（CHG-SN-4-FIX-F · plan v1.6 §1 G7）：localStorage 持久化
 *   - 升级（CHG-SN-8-FUP-PRESET-TEAM-EP-B · ADR-144）：DB 持久化 + scope private/shared
 *     双源策略：mount 立即返 localStorage 作 fallback（避免闪空）；fetch 成功后切 DB；
 *     失败保持 localStorage 数据继续可用（offline / 后端故障兜底）
 *
 * 职责：
 *   - 双源加载预设（DB 主源 + localStorage fallback）
 *   - 暴露 CRUD：save / update / remove / setDefault
 *   - 暴露 applyDefaultIfApplicable：仅当 URL 无筛选参数时返回 default 预设的 query
 *   - 跨 Tab 隔离：每条预设有 tab 字段（pending/staging/rejected/all）
 *   - 暴露 importLocalToServer：批量上传 localStorage 旧数据到 DB
 *
 * 不变约束：
 *   - hook 签名向后兼容（消费方 ModerationConsole / FilterPresetPopover 不需立即改）
 *   - localStorage 失效（隐私模式 / quota）降级为内存态，无报错
 *   - 单一 Tab 最多 1 个 isDefault=true（DB 部分唯一索引 + 应用层互斥事务双保险）
 */
import { useState, useEffect, useCallback } from 'react'
import {
  listFilterPresets,
  createFilterPreset,
  updateFilterPreset as apiUpdate,
  deleteFilterPreset as apiDelete,
  type ApiFilterPreset,
  type FilterPresetScope,
} from './filter-presets-api'

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
  // CHG-SN-8-FUP-PRESET-TEAM-EP-B / ADR-144：scope + owner 元数据
  scope?: FilterPresetScope  // 缺省视为 'private'（localStorage 旧数据兼容）
  ownerUserId?: string
  ownerUsername?: string | null
}

interface PresetsStorageV1 {
  version: 'v1'
  presets: FilterPreset[]
}

const STORAGE_KEY = 'admin.moderation.presets.v1'
const STORAGE_VERSION = 'v1' as const

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

function safeClearLocal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function isTabMatch(preset: FilterPreset, tab: FilterPresetTab): boolean {
  return preset.tab === 'all' || preset.tab === tab
}

function fromApi(p: ApiFilterPreset): FilterPreset {
  return {
    id: p.id,
    name: p.name,
    tab: p.tab,
    query: p.query,
    isDefault: p.isDefault,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    scope: p.scope,
    ownerUserId: p.ownerUserId,
    ownerUsername: p.ownerUsername,
  }
}

export interface SavePresetInput {
  name: string
  tab: FilterPresetTab
  query: FilterPresetQuery
  isDefault?: boolean
  scope?: FilterPresetScope  // CHG-SN-8-FUP-PRESET-TEAM-EP-B / ADR-144；缺省 'private'
}

export interface UseFilterPresetsReturn {
  /** 全部预设（DB 主源 + localStorage fallback）*/
  readonly presets: readonly FilterPreset[]
  /** 当前 Tab 适用的预设（tab === currentTab || tab === 'all'）*/
  readonly applicablePresets: readonly FilterPreset[]
  /** 当前 Tab 的默认预设（applicablePresets 中 isDefault=true 的第一条；最多 1 条）*/
  readonly defaultPreset: FilterPreset | null
  /** 数据加载状态（首次 mount fetch 期）*/
  readonly loading: boolean
  /** 数据源：'live'=DB 已加载 / 'local'=localStorage fallback */
  readonly dataSource: 'live' | 'local'
  /** localStorage 未上传数据条数（>0 时 UI 显示 import 入口）*/
  readonly localPendingCount: number
  /** 保存新预设（调端点 + 本地乐观更新）；返回 Promise<FilterPreset> */
  readonly save: (input: SavePresetInput) => Promise<FilterPreset>
  /** 更新已有预设的部分字段（仅 owner 可改） */
  readonly update: (id: string, patch: Partial<Omit<FilterPreset, 'id' | 'createdAt' | 'ownerUserId' | 'ownerUsername'>>) => Promise<void>
  /** 删除预设；返回被删除条（撤销路径） */
  readonly remove: (id: string) => Promise<FilterPreset | null>
  /** 恢复（撤销删除）：重新调 createFilterPreset 端点 */
  readonly restore: (preset: FilterPreset) => Promise<void>
  /** 设默认（同一 tab 下其他预设的 isDefault 自动清除） */
  readonly setDefault: (id: string) => Promise<void>
  /** 批量导入 localStorage 旧数据到 DB；成功后清 localStorage */
  readonly importLocalToServer: () => Promise<{ imported: number; failed: number }>
  /** 手动刷新（消费方按需调用，例如导入后）*/
  readonly refresh: () => Promise<void>
}

export function useFilterPresets(currentTab: FilterPresetTab): UseFilterPresetsReturn {
  const [presets, setPresets] = useState<FilterPreset[]>(() => safeRead().presets)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'local'>('local')
  const [localPendingCount, setLocalPendingCount] = useState(0)

  const fetchPresets = useCallback(async () => {
    try {
      const rows = await listFilterPresets()
      setPresets(rows.map(fromApi))
      setDataSource('live')
      // 更新 localStorage pending 计数（仅 fetch 成功后才显示 import 入口）
      const local = safeRead().presets
      setLocalPendingCount(local.length)
    } catch {
      // 端点失败 → 保持 localStorage 数据继续可用（offline / 后端故障兜底）
      // dataSource 维持 'local'
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPresets()
  }, [fetchPresets])

  const save = useCallback(async (input: SavePresetInput): Promise<FilterPreset> => {
    const created = await createFilterPreset({
      name: input.name,
      scope: input.scope ?? 'private',
      tab: input.tab,
      query: input.query,
      isDefault: input.isDefault ?? false,
    })
    const next = fromApi(created)
    setPresets((prev) => {
      // 乐观更新：插入 + 互斥 default（与后端事务一致）
      let arr = [...prev, next]
      if (next.isDefault) {
        arr = arr.map((p) =>
          p.id === next.id ? p : isTabMatch(p, next.tab) && p.isDefault ? { ...p, isDefault: false } : p,
        )
      }
      return arr
    })
    return next
  }, [])

  const update = useCallback(async (id: string, patch: Partial<Omit<FilterPreset, 'id' | 'createdAt' | 'ownerUserId' | 'ownerUsername'>>) => {
    const apiPatch: Parameters<typeof apiUpdate>[1] = {
      name: patch.name,
      scope: patch.scope,
      tab: patch.tab,
      query: patch.query,
      isDefault: patch.isDefault,
    }
    const updated = await apiUpdate(id, apiPatch)
    const next = fromApi(updated)
    setPresets((prev) => {
      let arr = prev.map((p) => (p.id === id ? next : p))
      if (next.isDefault) {
        arr = arr.map((p) =>
          p.id === id ? p : isTabMatch(p, next.tab) && p.isDefault ? { ...p, isDefault: false } : p,
        )
      }
      return arr
    })
  }, [])

  const remove = useCallback(async (id: string): Promise<FilterPreset | null> => {
    const removed = presets.find((p) => p.id === id) ?? null
    if (!removed) return null
    await apiDelete(id)
    setPresets((prev) => prev.filter((p) => p.id !== id))
    return removed
  }, [presets])

  const restore = useCallback(async (preset: FilterPreset): Promise<void> => {
    await save({
      name: preset.name,
      tab: preset.tab,
      query: preset.query,
      isDefault: preset.isDefault,
      scope: preset.scope ?? 'private',
    })
  }, [save])

  const setDefault = useCallback(async (id: string) => {
    await update(id, { isDefault: true })
  }, [update])

  const importLocalToServer = useCallback(async (): Promise<{ imported: number; failed: number }> => {
    const local = safeRead().presets
    if (local.length === 0) return { imported: 0, failed: 0 }
    let imported = 0
    let failed = 0
    for (const p of local) {
      try {
        await createFilterPreset({
          name: p.name,
          scope: 'private',  // 导入默认 private（用户决定是否后续改 shared）
          tab: p.tab,
          query: p.query,
          isDefault: false,  // 导入不继承 default（避免冲突）
        })
        imported++
      } catch {
        failed++
      }
    }
    if (imported > 0) {
      safeClearLocal()
      setLocalPendingCount(0)
      await fetchPresets()
    }
    return { imported, failed }
  }, [fetchPresets])

  const applicablePresets = presets.filter((p) => isTabMatch(p, currentTab))
  const defaultPreset = applicablePresets.find((p) => p.isDefault) ?? null

  return {
    presets,
    applicablePresets,
    defaultPreset,
    loading,
    dataSource,
    localPendingCount,
    save,
    update,
    remove,
    restore,
    setDefault,
    importLocalToServer,
    refresh: fetchPresets,
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
