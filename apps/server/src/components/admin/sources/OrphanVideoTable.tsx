/**
 * OrphanVideoTable.tsx — 孤岛视频列表（ADMIN-12）
 * 展示 source_health_events 最新记录为 auto_refetch_failed 且未被标记已处理的视频
 * 操作：[触发补源] [标记已处理] [进入暂存队列]
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'

// ── 类型 ──────────────────────────────────────────────────────────

interface OrphanRow {
  id: string
  title: string
  siteKey: string | null
  sourceCheckStatus: string
  lastEventOrigin: string
  lastEventAt: string
}

// ── 工具 ──────────────────────────────────────────────────────────

function formatDt(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

// ── 组件 ──────────────────────────────────────────────────────────

export function OrphanVideoTable() {
  const router = useRouter()
  const [rows, setRows] = useState<OrphanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refetchingIds, setRefetchingIds] = useState<string[]>([])
  const [resolvingIds, setResolvingIds] = useState<string[]>([])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: OrphanRow[]; total: number }>('/admin/sources/orphan-videos')
      setRows(res.data)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '加载孤岛视频失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRows() }, [fetchRows])

  async function handleRefetch(id: string) {
    setRefetchingIds((prev) => [...prev, id])
    try {
      await apiClient.post(`/admin/videos/${id}/refetch-sources`, {})
      notify.success('补源采集已触发')
      void fetchRows()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '触发补源失败')
    } finally {
      setRefetchingIds((prev) => prev.filter((x) => x !== id))
    }
  }

  async function handleResolve(id: string) {
    setResolvingIds((prev) => [...prev, id])
    try {
      await apiClient.post(`/admin/sources/orphan-videos/${id}/resolve`, {})
      notify.success('已标记为已处理')
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '标记失败')
    } finally {
      setResolvingIds((prev) => prev.filter((x) => x !== id))
    }
  }

  function handleGoToStaging(id: string) {
    router.push(`/admin/staging?videoId=${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]" data-testid="orphan-table-loading">
        加载中…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]" data-testid="orphan-table-empty">
        暂无孤岛视频
      </div>
    )
  }

  return (
    <div data-testid="orphan-video-table">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          共 <strong className="text-[var(--text)]">{rows.length}</strong> 条补源失败视频需处理
        </p>
        <button
          type="button"
          onClick={() => void fetchRows()}
          className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
        >
          刷新
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg2)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--muted)]">视频标题</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--muted)]">站点</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--muted)]">源状态</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--muted)]">最后事件</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--muted)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid={`orphan-row-${row.id}`}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg2)]"
              >
                <td className="max-w-[240px] px-4 py-3">
                  <p className="truncate text-sm text-[var(--text)]" title={row.title}>{row.title}</p>
                  <p className="text-xs text-[var(--muted)]">{row.id.slice(0, 8)}…</p>
                </td>
                <td className="px-3 py-3 text-xs text-[var(--muted)]">{row.siteKey ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                    {row.sourceCheckStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-[var(--muted)]">{formatDt(row.lastEventAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRefetch(row.id)}
                      disabled={refetchingIds.includes(row.id)}
                      data-testid={`orphan-refetch-${row.id}`}
                      className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-40"
                    >
                      {refetchingIds.includes(row.id) ? '触发中…' : '触发补源'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGoToStaging(row.id)}
                      data-testid={`orphan-staging-${row.id}`}
                      className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]"
                    >
                      进入暂存
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResolve(row.id)}
                      disabled={resolvingIds.includes(row.id)}
                      data-testid={`orphan-resolve-${row.id}`}
                      className="rounded border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300 hover:bg-orange-500/20 disabled:opacity-40"
                    >
                      {resolvingIds.includes(row.id) ? '处理中…' : '标记已处理'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
