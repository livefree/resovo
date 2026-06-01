'use client'

/**
 * StagingPageClient — 暂存发布独立页（CHG-SN-7-REDO-04-B）
 *
 * 范围（§5.5 + §6.3 spec）：
 *   - page head + 批量发布 action
 *   - 1.5fr/1fr grid：发布流水线 card + 自动发布规则 card
 *   - 4-segment：全部/就绪/警告/阻塞
 *   - DataTable v2 mode="client"（列：video / douban / signal / dwell / ready / actions）
 *
 * 端点：GET/PUT /admin/staging/rules · GET /admin/staging · POST publish/batch-publish/revert
 */

import React, { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  AdminInput,
  AdminCheckbox,
  DataTable,
  Segment,
  LoadingState,
  ErrorState,
  EmptyState,
  Thumb,
  DualSignal,
  useToast,
  type TableColumn,
  type TableCellContext,
  type TableQuerySnapshot,
  type ColumnPreference,
  type FilterValue,
  type TableSortState,
  type SegmentItem,
} from '@resovo/admin-ui'
import type { DualSignalDisplayState } from '@resovo/types'
import {
  listStagingVideos,
  saveStagingRules,
  publishStagingVideo,
  batchPublishStagingVideos,
  revertStagingVideo,
  type StagingRow,
  type StagingRules,
  type StagingReadinessSummary,
  type StagingReadinessFilter,
} from '@/lib/staging/api'
import { ApiClientError } from '@/lib/api-client'

// ── 样式常量 ──────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  height: '100%',
}

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr',
  gap: '12px',
}

const STAT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '24px',
  flexWrap: 'wrap',
}

const STAT_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const STAT_NUM_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xl)',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.2,
}

const STAT_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const RULES_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  alignItems: 'center',
}

// ── 辅助函数 ──────────────────────────────────────────────────────────

function toSignal(status: string): DualSignalDisplayState {
  if (status === 'ok' || status === 'partial' || status === 'dead' || status === 'pending') return status
  return 'unknown'
}

function formatDwell(approvedAt: string | null): string {
  if (!approvedAt) return '—'
  const ms = Date.now() - new Date(approvedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} 分钟`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小时`
  return `${Math.floor(hrs / 24)} 天`
}

function readinessLabel(row: StagingRow): { text: string; color: string } {
  if (row.readiness.ready) return { text: '通过全部规则', color: 'var(--state-success-fg)' }
  const first = row.readiness.blockers[0] ?? '未通过规则'
  if (first.includes('源') || first.includes('失效') || first.includes('线路')) {
    return { text: first, color: 'var(--state-error-fg)' }
  }
  return { text: first, color: 'var(--state-warning-fg)' }
}

function buildInitialQuery(): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 50 },
    sort: { field: undefined, direction: 'desc' },
    filters: new Map<string, FilterValue>(),
    columns: new Map<string, ColumnPreference>(),
    selection: { selectedKeys: new Set<string>(), mode: 'page' },
  }
}

// ── 流水线统计卡 ──────────────────────────────────────────────────────

function PipelineSummaryCard({ summary, loading }: { summary: StagingReadinessSummary | null; loading: boolean }) {
  if (loading || !summary) return <AdminCard surface="plain" padding="md" header={{ title: '发布流水线' }}><LoadingState variant="skeleton" /></AdminCard>
  return (
    <AdminCard surface="plain" padding="md" header={{ title: '发布流水线', subtitle: '当前暂存队列就绪分布' }}>
      <div style={STAT_ROW_STYLE}>
        <div style={STAT_ITEM_STYLE}>
          <span style={STAT_NUM_STYLE}>{summary.all}</span>
          <span style={STAT_LABEL_STYLE}>全部</span>
        </div>
        <div style={STAT_ITEM_STYLE}>
          <span style={{ ...STAT_NUM_STYLE, color: 'var(--state-success-fg)' }}>{summary.ready}</span>
          <span style={STAT_LABEL_STYLE}>就绪</span>
        </div>
        <div style={STAT_ITEM_STYLE}>
          <span style={{ ...STAT_NUM_STYLE, color: 'var(--state-warning-fg)' }}>{summary.warning}</span>
          <span style={STAT_LABEL_STYLE}>警告</span>
        </div>
        <div style={STAT_ITEM_STYLE}>
          <span style={{ ...STAT_NUM_STYLE, color: 'var(--state-error-fg)' }}>{summary.blocked}</span>
          <span style={STAT_LABEL_STYLE}>阻塞</span>
        </div>
      </div>
    </AdminCard>
  )
}

// ── 自动发布规则卡 ────────────────────────────────────────────────────

