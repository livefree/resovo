/**
 * ModerationSourceBlock.tsx — 审核台源健康折叠块（UX-11）
 * P2 fix: /admin/sources 返回 DB 原始行（snake_case）
 * 按 source_name 汇总成线路卡片，每张可展开查看集数详情
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { SourceCheckStatus } from '@/types'

// snake_case — 与 GET /admin/sources 返回的 DB 原始行保持一致
interface SourceRow {
  id: string
  source_url: string
  source_name: string | null
  is_active: boolean
  last_checked: string | null
  episode_number?: number | null
}

interface LineGroup {
  name: string
  sources: SourceRow[]
  activeCount: number
}

interface ModerationSourceBlockProps {
  videoId: string
  sourceCheckStatus: SourceCheckStatus
}

function formatChecked(iso: string | null): string {
  if (!iso) return '未检验'
  return iso.slice(0, 16).replace('T', ' ')
}

function groupByLine(rows: SourceRow[]): LineGroup[] {
  const map = new Map<string, SourceRow[]>()
  for (const row of rows) {
    const key = row.source_name?.trim() || '默认线路'
    const list = map.get(key)
    if (list) { list.push(row) } else { map.set(key, [row]) }
  }
  return Array.from(map.entries()).map(([name, sources]) => ({
    name,
    sources: sources.slice().sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0)),
    activeCount: sources.filter((s) => s.is_active).length,
  }))
}

function LineCard({ group, onVerifyOne, verifying }: {
  group: LineGroup
  onVerifyOne: (id: string) => void
  verifying: string | null
}) {
  const [open, setOpen] = useState(false)
  const total = group.sources.length
  const active = group.activeCount

  return (
    <div className="rounded border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left"
      >
        <span className="truncate text-[10px] text-[var(--text)]">{group.name}</span>
        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <span className={`text-[10px] ${active === total ? 'text-[var(--success,#22c55e)]' : active === 0 ? 'text-[var(--error,#ef4444)]' : 'text-[var(--warning,#f59e0b)]'}`}>
            {active}/{total}
          </span>
          <span className="text-[10px] text-[var(--muted)]">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <ul className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {group.sources.map((src) => (
            <li key={src.id} className="flex items-center gap-2 px-2 py-1">
              <span
                className={`shrink-0 text-[10px] ${src.is_active ? 'text-[var(--success,#22c55e)]' : 'text-[var(--error,#ef4444)]'}`}
                data-testid={`source-active-${src.id}`}
              >
                {src.is_active ? '●' : '✕'}
              </span>
              <div className="min-w-0 flex-1">
                {src.episode_number != null && (
                  <p className="text-[10px] text-[var(--muted)]">E{src.episode_number}</p>
                )}
                <p className="text-[10px] text-[var(--muted)]">{formatChecked(src.last_checked)}</p>
              </div>
              <button
                type="button"
                disabled={verifying === src.id}
                onClick={() => onVerifyOne(src.id)}
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

export function ModerationSourceBlock({ videoId, sourceCheckStatus }: ModerationSourceBlockProps) {
  const [lines, setLines] = useState<LineGroup[]>([])
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
      setLines(groupByLine(res.data))
    } catch {
      setLines([])
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
    ok: '全部可达', partial: '部分可达', all_dead: '全部失效', pending: '未检验',
  }

  const totalSources = lines.reduce((n, g) => n + g.sources.length, 0)

  return (
    <div className="space-y-2" data-testid="source-block">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted)]">检验状态：{statusLabel[sourceCheckStatus]}</span>
        <button
          type="button"
          disabled={verifyingAll || totalSources === 0}
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
      ) : lines.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">暂无播放源</p>
      ) : (
        <div className="space-y-1">
          {lines.map((group) => (
            <LineCard
              key={group.name}
              group={group}
              onVerifyOne={(id) => void handleVerifyOne(id)}
              verifying={verifying}
            />
          ))}
        </div>
      )}
    </div>
  )
}
