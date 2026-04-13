/**
 * ModerationSourceBlock.tsx — 审核台源健康折叠块（UX-11）
 * 展示视频所有播放源的活跃状态 + 单条/全部检验按钮
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { SourceCheckStatus } from '@/types'

interface SourceRow {
  id: string
  sourceUrl: string
  sourceName: string
  isActive: boolean
  lastChecked: string | null
}

interface ModerationSourceBlockProps {
  videoId: string
  sourceCheckStatus: SourceCheckStatus
}

function formatChecked(iso: string | null): string {
  if (!iso) return '未检验'
  return iso.slice(0, 16).replace('T', ' ')
}

export function ModerationSourceBlock({ videoId, sourceCheckStatus }: ModerationSourceBlockProps) {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SourceRow[]; total: number }>(
        `/admin/sources?videoId=${videoId}&status=all&page=1&limit=100`
      )
      setSources(res.data)
    } catch {
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  async function handleVerifyOne(sourceId: string) {
    setVerifying(sourceId)
    setMsg(null)
    try {
      await apiClient.post(`/admin/sources/${sourceId}/verify`, {})
      await fetchSources()
      setMsg('检验完成')
    } catch {
      setMsg('检验失败')
    } finally {
      setVerifying(null)
    }
  }

  async function handleVerifyAll() {
    setVerifyingAll(true)
    setMsg(null)
    try {
      await apiClient.post('/admin/sources/batch-verify', {
        scope: 'video',
        videoId,
        activeOnly: false,
        limit: 100,
      })
      await fetchSources()
      setMsg('全部检验完成')
    } catch {
      setMsg('批量检验失败')
    } finally {
      setVerifyingAll(false)
    }
  }

  const statusLabel: Record<SourceCheckStatus, string> = {
    ok: '全部可达',
    partial: '部分可达',
    all_dead: '全部失效',
    pending: '未检验',
  }

  return (
    <div className="space-y-2" data-testid="source-block">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted)]">检验状态：{statusLabel[sourceCheckStatus]}</span>
        <button
          type="button"
          disabled={verifyingAll || sources.length === 0}
          onClick={() => void handleVerifyAll()}
          data-testid="source-verify-all-btn"
          className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--bg3)] disabled:opacity-50"
        >
          {verifyingAll ? '检验中…' : '全部检验'}
        </button>
      </div>
      {msg && <p className="text-[10px] text-[var(--muted)]" data-testid="source-msg">{msg}</p>}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-[var(--bg3)]" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">暂无播放源</p>
      ) : (
        <ul className="space-y-1">
          {sources.map((src) => (
            <li key={src.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-2 py-1">
              <span
                className={`shrink-0 text-[10px] ${src.isActive ? 'text-[var(--success,#22c55e)]' : 'text-[var(--error,#ef4444)]'}`}
                data-testid={`source-active-${src.id}`}
              >
                {src.isActive ? '●' : '✕'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-[var(--muted)]">{src.sourceName || '默认线路'}</p>
                <p className="truncate text-[10px] text-[var(--muted)]">{formatChecked(src.lastChecked)}</p>
              </div>
              <button
                type="button"
                disabled={verifying === src.id}
                onClick={() => void handleVerifyOne(src.id)}
                data-testid={`source-verify-btn-${src.id}`}
                className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--bg3)] disabled:opacity-50"
              >
                {verifying === src.id ? '…' : '检验'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