function AutoPublishRulesCard({ rules, onSaved }: { rules: StagingRules | null; onSaved: (r: StagingRules) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StagingRules | null>(rules)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { setDraft(rules) }, [rules])

  const handleSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      const saved = await saveStagingRules(draft)
      onSaved(saved)
      setEditing(false)
      toast.push({ title: '规则已保存', level: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '保存失败，请重试'
      toast.push({ title: '保存失败', description: msg, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [draft, onSaved, toast])

  if (!rules || !draft) return <AdminCard surface="plain" padding="md" header={{ title: '自动发布规则' }}><LoadingState variant="skeleton" /></AdminCard>

  return (
    <AdminCard
      surface="plain"
      padding="md"
      header={{
        title: '自动发布规则',
        actions: editing
          ? <span style={{ display: 'inline-flex', gap: 8 }}>
              <AdminButton size="sm" variant="default" disabled={saving} onClick={() => { setEditing(false); setDraft(rules) }}>取消</AdminButton>
              <AdminButton size="sm" variant="primary" loading={saving} onClick={() => void handleSave()}>保存</AdminButton>
            </span>
          : <AdminButton size="sm" variant="default" onClick={() => setEditing(true)}>编辑规则</AdminButton>,
      }}
    >
      <div style={RULES_GRID_STYLE}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>最低元数据分</span>
        {editing
          ? <AdminInput type="number" size="sm" value={String(draft.minMetaScore)} onChange={(e) => setDraft((d) => d ? { ...d, minMetaScore: Number(e.target.value) || 0 } : d)} />
          : <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}>{rules.minMetaScore}</span>}

        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>最少活跃线路</span>
        {editing
          ? <AdminInput type="number" size="sm" value={String(draft.minActiveSourceCount)} onChange={(e) => setDraft((d) => d ? { ...d, minActiveSourceCount: Number(e.target.value) || 0 } : d)} />
          : <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)' }}>{rules.minActiveSourceCount}</span>}

        <AdminCheckbox
          label="要求豆瓣匹配"
          checked={draft.requireDoubanMatched}
          disabled={!editing}
          onChange={(e) => setDraft((d) => d ? { ...d, requireDoubanMatched: e.target.checked } : d)}
        />
        <AdminCheckbox
          label="要求封面图"
          checked={draft.requireCoverUrl}
          disabled={!editing}
          onChange={(e) => setDraft((d) => d ? { ...d, requireCoverUrl: e.target.checked } : d)}
        />
      </div>
    </AdminCard>
  )
}

// ── 列定义构建函数 ────────────────────────────────────────────────────

interface StagingColumnsCallbacks {
  readonly onPublish: (id: string, title: string) => void
  readonly onRevert: (id: string, title: string) => void
}

function buildStagingColumns(cbs: StagingColumnsCallbacks): readonly TableColumn<StagingRow>[] {
  return [
    {
      id: 'video',
      header: '视频',
      accessor: (row) => row.title,
      cell: ({ row }: TableCellContext<StagingRow>) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Thumb size="poster-sm" src={row.coverUrl ?? undefined} alt={row.title} />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)' }}>{row.title}</div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{row.type}{row.year ? ` · ${row.year}` : ''}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'douban',
      header: '豆瓣',
      accessor: (row) => row.metaScore,
      width: 70,
      cell: ({ row }: TableCellContext<StagingRow>) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: row.metaScore > 0 ? 'var(--accent-default)' : 'var(--fg-muted)', fontWeight: row.metaScore > 0 ? 600 : 400 }}>
          {row.metaScore > 0 ? row.metaScore : '—'}
        </span>
      ),
    },
    {
      id: 'signal',
      header: '探测/播放',
      accessor: (row) => row.sourceCheckStatus,
      width: 140,
      cell: ({ row }: TableCellContext<StagingRow>) => <DualSignal probe={toSignal(row.sourceCheckStatus)} render="unknown" />,
    },
    {
      id: 'dwell',
      header: '暂存时长',
      accessor: (row) => row.approvedAt,
      width: 90,
      cell: ({ row }: TableCellContext<StagingRow>) => <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{formatDwell(row.approvedAt)}</span>,
    },
    {
      id: 'ready',
      header: '就绪状态',
      accessor: (row) => row.readiness.ready,
      width: 200,
      cell: ({ row }: TableCellContext<StagingRow>) => {
        const { text, color } = readinessLabel(row)
        return <span style={{ fontSize: 'var(--font-size-xs)', color }}>{text}</span>
      },
    },
    {
      id: 'actions',
      kind: 'action',
      header: '操作',
      accessor: (row) => row.id,
      width: 160,
      cell: ({ row }: TableCellContext<StagingRow>) => (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <AdminButton size="sm" variant="primary" disabled={!row.readiness.ready}
            onClick={() => cbs.onPublish(row.id, row.title)}>
            发布
          </AdminButton>
          <AdminButton size="sm" variant="default"
            onClick={() => cbs.onRevert(row.id, row.title)}>
            退回
          </AdminButton>
        </span>
      ),
    },
  ]
}

