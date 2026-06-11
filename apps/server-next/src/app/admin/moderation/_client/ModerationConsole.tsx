'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader, RejectModal } from '@resovo/admin-ui'
import type { RejectModalSubmitPayload } from '@resovo/admin-ui'
import type { ReviewLabel } from '@resovo/types'
import { RejectedTabContent } from './RejectedTabContent'
import { RunInfoBanner } from './RunInfoBanner'
import { FilterPresetPopover } from './FilterPresetPopover'
import { SavePresetModal } from './SavePresetModal'
import { VideoEditDrawer } from '../../videos/_client/VideoEditDrawer'
import { usePendingQueue } from './usePendingQueue'
import { BatchActionsBar } from './BatchActionsBar'
import { PendingPaneController } from './PendingPaneController'
import * as api from '@/lib/moderation/api'
import { buildMergeHref } from '@/lib/merge/entry'
import { M } from '@/i18n/messages/zh-CN/moderation'
import { useFilterPresets } from '@/lib/moderation/use-filter-presets'
import type { FilterPreset, FilterPresetQuery, FilterPresetTab } from '@/lib/moderation/use-filter-presets'
import { ENRICHMENT_STATUSES } from '@resovo/types'

// ── Types & constants ──────────────────────────────────────────────

type TabId = 'pending' | 'rejected'

const PAGE_HEIGHT = 'calc(100vh - var(--topbar-h) - 32px)'
const VALID_TABS: readonly TabId[] = ['pending', 'rejected']

// ── Styles ────────────────────────────────────────────────────────

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}
const BTN_PRIMARY: React.CSSProperties = { ...BTN_SM, background: 'var(--accent-default)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-default)' }
const BTN_DANGER: React.CSSProperties = { ...BTN_SM, color: 'var(--state-error-fg)', borderColor: 'var(--state-error-border)' }
// MODUX-P2-1：键盘提示收敛——常驻 J/K/A/R/S 串收为「键盘流」紧凑标记，完整提示经 title hover 透出
//   （虚线下划线表 affordance；P2-3 将升级为可呼出 help 浮层的入口）。
const KBD_HINT_STYLE: React.CSSProperties = { color: 'var(--fg-muted)', cursor: 'help', borderBottom: '1px dashed var(--border-default)' }

function segBtnStyle(active: boolean, danger?: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'var(--bg-surface-row)',
    color: active ? (danger ? 'var(--state-error-fg)' : 'var(--accent-default)') : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-xs)',
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  }
}

function badgeStyle(danger?: boolean): React.CSSProperties {
  return { padding: '0 5px', borderRadius: 999, fontSize: 'var(--font-size-2xs)', background: danger ? 'var(--state-error-bg)' : 'var(--bg-surface-raised)', color: danger ? 'var(--state-error-fg)' : 'var(--fg-muted)' }
}

// ── 筛选 URL 同步工具（CHG-SN-4-FIX-F）─────────────────────────────────

// MODUX-P3-2：year/decade/enrichmentStatus 三维并入 URL 同步集（消费 P3-1-B 后端过滤）
const FILTER_KEYS = ['type', 'sourceCheckStatus', 'doubanStatus', 'hasStaffNote', 'needsManualReview', 'year', 'decade', 'enrichmentStatus'] as const

/** 解析正整数（年/年代）；非法返回 undefined */
function parseIntParam(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

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
  // MODUX-P3-2：year/decade 校验为正整数；enrichmentStatus 校验为枚举成员（防垃圾 URL 值打到 API 422）
  const year = parseIntParam(get('year'))
  if (year != null) filters.year = year
  const decade = parseIntParam(get('decade'))
  if (decade != null) filters.decade = decade
  const enrichmentStatus = get('enrichmentStatus')
  if (enrichmentStatus && (ENRICHMENT_STATUSES as readonly string[]).includes(enrichmentStatus)) {
    filters.enrichmentStatus = enrichmentStatus
  }
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
  if (filters.year != null) next.set('year', String(filters.year))
  if (filters.decade != null) next.set('decade', String(filters.decade))
  if (filters.enrichmentStatus) next.set('enrichmentStatus', filters.enrichmentStatus)
  return next
}

