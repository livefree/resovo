/**
 * SubmissionTable.tsx — 投稿审核表格（Client Component）
 * CHG-29: DataTable + Pagination + ReviewModal + Toast
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'

const PAGE_SIZE = 20

interface SubmissionRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  submitted_by: string | null
  submitted_by_username?: string
  video_title?: string
  created_at: string
}

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)

  const fetchSubmissions = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?page=${pageVal}&limit=${PAGE_SIZE}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubmissions(page) }, [fetchSubmissions, page])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/submissions/${id}/approve`)
    showToast('已通过，ES 索引已加入同步队列')
    fetchSubmissions(page)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/submissions/${id}/reject`, { reason })
    fetchSubmissions(page)
  }

  return (
    <div data-testid="submission-table">
      {toast && (
        <div
          className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          data-testid="submission-toast"
        >
          {toast}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">视频</th>
              <th className="px-4 py-3 text-left">源 URL</th>
              <th className="px-4 py-3 text-left">投稿人</th>
              <th className="px-4 py-3 text-left">时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
            )}
            {!loading && submissions.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-[var(--muted)]">暂无待审投稿</td></tr>
            )}
            {!loading && submissions.map((row) => (
              <tr
                key={row.id}
                className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`submission-row-${row.id}`}
              >
                <td className="px-4 py-3 text-[var(--text)]">{row.video_title ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--muted)]" title={row.source_url}>
                    {row.source_url.slice(0, 60)}{row.source_url.length > 60 ? '…' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.submitted_by_username ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setReviewTarget({ id: row.id, type: 'submission', title: row.video_title })}
                    className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
                    data-testid={`submission-review-btn-${row.id}`}
                  >
                    审核
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

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
