'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SplitPane, RejectModal } from '@resovo/admin-ui'
import type { RejectModalSubmitPayload } from '@resovo/admin-ui'
import type { VideoQueueRow, ReviewLabel } from '@resovo/types'
import { ModListRow } from './ModListRow'
import { PendingCenter } from './PendingCenter'
import { StagingTabContent } from './StagingTabContent'
import { RejectedTabContent } from './RejectedTabContent'
import { RightPane } from './RightPane'
import { FilterPresetPopover } from './FilterPresetPopover'
import { SavePresetModal } from './SavePresetModal'
import { VideoEditDrawer } from '../../videos/_client/VideoEditDrawer'
import * as api from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'
import { useFilterPresets } from '@/lib/moderation/use-filter-presets'
import type { FilterPreset, FilterPresetQuery, FilterPresetTab } from '@/lib/moderation/use-filter-presets'

// ── Types & constants ──────────────────────────────────────────────

type TabId = 'pending' | 'staging' | 'rejected'

const PAGE_HEIGHT = 'calc(100vh - var(--topbar-h) - 32px)'
const VALID_TABS: readonly TabId[] = ['pending', 'staging', 'rejected']

// ── Styles ────────────────────────────────────────────────────────

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}
const BTN_PRIMARY: React.CSSProperties = { ...BTN_SM, background: 'var(--accent-default)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-default)' }
const BTN_DANGER: React.CSSProperties = { ...BTN_SM, color: 'var(--state-error-fg)', borderColor: 'var(--state-error-border)' }
const KBD: React.CSSProperties = { display: 'inline-block', padding: '1px 5px', border: '1px solid var(--border-default)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', background: 'var(--bg-surface-raised)', color: 'var(--fg-muted)' }

function segBtnStyle(active: boolean, danger?: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'var(--bg-surface-elevated)',
    color: active ? (danger ? 'var(--state-error-fg)' : 'var(--accent-default)') : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  }
}

function badgeStyle(danger?: boolean): React.CSSProperties {
  return { padding: '0 5px', borderRadius: 999, fontSize: 10, background: danger ? 'var(--state-error-bg)' : 'var(--bg-surface-raised)', color: danger ? 'var(--state-error-fg)' : 'var(--fg-muted)' }
}

// ── 筛选 URL 同步工具（CHG-SN-4-FIX-F）─────────────────────────────────

const FILTER_KEYS = ['type', 'sourceCheckStatus', 'doubanStatus', 'hasStaffNote', 'needsManualReview'] as const

function readFiltersFromSearchParams(sp: URLSearchParams | ReturnType<typeof useSearchParams>): FilterPresetQuery {
  const get = (k: string) => sp.get(k)
  const filters: FilterPresetQuery = {}
  if (get('type')) filters.type = get('type') as string
  if (get('sourceCheckStatus')) filters.sourceCheckStatus = get('sourceCheckStatus') as string
  if (get('doubanStatus')) filters.doubanStatus = get('doubanStatus') as string
  const hasStaffNote = get('hasStaffNote')
  if (hasStaffNote === 'true') filters.hasStaffNote = true
  else if (hasStaffNote === 'false') filters.hasStaffNote = false
  const needsManualReview = get('needsManualReview')
  if (needsManualReview === 'true') filters.needsManualReview = true
  return filters
}

function hasFilterParamsInUrl(sp: URLSearchParams | ReturnType<typeof useSearchParams>): boolean {
  return FILTER_KEYS.some((k) => sp.get(k) != null && sp.get(k) !== '')
}

function writeFiltersToSearchParams(sp: URLSearchParams, filters: FilterPresetQuery): URLSearchParams {
  const next = new URLSearchParams(sp.toString())
  FILTER_KEYS.forEach((k) => next.delete(k))
  if (filters.type) next.set('type', filters.type)
  if (filters.sourceCheckStatus) next.set('sourceCheckStatus', filters.sourceCheckStatus)
  if (filters.doubanStatus) next.set('doubanStatus', filters.doubanStatus)
  if (filters.hasStaffNote != null) next.set('hasStaffNote', String(filters.hasStaffNote))
  if (filters.needsManualReview != null) next.set('needsManualReview', String(filters.needsManualReview))
  return next
}

// ── Main component ────────────────────────────────────────────────

