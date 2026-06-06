'use client'

/**
 * use-batch-add.ts — 批量添加视频编排域 hook（CHG-HOME-UX-07-FIX）
 *
 * 自 HomeOpsClient 抽离（兑现 CHG-HOME-OPS-SPLIT 500 行红线拆分预警），并修复
 * Codex stop-time review 缺陷：
 *   ① 重复创建 — getExistingIds 真源是懒加载的 modulesBySlot，目标 slot 未访问时
 *      返回空集 → 已在列视频不标灰且确认后重复创建
 *   ② ordering 冲突 — baseOrdering 按本地缓存 max+1，未加载时从 0 起撞服务端已有序号
 *
 * 修复双层：
 *   - UI 层：确认面板打开时预加载全部未加载 video slots（标灰即时正确）
 *   - 数据层：handleBatchAdd 确认时**服务端真源兜底**——先 listHomeModules(slot) 取
 *     最新列表 → 重过滤去重（跳过数进 toast）+ baseOrdering 按服务端 max+1
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { PickerVideoItem } from '@resovo/admin-ui'
import { listHomeModules, createHomeModule, fetchTrendingCandidates } from './api'
import { VIDEO_SLOTS, type HomeModule, type HomeModuleSlot } from './types'

type ModulesBySlot = Partial<Record<HomeModuleSlot, readonly HomeModule[]>>

export interface UseBatchAddOptions {
  readonly modulesBySlot: ModulesBySlot
  readonly setModulesBySlot: Dispatch<SetStateAction<ModulesBySlot>>
  readonly loadSlot: (slot: HomeModuleSlot) => Promise<void>
  readonly toast: { push: (t: { title: string; description?: string; level: 'success' | 'warn' | 'danger' }) => void }
}

export interface UseBatchAddResult {
  /** null=关闭；[]=页内空白；[...]=趋势导入/深链预填 */
  readonly batchAddInitial: readonly PickerVideoItem[] | null
  readonly openBlank: () => void
  readonly close: () => void
  readonly handleTrendingImport: () => Promise<void>
  /** 去重标灰显示用（已加载缓存；数据安全由 handleBatchAdd 服务端兜底保证） */
  readonly getExistingIds: (slot: HomeModuleSlot) => ReadonlySet<string>
  readonly handleBatchAdd: (slot: HomeModuleSlot, items: readonly PickerVideoItem[]) => Promise<void>
}

function videoIdsOf(modules: readonly HomeModule[]): Set<string> {
  const ids = new Set<string>()
  for (const m of modules) {
    if (m.contentRefType === 'video') ids.add(m.contentRefId)
  }
  return ids
}

export function useBatchAdd({ modulesBySlot, setModulesBySlot, loadSlot, toast }: UseBatchAddOptions): UseBatchAddResult {
  const [batchAddInitial, setBatchAddInitial] = useState<readonly PickerVideoItem[] | null>(null)

  // FIX ②（UI 层）：面板打开时预加载未加载的 video slots，slot 切换标灰即时正确
  const panelOpen = batchAddInitial !== null
  useEffect(() => {
    if (!panelOpen) return
    for (const slot of VIDEO_SLOTS) {
      if (modulesBySlot[slot] === undefined) void loadSlot(slot)
    }
    // 仅开启沿触发（modulesBySlot 进依赖会因预加载回填重复触发）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, loadSlot])

  const getExistingIds = useCallback((slot: HomeModuleSlot): ReadonlySet<string> => {
    return videoIdsOf(modulesBySlot[slot] ?? [])
  }, [modulesBySlot])

  const handleTrendingImport = useCallback(async () => {
    try {
      const candidates = await fetchTrendingCandidates()
      setBatchAddInitial(candidates)
    } catch (err: unknown) {
      toast.push({
        title: '趋势候选获取失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    }
  }, [toast])

  const handleBatchAdd = useCallback(async (slot: HomeModuleSlot, items: readonly PickerVideoItem[]) => {
    // FIX ①②（数据层）：服务端真源兜底——目标 slot 取最新列表，
    // 覆盖「未加载」与「缓存陈旧（他端并发改动）」两种情况
    let existing: readonly HomeModule[]
    try {
      const result = await listHomeModules({ slot, limit: 100 })
      existing = result.data
    } catch (err: unknown) {
      toast.push({
        title: '目标运营位列表获取失败，未执行添加',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
      return
    }

    const existingIds = videoIdsOf(existing)
    const pending = items.filter((item) => !existingIds.has(item.id))
    const skipped = items.length - pending.length
    const baseOrdering = existing.reduce((max, m) => Math.max(max, m.ordering), -1) + 1

    let failed = 0
    const createdModules: HomeModule[] = []
    for (const [i, item] of pending.entries()) {
      try {
        const module = await createHomeModule({
          slot,
          brandScope: 'all-brands',
          contentRefType: 'video',
          contentRefId: item.id,
          ordering: baseOrdering + i,
        })
        createdModules.push(module)
      } catch {
        failed += 1
      }
    }

    // 列表缓存以「服务端 fresh + 本批创建」整体回写（取代逐条追加，杜绝陈旧基线）
    setModulesBySlot(prev => ({ ...prev, [slot]: [...existing, ...createdModules] }))
    setBatchAddInitial(null)

    const parts = [`已添加 ${createdModules.length} 个`]
    if (skipped > 0) parts.push(`已在列跳过 ${skipped} 个`)
    if (failed > 0) parts.push(`失败 ${failed} 个`)
    toast.push({
      title: parts.join(' · '),
      level: failed > 0 ? 'warn' : 'success',
    })
  }, [setModulesBySlot, toast])

  return {
    batchAddInitial,
    openBlank: useCallback(() => setBatchAddInitial([]), []),
    close: useCallback(() => setBatchAddInitial(null), []),
    handleTrendingImport,
    getExistingIds,
    handleBatchAdd,
  }
}
