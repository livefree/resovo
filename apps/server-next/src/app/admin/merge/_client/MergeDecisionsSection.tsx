'use client'

/**
 * MergeDecisionsSection.tsx — identity 裁定记录子视图（CHG-VIR-13-C2 / ADR-179 D-179-1 消费）
 *
 * records mode 第二子视图：confirmed/rejected/reverted 可查 + pair 摘要（软删标注）
 * + rejected 未撤销行「复活候选」（POST revive / D-179-2/3，reused 幂等提示）。
 */

import { useState, useCallback, useEffect, type CSSProperties } from 'react'
import {
  AdminButton,
  EmptyState,
  LoadingState,
  ErrorState,
  useToast,
} from '@resovo/admin-ui'
import type { IdentityDecisionListRow } from '@resovo/types'
import { listIdentityDecisions, reviveIdentityCandidate } from '@/lib/identity/api'
import { describeError } from './MergeClient'
import { MERGE_M } from '@/i18n/messages/zh-CN/merge'

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const DECISION_BADGE: Record<'confirmed' | 'rejected', CSSProperties> = {
  confirmed: {
    display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
    background: 'var(--state-success-bg)', color: 'var(--state-success-fg)', border: '1px solid var(--state-success-border)',
  },
  rejected: {
    display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
    background: 'var(--state-danger-bg)', color: 'var(--state-danger-fg)', border: '1px solid var(--state-danger-border)',
  },
}

const PAGE_SIZE = 20

type DecisionFilter = 'all' | 'confirmed' | 'rejected'

function pairLabel(row: IdentityDecisionListRow): string {
  const left = `${row.leftVideoTitle ?? row.leftVideoId.slice(0, 8)}${row.leftVideoDeleted ? MERGE_M.records.deletedSuffix : ''}`
  const right = `${row.rightVideoTitle ?? row.rightVideoId.slice(0, 8)}${row.rightVideoDeleted ? MERGE_M.records.deletedSuffix : ''}`
  return `${left} ↔ ${right}`
}

export function DecisionsSection() {
  const toast = useToast()
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all')
  const [rows, setRows] = useState<readonly IdentityDecisionListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const [reviving, setReviving] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listIdentityDecisions({
      decision: decisionFilter === 'all' ? undefined : decisionFilter,
      limit: PAGE_SIZE,
      page,
    })
      .then((res) => {
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [decisionFilter, page])

  useEffect(() => { load() }, [load])

  // ADR-179 D-179-2/3：rejected 未撤销 → 人工复活（reused 幂等提示）
  const handleRevive = useCallback(async (row: IdentityDecisionListRow) => {
    if (!confirm(`确认复活候选「${pairLabel(row)}」？\n\n将新建待裁定候选（原拒绝记录标记为已推翻）。`)) return
    setReviving(row.candidateId)
    try {
      const result = await reviveIdentityCandidate(row.candidateId, '决策记录人工复活')
      toast.push({
        level: 'success',
        title: result.reused ? '该 pair 已有待裁定候选' : '已复活候选',
        description: result.reused
          ? '离线评分已先一步重建候选，可直接在待审候选裁定'
          : '已新建待裁定候选，可在待审候选中重新裁定',
      })
      load()
    } catch (err) {
      toast.push({ level: 'danger', title: '复活失败', description: describeError(err, 'merge') })
    } finally {
      setReviving(null)
    }
  }, [toast, load])

  if (loading && rows.length === 0) return <LoadingState variant="skeleton" skeletonRows={6} />
  if (error) return <ErrorState error={error} onRetry={load} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="merge-decisions-section">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={SECONDARY_TEXT}>裁定：</span>
        {(['all', 'confirmed', 'rejected'] as const).map((d) => (
          <AdminButton
            key={d}
            size="sm"
            variant={decisionFilter === d ? 'primary' : 'secondary'}
            onClick={() => { setDecisionFilter(d); setPage(1) }}
          >
            {d === 'all' ? '全部' : d === 'confirmed' ? '已确认' : '已拒绝'}
          </AdminButton>
        ))}
        <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>共 {total} 条</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="无裁定记录" description="尚无 identity 候选的人工/系统裁定。" />
      ) : (
        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '6px 8px', width: '80px' }}>裁定</th>
              <th style={{ padding: '6px 8px', width: '60px' }}>来源</th>
              <th style={{ padding: '6px 8px' }}>候选 pair</th>
              <th style={{ padding: '6px 8px', width: '70px' }}>身份分</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>操作人</th>
              <th style={{ padding: '6px 8px', width: '150px' }}>时间</th>
              <th style={{ padding: '6px 8px', width: '90px' }}>状态</th>
              <th style={{ padding: '6px 8px', width: '90px' }} aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canRevive = row.decision === 'rejected' && row.revertedAt === null
                && !row.leftVideoDeleted && !row.rightVideoDeleted
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} data-testid={`decision-row-${row.id}`}>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={DECISION_BADGE[row.decision]}>{row.decision === 'confirmed' ? MERGE_M.records.decisionConfirmed : MERGE_M.records.decisionRejected}</span>
                  </td>
                  <td style={{ padding: '6px 8px' }}>{row.actorType === 'system' ? MERGE_M.records.actorSystem : MERGE_M.records.actorHuman}</td>
                  <td style={{ padding: '6px 8px' }} title={row.reason ?? undefined}>
                    {pairLabel(row)}
                    {row.reason && <span style={{ ...SECONDARY_TEXT, marginLeft: 6 }}>（{row.reason}）</span>}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{(row.identityScore * 100).toFixed(1)}%</td>
                  <td style={{ padding: '6px 8px' }}>{row.performedByUsername ?? row.performedBy.slice(0, 8)}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                    {row.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {row.revertedAt
                      ? <span style={SECONDARY_TEXT} title={row.revertedReason ?? undefined}>{MERGE_M.records.decisionReverted}</span>
                      : <span style={SECONDARY_TEXT}>{MERGE_M.records.statusActive}</span>}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {canRevive && (
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        loading={reviving === row.candidateId}
                        onClick={() => void handleRevive(row)}
                        data-testid={`decision-revive-${row.id}`}
                      >
                        复活候选
                      </AdminButton>
                    )}
                  </td>
                </tr>
              )
            })}
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
