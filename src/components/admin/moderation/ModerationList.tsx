/**
 * ModerationList.tsx — 审核台左侧待审列表面板（CHG-222）
 * 调用 GET /admin/videos/pending-review，展示紧凑视频列表
 * 点击条目触发 onSelect 回调，选中态高亮显示
 * CHG-341: 增加类型筛选、排序（最新/最早）；修正 tv→series 映射
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

// 全量类型枚举（与 VideoMetaSchema 保持一致）
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'news', label: '新闻' },
  { value: 'kids', label: '少儿' },
  { value: 'other', label: '其他' },
]

function getTypeLabel(type: string): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

export function ModerationList({ selectedId, onSelect }: ModerationListProps) {
  const [rows, setRows] = useState<PendingVideoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const fetchRows = useCallback(async (pageVal: number, type: string, dir: 'asc' | 'desc') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE), sortDir: dir })
      if (type) params.set('type', type)
      const res = await apiClient.get<{ data: PendingVideoRow[]; total: number }>(
        `/admin/videos/pending-review?${params}`
      )
      setRows(res.data)
      setTotal(res.total)
    } catch (_err) {
      // fetch failed: list remains empty, loading ends
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRows(page, typeFilter, sortDir) }, [fetchRows, page, typeFilter, sortDir])

  function handleTypeChange(newType: string) {
    setTypeFilter(newType)
    setPage(1)
  }

  function handleSortDir(newDir: 'asc' | 'desc') {
    setSortDir(newDir)
    setPage(1)
  }

  const hasMore = page * PAGE_SIZE < total
  const hasPrev = page > 1

  return (
    <div className="flex h-full flex-col" data-testid="moderation-list">
      {/* 列表头 + 筛选 */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text)]">
            待审核列表
            {total > 0 && (
              <span className="ml-2 text-xs text-[var(--muted)]">共 {total} 条</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 类型筛选 */}
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            data-testid="moderation-list-type-filter"
            className="flex-1 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* 排序切换 */}
          <div className="flex rounded border border-[var(--border)] overflow-hidden shrink-0">
            <button
              type="button"
              data-testid="moderation-list-sort-desc"
              onClick={() => handleSortDir('desc')}
              className={`px-2 py-1 text-xs transition-colors ${sortDir === 'desc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
            >
              最新
            </button>
            <button
              type="button"
              data-testid="moderation-list-sort-asc"
              onClick={() => handleSortDir('asc')}
              className={`px-2 py-1 text-xs transition-colors ${sortDir === 'asc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
            >
              最早
            </button>
          </div>
        </div>
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
