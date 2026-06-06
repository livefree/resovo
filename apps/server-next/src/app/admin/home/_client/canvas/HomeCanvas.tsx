'use client'

/**
 * HomeCanvas.tsx — 前台同构画布容器（CHG-HOME-CANVAS-A/-B / 方案 §3）
 *
 * 消费 GET /admin/home/preview（ADR-182 #1，正式配置预览无草稿叠加），
 * 按 7 区块前台渲染序展示。-B 接入：环境栏（brand/locale/at/device →
 * preview 重拉）+ 右侧 Inspector（区块 settings 编辑，保存后重拉）。
 *
 * CHG-HOME-CARD-DND-B：DndContext 编排——同区块 pinned 拖拽 → 端点 #6
 * reorder（画布唯一排序路径，audit home_section.reorder）；跨区块（方案 §5.3）
 * 视频卡在视频型区块间落位 → 确认弹层 → PATCH slot + 端点 #6 重排目标区块。
 * 边界：banner 卡不可拖出 / banner+type_shortcuts 不接受视频卡落位。
 * 候选池展示归 Phase 3。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { AdminButton, EmptyState, ErrorState, LoadingState, useToast } from '@resovo/admin-ui'
import { getHomePreview, reorderHomeSection } from '@/lib/home-curation/api'
import { updateHomeModule } from '@/lib/home-modules/api'
import type { AutofillCandidate, HomePreview, HomePreviewQuery, HomeSectionKey } from '@/lib/home-curation/types'
import { CanvasSection, draggableCardId } from './CanvasSection'
import { CanvasEnvBar } from './CanvasEnvBar'
import { SectionInspector } from './SectionInspector'
import { CrossSectionConfirmModal, type CrossSectionMove } from './CrossSectionConfirmModal'
import { SECTION_TITLE, VIDEO_SECTIONS } from './section-meta'

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const SPLIT_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: 12,
  alignItems: 'start',
}

const CANVAS_COL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

// ── 拖拽落点解析（导出供单测）────────────────────────────────────

/** refId → 所在区块；非可拖卡（auto/fallback/empty）不命中 */
export function findCardSection(preview: HomePreview, refId: string) {
  for (const section of preview.sections) {
    const card = section.cards.find((c) => draggableCardId(c) === refId)
    if (card) return { key: section.key, card }
  }
  return null
}

/** over.id → 目标区块 key（卡 refId 或 `section:<key>` 容器） */
export function resolveOverSection(preview: HomePreview, overId: string): HomeSectionKey | null {
  if (overId.startsWith('section:')) {
    const key = overId.slice('section:'.length) as HomeSectionKey
    return preview.sections.some((s) => s.key === key) ? key : null
  }
  return findCardSection(preview, overId)?.key ?? null
}

/** 区块内可拖卡（pinned）有序 id 列表 */
function sortableIdsOf(preview: HomePreview, key: HomeSectionKey): string[] {
  const section = preview.sections.find((s) => s.key === key)
  return (section?.cards ?? []).flatMap((c) => {
    const id = draggableCardId(c)
    return id ? [id] : []
  })
}

export interface HomeCanvasProps {
  /** 区块选中回调（外部联动可选；Inspector 已内置） */
  readonly onSelectSection?: (key: HomeSectionKey) => void
  /** empty 占位点击上抛（CHG-HOME-EMPTY-SLOTS：添加链路由 HomeOpsClient 编排——
   *  视频位复用 BatchAddVideosModal、banner 位走 BannerDrawer 创建） */
  readonly onEmptySlot?: (key: HomeSectionKey) => void
  /** 外部添加完成信号：值变化 → silent 重拉 preview（不闪骨架） */
  readonly reloadToken?: number
  /** banner 候选预填上抛（CHG-HOME-AUTOFILL-UI：HomeOpsClient 打开 BannerDrawer 创建模式） */
  readonly onBannerPrefill?: (candidate: AutofillCandidate) => void
}

