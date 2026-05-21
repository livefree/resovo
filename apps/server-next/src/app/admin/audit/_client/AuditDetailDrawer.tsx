import { type CSSProperties } from 'react'
import {
  Drawer,
  EmptyState,
  LoadingState,
} from '@resovo/admin-ui'
import type { AdminAuditLogDetail } from '@resovo/types'

const DETAIL_SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
}

const DETAIL_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const DETAIL_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  wordBreak: 'break-all',
}

const JSONB_BLOCK_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px',
  maxHeight: '300px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  margin: 0,
}

export interface DetailDrawerProps {
  readonly open: boolean
  readonly detail: AdminAuditLogDetail | null
  readonly loading: boolean
  readonly onClose: () => void
}

export function DetailDrawer({ open, detail, loading, onClose }: DetailDrawerProps) {
  return (
    <Drawer
      open={open}
      placement="right"
      width={560}
      onClose={onClose}
      title={detail ? `审计详情 #${detail.id}` : '审计详情'}
      data-testid="audit-detail-drawer"
    >
      {loading ? (
        <LoadingState variant="spinner" />
      ) : !detail ? (
        <EmptyState title="无数据" description="审计行已被删除或不存在" />
      ) : (
        <div style={DETAIL_SECTION_STYLE} data-testid="audit-detail-content">
          <div>
            <div style={DETAIL_LABEL_STYLE}>操作类型</div>
            <div style={DETAIL_VALUE_STYLE}>{detail.actionType}</div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>操作人</div>
            <div style={DETAIL_VALUE_STYLE}>
              {detail.actorUsername ?? '(已删除)'} · <code>{detail.actorId}</code>
            </div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>目标</div>
            <div style={DETAIL_VALUE_STYLE}>
              {detail.targetKind}
              {detail.targetId ? ` · ${detail.targetId}` : ' · (批量操作)'}
            </div>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>时间</div>
            <div style={DETAIL_VALUE_STYLE}>
              {new Date(detail.createdAt).toLocaleString('zh-CN', { hour12: false })}
            </div>
          </div>
          {detail.requestId ? (
            <div>
              <div style={DETAIL_LABEL_STYLE}>Request ID</div>
              <div style={DETAIL_VALUE_STYLE}>{detail.requestId}</div>
            </div>
          ) : null}
          {detail.ipHash ? (
            <div>
              <div style={DETAIL_LABEL_STYLE}>IP Hash</div>
              <div style={DETAIL_VALUE_STYLE}>{detail.ipHash}</div>
            </div>
          ) : null}
          <div>
            <div style={DETAIL_LABEL_STYLE}>变更前 (before_jsonb)</div>
            <pre style={JSONB_BLOCK_STYLE} data-testid="audit-before-jsonb">
              {detail.beforeJsonb ? JSON.stringify(detail.beforeJsonb, null, 2) : '—'}
            </pre>
          </div>
          <div>
            <div style={DETAIL_LABEL_STYLE}>变更后 (after_jsonb)</div>
            <pre style={JSONB_BLOCK_STYLE} data-testid="audit-after-jsonb">
              {detail.afterJsonb ? JSON.stringify(detail.afterJsonb, null, 2) : '—'}
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  )
}
