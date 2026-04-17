'use client'

/**
 * ModerationProvenanceBlock.tsx — 字段来源追踪展示块（META-09）
 * 展示 media_catalog 各字段的最后写入来源与锁状态
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 来源标签 ─────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual:  { label: '手动', color: 'var(--status-success)' },
  douban:  { label: '豆瓣', color: 'var(--accent)' },
  bangumi: { label: 'Bangumi', color: 'var(--status-info, var(--accent))' },
  tmdb:    { label: 'TMDB', color: 'var(--status-success)' },
  crawler: { label: '爬虫', color: 'var(--muted-foreground)' },
}

// ── 字段显示名 ────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  title: '标题', titleEn: '英文标题', titleOriginal: '原标题',
  description: '简介', coverUrl: '封面', rating: '评分',
  ratingVotes: '评分人数', runtimeMinutes: '片长',
  year: '年份', country: '地区', status: '状态',
  director: '导演', cast: '演员', writers: '编剧',
  genres: '类型', genresRaw: '原始类型', aliases: '别名',
  languages: '语言', tags: '标签',
  doubanId: '豆瓣 ID', tmdbId: 'TMDB ID', bangumiSubjectId: 'Bangumi ID',
}

// ── 类型 ─────────────────────────────────────────────────────────

interface ProvenanceRow {
  fieldName: string
  sourceKind: string
  sourceRef: string | null
  sourcePriority: number
  updatedAt: string
}

interface LockRow {
  fieldName: string
  lockMode: 'soft' | 'hard'
  lockedBy: string
  lockedAt: string
  reason: string | null
}

interface ProvenanceData {
  provenance: ProvenanceRow[]
  locks: LockRow[]
}

interface Props {
  videoId: string
}

// ── 组件 ─────────────────────────────────────────────────────────

export function ModerationProvenanceBlock({ videoId }: Props) {
  const [data, setData] = useState<ProvenanceData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<{ data: ProvenanceData }>(`/admin/moderation/${videoId}/metadata-provenance`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [videoId])

  if (loading) {
    return <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>加载中…</p>
  }

  if (!data || data.provenance.length === 0) {
    return (
      <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>
        暂无字段来源记录
      </p>
    )
  }

  const lockMap = new Map(data.locks.map((l) => [l.fieldName, l]))

  return (
    <div className="space-y-1">
      {data.provenance.map((row) => {
        const lock = lockMap.get(row.fieldName)
        const src = SOURCE_LABELS[row.sourceKind]
        return (
          <div key={row.fieldName} className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-xs w-28 shrink-0" style={{ color: 'var(--foreground)' }}>
              {FIELD_LABELS[row.fieldName] ?? row.fieldName}
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{
                  color: src?.color ?? 'var(--muted-foreground)',
                  background: 'color-mix(in srgb, currentColor 12%, transparent)',
                  border: `1px solid color-mix(in srgb, currentColor 30%, transparent)`,
                }}
              >
                {src?.label ?? row.sourceKind}
              </span>
              {row.sourceRef && (
                <span className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {row.sourceRef}
                </span>
              )}
            </div>
            {lock && (
              <span
                className="text-[10px] px-1 py-0.5 rounded shrink-0"
                style={{
                  color: lock.lockMode === 'hard' ? 'var(--status-error)' : 'var(--status-warning)',
                  background: lock.lockMode === 'hard'
                    ? 'color-mix(in srgb, var(--status-error) 12%, transparent)'
                    : 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
                }}
                title={lock.reason ?? (lock.lockMode === 'hard' ? '硬锁' : '软锁')}
              >
                {lock.lockMode === 'hard' ? '🔒 硬锁' : '🔓 软锁'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
