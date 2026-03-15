/**
 * AdminSourceList.tsx — 播放源管理列表
 * ADMIN-03: 按 is_active 筛选 + 单条验证 + 批量删除
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface SourceRow {
  id: string
  video_id: string
  video_title: string | null
  source_url: string
  source_name: string
  type: string
  is_active: boolean
  last_checked: string | null
  created_at: string
}

type ActiveFilter = 'all' | 'true' | 'false'

export function AdminSourceList() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = 20

  const fetchSources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        active: activeFilter,
        page: String(page),
        limit: String(limit),
      })
      const res = await apiClient.get<{ data: SourceRow[]; total: number }>(
        `/admin/sources?${params}`
      )
      setSources(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [activeFilter, page])

  useEffect(() => { fetchSources() }, [fetchSources])

  async function handleVerify(id: string) {
    try {
      await apiClient.post(`/admin/sources/${id}/verify`)
      alert('已加入验证队列')
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该播放源？')) return
    try {
      await apiClient.delete(`/admin/sources/${id}`)
      fetchSources()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return
    if (!confirm(`确认批量删除 ${selected.size} 条播放源？`)) return
    try {
      await apiClient.post('/admin/sources/batch-delete', { ids: [...selected] })
      setSelected(new Set())
      fetchSources()
    } catch (err) {
      alert(err instanceof Error ? err.message : '批量删除失败')
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div data-testid="admin-source-list">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-[var(--border)] p-0.5">
          {(['all', 'true', 'false'] as ActiveFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setPage(1); setActiveFilter(f) }}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                activeFilter === f
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              data-testid={`admin-sources-filter-${f}`}
            >
              {{ all: '全部', true: '活跃', false: '失效' }[f]}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="rounded-md bg-red-900/50 px-3 py-1 text-sm text-red-300 hover:bg-red-900"
            data-testid="admin-sources-batch-delete"
          >
            批量删除 ({selected.size})
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === sources.length && sources.length > 0}
                  onChange={() => {
                    if (selected.size === sources.length) setSelected(new Set())
                    else setSelected(new Set(sources.map((s) => s.id)))
                  }}
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="px-4 py-3 text-left">视频</th>
              <th className="px-4 py-3 text-left">来源名</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">最后验证</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            {loading && (
              <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
            )}
            {!loading && sources.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">暂无数据</td></tr>
            )}
            {!loading && sources.map((src) => (
              <tr key={src.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-source-row-${src.id}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(src.id)}
                    onChange={() => toggleSelect(src.id)}
                    className="accent-[var(--accent)]"
                  />
                </td>
                <td className="max-w-48 truncate px-4 py-3 text-[var(--text)]">
                  {src.video_title ?? src.video_id}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{src.source_name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{src.type}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${src.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {src.is_active ? '活跃' : '失效'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted)] text-xs">
                  {src.last_checked ? new Date(src.last_checked).toLocaleDateString() : '从未'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(src.id)}
                      className="text-[var(--accent)] hover:underline text-xs"
                      data-testid={`admin-source-verify-${src.id}`}
                    >
                      验证
                    </button>
                    <button
                      onClick={() => handleDelete(src.id)}
                      className="text-red-400 hover:underline text-xs"
                      data-testid={`admin-source-delete-${src.id}`}
                    >
                      删除
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
