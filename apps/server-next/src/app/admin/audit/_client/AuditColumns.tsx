import {
  UserRef,
  CodeText,
  IdRef,
  MutedText,
  type DistinctOption,
  type TableColumn,
} from '@resovo/admin-ui'
import type { AdminAuditLogListRow } from '@resovo/types'
import { resolveRollbackTarget } from '@/lib/audit/rollback-routes'

export interface AuditColumnsOptions {
  /** CHG-SN-8-GAPS-AUDIT-ROLLBACK：行尾回滚 handler — 由消费方注入（router.push / toast 反馈） */
  readonly onRollback?: (row: AdminAuditLogListRow) => void
  /**
   * sub 2（2026-05-24）：ADR-150 D-150-1 列固有自动过滤
   * 消费方注入 enums 静态选项（来自 GET /admin/audit/enums）→ actionType / targetKind 列 filterOptions
   */
  readonly actionTypeOptions?: readonly DistinctOption[]
  readonly targetKindOptions?: readonly DistinctOption[]
  /**
   * sub 2：moderator self-scope 隐藏 actor 列过滤（ADR-142 D-142-4）
   * true → actor 列不加 filterable / 用户能查的是自己 / filter 无意义
   */
  readonly hideActorFilter?: boolean
}

// CHG-SN-6-RETRO-3-C / ultrareview P2-6：4 cell 沉淀到 admin-ui，AuditClient 消费切换
// CHG-SN-8-GAPS-AUDIT-ROLLBACK：新增 actions 列 + 回滚按钮（消费层补齐）
// sub 2（2026-05-24）：ADR-150 D-150-1 双轨 — 5 列加 filterable（createdAt date + actor text +
//   actionType enum + target text + requestId text）
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
      // sub 2：date kind / 精度从 datetime 降为日（业务上 audit 按日过滤足够 / UX 视觉一致优先）
      filterable: true,
      filterFieldName: 'createdAt',
      filterKind: 'date',
      // sub 2 EXTEND（2026-05-24）：sort 全栈打通 / createdAt 列可点击升降序 / 后端 ORDER BY 白名单
      enableSorting: true,
      cell: ({ row }) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
      // 时间格式化保留视图层（locale 是视图 concern，不下沉 admin-ui）
    },
    // sub 2：actor 列分两版本显式返回（D-150-5 union 守卫 / 条件 spread 触发类型推断 true|undefined）
    options.hideActorFilter
      ? {
          id: 'actor',
          header: '操作人',
          accessor: (r) => r.actorUsername ?? r.actorId,
          width: 160,
          defaultVisible: true,
          cell: ({ row }) => (
            <UserRef id={row.actorId} username={row.actorUsername} deletedFallback="(已删除)" />
          ),
        }
      : {
          id: 'actor',
          header: '操作人',
          accessor: (r) => r.actorUsername ?? r.actorId,
          width: 160,
          defaultVisible: true,
          // sub 2：actorId UUID 前缀匹配（moderator self-scope 模式隐藏 / ADR-142 D-142-4）
          filterable: true,
          filterFieldName: 'actorId',
          filterKind: 'text',
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
      // sub 2：enum / filterOptions 来自 GET /admin/audit/enums 静态注入（不走 distinct 端点）
      filterable: true,
      filterFieldName: 'actionType',
      filterKind: 'enum',
      filterOptions: options.actionTypeOptions ?? [],
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
      // sub 2：target 列代表 targetKind enum filter（targetId 走 detail Drawer / 不分独立列）
      filterable: true,
      filterFieldName: 'targetKind',
      filterKind: 'enum',
      filterOptions: options.targetKindOptions ?? [],
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
      // sub 2：requestId text 前缀匹配
      filterable: true,
      filterFieldName: 'requestId',
      filterKind: 'text',
      cell: ({ row }) => (
        <CodeText value={row.requestId} muted dataAttr={{ 'data-request-id': row.requestId ?? '' }} />
      ),
    },
    {
      id: 'actions',
      kind: 'action',
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
