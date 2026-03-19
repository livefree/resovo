/**
 * CacheManager.tsx — 缓存管理面板（Client Component）
 * CHG-30: 展示各类型缓存统计，支持逐类清除和全部清除（二次确认）
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import type { CacheStat, CacheType } from '@/api/services/CacheService'

const TYPE_LABELS: Record<string, string> = {
  search: '搜索缓存',
  video: '视频详情缓存',
  danmaku: '弹幕缓存',
  analytics: '统计缓存',
}

export function CacheManager() {
  const [stats, setStats] = useState<CacheStat[]>([])
  const [loading, setLoading] = useState(false)
  const [clearingType, setClearingType] = useState<CacheType | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<CacheType | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getCacheStats()
      setStats(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleClear(type: CacheType) {
    setClearingType(type)
    try {
      const res = await apiClient.clearCache(type)
      showToast(`已清除 ${res.data.deleted} 个缓存 key`)
      fetchStats()
    } catch {
      showToast('清除失败，请稍后重试')
    } finally {
      setClearingType(null)
      setConfirmTarget(null)
    }
  }

  return (
    <div data-testid="cache-manager">
      {toast && (
        <div
          className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          data-testid="cache-toast"
        >
          {toast}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">缓存类型</th>
              <th className="px-4 py-3 text-left">Key 数量</th>
              <th className="px-4 py-3 text-left">估算大小</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[var(--muted)]">
                  加载中…
                </td>
              </tr>
            )}
            {!loading && stats.map((row) => (
              <tr
                key={row.type}
                className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`cache-row-${row.type}`}
              >
                <td className="px-4 py-3 font-medium text-[var(--text)]">
                  {TYPE_LABELS[row.type] ?? row.type}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]" data-testid={`cache-count-${row.type}`}>
                  {row.count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {row.sizeKb < 1 ? '< 1 KB' : `${row.sizeKb.toLocaleString()} KB`}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setConfirmTarget(row.type)}
                    disabled={clearingType !== null || row.count === 0}
                    className="rounded px-2 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-40"
                    data-testid={`cache-clear-btn-${row.type}`}
                  >
                    {clearingType === row.type ? '清除中…' : '清除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setConfirmTarget('all')}
          disabled={clearingType !== null}
          className="rounded-md px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
          data-testid="cache-clear-all-btn"
        >
          清除全部缓存
        </button>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget === 'all' ? '清除全部缓存' : `清除${TYPE_LABELS[confirmTarget ?? ''] ?? ''}` }
        description={
          confirmTarget === 'all'
            ? '将清除所有业务缓存（搜索、视频、弹幕、统计），不影响 Bull 队列和登录状态。此操作不可撤销。'
            : `确认清除"${TYPE_LABELS[confirmTarget ?? ''] ?? confirmTarget}"的全部缓存 key？`
        }
        confirmText="确认清除"
        onConfirm={() => { if (confirmTarget) handleClear(confirmTarget) }}
        loading={clearingType !== null}
        danger
      />
    </div>
  )
}