// ── Main component ────────────────────────────────────────────────

export function ModerationConsole(): React.ReactElement {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawTab = searchParams.get('tab') ?? 'pending'
  // staging tab 已迁移至独立路由 /admin/staging（REDO-04-C）
  useEffect(() => {
    if (rawTab === 'staging') router.replace('/admin/staging')
  }, [rawTab, router])
  const tab = (VALID_TABS as readonly string[]).includes(rawTab) ? (rawTab as TabId) : 'pending'

  const [reviewLabels, setReviewLabels] = useState<ReviewLabel[]>([])
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [editVideoId, setEditVideoId] = useState<string | null>(null)
  // rightOpen state 已下沉至 PendingPaneController（CHG-349 / SPLIT-C）

  // CHG-SN-4-FIX-F：筛选预设
  const [currentFilters, setCurrentFilters] = useState<FilterPresetQuery>(() => readFiltersFromSearchParams(searchParams))
  const [presetPopoverOpen, setPresetPopoverOpen] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo?: () => void; key: number } | null>(null)
  const presetAnchorRef = useRef<HTMLDivElement>(null)
  const presetTab: FilterPresetTab = tab === 'pending' || tab === 'rejected' ? tab : 'pending'
  const {
    applicablePresets, defaultPreset,
    save: savePreset, remove: removePreset, restore: restorePreset,
    setDefault: setPresetDefault, update: updatePreset,
    // CHG-SN-8-FUP-PRESET-TEAM-EP-B / ADR-144：双源 + import
    dataSource: presetDataSource, localPendingCount: presetLocalPendingCount,
    importLocalToServer: importLocalPresets,
  } = useFilterPresets(presetTab)

  const setTab = useCallback((t: TabId) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', t)
    router.replace(`?${p}`, { scroll: false })
  }, [router, searchParams])

  // CHG-SN-8-03：W1 金票 ② 软深链 — 读 run_id query 显示 banner，清除时移除该 param
  const runIdParam = searchParams.get('run_id')
  const dismissRunBanner = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('run_id')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  // responsive right pane 已下沉至 PendingPaneController（CHG-349 / SPLIT-C）

  // load review labels once
  useEffect(() => {
    api.fetchReviewLabels().then(setReviewLabels).catch(() => { /* silent */ })
  }, [])

  // CHG-SN-8-GAPS-MOD-BATCH：批量审核模式
  const [batchModeOn, setBatchModeOn] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [batchPending, setBatchPending] = useState(false)
  const [batchRejectModalOpen, setBatchRejectModalOpen] = useState(false)
  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  // 退出批量模式时清空选择
  useEffect(() => {
    if (!batchModeOn) clearSelection()
  }, [batchModeOn, clearSelection])

  // CHG-SN-8-06：「通过即上架」开关 — sessionStorage 持久化
  const [approveAndPublishOn, setApproveAndPublishOnRaw] = useState(false)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('admin.moderation.approveAndPublishOn.v1')
      if (stored === 'true') setApproveAndPublishOnRaw(true)
    } catch { /* ignore */ }
  }, [])
  const setApproveAndPublishOn = useCallback((next: boolean) => {
    setApproveAndPublishOnRaw(next)
    try { sessionStorage.setItem('admin.moderation.approveAndPublishOn.v1', String(next)) } catch { /* ignore */ }
  }, [])

  // CHG-350 + BUG-FIX：q 搜索词
  //   复用 admin-ui DataTableSearchInput（半 uncontrolled / IME 兼容 / 内置 300ms debounce）
  //   onQChange 收到的是 debounce/composition end 后的最终值（不是按键级）
  //   不再需要 qInput/q 双 state；不再需要 router.replace 回流 — 删除 useEffect debounce 链路
  const [q, setQ] = useState<string>(() => searchParams.get('q') ?? '')
  // searchParams 用 ref 持有最新值，onQChange 不依赖 searchParams（断开 useCallback 重建链路）
  const searchParamsRef = useRef(searchParams)
  useEffect(() => { searchParamsRef.current = searchParams }, [searchParams])
  const handleQChange = useCallback((next: string) => {
    setQ(next)
    const p = new URLSearchParams(searchParamsRef.current.toString())
    if (next.trim()) p.set('q', next.trim())
    else p.delete('q')
    router.replace(`?${p}`, { scroll: false })
  }, [router])

  // CHG-347 / SPLIT-A：pending 队列状态与方法抽到独立 hook
  const queueFilters = React.useMemo(() => ({ ...currentFilters, q }), [currentFilters, q])
  const queue = usePendingQueue(queueFilters, {
    tab,
    approveAndPublishOn,
    enabled: tab === 'pending',
  })
  const {
    videos: pendingVideos,
    total: totalPending,
    todayStats,
    activeIdx,
    loading,
    loadingMore,
    error,
    nextCursor,
    setActiveIdx,
    loadMore,
    approveAt,
    rejectAt,
    batchApprove,
    batchReject,
    updateStaffNoteLocal,
    refetch: refetchQueue,
    setError,
  } = queue

  const v = pendingVideos[activeIdx] ?? null

  const handleApprove = useCallback(() => { void approveAt() }, [approveAt])

  const handleBatchApprove = useCallback(async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定批量通过 ${selectedIds.size} 条视频？通过后视为「通过 → 暂存」（与 approveAndPublishOn 无关，批量端点固定 approve action）。`)) return
    setBatchPending(true)
    try {
      const result = await batchApprove([...selectedIds])
      clearSelection()
      setBatchModeOn(false)
      setToast({ message: `批量通过 ${result.ok} 条${result.failed > 0 ? `（失败 ${result.failed}）` : ''}`, key: Date.now() })
    } catch {
      // hook 内部已 setError，无需再处理
    } finally {
      setBatchPending(false)
    }
  }, [selectedIds, clearSelection, batchApprove])

  const handleBatchRejectSubmit = useCallback(async (payload: RejectModalSubmitPayload) => {
    if (selectedIds.size === 0) return
    setRejectSubmitting(true)
    try {
      const result = await batchReject([...selectedIds], payload)
      clearSelection()
      setBatchModeOn(false)
      setBatchRejectModalOpen(false)
      setToast({ message: `批量拒绝 ${result.ok} 条${result.failed > 0 ? `（失败 ${result.failed}）` : ''}`, key: Date.now() })
    } catch {
      // hook 内部已 setError
    } finally {
      setRejectSubmitting(false)
    }
  }, [selectedIds, clearSelection, batchReject])

  const handleRejectSubmit = useCallback(async (payload: RejectModalSubmitPayload) => {
    setRejectSubmitting(true)
    try {
      await rejectAt(undefined, payload)
      setRejectOpen(false)
    } catch (err) {
      throw err
    } finally {
      setRejectSubmitting(false)
    }
  }, [rejectAt])

  const handleStaffNoteChange = updateStaffNoteLocal

  const handleEditVideo = useCallback((videoId: string) => {
    setEditVideoId(videoId)
  }, [])

  const handleEditDrawerSaved = useCallback(() => {
    setEditVideoId(null)
    void refetchQueue()
  }, [refetchQueue])

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

  // CHG-SN-8-FUP-PRESET-TEAM-EP-B / ADR-144：hook 由 localStorage → DB 持久化，
  // CRUD 改为 async；外层 handler 加 try/catch + 失败 toast 兜底
  const handleRemovePreset = useCallback(async (preset: FilterPreset) => {
    try {
      const removed = await removePreset(preset.id)
      if (!removed) return
      setToast({
        message: M.preset.toast.deleted(preset.name),
        undo: () => { void restorePreset(removed); setToast(null) },
        key: Date.now(),
      })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '删除预设失败', key: Date.now() })
    }
  }, [removePreset, restorePreset])

  const handleSetPresetDefault = useCallback(async (preset: FilterPreset) => {
    try {
      await setPresetDefault(preset.id)
      setToast({ message: M.preset.toast.defaultSet(preset.name), key: Date.now() })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '设置默认预设失败', key: Date.now() })
    }
  }, [setPresetDefault])

  const handleUnsetPresetDefault = useCallback(async (preset: FilterPreset) => {
    try {
      await updatePreset(preset.id, { isDefault: false })
      setToast({ message: M.preset.toast.defaultUnset(preset.name), key: Date.now() })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '取消默认预设失败', key: Date.now() })
    }
  }, [updatePreset])

  const handleSavePresetSubmit = useCallback(async (input: { name: string; tab: FilterPresetTab; isDefault: boolean }) => {
    try {
      const saved = await savePreset({ name: input.name, tab: input.tab, isDefault: input.isDefault, query: currentFilters })
      setSavePresetOpen(false)
      setPresetPopoverOpen(false)
      setToast({ message: M.preset.toast.saved(saved.name), key: Date.now() })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '保存预设失败', key: Date.now() })
    }
  }, [savePreset, currentFilters])

  // 键盘流 J/K/A/R/S 已下沉至 PendingPaneController（CHG-349 / SPLIT-C）

  const tabCounts = { pending: totalPending, rejected: 0 }
  const tabDefs: readonly { id: TabId; label: string; danger?: boolean }[] = [
    { id: 'pending', label: M.tabs.pending },
    { id: 'rejected', label: M.tabs.rejected, danger: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: PAGE_HEIGHT }} data-moderation-console>

      {/* Page head — 共享 PageHeader（MODUX-P1-1-A，规约 T-1/T-5/T-6：统计+键盘行进 subtitle 槽） */}
      <div style={{ marginBottom: 8, flexShrink: 0 }}>
      <PageHeader
        title={M.title}
        subtitle={
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span dangerouslySetInnerHTML={{ __html: M.todayStats(todayStats.reviewed, todayStats.approveRate).replace(/(\d+)/g, '<strong style="color:var(--fg-default)">$1</strong>').replace(/\d+%/g, m => `<strong style="color:var(--state-success-fg)">${m}</strong>`) }} />
            <span style={{ color: 'var(--border-default)' }}>|</span>
            <span style={KBD_HINT_STYLE} title={M.kbdHint} data-kbd-hint>{M.kbdFlowLabel}</span>
          </div>
        }
        actions={
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
            dataSource={presetDataSource}
            localPendingCount={presetLocalPendingCount}
            onImportLocal={async () => {
              try {
                const r = await importLocalPresets()
                setToast({ message: `导入完成：成功 ${r.imported} · 失败 ${r.failed}`, key: Date.now() })
              } catch (err) {
                setToast({ message: err instanceof Error ? err.message : '导入失败', key: Date.now() })
              }
            }}
          />
        </div>
        }
      />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, marginBottom: 8, fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button style={{ ...BTN_SM, fontSize: 'var(--font-size-xxs)', padding: '2px 8px' }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* CHG-SN-8-03：来自采集 run 软深链 banner */}
      {runIdParam && <RunInfoBanner runId={runIdParam} onDismiss={dismissRunBanner} />}

      {/* Segment tabs + 通过即上架 toggle（CHG-SN-8-06）*/}
      <div style={{ display: 'flex', gap: 1, marginBottom: 10, flexShrink: 0, alignItems: 'center' }}>
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
        {tab === 'pending' && (
          <label
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--fg-default)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            data-testid="moderation-approve-publish-toggle"
            title={approveAndPublishOn
              ? '通过后将直接发布到前台（跳过暂存）；A 键 / 通过 按钮 同步生效'
              : '通过后入暂存（staging），需 admin 在暂存页二次发布'}
          >
            <input
              type="checkbox"
              checked={approveAndPublishOn}
              onChange={(e) => setApproveAndPublishOn(e.target.checked)}
              data-testid="moderation-approve-publish-toggle-input"
              aria-label="通过即上架"
            />
            <span>{approveAndPublishOn ? '✓ 通过即上架' : '通过 → 暂存'}</span>
          </label>
        )}
        {tab === 'pending' && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--fg-default)',
              cursor: 'pointer',
              userSelect: 'none',
              marginLeft: 8,
            }}
            data-testid="moderation-batch-mode-toggle"
            title="开启批量模式：左队列改为多选 checkbox，J/K 键盘流暂停"
          >
            <input
              type="checkbox"
              checked={batchModeOn}
              onChange={(e) => setBatchModeOn(e.target.checked)}
              data-testid="moderation-batch-mode-toggle-input"
              aria-label="批量模式"
            />
            <span>{batchModeOn ? `✓ 批量模式（${selectedIds.size}）` : '批量模式'}</span>
          </label>
        )}
      </div>

      {/* Tab content (CHG-349 / SPLIT-C：pending SplitPane + 键盘流抽至 PendingPaneController) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'pending' && (
          <PendingPaneController
            videos={pendingVideos}
            total={totalPending}
            activeIdx={activeIdx}
            loading={loading}
            loadingMore={loadingMore}
            nextCursor={nextCursor}
            setActiveIdx={setActiveIdx}
            loadMore={loadMore}
            batchModeOn={batchModeOn}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectId}
            onApprove={handleApprove}
            onRejectOpen={() => setRejectOpen(true)}
            onEditVideo={handleEditVideo}
            onStaffNoteChange={handleStaffNoteChange}
            onSourceHealthChanged={refetchQueue}
            q={q}
            onQChange={handleQChange}
            currentFilters={currentFilters}
            onClearAllFilters={() => {
              handleQChange('')
              setCurrentFilters({})
              applyFiltersToUrl({})
            }}
            onApplyFilters={applyFiltersToUrl}
          />
        )}
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

      {/* CHG-SN-8-GAPS-MOD-BATCH：批量拒绝 modal（复用 RejectModal）*/}
      <RejectModal
        open={batchRejectModalOpen}
        onClose={() => setBatchRejectModalOpen(false)}
        labels={reviewLabels}
        onSubmit={handleBatchRejectSubmit}
        submitting={rejectSubmitting}
        title={`批量拒绝 ${selectedIds.size} 条`}
      />

      {/* CHG-SN-8-GAPS-MOD-BATCH：bulk action bar (CHG-348 / SPLIT-B 抽至 BatchActionsBar 组件) */}
      {batchModeOn && selectedIds.size > 0 && (
        <BatchActionsBar
          selectedCount={selectedIds.size}
          onApprove={() => void handleBatchApprove()}
          onReject={() => setBatchRejectModalOpen(true)}
          onClear={clearSelection}
          pending={batchPending}
          onMerge={() => {
            // CHG-364-A：批量合并入口（CHG-VIR-13-A1：buildMergeHref 收口，禁内联拼接）
            // CHG-364-B 卡补 MergeClient 接 ?ids query + BatchMergeWorkspace（列 ids 选 target + 提交 merge）
            window.open(
              buildMergeHref({ kind: 'batch-merge', ids: Array.from(selectedIds), from: 'moderation-batch' }),
              '_blank',
              'noopener,noreferrer',
            )
          }}
        />
      )}

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
            fontSize: 'var(--font-size-xs)',
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
                fontSize: 'var(--font-size-xxs)',
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
