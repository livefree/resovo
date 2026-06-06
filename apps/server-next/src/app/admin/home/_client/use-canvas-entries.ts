'use client'

/**
 * use-canvas-entries.ts — 画布入口编排 hook（CHG-HOME-AUTOFILL-UI 文件拆分）
 *
 * 自 HomeOpsClient 拆出（582>500 硬限，CHG-VSR-3 / AUTOFILL-APPLY 同先例）：
 * 聚合画布视图三类入口的状态与处理器——
 *   - 空位添加（CHG-HOME-EMPTY-SLOTS / 方案 §5.2：视频位复用 batchAdd 全链路、
 *     banner 位 BannerDrawer 创建）
 *   - banner 候选预填（CHG-HOME-AUTOFILL-UI / D-182-4.5：端点 #5 对 banner 恒 422，
 *     应用动作降级为编辑器预填；横版大图须人工提供不预填）
 *   - 添加/创建完成 → canvasReload 信号驱动画布 silent 重拉
 * 行为零变更，BannerDrawer / BatchAddVideosModal 渲染仍归 HomeOpsClient。
 */

import { useState } from 'react'
import type { PickerVideoItem } from '@resovo/admin-ui'
import { listBanners, createBanner } from '@/lib/banners/api'
import type { CreateBannerInput, UpdateBannerInput } from '@/lib/banners/types'
import type { HomeModuleSlot } from '@/lib/home-modules/types'
import type { UseBatchAddResult } from '@/lib/home-modules/use-batch-add'
import type { AutofillCandidate, HomeSectionKey } from '@/lib/home-curation/types'
import type { BannerPrefill } from './BannerDrawer'

export interface UseCanvasEntriesOptions {
  readonly batchAdd: Pick<UseBatchAddResult, 'openBlank' | 'handleBatchAdd'>
  /** 同 UseBatchAddOptions.toast 形状（最小依赖面） */
  readonly toast: { push: (t: { title: string; description?: string; level: 'success' | 'warn' | 'danger' }) => void }
  readonly setActiveSlot: (slot: HomeModuleSlot) => void
}

export interface UseCanvasEntriesResult {
  /** 添加完成信号：值变化 → HomeCanvas silent 重拉 */
  readonly canvasReload: number
  readonly bannerDrawerOpen: boolean
  readonly bannerPrefill: BannerPrefill | null
  readonly handleCanvasEmptySlot: (key: HomeSectionKey) => void
  readonly handleBatchConfirm: (slot: HomeModuleSlot, items: readonly PickerVideoItem[]) => Promise<void>
  readonly handleCanvasBannerCreate: (body: CreateBannerInput | UpdateBannerInput) => Promise<void>
  readonly handleBannerPrefill: (candidate: AutofillCandidate) => void
  readonly closeBannerDrawer: () => void
}

export function useCanvasEntries({ batchAdd, toast, setActiveSlot }: UseCanvasEntriesOptions): UseCanvasEntriesResult {
  const [canvasReload, setCanvasReload] = useState(0)
  const [bannerDrawerOpen, setBannerDrawerOpen] = useState(false)
  const [bannerPrefill, setBannerPrefill] = useState<BannerPrefill | null>(null)

  /** 视频空位 → 切目标 slot + 打开选片面板（复用 batchAdd 全链路）；banner 空位 → BannerDrawer 创建 */
  function handleCanvasEmptySlot(key: HomeSectionKey) {
    if (key === 'banner') {
      setBannerDrawerOpen(true)
      return
    }
    // 画布仅对视频型区块上抛（CanvasSection 文案守卫）；视频 section key ⊂ HomeModuleSlot
    setActiveSlot(key as HomeModuleSlot)
    batchAdd.openBlank()
  }

  /** 选片确认（页内/画布共用）：batchAdd 服务端兜底链路 + 画布重拉信号 */
  async function handleBatchConfirm(slot: HomeModuleSlot, items: readonly PickerVideoItem[]) {
    await batchAdd.handleBatchAdd(slot, items)
    setCanvasReload(n => n + 1)
  }

  /** 画布 banner 空位创建（sortOrder 服务端真源 max+1——画布无 banners 列表缓存） */
  async function handleCanvasBannerCreate(body: CreateBannerInput | UpdateBannerInput) {
    const result = await listBanners({ limit: 1, sortField: 'sortOrder', sortDir: 'desc' })
    const maxSort = result.data[0]?.sortOrder ?? -1
    await createBanner({ ...(body as CreateBannerInput), sortOrder: maxSort + 1 })
    toast.push({ title: 'Banner 已创建', level: 'success' })
    setCanvasReload(n => n + 1)
  }

  /** banner 候选「预填」→ BannerDrawer 创建模式（prefill 仅创建模式生效，关闭即清） */
  function handleBannerPrefill(candidate: AutofillCandidate) {
    setBannerPrefill({
      titleZh: candidate.videoSummary.title,
      linkType: 'video',
      linkTarget: candidate.videoId,
    })
    setBannerDrawerOpen(true)
  }

  function closeBannerDrawer() {
    setBannerDrawerOpen(false)
    setBannerPrefill(null)
  }

  return {
    canvasReload,
    bannerDrawerOpen,
    bannerPrefill,
    handleCanvasEmptySlot,
    handleBatchConfirm,
    handleCanvasBannerCreate,
    handleBannerPrefill,
    closeBannerDrawer,
  }
}