// ── 主组件 ────────────────────────────────────────────────────────────

type SegmentValue = 'all' | StagingReadinessFilter

export function StagingPageClient() {
  const toast = useToast()
  const [rows, setRows] = useState<readonly StagingRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<StagingReadinessSummary | null>(null)
  const [rules, setRules] = useState<StagingRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [segment, setSegment] = useState<SegmentValue>('all')
  const [batchPublishing, setBatchPublishing] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [query, setQuery] = useState<TableQuerySnapshot>(buildInitialQuery)
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'desc' })
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  const [filters, setFilters] = useState<ReadonlyMap<string, FilterValue>>(new Map())

  const tableQuery = useMemo<TableQuerySnapshot>(() => ({
    pagination: query.pagination,
    sort,
    filters,
    columns: columnPrefs,
    selection: { selectedKeys: new Set<string>(), mode: 'page' },
  }), [query.pagination, sort, filters, columnPrefs])

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const readiness = segment !== 'all' ? segment : undefined
    listStagingVideos({ limit: 50, readiness })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.total)
        setSummary(res.summary)
        setRules(res.rules)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [segment])

  useEffect(() => load(), [load, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleBatchPublish = useCallback(async () => {
    setBatchPublishing(true)
    try {
      const { published, skipped } = await batchPublishStagingVideos()
      toast.push({ title: `批量发布完成：${published} 条`, description: `跳过 ${skipped} 条（条件未就绪）`, level: 'success' })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '批量发布失败'
      toast.push({ title: '批量发布失败', description: msg, level: 'danger' })
    } finally {
      setBatchPublishing(false)
    }
  }, [toast, refresh])

  const handlePublish = useCallback(async (id: string, title: string) => {
    try {
      await publishStagingVideo(id)
      toast.push({ title: `《${title}》已发布`, level: 'success' })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '发布失败'
      toast.push({ title: '发布失败', description: msg, level: 'danger' })
    }
  }, [toast, refresh])

  const handleRevert = useCallback(async (id: string, title: string) => {
    try {
      await revertStagingVideo(id)
      toast.push({ title: `《${title}》已退回待审`, level: 'info' })
      refresh()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : '退回失败'
      toast.push({ title: '退回失败', description: msg, level: 'danger' })
    }
  }, [toast, refresh])

  const columnsCallbacks = useMemo<StagingColumnsCallbacks>(() => ({
    onPublish: (id, title) => void handlePublish(id, title),
    onRevert: (id, title) => void handleRevert(id, title),
  }), [handlePublish, handleRevert])

  const columns = useMemo(() => buildStagingColumns(columnsCallbacks), [columnsCallbacks])

  const segmentItems = useMemo<readonly SegmentItem[]>(() => [
    { value: 'all', label: '全部', badge: summary?.all },
    { value: 'ready', label: '就绪', badge: summary?.ready },
    { value: 'warning', label: '警告', badge: summary?.warning },
    { value: 'blocked', label: '阻塞', badge: summary?.blocked },
  ], [summary])

  if (error && !rows.length) {
    return (
      <div style={PAGE_STYLE}>
        <PageHeader title="暂存发布" />
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  return (
    <div style={PAGE_STYLE} data-testid="staging-page">
      <PageHeader
        title="暂存发布"
        subtitle={`${total} 条待发布`}
        actions={
          <AdminButton variant="primary" size="sm" loading={batchPublishing} onClick={() => void handleBatchPublish()}>
            批量发布就绪
          </AdminButton>
        }
      />

      <div style={GRID_STYLE}>
        <PipelineSummaryCard summary={summary} loading={loading && !summary} />
        <AutoPublishRulesCard rules={rules} onSaved={setRules} />
      </div>

      <Segment
        items={segmentItems}
        value={segment}
        onChange={(v) => setSegment(v as SegmentValue)}
        aria-label="暂存队列筛选"
        data-testid="staging-segment"
      />

      {loading && !rows.length
        ? <LoadingState variant="skeleton" />
        : rows.length === 0
          ? <EmptyState title="暂无数据" description="当前筛选条件下没有暂存视频" />
          : (
            <DataTable<StagingRow>
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              mode="client"
              query={tableQuery}
              onQueryChange={(patch) => {
                if (patch.pagination) setQuery((q) => ({ ...q, pagination: { ...q.pagination, ...patch.pagination } }))
                if (patch.sort) setSort(patch.sort)
                if (patch.columns) setColumnPrefs(patch.columns)
                if (patch.filters) setFilters(patch.filters)
              }}
              loading={loading}
              data-testid="staging-table"
              enableColumnResizing
            />
          )}
    </div>
  )
}
