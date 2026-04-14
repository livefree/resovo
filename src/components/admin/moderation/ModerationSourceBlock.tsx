/**
 * ModerationSourceBlock.tsx — 审核台源健康折叠块（UX-11）
 * - snake_case 字段（GET /admin/sources 返回 DB 原始行）
 * - 按 source_name 汇总线路，每条线路内显示集数 chip 标签
 * - chip 颜色表示健康状态（绿/红），点击单条检验
 * - 检验后从已拉取源数据本地计算状态，无需等待父组件 refetch
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
}

interface ModerationSourceBlockProps {
  videoId: string
  sourceCheckStatus: SourceCheckStatus
}

function computeStatus(rows: SourceRow[]): SourceCheckStatus {
  if (rows.length === 0) return 'pending'
  const active = rows.filter((r) => r.is_active).length
  if (active === rows.length) return 'ok'
  if (active === 0) return 'all_dead'
  return 'partial'
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
  }))
}

const STATUS_LABEL: Record<SourceCheckStatus, string> = {
  ok: '全部可达', partial: '部分可达', all_dead: '全部失效', pending: '未检验',
}

export function ModerationSourceBlock({ videoId, sourceCheckStatus }: ModerationSourceBlockProps) {
  const [lines, setLines] = useState<LineGroup[]>([])
  const [allSources, setAllSources] = useState<SourceRow[]>([])
  const [computedStatus, setComputedStatus] = useState<SourceCheckStatus>(sourceCheckStatus)
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
      setAllSources(res.data)
      setLines(groupByLine(res.data))
      setComputedStatus(computeStatus(res.data))
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
        scope: 'video', videoId, activeOnly: false, limit: 100,
      })
      await fetchSources()
      setMsg('全部检验完成')
    } catch {
      setMsg('批量检验失败')
    } finally {
      setVerifyingAll(false)
    }
  }

  return (
    <div className="space-y-2" data-testid="source-block">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted)]">
          检验状态：{STATUS_LABEL[computedStatus]}
          {allSources.length > 0 && ` (${allSources.filter(s => s.is_active).length}/${allSources.length})`}
        </span>
        <button
          type="button"
          disabled={verifyingAll || allSources.length === 0}
          onClick={() => void handleVerifyAll()}
          data-testid="source-verify-all-btn"
          className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-[var(--bg3)] disabled:opacity-50"
        >
          {verifyingAll ? '检验中…' : '全部检验'}
        </button>
      </div>

      {msg && <p className="text-[10px] text-[var(--muted)]" data-testid="source-msg">{msg}</p>}

      {loading ? (
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-10 animate-pulse rounded bg-[var(--bg3)]" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">暂无播放源</p>
      ) : (
        <div className="space-y-2">
          {lines.map((group) => (
            <div key={group.name}>
              {lines.length > 1 && (
                <p className="mb-1 text-[10px] text-[var(--muted)]">{group.name}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {group.sources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    disabled={verifying === src.id || verifyingAll}
                    onClick={() => void handleVerifyOne(src.id)}
                    title={`上次检验：${src.last_checked ? src.last_checked.slice(0, 16).replace('T', ' ') : '未检验'}`}
                    data-testid={`source-verify-btn-${src.id}`}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      verifying === src.id
                        ? 'bg-[var(--bg3)] text-[var(--muted)] opacity-70'
                        : src.is_active
                          ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                    }`}
                  >
                    {verifying === src.id
                      ? '…'
                      : `${src.is_active ? '●' : '✕'} E${src.episode_number ?? '?'}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
