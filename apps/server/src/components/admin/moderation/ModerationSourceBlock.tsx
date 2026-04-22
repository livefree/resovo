/**
 * ModerationSourceBlock.tsx — 审核台源健康折叠块（UX-11 / ADMIN-16）
 * - snake_case 字段（GET /admin/sources 返回 DB 原始行）
 * - 按 source_name 汇总线路，每条线路内显示集数 chip 标签
 * - chip 颜色表示健康状态（绿/红），点击单条检验
 * - 检验后从已拉取源数据本地计算状态，无需等待父组件 refetch
 * - ADMIN-16: sources 数据由父组件统一拉取并下发，避免源健康 (limit=100)
 *   与播放器预览 (全量分页) 出现分页口径分叉
 */

'use client'

import { useCallback, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { SourceCheckStatus } from '@/types'

// snake_case — 与 GET /admin/sources 返回的 DB 原始行保持一致
interface SourceRow {
  id: string
  source_url: string
  source_name: string | null
  site_key?: string | null
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
  /** ADMIN-16: 由父组件统一拉取的全量源数据，与播放器预览共用同一份 */
  sources: SourceRow[]
  /** ADMIN-16: 单条/批量检验成功后通知父组件 refetch 全量，保持两区块同步 */
  onRefetch: () => Promise<void> | void
}

function computeStatus(rows: SourceRow[]): SourceCheckStatus {
  if (rows.length === 0) return 'pending'
  const active = rows.filter((r) => r.is_active).length
  if (active === rows.length) return 'ok'
  if (active === 0) return 'all_dead'
  return 'partial'
}

function groupByLine(rows: SourceRow[]): LineGroup[] {
  // ADMIN-15/16: 分组 key 与 ModerationDetail 保持一致（source_name + site_key）
  const map = new Map<string, { name: string; sources: SourceRow[] }>()
  for (const row of rows) {
    const name = row.source_name?.trim() || '默认线路'
    const siteKey = row.site_key?.trim() || 'unknown'
    const id = `${name}::${siteKey}`
    const existing = map.get(id)
    if (existing) { existing.sources.push(row) } else { map.set(id, { name, sources: [row] }) }
  }
  return Array.from(map.values()).map(({ name, sources }) => ({
    name,
    sources: sources.slice().sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0)),
  }))
}

const STATUS_LABEL: Record<SourceCheckStatus, string> = {
  ok: '全部可达', partial: '部分可达', all_dead: '全部失效', pending: '未检验',
}

export function ModerationSourceBlock({
  videoId,
  sourceCheckStatus,
  sources,
  onRefetch,
}: ModerationSourceBlockProps) {
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const lines = groupByLine(sources)
  const computedStatus = sources.length === 0 ? sourceCheckStatus : computeStatus(sources)
  const allSources = sources

  const refetch = useCallback(async () => {
    await onRefetch()
  }, [onRefetch])

  async function handleVerifyOne(sourceId: string) {
    setVerifying(sourceId)
    setMsg(null)
    try {
      await apiClient.post(`/admin/sources/${sourceId}/verify`, {})
      await refetch()
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
      await refetch()
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

      {lines.length === 0 ? (
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