export function ModerationConsole(): React.ReactElement {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawTab = searchParams.get('tab') ?? 'pending'
  const tab = (VALID_TABS as readonly string[]).includes(rawTab) ? (rawTab as TabId) : 'pending'

  const [pendingVideos, setPendingVideos] = useState<VideoQueueRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalPending, setTotalPending] = useState(0)
  const [todayStats, setTodayStats] = useState<{ reviewed: number; approveRate: number | null }>({ reviewed: 0, approveRate: null })
  const [activeIdxRaw, setActiveIdxRaw] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewLabels, setReviewLabels] = useState<ReviewLabel[]>([])
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [rightOpen, setRightOpen] = useState(true)
  const [editVideoId, setEditVideoId] = useState<string | null>(null)

  // CHG-SN-4-FIX-F：筛选预设
  const [currentFilters, setCurrentFilters] = useState<FilterPresetQuery>(() => readFiltersFromSearchParams(searchParams))
  const [presetPopoverOpen, setPresetPopoverOpen] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo?: () => void; key: number } | null>(null)
  const presetAnchorRef = useRef<HTMLDivElement>(null)
  const presetTab: FilterPresetTab = tab === 'pending' || tab === 'staging' || tab === 'rejected' ? tab : 'pending'
  const { applicablePresets, defaultPreset, save: savePreset, remove: removePreset, restore: restorePreset, setDefault: setPresetDefault, update: updatePreset } = useFilterPresets(presetTab)

  const tabRef = useRef<TabId>(tab)
  useEffect(() => { tabRef.current = tab }, [tab])

  const setTab = useCallback((t: TabId) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', t)
    router.replace(`?${p}`, { scroll: false })
  }, [router, searchParams])

  const setActiveIdx = useCallback((updater: number | ((prev: number) => number)) => {
    setActiveIdxRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { sessionStorage.setItem(`admin.moderation.${tabRef.current}.activeIdx.v1`, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const activeIdx = activeIdxRaw

  // restore activeIdx from sessionStorage when tab changes
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`admin.moderation.${tab}.activeIdx.v1`)
      setActiveIdxRaw(stored ? Math.max(0, parseInt(stored, 10)) : 0)
    } catch { setActiveIdxRaw(0) }
  }, [tab])

  // responsive right pane
  useEffect(() => {
    const update = () => setRightOpen(window.innerWidth >= 1280)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // load pending queue (CHG-SN-4-FIX-F：传入 currentFilters)
  useEffect(() => {
    if (tab !== 'pending') return
    setLoading(true)
    setError(null)
    api.fetchPendingQueue(currentFilters)
      .then(res => {
        setPendingVideos(res.data as VideoQueueRow[])
        setNextCursor(res.nextCursor)
        setTotalPending(res.total)
        setTodayStats(res.todayStats)
      })
      .catch(() => setError(M.errors.loadFailed))
      .finally(() => setLoading(false))
  }, [tab, currentFilters])

  // load review labels once
  useEffect(() => {
    api.fetchReviewLabels().then(setReviewLabels).catch(() => { /* silent */ })
  }, [])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    api.fetchPendingQueue({ ...currentFilters, cursor: nextCursor })
      .then(res => {
        setPendingVideos(prev => [...prev, ...(res.data as VideoQueueRow[])])
        setNextCursor(res.nextCursor)
        setTotalPending(res.total)
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoadingMore(false))
  }, [nextCursor, loadingMore, currentFilters])

  // auto-load more when near end
  useEffect(() => {
    if (pendingVideos.length > 0 && activeIdx >= pendingVideos.length - 5 && nextCursor && !loadingMore) {
      loadMore()
    }
  }, [activeIdx, pendingVideos.length, nextCursor, loadingMore, loadMore])

  const v = pendingVideos[activeIdx] ?? null

  const handleApprove = useCallback(async () => {
    const current = pendingVideos[activeIdx]
    if (!current) return
    const savedV = current
    const savedIdx = activeIdx
    const newVideos = pendingVideos.filter((_, i) => i !== savedIdx)
    setPendingVideos(newVideos)
    setTotalPending(t => Math.max(0, t - 1))
    setActiveIdx(Math.min(savedIdx, Math.max(0, newVideos.length - 1)))
    try {
      await api.approveVideo(savedV.id)
    } catch {
      setPendingVideos(prev => { const next = [...prev]; next.splice(savedIdx, 0, savedV); return next })
      setTotalPending(t => t + 1)
      setError(M.errors.approveFailed)
    }
  }, [pendingVideos, activeIdx, setActiveIdx])

  const handleRejectSubmit = useCallback(async (payload: RejectModalSubmitPayload) => {
    const current = pendingVideos[activeIdx]
    if (!current) return
    setRejectSubmitting(true)
    try {
      await api.rejectVideo(current.id, payload, current.updatedAt)
      setRejectOpen(false)
      const newVideos = pendingVideos.filter(item => item.id !== current.id)
      setPendingVideos(newVideos)
      setTotalPending(t => Math.max(0, t - 1))
      setActiveIdx(Math.min(activeIdx, Math.max(0, newVideos.length - 1)))
    } catch {
      setError(M.errors.rejectFailed)
      throw new Error(M.errors.rejectFailed)
    } finally {
      setRejectSubmitting(false)
    }
  }, [pendingVideos, activeIdx, setActiveIdx])

  const handleStaffNoteChange = useCallback((videoId: string, note: string | null) => {
    setPendingVideos(prev => prev.map(item => item.id === videoId ? { ...item, staffNote: note } : item))
  }, [])

  const handleEditVideo = useCallback((videoId: string) => {
    setEditVideoId(videoId)
  }, [])

  const handleEditDrawerSaved = useCallback(() => {
    // 编辑保存后刷新当前条目；保持 activeIdx 不变
    setEditVideoId(null)
    api.fetchPendingQueue(currentFilters)
      .then(res => {
        setPendingVideos(res.data as VideoQueueRow[])
        setNextCursor(res.nextCursor)
        setTotalPending(res.total)
      })
      .catch(() => { /* silent — 用户仍可手动刷新 */ })
  }, [currentFilters])

  // CHG-SN-4-FIX-F：URL → filters 单向同步（route 变化时）
  useEffect(() => {
    setCurrentFilters(readFiltersFromSearchParams(searchParams))
  }, [searchParams])

  // 默认预设自动应用（仅当 URL 无任何筛选参数时）
  const defaultAppliedRef = useRef(false)
  useEffect(() => {
    if (defaultAppliedRef.current) return
    if (hasFilterParamsInUrl(searchParams)) {
      defaultAppliedRef.current = true
      return
    }
    if (defaultPreset) {
      defaultAppliedRef.current = true
      const p = writeFiltersToSearchParams(new URLSearchParams(searchParams.toString()), defaultPreset.query)
      router.replace(`?${p}`, { scroll: false })
    }
  }, [defaultPreset, searchParams, router])

  const applyFiltersToUrl = useCallback((filters: FilterPresetQuery) => {
    const next = writeFiltersToSearchParams(new URLSearchParams(searchParams.toString()), filters)
    router.replace(`?${next}`, { scroll: false })
  }, [router, searchParams])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  // 预设动作 handlers
  const handleApplyPreset = useCallback((preset: FilterPreset) => {
    applyFiltersToUrl(preset.query)
    setPresetPopoverOpen(false)
    setToast({ message: M.preset.toast.applied(preset.name), key: Date.now() })
  }, [applyFiltersToUrl])

  const handleRemovePreset = useCallback((preset: FilterPreset) => {
    const removed = removePreset(preset.id)
    if (!removed) return
    setToast({
      message: M.preset.toast.deleted(preset.name),
      undo: () => { restorePreset(removed); setToast(null) },
      key: Date.now(),
    })
  }, [removePreset, restorePreset])

  const handleSetPresetDefault = useCallback((preset: FilterPreset) => {
    setPresetDefault(preset.id)
    setToast({ message: M.preset.toast.defaultSet(preset.name), key: Date.now() })
  }, [setPresetDefault])

  const handleUnsetPresetDefault = useCallback((preset: FilterPreset) => {
    updatePreset(preset.id, { isDefault: false })
    setToast({ message: M.preset.toast.defaultUnset(preset.name), key: Date.now() })
  }, [updatePreset])

  const handleSavePresetSubmit = useCallback((input: { name: string; tab: FilterPresetTab; isDefault: boolean }) => {
    const saved = savePreset({ name: input.name, tab: input.tab, isDefault: input.isDefault, query: currentFilters })
    setSavePresetOpen(false)
    setPresetPopoverOpen(false)
    setToast({ message: M.preset.toast.saved(saved.name), key: Date.now() })
  }, [savePreset, currentFilters])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (tab !== 'pending') return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.metaKey || e.ctrlKey) return
    if (e.key === 'j' || e.key === 'J') setActiveIdx(i => Math.min(i + 1, pendingVideos.length - 1))
    else if (e.key === 'k' || e.key === 'K') setActiveIdx(i => Math.max(i - 1, 0))
    else if (e.key === 'a' || e.key === 'A') void handleApprove()
    else if (e.key === 'r' || e.key === 'R') setRejectOpen(true)
    else if (e.key === 's' || e.key === 'S') setActiveIdx(i => Math.min(i + 1, pendingVideos.length - 1))
  }, [tab, pendingVideos.length, handleApprove, setActiveIdx])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const tabCounts = { pending: totalPending, staging: 0, rejected: 0 }
  const tabDefs: readonly { id: TabId; label: string; danger?: boolean }[] = [
    { id: 'pending', label: M.tabs.pending },
    { id: 'staging', label: M.tabs.staging },
    { id: 'rejected', label: M.tabs.rejected, danger: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: PAGE_HEIGHT }} data-moderation-console>

      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>{M.title}</h1>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4, fontSize: 12, color: 'var(--fg-muted)', flexWrap: 'wrap' }}>
            <span dangerouslySetInnerHTML={{ __html: M.todayStats(todayStats.reviewed, todayStats.approveRate).replace(/(\d+)/g, '<strong style="color:var(--fg-default)">$1</strong>').replace(/\d+%/g, m => `<strong style="color:var(--state-success-fg)">${m}</strong>`) }} />
            <span style={{ color: 'var(--border-default)' }}>|</span>
            <span><span style={KBD}>J</span> <span style={KBD}>K</span> 切换 · <span style={KBD}>A</span> 通过 · <span style={KBD}>R</span> 拒 · <span style={KBD}>S</span> 跳过</span>
          </div>
        </div>
        <div ref={presetAnchorRef} style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button
            style={BTN_SM}
            onClick={() => setPresetPopoverOpen(o => !o)}
            aria-expanded={presetPopoverOpen}
            aria-haspopup="dialog"
            data-filter-preset-trigger
          >
            {M.actions.filterPreset}{defaultPreset ? ' ⭐' : ''}
          </button>
          <button
            style={BTN_SM}
            onClick={() => { setSavePresetOpen(true); setPresetPopoverOpen(false) }}
            data-save-preset-trigger
          >
            {M.actions.savePreset}
          </button>

          <FilterPresetPopover
            open={presetPopoverOpen}
            anchorRef={presetAnchorRef}
            presets={applicablePresets}
            onApply={handleApplyPreset}
            onSetDefault={handleSetPresetDefault}
            onUnsetDefault={handleUnsetPresetDefault}
            onRemove={handleRemovePreset}
            onSaveCurrent={() => { setSavePresetOpen(true); setPresetPopoverOpen(false) }}
            onClose={() => setPresetPopoverOpen(false)}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, marginBottom: 8, fontSize: 12, color: 'var(--state-error-fg)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button style={{ ...BTN_SM, fontSize: 11, padding: '2px 8px' }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Segment tabs */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 10, flexShrink: 0 }}>
        {tabDefs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={segBtnStyle(tab === t.id, t.danger)} aria-pressed={tab === t.id}>
            {t.label}
            {tab === 'pending' && t.id === 'pending' && totalPending > 0 && (
              <span style={badgeStyle(false)}>{totalPending}</span>
            )}
            {tab !== 'pending' && tabCounts[t.id] > 0 && (
              <span style={badgeStyle(t.danger)}>{tabCounts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'pending' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-muted)', fontSize: 13 }}>{M.pending.loading}</div>
          ) : (
            <SplitPane
              height="100%"
              gap={12}
              role="region"
              aria-label={M.aria.consoleSplitRegion}
              data-testid="moderation-split"
              panes={[
                {
                  width: 280,
                  minWidth: 200,
                  header: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{M.totalCount(totalPending, 0)}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: 'var(--state-success-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success-fg)', display: 'inline-block' }} />
                        {M.kbdFlowLabel}
                      </span>
                    </div>
                  ),
                  noPadding: true,
                  role: 'complementary',
                  'aria-label': M.aria.consoleQueuePane,
                  children: (
                    <div role="listbox" aria-label={M.aria.consoleQueuePane}>
                      {pendingVideos.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>{M.pending.empty}</div>
                      ) : (
                        <>
                          {pendingVideos.map((it, i) => (
                            <ModListRow key={it.id} it={it} active={i === activeIdx} onClick={() => setActiveIdx(i)} />
                          ))}
                          <div style={{ padding: 14, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 11 }}>
                            {loadingMore ? M.pending.loadingMore : nextCursor ? (
                              <button style={{ ...BTN_SM, fontSize: 11 }} onClick={loadMore}>{M.pending.loadingMore}</button>
                            ) : M.pending.noMore}
                          </div>
                        </>
                      )}
                    </div>
                  ),
                },
                {
                  width: '1fr',
                  minWidth: 400,
                  header: v ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={KBD}>J</span>
                      <span style={KBD}>K</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{M.counter(activeIdx + 1, totalPending)}</span>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-surface-raised)', borderRadius: 2, minWidth: 40 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, ((activeIdx + 1) / Math.max(1, totalPending)) * 100)}%`, background: 'var(--accent-default)', borderRadius: 2 }} />
                      </div>
                      <button style={BTN_DANGER} onClick={() => setRejectOpen(true)} aria-label={M.aria.consoleRejectVideo}>✕ {M.actions.reject} <span style={KBD}>R</span></button>
                      <button style={BTN_SM} onClick={() => setActiveIdx(i => Math.min(i + 1, pendingVideos.length - 1))} aria-label={M.aria.consoleSkipVideo}>{M.actions.skip} <span style={KBD}>S</span></button>
                      <button style={BTN_PRIMARY} onClick={() => void handleApprove()} aria-label={M.aria.consoleApproveVideo}>✓ {M.actions.approve} <span style={KBD}>A</span></button>
                      <button style={BTN_SM} onClick={() => setRightOpen(o => !o)} aria-expanded={rightOpen}>{rightOpen ? '›' : '‹'} {M.actions.detail}</button>
                    </div>
                  ) : <span />,
                  role: 'main',
                  'aria-label': M.aria.consolePreviewPane,
                  children: v ? (
                    <PendingCenter v={v} onStaffNoteChange={handleStaffNoteChange} onEditVideo={handleEditVideo} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-muted)', fontSize: 13 }}>{M.pending.empty}</div>
                  ),
                },
                {
                  width: 300,
                  minWidth: 260,
                  hidden: !rightOpen,
                  role: 'complementary',
                  'aria-label': M.aria.consoleDetailPane,
                  children: v ? <RightPane v={v} /> : null,
                },
              ]}
            />
          )
        )}
        {tab === 'staging' && <StagingTabContent />}
        {tab === 'rejected' && <RejectedTabContent />}
      </div>

      {/* Reject modal */}
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        labels={reviewLabels}
        onSubmit={handleRejectSubmit}
        submitting={rejectSubmitting}
        title={M.rejectModal.title}
      />

      {/* Video edit drawer (CHG-SN-4-FIX-A · plan v1.6 §1 G1) */}
      <VideoEditDrawer
        open={editVideoId !== null}
        videoId={editVideoId}
        onClose={() => setEditVideoId(null)}
        onSaved={handleEditDrawerSaved}
      />

      {/* Save preset modal (CHG-SN-4-FIX-F · plan v1.6 §1 G7) */}
      <SavePresetModal
        open={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        onSubmit={handleSavePresetSubmit}
        currentTab={presetTab}
        currentQuery={currentFilters}
      />

      {/* Toast (preset 操作反馈 + 撤销) */}
      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '10px 14px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'var(--fg-default)',
            zIndex: 60,
          }}
          data-preset-toast
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              style={{
                padding: '2px 8px',
                border: '1px solid var(--accent-default)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--accent-default)',
                cursor: 'pointer',
                fontSize: 11,
              }}
              onClick={toast.undo}
              data-preset-toast-undo
            >
              {M.preset.toast.undo}
            </button>
          )}
        </div>
      )}

    </div>
  )
}
