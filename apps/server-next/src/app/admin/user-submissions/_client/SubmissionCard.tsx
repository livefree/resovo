'use client'

/**
 * SubmissionCard.tsx — 单条投稿 Card 行组件（spec §5.13 / screens-3.jsx:436-450）
 *
 * 真源：ADR-124 + screens-3.jsx Card list 形态
 * 任务卡：CHG-SN-7-REDO-02-C
 *
 * 形态：card 14px padding + flex gap:14 align-items:center
 *   - 32px 状态 icon box（背景 var(--${ty}-soft) / 色 var(--${ty})）
 *   - 可选 poster 42x60（求片无 video → 不渲染）
 *   - title 13/600 + who/time 11/muted + quote block (bg-subtle italic)
 *   - 3 按钮：查看视频（次）/ 拒绝（次）/ 处理 primary
 *
 * type → ty/icon 派生：
 *   - bad_source → danger / AlertCircle
 *   - wish_list → info / Flag
 *   - metadata_correction → warn / Pencil
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, Flag, Pencil, Check, X, ExternalLink } from 'lucide-react'
import { AdminButton, AdminCard, useToast } from '@resovo/admin-ui'
import { processUserSubmission, rejectUserSubmission } from '@/lib/user-submissions/api'
import type { UserSubmissionRow, UserSubmissionType } from '@/lib/user-submissions/types'
import { ApiClientError } from '@/lib/api-client'

export interface SubmissionCardProps {
  readonly row: UserSubmissionRow
  /** 已处理 / 已拒绝 之后从列表移除 */
  readonly onProcessed: (id: string) => void
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '14px',
  alignItems: 'center',
}

const ICON_BOX_BASE: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '6px',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
}

const POSTER_STYLE: CSSProperties = {
  width: 42,
  height: 60,
  borderRadius: '4px',
  objectFit: 'cover',
  flexShrink: 0,
}

const CONTENT_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '2px',
}

const QUOTE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  marginTop: '6px',
  padding: '4px 8px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: '4px',
  fontStyle: 'italic',
  borderLeft: '2px solid var(--border-default)',
}

const ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexShrink: 0,
}

interface TypeVisual {
  readonly icon: ReactNode
  readonly bg: string
  readonly fg: string
  readonly titlePrefix: string
}

function visualForType(type: UserSubmissionType): TypeVisual {
  switch (type) {
    case 'bad_source':
      return {
        icon: <AlertCircle size={16} aria-hidden />,
        bg: 'var(--state-danger-bg, var(--state-error-bg))',
        fg: 'var(--state-danger-fg, var(--state-error-fg, var(--fg-danger)))',
        titlePrefix: '举报',
      }
    case 'wish_list':
      return {
        icon: <Flag size={16} aria-hidden />,
        bg: 'var(--state-info-bg, var(--accent-soft))',
        fg: 'var(--state-info-fg, var(--accent-default))',
        titlePrefix: '求片',
      }
    case 'metadata_correction':
      return {
        icon: <Pencil size={16} aria-hidden />,
        bg: 'var(--state-warning-bg)',
        fg: 'var(--state-warning-fg)',
        titlePrefix: '纠错',
      }
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay} 天前`
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'STATE_CONFLICT') return { title: '状态冲突', description: err.message }
    if (err.code === 'NOT_FOUND') return { title: '投稿不存在', description: err.message }
    if (err.code === 'FORBIDDEN') return { title: '禁止操作', description: err.message }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function SubmissionCard({ row, onProcessed }: SubmissionCardProps) {
  const toast = useToast()
  const [pending, setPending] = useState<'process' | 'reject' | null>(null)
  const visual = visualForType(row.type)

  const handleProcess = useCallback(async () => {
    setPending('process')
    try {
      await processUserSubmission(row.id)
      toast.push({ title: '已处理', description: row.id.slice(0, 8), level: 'success' })
      onProcessed(row.id)
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPending(null)
    }
  }, [row.id, toast, onProcessed])

  const handleReject = useCallback(async () => {
    const reason = window.prompt('请输入拒绝原因（1-200 字符）：')
    if (!reason || reason.trim().length === 0) return
    setPending('reject')
    try {
      await rejectUserSubmission(row.id, { reason: reason.trim() })
      toast.push({ title: '已拒绝', description: row.id.slice(0, 8), level: 'success' })
      onProcessed(row.id)
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPending(null)
    }
  }, [row.id, toast, onProcessed])

  const handleViewVideo = useCallback(() => {
    if (!row.videoId) return
    window.open(`/admin/videos/${row.videoId}`, '_blank', 'noopener,noreferrer')
  }, [row.videoId])

  const displayTitle = row.quote.startsWith(visual.titlePrefix)
    ? row.quote
    : `${visual.titlePrefix}：${row.quote}`

  return (
    <AdminCard
      surface="plain"
      padding="md"
      data-testid={`submission-card-${row.id}`}
      data-submission-type={row.type}
    >
      <div style={ROW_STYLE}>
        <div
          style={{ ...ICON_BOX_BASE, background: visual.bg, color: visual.fg }}
          data-submission-icon
          aria-hidden
        >
          {visual.icon}
        </div>

        {row.videoPosterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.videoPosterUrl}
            alt={row.videoTitle ?? ''}
            style={POSTER_STYLE}
            loading="lazy"
            data-submission-poster
          />
        )}

        <div style={CONTENT_STYLE}>
          <div style={TITLE_STYLE} data-submission-title>
            {displayTitle}
          </div>
          <div style={META_STYLE}>
            @{row.submittedByName ?? row.submittedBy.slice(0, 8)} · {formatRelativeTime(row.createdAt)}
            {row.videoTitle && ` · ${row.videoTitle}`}
          </div>
          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <div style={QUOTE_STYLE} data-submission-metadata>
              {row.type === 'metadata_correction' && row.metadata.field !== undefined
                ? `字段「${String(row.metadata.field)}」→ ${String(row.metadata.suggested_value ?? '')}`
                : Object.entries(row.metadata)
                    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                    .join(' · ')}
            </div>
          )}
        </div>

        <div style={ACTIONS_STYLE}>
          {row.videoId && (
            <AdminButton
              size="sm"
              variant="default"
              onClick={handleViewVideo}
              disabled={pending !== null}
              data-testid={`submission-view-${row.id}`}
            >
              <ExternalLink size={12} aria-hidden /> 查看视频
            </AdminButton>
          )}
          <AdminButton
            size="sm"
            variant="default"
            onClick={() => void handleReject()}
            loading={pending === 'reject'}
            disabled={pending !== null}
            data-testid={`submission-reject-${row.id}`}
          >
            <X size={12} aria-hidden /> 拒绝
          </AdminButton>
          <AdminButton
            size="sm"
            variant="primary"
            onClick={() => void handleProcess()}
            loading={pending === 'process'}
            disabled={pending !== null}
            data-testid={`submission-process-${row.id}`}
          >
            <Check size={12} aria-hidden /> 处理
          </AdminButton>
        </div>
      </div>
    </AdminCard>
  )
}
