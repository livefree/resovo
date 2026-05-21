'use client'

/**
 * TabSimilar — 审核台 RightPane 类似视频 Tab（CHG-SN-8-04-VIEW / ADR-137 实装）
 *
 * 真源：ADR-137（GET /admin/moderation/:id/similar）+ W1 金票反例 #3 闭合
 *
 * 行为：
 *  - 切到此 Tab 时调 `listSimilarVideos(videoId, { limit: 10 })`
 *  - 渲染 top-N 列表（每行：标题 + meta + score badge + 「发起合并」xs btn）
 *  - 发起合并 → router.push(/admin/merge?candidate_a=<active>&candidate_b=<sim>&from=moderation)
 *  - 空结果显示 EmptyState；错误显示 ErrorState + 重试
 *
 * 历史：
 *  - CHG-SN-4-FIX-C 占位实装；CHG-SN-8-04-VIEW 2026-05-21 真实化
 */

import React, { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AdminButton, EmptyState, ErrorState, LoadingState } from '@resovo/admin-ui'
import { listSimilarVideos, type SimilarVideoItem } from '@/lib/moderation/api'

export interface TabSimilarProps {
  readonly videoId: string
}

const LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '4px',
}

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  gap: 8,
  alignItems: 'center',
  padding: '8px 10px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
}

const TITLE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
}

const TITLE_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const META_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const SCORE_PILL: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  fontWeight: 500,
  background: 'var(--state-info-bg, var(--state-info-soft))',
  color: 'var(--state-info-fg, var(--state-info))',
}

export function TabSimilar({ videoId }: TabSimilarProps): React.ReactElement {
  const router = useRouter()
  const [items, setItems] = useState<readonly SimilarVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSimilarVideos(videoId, { limit: 10 })
      .then((data) => {
        if (cancelled) return
        setItems(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('召回失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [videoId, retryKey])

  if (loading) {
    return (
      <div data-right-tab="similar">
        <LoadingState variant="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div data-right-tab="similar" data-testid="tab-similar-error">
        <ErrorState
          title="召回失败"
          error={error}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div data-right-tab="similar" data-testid="tab-similar-empty">
        <EmptyState
          title="未找到类似视频"
          description="该视频在同类型 / 年份范围内无相似召回；可考虑直接审核或检查元数据是否完整"
        />
      </div>
    )
  }

  return (
    <div style={LIST_STYLE} data-right-tab="similar" data-testid="tab-similar-list">
      {items.map((it) => (
        <div key={it.id} style={ROW_STYLE} data-testid={`tab-similar-row-${it.id}`}>
          <span style={TITLE_STYLE}>
            <span style={TITLE_TEXT}>{it.title}</span>
            <span style={META_STYLE}>
              {it.type} · {it.year ?? '—'} · {it.country ?? '—'}
            </span>
          </span>
          <span style={SCORE_PILL} title={`similarityScore = ${it.similarityScore}`}>
            {it.similarityScore}
          </span>
          <AdminButton
            size="sm"
            variant="default"
            onClick={() => {
              router.push(
                `/admin/merge?candidate_a=${encodeURIComponent(videoId)}&candidate_b=${encodeURIComponent(it.id)}&from=moderation`,
              )
            }}
            data-testid={`tab-similar-merge-${it.id}`}
          >
            发起合并
          </AdminButton>
        </div>
      ))}
    </div>
  )
}
