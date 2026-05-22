import {
  UserRef,
  CodeText,
  IdRef,
  MutedText,
  type TableColumn,
} from '@resovo/admin-ui'
import type { AdminAuditLogListRow } from '@resovo/types'
import { resolveRollbackTarget } from '@/lib/audit/rollback-routes'

export interface AuditColumnsOptions {
  /** CHG-SN-8-GAPS-AUDIT-ROLLBACK：行尾回滚 handler — 由消费方注入（router.push / toast 反馈） */
  readonly onRollback?: (row: AdminAuditLogListRow) => void
}

// CHG-SN-6-RETRO-3-C / ultrareview P2-6：4 cell 沉淀到 admin-ui，AuditClient 消费切换
// CHG-SN-8-GAPS-AUDIT-ROLLBACK：新增 actions 列 + 回滚按钮（消费层补齐）
export function buildAuditColumns(
  options: AuditColumnsOptions = {},
): readonly TableColumn<AdminAuditLogListRow>[] {
  return [
    {
      id: 'createdAt',
      header: '时间',
      accessor: (r) => r.createdAt,
      width: 180,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
      // 时间格式化保留视图层（locale 是视图 concern，不下沉 admin-ui）
    },
    {
      id: 'actor',
      header: '操作人',
      accessor: (r) => r.actorUsername ?? r.actorId,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => (
        <UserRef id={row.actorId} username={row.actorUsername} deletedFallback="(已删除)" />
      ),
    },
    {
      id: 'actionType',
      header: '操作类型',
      accessor: (r) => r.actionType,
      width: 200,
      defaultVisible: true,
      cell: ({ row }) => (
        <CodeText value={row.actionType} dataAttr={{ 'data-action-type': row.actionType }} />
      ),
    },
    {
      id: 'target',
      header: '目标',
      accessor: (r) => `${r.targetKind}:${r.targetId ?? ''}`,
      width: 220,
      defaultVisible: true,
      cell: ({ row }) => (
        <IdRef kind={row.targetKind} id={row.targetId} batchFallback="批量" />
      ),
    },
    {
      id: 'payloadSummary',
      header: '摘要',
      accessor: (r) => r.payloadSummary,
      minWidth: 240,
      defaultVisible: true,
      cell: ({ row }) => (
        <MutedText value={row.payloadSummary} dataAttr={{ 'data-payload-summary': '' }} />
      ),
    },
    {
      id: 'requestId',
      header: 'Request ID',
      accessor: (r) => r.requestId,
      width: 160,
      defaultVisible: true,
      cell: ({ row }) => (
        <CodeText value={row.requestId} muted dataAttr={{ 'data-request-id': row.requestId ?? '' }} />
      ),
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => '',
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => {
        const target = resolveRollbackTarget(row)
        const disabled = target.href == null
        return (
          <button
            type="button"
            disabled={disabled}
            onClick={(ev) => {
              ev.stopPropagation() // 不触发 onRowClick 抽屉
              options.onRollback?.(row)
            }}
            data-audit-action="rollback"
            data-action-type={row.actionType}
            data-disabled={disabled ? 'true' : 'false'}
            title={disabled ? target.disabledReason : `跳转：${target.label}`}
            style={{
              padding: '2px 8px',
              fontSize: 'var(--font-size-xxs)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: disabled ? 'var(--bg-disabled)' : 'var(--bg-surface)',
              color: disabled ? 'var(--fg-muted)' : 'var(--state-error-fg)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {target.label}
          </button>
        )
      },
    },
  ]
}
