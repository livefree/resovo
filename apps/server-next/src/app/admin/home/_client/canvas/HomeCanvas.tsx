'use client'

/**
 * HomeCanvas.tsx — 前台同构画布容器（CHG-HOME-CANVAS-A/-B / 方案 §3）
 *
 * 消费 GET /admin/home/preview（ADR-182 #1），按 7 区块前台渲染序展示。
 * -B 接入：环境栏（brand/locale/at/device → preview 重拉）+ 右侧 Inspector。
 *
 * **CHG-HOME-DRAFT-PUBLISH-B / ADR-185 D-185-2.1：画布全部配置变更落草稿**——
 * 拖拽排序/跨区块移动/settings/候选应用经 draftCtl.mutateConfig 写
 * home_config_drafts（首次编辑惰性建稿），不再调用门面 #3/#5/#6 与资源级
 * 直写端点（端点保留为非画布旁路——列表视图/API 直接消费）。草稿存在时
 * preview 走 draft=true 叠加消费；「发布/丢弃草稿」工具栏解锁。
 * 跨区块移动在草稿内单次变换原子完成（替代发布态两步 PATCH+reorder 非原子链）。
 * 边界：banner 卡不可拖出 / banner+type_shortcuts 不接受视频卡落位。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { AdminButton, EmptyState, ErrorState, LoadingState, Pill, useToast } from '@resovo/admin-ui'
import { getHomePreview } from '@/lib/home-curation/api'
import {
  applyCandidatesToConfig,
  moveModuleInConfig,
  reorderSectionInConfig,
  updateSettingsInConfig,
} from '@/lib/home-curation/draft-mutations'
import type { UseHomeDraftResult } from '@/lib/home-curation/use-home-draft'
import type {
  AutofillCandidate,
  HomeConfigSectionSettingsEntry,
  HomePreview,
  HomePreviewQuery,
  HomeSectionKey,
} from '@/lib/home-curation/types'
import { CanvasSection, draggableCardId } from './CanvasSection'
import { CanvasEnvBar } from './CanvasEnvBar'
import { SectionInspector } from './SectionInspector'
import { CrossSectionConfirmModal, type CrossSectionMove } from './CrossSectionConfirmModal'
import { PublishConfirmModal } from './PublishConfirmModal'
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
  /** 草稿生命周期（CHG-HOME-DRAFT-PUBLISH-B：HomeOpsClient 持有，画布全部写路径经此落草稿） */
  readonly draftCtl: UseHomeDraftResult
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

