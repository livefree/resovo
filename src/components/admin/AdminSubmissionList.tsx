/**
 * AdminSubmissionList.tsx — 投稿审核队列
 * ADMIN-03: 通过 → is_active=true；拒绝 → 软删除
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface SubmissionRow {
  id: string
  video_id: string
  video_title: string | null
  source_url: string
  source_name: string
  type: string
  submitted_by: string | null
  submitted_by_username: string | null
  created_at: string
}

export function AdminSubmissionList() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = 20

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?${params}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

  async function handleApprove(id: string) {
    try {
      await apiClient.post(`/admin/submissions/${id}/approve`)
      fetchSubmissions()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleReject(id: string) {
    if (!confirm('确认拒绝此投稿？')) return
    try {
      await apiClient.post(`/admin/submissions/${id}/reject`)
      fetchSubmissions()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div data-testid="admin-submission-list">
      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">视频</th>
              <th className="px-4 py-3 text-left">来源名</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">投稿人</th>
              <th className="px-4 py-3 text-left">投稿时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
            )}
            {!loading && submissions.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">暂无待审投稿</td></tr>
            )}
            {!loading && submissions.map((sub) => (
              <tr key={sub.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-submission-row-${sub.id}`}>
                <td className="max-w-48 truncate px-4 py-3 text-[var(--text)]">
                  {sub.video_title ?? sub.video_id}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{sub.source_name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{sub.type}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {sub.submitted_by_username ?? sub.submitted_by ?? '—'}
                </td>
                <td className="px-4 py-3 text-[var(--muted)] text-xs">
                  {new Date(sub.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(sub.id)}
                      className="rounded px-2 py-0.5 text-xs bg-green-900/30 text-green-400 hover:bg-green-900/60"
                      data-testid={`admin-submission-approve-${sub.id}`}
                    >
                      通过
                    </button>
                    <button
                      onClick={() => handleReject(sub.id)}
                      className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
                      data-testid={`admin-submission-reject-${sub.id}`}
                    >
                      拒绝
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">上一页</button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
