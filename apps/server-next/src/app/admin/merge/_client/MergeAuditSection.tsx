'use client'

/**
 * MergeAuditSection.tsx — 合并/拆分审计时间线子组件（从 MergeClient 提取，CHG-SN-7-MISC-MERGE-2）
 */

import { useState, useCallback, useEffect, type CSSProperties } from 'react'
import {
  AdminButton,
  EmptyState,
  LoadingState,
  ErrorState,
} from '@resovo/admin-ui'
import type { MergeAuditRow } from '@resovo/types'
import { listAudit } from '@/lib/merge/api'

const SCORE_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const PAGE_SIZE = 20

export interface AuditSectionProps {
  initialAction?: 'merge' | 'split'
}

export function AuditSection({ initialAction }: AuditSectionProps) {
  const [actionFilter, setActionFilter] = useState<'all' | 'merge' | 'split'>(initialAction ?? 'all')
  const [rows, setRows] = useState<readonly MergeAuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listAudit({
      action: actionFilter === 'all' ? undefined : actionFilter,
      limit: PAGE_SIZE,
      page,
    })
      .then((res) => {
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [actionFilter, page])

  useEffect(() => { load() }, [load])

  if (loading && rows.length === 0) return <LoadingState variant="skeleton" skeletonRows={6} />
  if (error) return <ErrorState error={error} onRetry={load} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={SECONDARY_TEXT}>过滤：</span>
        {(['all', 'merge', 'split'] as const).map((a) => (
          <AdminButton
            key={a}
            size="sm"
            variant={actionFilter === a ? 'primary' : 'secondary'}
            onClick={() => { setActionFilter(a); setPage(1) }}
          >
            {a === 'all' ? '全部' : a === 'merge' ? '合并' : '拆分'}
          </AdminButton>
        ))}
        <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>共 {total} 条</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="无审计记录" description="当前过滤无匹配；切换过滤或清空数据库后无 merge/split 操作。" />
      ) : (
        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '6px 8px', width: '80px' }}>操作</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>操作人</th>
              <th style={{ padding: '6px 8px' }}>涉及 video</th>
              <th style={{ padding: '6px 8px', width: '160px' }}>时间</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: row.action === 'merge' ? 'var(--state-info-fg)' : 'var(--state-warning-fg)' }}>
                  {row.action === 'merge' ? '合并' : '拆分'}
                </td>
                <td style={{ padding: '6px 8px' }}>{row.performedByUsername ?? row.performedBy.slice(0, 8)}</td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: '11px' }}>
                  {row.action === 'merge'
                    ? `${row.sourceVideoIds.length} → ${row.targetVideoIds.length}`
                    : `${row.sourceVideoIds.length} → ${row.targetVideoIds.length}（拆分）`}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                  {row.performedAt.slice(0, 19).replace('T', ' ')}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {row.revertedAt
                    ? <span style={SCORE_BADGE_STYLE}>已撤销</span>
                    : <span style={SECONDARY_TEXT}>有效</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={SECONDARY_TEXT}>第 {page} / {Math.ceil(total / PAGE_SIZE)} 页</span>
          <AdminButton size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</AdminButton>
          <AdminButton size="sm" variant="secondary" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>下一页</AdminButton>
        </div>
      )}
    </div>
  )
}
