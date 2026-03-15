/**
 * AdminVideoList.tsx — 后台视频列表组件
 * ADMIN-02: 状态筛选 + 单条/批量上下架
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

// ── 类型 ──────────────────────────────────────────────────────────

interface AdminVideoRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  type: string
  year: number | null
  is_published: boolean
  source_count: number
  created_at: string
}

type StatusFilter = 'all' | 'pending' | 'published' | 'unpublished'

// ── 辅助 ──────────────────────────────────────────────────────────

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isPublished
          ? 'bg-green-900/30 text-green-400'
          : 'bg-yellow-900/30 text-yellow-400'
      }`}
    >
      {isPublished ? '已上架' : '待审/已下架'}
    </span>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AdminVideoList() {
  const [videos, setVideos] = useState<AdminVideoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = 20

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('q', search)
      const res = await apiClient.get<{
        data: AdminVideoRow[]
        total: number
      }>(`/admin/videos?${params}`)
      setVideos(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, search])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  async function handlePublish(id: string, isPublished: boolean) {
    try {
      await apiClient.patch(`/admin/videos/${id}/publish`, { isPublished })
      fetchVideos()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleBatchPublish(isPublished: boolean) {
    if (selected.size === 0) return
    try {
      await apiClient.post('/admin/videos/batch-publish', {
        ids: [...selected],
        isPublished,
      })
      setSelected(new Set())
      fetchVideos()
    } catch (err) {
      alert(err instanceof Error ? err.message : '批量操作失败')
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

  function toggleAll() {
    if (selected.size === videos.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(videos.map((v) => v.id)))
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div data-testid="admin-video-list">
      {/* ── 筛选栏 ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-[var(--border)] p-0.5">
          {(['all', 'pending', 'published', 'unpublished'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => { setPage(1); setStatusFilter(s) }}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              data-testid={`admin-videos-filter-${s}`}
            >
              {{ all: '全部', pending: '待审', published: '已上架', unpublished: '已下架' }[s]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜索标题…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="admin-videos-search"
        />
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleBatchPublish(true)}
              className="rounded-md bg-green-800 px-3 py-1 text-sm text-green-200 hover:bg-green-700"
              data-testid="admin-videos-batch-publish"
            >
              批量上架 ({selected.size})
            </button>
            <button
              onClick={() => handleBatchPublish(false)}
              className="rounded-md bg-[var(--bg3)] px-3 py-1 text-sm text-[var(--muted)] hover:text-[var(--text)]"
              data-testid="admin-videos-batch-unpublish"
            >
              批量下架 ({selected.size})
            </button>
          </div>
        )}
      </div>

      {/* ── 错误提示 ────────────────────────────────────────────── */}
      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* ── 表格 ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === videos.length && videos.length > 0}
                  onChange={toggleAll}
                  data-testid="admin-videos-select-all"
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="px-4 py-3 text-left">标题</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">年份</th>
              <th className="px-4 py-3 text-left">播放源</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            {loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
                  加载中…
                </td>
              </tr>
            )}
            {!loading && videos.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
                  暂无数据
                </td>
              </tr>
            )}
            {!loading &&
              videos.map((video) => (
                <tr
                  key={video.id}
                  className="bg-[var(--bg)] hover:bg-[var(--bg2)] transition-colors"
                  data-testid={`admin-video-row-${video.id}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(video.id)}
                      onChange={() => toggleSelect(video.id)}
                      className="accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text)]">{video.title}</div>
                    {video.title_en && (
                      <div className="text-xs text-[var(--muted)]">{video.title_en}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{video.type}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{video.year ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{video.source_count}</td>
                  <td className="px-4 py-3">
                    <StatusBadge isPublished={video.is_published} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/videos/${video.id}/edit`}
                        className="text-[var(--accent)] hover:underline"
                        data-testid={`admin-video-edit-${video.id}`}
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handlePublish(video.id, !video.is_published)}
                        className="text-[var(--muted)] hover:text-[var(--text)]"
                        data-testid={`admin-video-toggle-${video.id}`}
                      >
                        {video.is_published ? '下架' : '上架'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── 分页 ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40"
            >
              上一页
            </button>
            <span className="px-2 py-1">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
