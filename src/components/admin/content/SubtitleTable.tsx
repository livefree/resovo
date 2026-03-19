/**
 * SubtitleTable.tsx — 字幕审核表格（Client Component）
 * CHG-29: DataTable + Pagination + ReviewModal
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'

const PAGE_SIZE = 20

interface SubtitleRow {
  id: string
  video_id: string
  language: string
  format: string
  label: string | null
  file_url: string
  uploaded_by: string | null
  created_at: string
  video_title?: string
  uploader_username?: string
}

export function SubtitleTable() {
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)

  const fetchSubtitles = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SubtitleRow[]; total: number }>(
        `/admin/subtitles?page=${pageVal}&limit=${PAGE_SIZE}`
      )
      setSubtitles(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubtitles(page) }, [fetchSubtitles, page])

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/subtitles/${id}/approve`)
    fetchSubtitles(page)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/subtitles/${id}/reject`, { reason })
    fetchSubtitles(page)
  }

  return (
    <div data-testid="subtitle-table">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">视频</th>
              <th className="px-4 py-3 text-left">语言</th>
              <th className="px-4 py-3 text-left">格式</th>
              <th className="px-4 py-3 text-left">上传人</th>
              <th className="px-4 py-3 text-left">时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
            )}
            {!loading && subtitles.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">暂无待审字幕</td></tr>
            )}
            {!loading && subtitles.map((row) => (
              <tr
                key={row.id}
                className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`subtitle-row-${row.id}`}
              >
                <td className="px-4 py-3 text-[var(--text)]">{row.video_title ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.language}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.format}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.uploader_username ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setReviewTarget({ id: row.id, type: 'subtitle', title: row.video_title })}
                    className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
                    data-testid={`subtitle-review-btn-${row.id}`}
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
