import type { CSSProperties } from 'react'
import type { TableColumn } from '@resovo/admin-ui'
import type { AdminNotificationItem } from '@resovo/types'

// level → 文案 / state slot（颜色走 CSS 变量 --state-{slot}-*，零硬编码）
const LEVEL_LABEL: Record<AdminNotificationItem['level'], string> = {
  info: '信息',
  warn: '警告',
  danger: '严重',
}
const LEVEL_SLOT: Record<AdminNotificationItem['level'], 'info' | 'warning' | 'error'> = {
  info: 'info',
  warn: 'warning',
  danger: 'error',
}

/**
 * broadcast/role 已读判定（D-192-AMD-4 单一已读源）：list 行恒 read=false，
 * 客户端据 readAt 高水位线计算——createdAt <= readAt 视为已读。
 */
export function computeRead(row: AdminNotificationItem, readAt: string | null): boolean {
  if (readAt == null) return false
  return new Date(row.createdAt).getTime() <= new Date(readAt).getTime()
}

const BADGE_STYLE = (slot: 'info' | 'warning' | 'error'): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  background: `var(--state-${slot}-bg)`,
  color: `var(--state-${slot}-fg)`,
  border: `1px solid var(--state-${slot}-border)`,
})

const READ_DOT_STYLE = (read: boolean): CSSProperties => ({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: 'var(--radius-full)',
  background: read ? 'var(--border-subtle)' : 'var(--accent-default)',
})

const BODY_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

export function buildMessageColumns(
  readAt: string | null,
): readonly TableColumn<AdminNotificationItem>[] {
  return [
    {
      id: 'read',
      header: '状态',
      accessor: (r) => (computeRead(r, readAt) ? '已读' : '未读'),
      cell: ({ row }) => {
        const read = computeRead(row, readAt)
        return (
          <span
            data-message-read={read ? 'true' : 'false'}
            style={READ_DOT_STYLE(read)}
            title={read ? '已读' : '未读'}
            aria-label={read ? '已读' : '未读'}
          />
        )
      },
    },
    {
      id: 'level',
      header: '级别',
      accessor: (r) => r.level,
      cell: ({ row }) => (
        <span data-message-level={row.level} style={BADGE_STYLE(LEVEL_SLOT[row.level])}>
          {LEVEL_LABEL[row.level]}
        </span>
      ),
    },
    {
      id: 'title',
      header: '标题',
      accessor: (r) => r.title,
    },
    {
      id: 'body',
      header: '内容',
      accessor: (r) => r.body ?? '',
      cell: ({ row }) => (row.body ? <span style={BODY_STYLE}>{row.body}</span> : null),
    },
    {
      id: 'createdAt',
      header: '时间',
      accessor: (r) => r.createdAt,
      cell: ({ row }) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
    },
  ]
}
