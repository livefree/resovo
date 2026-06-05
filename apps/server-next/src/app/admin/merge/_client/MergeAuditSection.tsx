'use client'

/**
 * MergeAuditSection.tsx — 合并/拆分审计时间线子组件（从 MergeClient 提取，CHG-SN-7-MISC-MERGE-2）
 *
 * CHG-VIR-13-C2（D-105-8 / §10.2 增强 #5）：
 *   - auto/manual 列（actorType：关联 decision 透出，无 decision 恒人工）
 *   - 行展开明细（videoTitlesSnapshot 前后形态 + 关联候选/裁定 + reason + reverted 信息）
 *   - 行内撤销（有效行展开区内 reason 输入 + 确认，复用 unmerge 端点）
 */

import { useState, useCallback, useEffect, Fragment, type CSSProperties } from 'react'
import {
  AdminButton,
  AdminInput,
  EmptyState,
  LoadingState,
  ErrorState,
  useToast,
} from '@resovo/admin-ui'
import type { MergeAuditRow } from '@resovo/types'
import { listAudit, unmergeVideos } from '@/lib/merge/api'
import { describeStatusTransition } from '@/lib/merge/status-defaults'
import { describeError } from './MergeClient'

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

const EXPAND_STYLE: CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-surface-elevated)',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  fontSize: 'var(--font-size-sm)',
}

const PAGE_SIZE = 20

/** 行明细：videoTitlesSnapshot 按 source/target 分组展示（D-105-8） */
function titlesFor(row: MergeAuditRow, ids: readonly string[]): string {
  const byId = new Map((row.videoTitlesSnapshot ?? []).map((v) => [v.videoId, v.title]))
  return ids.map((id) => byId.get(id) ?? id.slice(0, 8)).join('、')
}

export interface AuditSectionProps {
  initialAction?: 'merge' | 'split'
}

export function AuditSection({ initialAction }: AuditSectionProps) {
  const toast = useToast()
  const [actionFilter, setActionFilter] = useState<'all' | 'merge' | 'split'>(initialAction ?? 'all')
  const [rows, setRows] = useState<readonly MergeAuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  // CHG-VIR-13-C2：行展开 + 行内撤销 reason
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [revertReason, setRevertReason] = useState('')
  const [reverting, setReverting] = useState(false)

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

  // 行内撤销（§10.2 #5）：复用 unmerge 端点；UnmergeResult.statusTransition failed 提示（D-105-11）
  const handleRevert = useCallback(async (row: MergeAuditRow) => {
    if (!confirm(`确认撤销该${row.action === 'merge' ? '合并' : '拆分'}？\n\n源视频将还原，${row.action === 'merge' ? '播放源归还原视频' : '拆分新建的视频将软删除'}。`)) {
      return
    }
    setReverting(true)
    try {
      const result = await unmergeVideos(row.id, revertReason.trim() || undefined)
      const transitionNote = describeStatusTransition(result.statusTransition)
      if (transitionNote) {
        toast.push({ level: transitionNote.level, title: '状态未还原', description: transitionNote.text })
      }
      toast.push({ level: 'success', title: '已撤销', description: `还原 ${result.restoredVideoIds.length} 个视频` })
      setRevertReason('')
      setExpandedId(null)
      load()
    } catch (err) {
      toast.push({ level: 'danger', title: '撤销失败', description: describeError(err, 'merge') })
    } finally {
      setReverting(false)
    }
  }, [revertReason, toast, load])

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
              <th style={{ padding: '6px 8px', width: '70px' }}>操作</th>
              <th style={{ padding: '6px 8px', width: '60px' }}>来源</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>操作人</th>
              <th style={{ padding: '6px 8px' }}>涉及 video</th>
              <th style={{ padding: '6px 8px', width: '160px' }}>时间</th>
              <th style={{ padding: '6px 8px', width: '80px' }}>状态</th>
              <th style={{ padding: '6px 8px', width: '70px' }} aria-label="明细" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: row.action === 'merge' ? 'var(--state-info-fg)' : 'var(--state-warning-fg)' }}>
                    {row.action === 'merge' ? '合并' : '拆分'}
                  </td>
                  {/* CHG-VIR-13-C2 / D-105-8：actorType（auto-merge OFF 期恒 human / Y-105-T5） */}
                  <td style={{ padding: '6px 8px' }} data-testid={`audit-actor-${row.id}`}>
                    {row.actorType === 'system' ? '自动' : '人工'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{row.performedByUsername ?? row.performedBy.slice(0, 8)}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: '11px' }}>
                    {`${row.sourceVideoIds.length} → ${row.targetVideoIds.length}`}
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                    {row.performedAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {row.revertedAt
                      ? <span style={SCORE_BADGE_STYLE}>已撤销</span>
                      : <span style={SECONDARY_TEXT}>有效</span>}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <AdminButton
                      size="sm"
                      variant="default"
                      onClick={() => { setExpandedId((cur) => (cur === row.id ? null : row.id)); setRevertReason('') }}
                      data-testid={`audit-expand-${row.id}`}
                    >
                      {expandedId === row.id ? '收起' : '明细'}
                    </AdminButton>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: '4px 8px 10px' }}>
                      <div style={EXPAND_STYLE} data-testid={`audit-detail-${row.id}`}>
                        {/* D-105-8：前后明细（source 标题取 snapshot / target 实时） */}
                        <div>
                          <span style={SECONDARY_TEXT}>{row.action === 'merge' ? '合并前（已软删）：' : '拆分前（已软删）：'}</span>
                          {titlesFor(row, row.sourceVideoIds)}
                        </div>
                        <div>
                          <span style={SECONDARY_TEXT}>{row.action === 'merge' ? '合并到：' : '拆分为：'}</span>
                          {titlesFor(row, row.targetVideoIds)}
                        </div>
                        {row.reason && (
                          <div><span style={SECONDARY_TEXT}>原因：</span>{row.reason}</div>
                        )}
                        {(row.relatedCandidateIds?.length ?? 0) > 0 && (
                          <div style={SECONDARY_TEXT}>
                            关联候选 {row.relatedCandidateIds!.length} 个 / 裁定 {row.relatedDecisionIds?.length ?? 0} 条（identity 候选路径 confirm）
                          </div>
                        )}
                        {row.revertedAt ? (
                          <div style={SECONDARY_TEXT}>
                            已于 {row.revertedAt.slice(0, 19).replace('T', ' ')} 撤销
                            {row.revertedReason ? `：${row.revertedReason}` : ''}
                          </div>
                        ) : (
                          /* §10.2 #5：行内撤销（reason 输入 + 确认） */
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <AdminInput
                              size="sm"
                              placeholder="撤销原因（可选 / ≤ 500 字符）"
                              value={revertReason}
                              onChange={(e) => setRevertReason(e.target.value.slice(0, 500))}
                              style={{ flex: 1, maxWidth: 360 }}
                              data-testid={`audit-revert-reason-${row.id}`}
                            />
                            <AdminButton
                              size="sm"
                              variant="danger"
                              loading={reverting}
                              onClick={() => void handleRevert(row)}
                              data-testid={`audit-revert-${row.id}`}
                            >
                              撤销此操作
                            </AdminButton>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
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
