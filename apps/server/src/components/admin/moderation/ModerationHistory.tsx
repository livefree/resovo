/**
 * ModerationHistory.tsx — 审核台已审核历史 Tab（UX-13）
 * 展示 review_status IN ('approved', 'rejected') 的视频
 * 支持筛选：结果（全部/通过/拒绝）/ 类型 / 排序
 * rejected 行显示[复审]按钮 → state-transition: reopen_pending
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { TableImageCell } from '@/components/admin/shared/modern-table/cells'
import { notify } from '@/components/admin/shared/toast/useAdminToast'

interface HistoryRow {
  id: string
  title: string
  type: string
  year: number | null
  cover_url: string | null
  review_status: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_reason: string | null
  douban_status: string
  source_check_status: string
  meta_score: number
  created_at: string
}

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'other', label: '其他' },
]

const PAGE_SIZE = 30

function formatDt(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ')
}

function getTypeLabel(type: string): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function ReviewStatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-300">
        已通过
      </span>
    )
  }
  return (
    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
      已拒绝
    </span>
  )
}

export function ModerationHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resultFilter, setResultFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [reopeningId, setReopeningId] = useState<string | null>(null)

  const fetchRows = useCallback(async (
    pageVal: number,
    result: string,
    type: string,
    dir: 'asc' | 'desc'
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: String(PAGE_SIZE),
        sortDir: dir,
      })
      if (result) params.set('result', result)
      if (type) params.set('type', type)
      const res = await apiClient.get<{ data: HistoryRow[]; total: number }>(
        `/admin/moderation/history?${params}`
      )
      setRows(res.data)
      setTotal(res.total)
    } catch (_err) {
      // fetch failed; list stays empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRows(page, resultFilter, typeFilter, sortDir)
  }, [fetchRows, page, resultFilter, typeFilter, sortDir])

  async function handleReopen(id: string) {
    if (reopeningId) return
    setReopeningId(id)
    try {
      await apiClient.post(`/admin/moderation/${id}/reopen`, {})
      notify.success('已重新加入待审队列')
      void fetchRows(page, resultFilter, typeFilter, sortDir)
    } catch (_err) {
      notify.error('复审操作失败')
    } finally {
      setReopeningId(null)
    }
  }

  const hasMore = page * PAGE_SIZE < total
  const hasPrev = page > 1

  return (
    <div className="flex h-full flex-col" data-testid="moderation-history">
      {/* 筛选栏 */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text)]">
            已审核历史
            {total > 0 && <span className="ml-2 text-xs text-[var(--muted)]">共 {total} 条</span>}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* 审核结果筛选 */}
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setPage(1) }}
            data-testid="history-result-filter"
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">全部结果</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          {/* 类型筛选 */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            data-testid="history-type-filter"
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* 排序 */}
          <div className="flex rounded border border-[var(--border)] overflow-hidden">
            <button
              type="button"
              onClick={() => { setSortDir('desc'); setPage(1) }}
              className={`px-2 py-1 text-xs transition-colors ${sortDir === 'desc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
            >
              最新
            </button>
            <button
              type="button"
              onClick={() => { setSortDir('asc'); setPage(1) }}
              className={`px-2 py-1 text-xs transition-colors ${sortDir === 'asc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
            >
              最早
            </button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="moderation-history-scroll">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--bg3)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-[var(--muted)]">暂无审核历史</p>
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-[var(--bg3)]"
                data-testid={`history-row-${row.id}`}
              >
                {/* 封面 */}
                <div className="mt-0.5 shrink-0">
                  <TableImageCell src={row.cover_url} alt={row.title} width={32} height={48} />
                </div>
                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm text-[var(--text)]">{row.title}</p>
                    <ReviewStatusBadge status={row.review_status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span>{getTypeLabel(row.type)}</span>
                    {row.year && <span>· {row.year}</span>}
                    <span>· 审核：{formatDt(row.reviewed_at)}</span>
                    {row.reviewed_by && <span>· {row.reviewed_by}</span>}
                  </div>
                  {row.review_reason && (
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      原因：{row.review_reason}
                    </p>
                  )}
                </div>
                {/* 复审按钮（仅拒绝视频） */}
                {row.review_status === 'rejected' && (
                  <button
                    type="button"
                    disabled={reopeningId === row.id}
                    onClick={() => { void handleReopen(row.id) }}
                    data-testid={`history-reopen-btn-${row.id}`}
                    className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                  >
                    {reopeningId === row.id ? '…' : '复审'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 分页 */}
      {(hasPrev || hasMore) && (
        <div className="shrink-0 flex justify-between border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
            data-testid="history-prev"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            上一页
          </button>
          <span className="self-center text-xs text-[var(--muted)]">第 {page} 页</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            data-testid="history-next"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
