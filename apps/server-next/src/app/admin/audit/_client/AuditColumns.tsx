import {
  UserRef,
  CodeText,
  IdRef,
  MutedText,
  type TableColumn,
} from '@resovo/admin-ui'
import type { AdminAuditLogListRow } from '@resovo/types'

// CHG-SN-6-RETRO-3-C / ultrareview P2-6：4 cell 沉淀到 admin-ui，AuditClient 消费切换
export function buildAuditColumns(): readonly TableColumn<AdminAuditLogListRow>[] {
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
  ]
}
