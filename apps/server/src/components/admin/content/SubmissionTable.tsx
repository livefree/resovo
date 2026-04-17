/**
 * SubmissionTable.tsx — 投稿审核表格（UX-06）
 * CHG-259: 迁移至 ModernDataTable；UX-06: 新增过滤/选择/批量审核
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import type { AdminTableSortState } from '@/components/admin/shared/table/useAdminTableState'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import {
  useSubmissionTableColumns,
  SUBMISSION_COLUMN_LABELS,
  SUBMISSION_SORTABLE_MAP,
  SUBMISSION_COLUMNS_META,
  SUBMISSION_DEFAULT_TABLE_STATE,
  type SubmissionRow,
  type SubmissionColumnId,
} from './useSubmissionTableColumns'

// ── 常量 ──────────────────────────────────────────────────────────

const ALL_SUBMISSION_COLUMN_IDS = SUBMISSION_COLUMNS_META.map((col) => col.id as SubmissionColumnId)

const SUBMISSION_SETTINGS_COLUMNS = SUBMISSION_COLUMNS_META.map((col) => ({
  id: col.id,
  label: SUBMISSION_COLUMN_LABELS[col.id as SubmissionColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: SUBMISSION_SORTABLE_MAP[col.id as SubmissionColumnId] ?? false,
  required: col.id === 'actions',
}))

const DEFAULT_PAGE_SIZE = 20

const VIDEO_TYPE_OPTIONS = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'other', label: '其他' },
]

// ── 主组件 ──────────────────────────────────────────────────────

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [sort, setSort] = useState<AdminTableSortState | undefined>(SUBMISSION_DEFAULT_TABLE_STATE.sort)

  // 过滤
  const [videoType, setVideoType] = useState('')
  const [siteKey, setSiteKey] = useState('')
  const [sites, setSites] = useState<{ key: string; name: string }[]>([])

  // 选择
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 批量拒绝
  const [batchRejectMode, setBatchRejectMode] = useState(false)
  const [batchRejectReason, setBatchRejectReason] = useState('')
  const [batchPending, setBatchPending] = useState(false)

  const tableSettings = useTableSettings({
    tableId: 'submission-table',
    columns: SUBMISSION_SETTINGS_COLUMNS,
  })

  const tableSortState = useMemo<TableSortState | undefined>(() => {
    if (!sort) return undefined
    return { field: sort.field, direction: sort.dir }
  }, [sort])

  // 加载站点列表（用于过滤）
  useEffect(() => {
    apiClient
      .get<{ data: { key: string; name: string }[] }>('/admin/crawler/sites')
      .then((res) => {
        const sorted = [...(res.data ?? [])].sort((a, b) =>
          a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' })
        )
        setSites(sorted)
      })
      .catch(() => {/* 站点加载失败时下拉为空 */})
  }, [])

  const fetchSubmissions = useCallback(async (pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    setSelectedIds([])
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: String(pageSizeVal),
      })
      if (sort) {
        params.set('sortField', sort.field)
        params.set('sortDir', sort.dir)
      }
      if (videoType) params.set('videoType', videoType)
      if (siteKey) params.set('siteKey', siteKey)
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?${params}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch {
      // fetch failed: table remains showing previous data
    } finally {
      setLoading(false)
    }
  }, [sort, videoType, siteKey])

  useEffect(() => {
    setPage(1)
    void fetchSubmissions(1, pageSize)
  }, [sort, pageSize, videoType, siteKey, fetchSubmissions])

  // 选择
  const allSelected = submissions.length > 0 && selectedIds.length === submissions.length

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? submissions.map((s) => s.id) : [])
  }, [submissions])

  // 批量操作
  async function handleBatchApprove() {
    setBatchPending(true)
    try {
      await apiClient.post('/admin/submissions/batch-approve', { ids: selectedIds })
      setSelectedIds([])
      void fetchSubmissions(page, pageSize)
    } catch {
      // silent
    } finally {
      setBatchPending(false)
    }
  }

  async function handleBatchReject() {
    if (!batchRejectReason.trim()) return
    setBatchPending(true)
    try {
      await apiClient.post('/admin/submissions/batch-reject', {
        ids: selectedIds,
        reason: batchRejectReason.trim(),
      })
      setSelectedIds([])
      setBatchRejectMode(false)
      setBatchRejectReason('')
      void fetchSubmissions(page, pageSize)
    } catch {
      // silent
    } finally {
      setBatchPending(false)
    }
  }

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/submissions/${id}/approve`)
    void fetchSubmissions(page, pageSize)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/submissions/${id}/reject`, { reason })
    void fetchSubmissions(page, pageSize)
  }

  const allTableColumns = useSubmissionTableColumns({
    visibleColumnIds: ALL_SUBMISSION_COLUMN_IDS,
    allSelected,
    selectedIds,
    handleSelectAll,
    handleCheck,
    setReviewTarget,
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  const REJECT_TEMPLATES = ['来源无法访问', '内容与视频不符', '重复提交', '格式不支持']

  return (
    <div data-testid="submission-table" className="space-y-2">
      {/* 过滤栏 */}
      <div className="flex flex-wrap items-center gap-2" data-testid="submission-filters">
        <select
          value={videoType}
          onChange={(e) => setVideoType(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="submission-filter-type"
        >
          <option value="">全部类型</option>
          {VIDEO_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {sites.length > 0 && (
          <select
            value={siteKey}
            onChange={(e) => setSiteKey(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            data-testid="submission-filter-site"
          >
            <option value="">全部来源</option>
            {sites.map((s) => (
              <option key={s.key} value={s.key}>{s.name || s.key}</option>
            ))}
          </select>
        )}
      </div>

      <ModernDataTable
        columns={tableColumns}
        rows={submissions}
        sort={tableSortState}
        onSortChange={(nextSort) => {
          setSort({ field: nextSort.field, dir: nextSort.direction === 'asc' ? 'asc' : 'desc' })
        }}
        onColumnWidthChange={tableSettings.updateWidth}
        loading={loading}
        emptyText="暂无待审投稿"
        scrollTestId="submission-table-scroll"
        getRowId={(row) => row.id}
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />

      {total > 0 ? (
        <div className="mt-4">
          <PaginationV2
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(nextPage) => { setPage(nextPage); void fetchSubmissions(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchSubmissions(1, nextSize) }}
          />
        </div>
      ) : null}

      {/* 批量拒绝理由输入区 */}
      {batchRejectMode && (
        <div className="fixed bottom-20 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl" data-testid="batch-reject-form">
          <div className="mb-2 text-sm font-medium text-[var(--text)]">批量拒绝理由</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {REJECT_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setBatchRejectReason(tpl)}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:border-red-400/50 hover:text-red-400"
              >
                {tpl}
              </button>
            ))}
          </div>
          <textarea
            value={batchRejectReason}
            onChange={(e) => setBatchRejectReason(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="请输入拒绝理由（1~200 字）"
            className="w-full resize-none rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            data-testid="batch-reject-reason-input"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setBatchRejectMode(false); setBatchRejectReason('') }}
              className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >取消</button>
            <button
              type="button"
              disabled={!batchRejectReason.trim() || batchPending}
              onClick={() => { void handleBatchReject() }}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              data-testid="batch-reject-confirm"
            >{batchPending ? '提交中…' : `拒绝 ${selectedIds.length} 条`}</button>
          </div>
        </div>
      )}

      <SelectionActionBar
        selectedCount={selectedIds.length}
        variant="sticky-bottom"
        data-testid="submission-batch-bar"
        actions={[
          {
            key: 'batch-approve',
            label: `批量通过（${selectedIds.length}）`,
            variant: 'success',
            disabled: batchPending,
            testId: 'submission-batch-approve',
            onClick: () => { void handleBatchApprove() },
          },
          {
            key: 'batch-reject',
            label: '批量拒绝…',
            variant: 'danger',
            disabled: batchPending,
            testId: 'submission-batch-reject',
            onClick: () => { setBatchRejectMode(true) },
          },
        ]}
      />

      <ReviewModal
        open={reviewTarget !== null}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
