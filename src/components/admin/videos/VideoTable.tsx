/**
 * VideoTable.tsx — 视频管理表格（Client Component）
 * CHG-27: DataTable + 复选框 + StatusBadge + 批量操作 + 单条操作
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'
import type { BadgeStatus } from '@/components/admin/StatusBadge'

const PAGE_SIZE = 20

interface VideoAdminRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: string
  year: number | null
  is_published: boolean
  source_count: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
}

function VideoRow({
  row,
  checked,
  onCheck,
  onRefresh,
}: {
  row: VideoAdminRow
  checked: boolean
  onCheck: (id: string, checked: boolean) => void
  onRefresh: () => void
}) {
  async function handlePublish(isPublished: boolean) {
    try {
      await apiClient.patch(`/admin/videos/${row.id}/publish`, { isPublished })
      onRefresh()
    } catch {
      // silent
    }
  }

  const statusBadge: BadgeStatus = row.is_published ? 'published' : 'pending'

  return (
    <tr
      className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
      style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
      data-testid={`video-row-${row.id}`}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(row.id, e.target.checked)}
          className="accent-[var(--accent)]"
          data-testid={`video-checkbox-${row.id}`}
        />
      </td>
      <td className="px-4 py-3">
        {row.cover_url ? (
          <Image
            src={row.cover_url}
            alt={row.title}
            width={40}
            height={56}
            className="rounded object-cover"
            sizes="40px"
          />
        ) : (
          <div className="h-14 w-10 rounded bg-[var(--bg3)]" />
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--text)]">{row.title}</p>
        {row.title_en && (
          <p className="text-xs text-[var(--muted)]">{row.title_en}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--muted)]">
        {TYPE_LABELS[row.type] ?? row.type}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--muted)]">{row.year ?? '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={statusBadge} />
      </td>
      <td className="px-4 py-3 text-sm text-[var(--muted)]">
        {parseInt(row.source_count ?? '0')}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Link
            href={`/admin/videos/${row.id}/edit`}
            className="rounded px-2 py-0.5 text-xs bg-[var(--bg3)] text-[var(--muted)] hover:text-[var(--text)]"
            data-testid={`video-edit-btn-${row.id}`}
          >
            编辑
          </Link>
          {row.is_published ? (
            <button
              onClick={() => handlePublish(false)}
              className="rounded px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/60"
              data-testid={`video-unpublish-btn-${row.id}`}
            >
              下架
            </button>
          ) : (
            <button
              onClick={() => handlePublish(true)}
              className="rounded px-2 py-0.5 text-xs bg-green-900/30 text-green-400 hover:bg-green-900/60"
              data-testid={`video-publish-btn-${row.id}`}
            >
              上架
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export function VideoTable() {
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? ''
  const status = searchParams.get('status') ?? ''

  const fetchVideos = useCallback(
    async (pageVal: number) => {
      setLoading(true)
      setSelectedIds([])
      try {
        const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE) })
        if (q) params.set('q', q)
        if (type) params.set('type', type)
        if (status) params.set('status', status)
        const res = await apiClient.get<{ data: VideoAdminRow[]; total: number }>(
          `/admin/videos?${params}`
        )
        setVideos(res.data)
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    [q, type, status]
  )

  useEffect(() => {
    setPage(1)
    fetchVideos(1)
  }, [q, type, status, fetchVideos])

  function handleCheck(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    )
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? videos.map((v) => v.id) : [])
  }

  const allSelected = videos.length > 0 && selectedIds.length === videos.length

  return (
    <div data-testid="video-table">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="accent-[var(--accent)]"
                  data-testid="video-select-all"
                />
              </th>
              <th className="px-4 py-3 text-left">封面</th>
              <th className="px-4 py-3 text-left">标题</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">年份</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">播放源</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  加载中…
                </td>
              </tr>
            )}
            {!loading && videos.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  暂无数据
                </td>
              </tr>
            )}
            {!loading &&
              videos.map((row) => (
                <VideoRow
                  key={row.id}
                  row={row}
                  checked={selectedIds.includes(row.id)}
                  onCheck={handleCheck}
                  onRefresh={() => fetchVideos(page)}
                />
              ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              setPage(p)
              fetchVideos(p)
            }}
          />
        </div>
      )}

      <BatchPublishBar
        selectedIds={selectedIds}
        onSuccess={() => fetchVideos(page)}
        onClear={() => setSelectedIds([])}
      />
    </div>
  )
}