export function HomeCanvas({ draftCtl, onSelectSection, onEmptySlot, reloadToken, onBannerPrefill }: HomeCanvasProps) {
  const toast = useToast()
  const [preview, setPreview] = useState<HomePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<HomeSectionKey | null>(null)
  // CHG-HOME-CARD-DND-B：跨区块落位确认（方案 §5.3）
  const [pendingMove, setPendingMove] = useState<CrossSectionMove | null>(null)
  const [moving, setMoving] = useState(false)
  // CHG-HOME-DRAFT-PUBLISH-B：发布确认弹层
  const [publishOpen, setPublishOpen] = useState(false)
  // CHG-HOME-CANVAS-B：环境参数（环境栏「应用」驱动；ref 保证刷新/保存重拉用最新值）
  const queryRef = useRef<HomePreviewQuery>({})

  // 草稿存在 → preview 草稿叠加消费（draftActive 翻转时 load 身份变化驱动自动重拉）
  const draftActive = draftCtl.draft !== null

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      setPreview(await getHomePreview({ ...queryRef.current, draft: draftActive }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [draftActive])

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
      // 同区块重排：pinned 前缀 arrayMove → 草稿（D-185-2.1，不再调端点 #6）
      if (activeId === overId || overId.startsWith('section:')) return
      const ids = sortableIdsOf(preview, from.key)
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const next = arrayMove(ids, oldIndex, newIndex)
      try {
        await draftCtl.mutateConfig((config) => reorderSectionInConfig(config, from.key, next))
        toast.push({ title: '排序已存入草稿', level: 'success' })
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
   * 确认跨区块：草稿内单次变换原子完成 slot 迁移 + 目标区块重排
   * （D-185-2.1——替代发布态两步 PATCH+reorder 非原子链，原 Codex review
   * 「部分持久化态」差异化提示随之消解）。
   */
  async function confirmCrossMove() {
    if (!pendingMove) return
    const move = pendingMove
    setMoving(true)
    try {
      await draftCtl.mutateConfig((config) =>
        moveModuleInConfig(config, move.refId, move.to, move.items.map((i) => i.id)),
      )
      toast.push({ title: `已移至 ${SECTION_TITLE[move.to]}（草稿）`, level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '移动失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      // 统一关弹层（重拉后 items 失效，不可重试提交 stale 序）
      setPendingMove(null)
      setMoving(false)
      void load({ silent: true })
    }
  }

  const selectedSection = preview?.sections.find((s) => s.key === selected) ?? null

  // ── 草稿写路径（D-185-2.1：settings / 候选应用 / 发布 / 丢弃）───────────

  /** Inspector settings 保存 → 草稿 settings 行替换（不再调端点 #3） */
  async function handleSaveSettings(
    key: HomeSectionKey,
    patch: Partial<Omit<HomeConfigSectionSettingsEntry, 'section' | 'id'>>,
  ) {
    await draftCtl.mutateConfig((config) => updateSettingsInConfig(config, key, patch))
  }

  /** 候选应用 → 草稿 pinned（不再调端点 #5；重校验挪 publish 时点，D-185-2.1） */
  async function handleApplyCandidates(
    section: HomeSectionKey,
    candidates: readonly AutofillCandidate[],
  ): Promise<{ applied: number; skipped: number }> {
    let applied = 0
    let skipped = 0
    await draftCtl.mutateConfig((config) => {
      const result = applyCandidatesToConfig(config, section, candidates)
      applied = result.added
      skipped = result.skipped.length
      return result.config
    })
    return { applied, skipped }
  }

  async function handlePublishConfirm(note?: string) {
    try {
      const { versionNo } = await draftCtl.publish(note)
      setPublishOpen(false)
      toast.push({ title: `已发布为版本 v${versionNo}`, level: 'success' })
    } catch (err: unknown) {
      // 409 = 草稿陈旧/重校验失败/并发竞态（服务端 message 自带处置指引）
      setPublishOpen(false)
      toast.push({
        title: '发布被拒绝',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
      void draftCtl.reload() // 双信号刷新（提示条反映最新陈旧态）
    }
  }

  async function handleDiscard() {
    try {
      await draftCtl.discard()
      toast.push({ title: '草稿已丢弃', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '丢弃失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    }
  }

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
                生成于 {new Date(preview.generatedAt).toLocaleString()}
                {draftActive ? ' · 草稿预览（编辑不影响前台，发布后生效）' : ' · 正式配置实时预览（编辑即建稿）'}
              </span>
              {draftActive && (
                <Pill variant="accent" testId="canvas-draft-chip">
                  {`草稿 · 基于 v${draftCtl.draft?.baseVersionNo ?? '—'}`}
                </Pill>
              )}
              <AdminButton
                variant="default"
                size="sm"
                onClick={() => void load()}
                data-testid="canvas-refresh-btn"
              >
                刷新
              </AdminButton>
              {draftActive && (
                <>
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    disabled={draftCtl.busy}
                    onClick={() => void handleDiscard()}
                    data-testid="canvas-discard-draft-btn"
                  >
                    丢弃草稿
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    disabled={draftCtl.busy}
                    onClick={() => setPublishOpen(true)}
                    data-testid="canvas-publish-btn"
                  >
                    发布
                  </AdminButton>
                </>
              )}
            </div>

            {/* 草稿陈旧显著提示（D-185-2.2 双信号：直写通道写入 / 新版本发布） */}
            {draftActive && draftCtl.staleness?.stale && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--state-warning-border, var(--border-subtle))',
                  background: 'var(--state-warning-bg)',
                  fontSize: 'var(--font-size-2xs)',
                  color: 'var(--fg-default)',
                }}
                data-testid="canvas-draft-stale"
              >
                草稿基线已过时——正式配置在草稿保存后被
                {draftCtl.staleness.tablesNewer ? '直写通道修改' : ''}
                {draftCtl.staleness.baseMismatch ? `（已发布至 v${draftCtl.staleness.latestVersionNo ?? '—'}）` : ''}
                ；发布将被拒绝，请丢弃草稿后基于最新配置重建。
              </div>
            )}

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

          {/* 右侧 Inspector：settings 编辑 + 候选应用——写路径经草稿
              （D-185-2.1；保存/应用成功 → 重拉 preview 反映草稿态） */}
          <SectionInspector
            section={selectedSection}
            onSaveSettings={handleSaveSettings}
            onSaved={() => void load()}
            onApplyCandidates={handleApplyCandidates}
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

      {/* 发布确认（D-185-3.2 + ERRATA 横图三类警告标记） */}
      <PublishConfirmModal
        config={publishOpen ? draftCtl.draft?.config ?? null : null}
        baseVersionNo={draftCtl.draft?.baseVersionNo ?? null}
        staleness={draftCtl.staleness}
        busy={draftCtl.busy}
        onConfirm={(note) => void handlePublishConfirm(note)}
        onCancel={() => setPublishOpen(false)}
      />
    </div>
  )
}
