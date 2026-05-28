'use client'

/**
 * BatchMergeWorkspace.tsx — CHG-364-B MERGE-INLINE -B
 *
 * 范围：审核台批量栏 "↔ 合并" 按钮跳 /admin/merge?ids=<csv> 后的工作区。
 * 列 ids 让运营选 1 个作为 target，其他作为 sources，提交 mergeVideos（ADR-105）。
 *
 * 最简化 UX：仅展示 uuid 短码 + 完整 uuid，运营从审核台来本来就知道 id 对应内容。
 * 丰富信息（title/cover）等留 follow-up（依赖后端 listVideos by-ids 端点扩展）。
 */

import { useState, useCallback, type CSSProperties } from 'react'
import { AdminCard, AdminButton, AdminInput, useToast } from '@resovo/admin-ui'
import { mergeVideos, unmergeVideos } from '@/lib/merge/api'
import { describeError } from './MergeClient'

interface BatchMergeWorkspaceProps {
  readonly ids: readonly string[]
  /** 用户解除入口横幅 / 清 URL query */
  readonly onMergeSuccess?: () => void
}

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-row)',
}

const ID_CODE: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '11px',
  color: 'var(--fg-default)',
}

const ID_TAIL: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

export function BatchMergeWorkspace({ ids, onMergeSuccess }: BatchMergeWorkspaceProps) {
  // dedup + 至少 2 条才有合并语义（ADR-105 sourceVideoIds + targetVideoId）
  const uniqueIds = Array.from(new Set(ids))
  const validIds = uniqueIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  const [targetId, setTargetId] = useState<string | null>(validIds[0] ?? null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const handleMerge = useCallback(async () => {
    if (!targetId) return
    const sourceVideoIds = validIds.filter((id) => id !== targetId)
    if (sourceVideoIds.length === 0) {
      toast.push({ level: 'warn', title: '需至少 1 个 source', description: '请选不同于 target 的 N-1 个视频作为 source' })
      return
    }
    setSubmitting(true)
    try {
      const result = await mergeVideos({
        sourceVideoIds,
        targetVideoId: targetId,
        reason: reason.trim() || undefined,
      })
      toast.push({
        level: 'success',
        title: '合并成功',
        description: `已将 ${sourceVideoIds.length} 个 source 合并到 target（auditId: ${result.auditId.slice(0, 8)}）`,
        action: {
          label: '撤销',
          onClick: () => {
            unmergeVideos(result.auditId, '用户撤销合并')
              .then(() => toast.push({ level: 'success', title: '已撤销合并' }))
              .catch((err: unknown) => {
                toast.push({
                  level: 'danger',
                  title: '撤销失败',
                  description: err instanceof Error ? err.message : '未知错误',
                })
              })
          },
        },
      })
      onMergeSuccess?.()
    } catch (err) {
      toast.push({ level: 'danger', title: '合并失败', description: describeError(err, 'merge') })
    } finally {
      setSubmitting(false)
    }
  }, [targetId, validIds, reason, toast, onMergeSuccess])

  if (validIds.length < 2) {
    return (
      <AdminCard surface="subtle" status="warn" style={{ padding: '12px 16px' }} data-testid="batch-merge-empty">
        <span style={{ fontSize: 'var(--font-size-sm)' }}>
          批量合并需至少 2 个有效 uuid（当前去重 + 校验后：{validIds.length} 个）
        </span>
      </AdminCard>
    )
  }

  return (
    <AdminCard style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="batch-merge-workspace">
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
        批量合并工作区（{validIds.length} 个视频）
      </div>
      <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
        请选择 1 个视频作为 <strong>合并目标 (target)</strong>，其余 {validIds.length - 1} 个将作为 source 合入 target；可填合并原因（≤ 500 字符）。
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {validIds.map((id) => (
          <label key={id} style={ROW} data-testid={`batch-merge-row-${id}`}>
            <input
              type="radio"
              name="batch-merge-target"
              value={id}
              checked={targetId === id}
              onChange={() => setTargetId(id)}
              data-testid={`batch-merge-radio-${id}`}
            />
            <code style={ID_CODE}>{id.slice(0, 8)}</code>
            <code style={ID_TAIL}>{id.slice(8)}</code>
            {targetId === id && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--state-success-fg)' }}>
                ★ target
              </span>
            )}
          </label>
        ))}
      </div>

      <AdminInput
        size="sm"
        placeholder="合并原因（可选 / ≤ 500 字符）"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        data-testid="batch-merge-reason"
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <AdminButton
          size="sm"
          variant="primary"
          onClick={handleMerge}
          disabled={!targetId || submitting}
          data-testid="batch-merge-submit"
        >
          {submitting ? '合并中…' : `执行合并（${validIds.length - 1} → target）`}
        </AdminButton>
      </div>
    </AdminCard>
  )
}
