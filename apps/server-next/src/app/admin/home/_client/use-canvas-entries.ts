'use client'

/**
 * use-canvas-entries.ts — 画布入口编排 hook（CHG-HOME-AUTOFILL-UI 文件拆分）
 *
 * 自 HomeOpsClient 拆出（582>500 硬限，CHG-VSR-3 / AUTOFILL-APPLY 同先例）：
 * 聚合画布视图三类入口的状态与处理器——
 *   - 空位添加（CHG-HOME-EMPTY-SLOTS / 方案 §5.2：视频位复用 batchAdd 选片面板、
 *     banner 位 BannerDrawer 创建）
 *   - banner 候选预填（CHG-HOME-AUTOFILL-UI / D-182-4.5：端点 #5 对 banner 恒 422，
 *     应用动作降级为编辑器预填；横版大图须人工提供不预填）
 *   - 添加/创建完成 → canvasReload 信号驱动画布 silent 重拉
 *
 * **CHG-HOME-DRAFT-PUBLISH-B / D-185-2.1**：确认写入按视图分流——
 *   - canvas 视图：落草稿（draftCtl.mutateConfig + addVideos/addBanner 变异），
 *     不再调资源级直写端点；
 *   - list 视图（含深链落地）：维持资源级直写（ADR-104 / banners 真·紧急通道）。
 * BannerDrawer / BatchAddVideosModal 渲染仍归 HomeOpsClient。
 */

import { useState } from 'react'
import type { PickerVideoItem } from '@resovo/admin-ui'
import type { CreateBannerInput, UpdateBannerInput } from '@/lib/banners/types'
import type { HomeModuleSlot } from '@/lib/home-modules/types'
import type { UseBatchAddResult } from '@/lib/home-modules/use-batch-add'
import { addBannerToConfig, addVideosToConfig } from '@/lib/home-curation/draft-mutations'
import type { UseHomeDraftResult } from '@/lib/home-curation/use-home-draft'
import type { AutofillCandidate, HomeSectionKey } from '@/lib/home-curation/types'
import type { BannerPrefill } from './BannerDrawer'

export interface UseCanvasEntriesOptions {
  readonly batchAdd: Pick<UseBatchAddResult, 'openBlank' | 'handleBatchAdd'>
  /** 同 UseBatchAddOptions.toast 形状（最小依赖面） */
  readonly toast: { push: (t: { title: string; description?: string; level: 'success' | 'warn' | 'danger' }) => void }
  readonly setActiveSlot: (slot: HomeModuleSlot) => void
  /** 草稿生命周期（D-185-2.1：canvas 视图写入落草稿） */
  readonly draftCtl: UseHomeDraftResult
  /** 当前视图（确认写入分流依据） */
  readonly viewMode: 'list' | 'canvas'
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

export function useCanvasEntries({ batchAdd, toast, setActiveSlot, draftCtl, viewMode }: UseCanvasEntriesOptions): UseCanvasEntriesResult {
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

  /** 选片确认（页内/画布共用）：canvas 视图落草稿（slot 内去重跳过），
   *  list 视图维持 batchAdd 资源级直写链路（D-185-2.1 分流） */
  async function handleBatchConfirm(slot: HomeModuleSlot, items: readonly PickerVideoItem[]) {
    if (viewMode === 'canvas') {
      let added = 0
      let skipped = 0
      await draftCtl.mutateConfig((config) => {
        const result = addVideosToConfig(config, slot as HomeSectionKey, items.map((v) => v.id))
        added = result.added
        skipped = result.skipped.length
        return result.config
      })
      toast.push({
        title: added > 0 ? `已将 ${added} 个视频加入草稿` : '所选视频均已在草稿中',
        ...(skipped > 0 ? { description: `${skipped} 个重复已跳过` } : {}),
        level: added > 0 ? 'success' : 'warn',
      })
    } else {
      await batchAdd.handleBatchAdd(slot, items)
    }
    setCanvasReload(n => n + 1)
  }

  /** 画布 banner 空位创建 → 草稿（sortOrder = 草稿内 max+1，D-185-2.1；
   *  本入口仅画布触达——list 视图 Banner 编辑走 BannerOpsSection 直写） */
  async function handleCanvasBannerCreate(body: CreateBannerInput | UpdateBannerInput) {
    const input = body as CreateBannerInput
    await draftCtl.mutateConfig((config) =>
      addBannerToConfig(config, {
        title: input.title,
        imageUrl: input.imageUrl,
        linkType: input.linkType,
        linkTarget: input.linkTarget,
        activeFrom: input.activeFrom ?? null,
        activeTo: input.activeTo ?? null,
        isActive: input.isActive ?? true,
        brandScope: input.brandScope ?? 'all-brands',
        brandSlug: input.brandSlug ?? null,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      }),
    )
    toast.push({ title: 'Banner 已加入草稿', level: 'success' })
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