export function HomeCanvas({ onSelectSection, onEmptySlot, reloadToken, onBannerPrefill }: HomeCanvasProps) {
  const toast = useToast()
  const [preview, setPreview] = useState<HomePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<HomeSectionKey | null>(null)
  // CHG-HOME-CARD-DND-B：跨区块落位确认（方案 §5.3）
  const [pendingMove, setPendingMove] = useState<CrossSectionMove | null>(null)
  const [moving, setMoving] = useState(false)
  // CHG-HOME-CANVAS-B：环境参数（环境栏「应用」驱动；ref 保证刷新/保存重拉用最新值）
  const queryRef = useRef<HomePreviewQuery>({})

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      setPreview(await getHomePreview(queryRef.current))
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 外部添加完成 → silent 重拉（初始 mount 由上方 effect 承担，跳过）
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    void load({ silent: true })
  }, [reloadToken, load])

  // ── 拖拽编排（CHG-HOME-CARD-DND-B）──────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || !preview) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const from = findCardSection(preview, activeId)
    if (!from) return
    const toKey = resolveOverSection(preview, overId)
    if (!toKey) return

    if (toKey === from.key) {
      // 同区块重排：pinned 前缀 arrayMove → 端点 #6（拖到自身或区块容器 = 无位移）
      if (activeId === overId || overId.startsWith('section:')) return
      const ids = sortableIdsOf(preview, from.key)
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const next = arrayMove(ids, oldIndex, newIndex)
      try {
        await reorderHomeSection(from.key, next.map((id, i) => ({ id, ordering: i })))
        toast.push({ title: '排序已保存', level: 'success' })
      } catch (err: unknown) {
        toast.push({
          title: '排序保存失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
      void load({ silent: true })
      return
    }

    // 跨区块（方案 §5.3 拖拽边界）
    if (from.key === 'banner') {
      // home_banners 行不可变为 home_modules 行（D-181-1 真源分离）
      toast.push({ title: 'Banner 不可移出 Hero 区块', description: '横幅由 home_banners 独立管理', level: 'warn' })
      return
    }
    if (!from.card.videoId) {
      toast.push({ title: '仅视频卡可跨区块移动', level: 'warn' })
      return
    }
    if (!VIDEO_SECTIONS.has(toKey)) {
      toast.push({ title: `${SECTION_TITLE[toKey]} 不接受视频卡落位`, level: 'warn' })
      return
    }

    // 目标区块 pinned 全序：落点卡位置插入（容器落点 = 末尾）
    const targetIds = sortableIdsOf(preview, toKey)
    const overIndex = overId.startsWith('section:') ? targetIds.length : targetIds.indexOf(overId)
    const insertAt = overIndex < 0 ? targetIds.length : overIndex
    const nextIds = [...targetIds]
    nextIds.splice(insertAt, 0, activeId)
    setPendingMove({
      refId: activeId,
      title: from.card.title,
      from: from.key,
      to: toKey,
      items: nextIds.map((id, i) => ({ id, ordering: i })),
    })
  }

  /**
   * 确认跨区块：PATCH slot（资源级，audit home_module.update）→ 端点 #6 重排目标区块。
   * 两步非原子（Codex review 修复）：第二步 reorder 失败时 slot 迁移**已持久化**——
   * 必须差异化提示「已移动但排序未应用」，不得报「移动失败」误导（行已在目标区块，
   * 仅落点不精确；不做 slot 补偿回滚——违背已确认的移动意图且回滚自身可能再失败）。
   */
  async function confirmCrossMove() {
    if (!pendingMove) return
    const move = pendingMove
    setMoving(true)
    let slotMoved = false
    try {
      await updateHomeModule(move.refId, { slot: move.to })
      slotMoved = true
      await reorderHomeSection(move.to, [...move.items])
      toast.push({ title: `已移至 ${SECTION_TITLE[move.to]}`, level: 'success' })
    } catch (err: unknown) {
      if (slotMoved) {
        // 部分持久化态：移动成功、排序未应用——重拉后画布反映真实位置，可再拖调整
        toast.push({
          title: `已移至 ${SECTION_TITLE[move.to]}，但落位排序未应用`,
          description: '卡片可能不在拖放位置，可在画布内重新拖拽调整',
          level: 'warn',
        })
      } else {
        // 第一步失败：零持久化，如实报失败
        toast.push({
          title: '移动失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
    } finally {
      // 统一关弹层（重拉后 items 失效，不可重试提交 stale 序）
      setPendingMove(null)
      setMoving(false)
      void load({ silent: true })
    }
  }

  const selectedSection = preview?.sections.find((s) => s.key === selected) ?? null

  return (
    <div style={WRAP_STYLE} data-testid="home-canvas-wrap">
      {/* 环境栏：四参数 → preview 重拉（方案 §3） */}
      <CanvasEnvBar
        onApply={(query) => {
          queryRef.current = query
          void load()
        }}
      />

      {loading ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState error={error} title="画布加载失败" onRetry={() => void load()} />
      ) : !preview ? (
        <EmptyState title="暂无预览数据" />
      ) : (
        <div style={SPLIT_STYLE}>
          <div style={CANVAS_COL_STYLE} data-testid="home-canvas">
            <div style={TOOLBAR_STYLE}>
              <span data-testid="canvas-generated-at">
                生成于 {new Date(preview.generatedAt).toLocaleString()} · 正式配置实时预览（无草稿态）
              </span>
              <AdminButton
                variant="default"
                size="sm"
                onClick={() => void load()}
                data-testid="canvas-refresh-btn"
              >
                刷新
              </AdminButton>
            </div>

            <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
              {preview.sections.map((section) => (
                <CanvasSection
                  key={section.key}
                  section={section}
                  selected={selected === section.key}
                  onSelect={(key) => {
                    setSelected(key)
                    onSelectSection?.(key)
                  }}
                  onEmptySlot={onEmptySlot}
                />
              ))}
            </DndContext>
          </div>

          {/* 右侧 Inspector：settings 编辑（保存成功 → 重拉 preview 反映新槽位/模式）
              + 候选池（应用成功 → silent 重拉反映新 pinned；CHG-HOME-AUTOFILL-UI） */}
          <SectionInspector
            section={selectedSection}
            onSaved={() => void load()}
            onCandidateApplied={() => void load({ silent: true })}
            onBannerPrefill={onBannerPrefill}
          />
        </div>
      )}

      {/* 跨区块落位确认（方案 §5.3） */}
      <CrossSectionConfirmModal
        move={pendingMove}
        busy={moving}
        onConfirm={() => void confirmCrossMove()}
        onCancel={() => setPendingMove(null)}
      />
    </div>
  )
}
