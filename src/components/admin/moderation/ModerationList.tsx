/**
 * ModerationList.tsx — 审核台左侧待审列表面板（CHG-222）
 * 调用 GET /admin/videos/pending-review，展示紧凑视频列表
 * 点击条目触发 onSelect 回调，选中态高亮显示
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { TableImageCell } from '@/components/admin/shared/modern-table/cells'

interface PendingVideoRow {
  id: string
  shortId: string
  title: string
  type: string
  coverUrl: string | null
  year: number | null
  siteKey: string | null
  siteName: string | null
  firstSourceUrl: string | null
  createdAt: string
}

interface ModerationListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

const PAGE_SIZE = 30

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'movie': return '电影'
    case 'tv': return '剧集'
    case 'anime': return '动漫'
    default: return type
  }
}

export function ModerationList({ selectedId, onSelect }: ModerationListProps) {
  const [rows, setRows] = useState<PendingVideoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchRows = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE) })
      const res = await apiClient.get<{ rows: PendingVideoRow[]; total: number }>(
        `/admin/videos/pending-review?${params}`
      )
      setRows(res.rows)
      setTotal(res.total)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRows(page) }, [fetchRows, page])

  const hasMore = page * PAGE_SIZE < total
  const hasPrev = page > 1

  return (
    <div className="flex h-full flex-col" data-testid="moderation-list">
      {/* 列表头 */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <p className="text-sm font-medium text-[var(--text)]">
          待审核列表
          {total > 0 && (
            <span className="ml-2 text-xs text-[var(--muted)]">共 {total} 条</span>
          )}
        </p>
      </div>

      {/* 列表内容 */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="moderation-list-scroll">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-14 animate-pulse gap-2 rounded-md bg-[var(--bg3)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-[var(--muted)]">暂无待审核视频</p>
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  data-testid={`moderation-list-item-${row.id}`}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    selectedId === row.id
                      ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/40'
                      : 'hover:bg-[var(--bg3)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 封面缩略图 */}
                    <div className="mt-0.5 shrink-0">
                      <TableImageCell src={row.coverUrl} alt={row.title} width={32} height={48} />
                    </div>
                    {/* 文字信息 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--text)]">{row.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span>{getTypeLabel(row.type)}</span>
                        {row.year && <span>· {row.year}</span>}
                        {row.siteName && <span>· {row.siteName}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{formatDate(row.createdAt)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 分页控制 */}
      {(hasPrev || hasMore) && (
        <div className="shrink-0 flex justify-between border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
            data-testid="moderation-list-prev"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            上一页
          </button>
          <span className="self-center text-xs text-[var(--muted)]">第 {page} 页</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            data-testid="moderation-list-next"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
