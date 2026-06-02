'use client'

/**
 * VideoBatchActions.tsx — 视频库批量操作（CHG-VSR-PRE-1 从 VideoListClient 抽出，零行为变化）
 *
 * Step 7B：从外置 SelectionActionBar 切到 DataTable.bulkActions ReactNode 直传。
 * 保留 SelectionAction 类型 + confirm 流（pendingConfirm 状态机），inline 渲染 4 个
 * 批量按钮，不抽 admin-ui（多消费方需求出现时再考虑沉淀，CHG-DESIGN-12 评估）。
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { batchPublish, batchUnpublish, reviewVideo } from '@/lib/videos/api'

const BATCH_PUBLISH_LIMIT = 100
const BATCH_DANGER_LIMIT = 50

export interface BatchAction {
  readonly key: string
  readonly label: string
  readonly variant?: 'danger'
  readonly disabled: boolean
  readonly confirm?: { readonly title: string; readonly description?: string }
  readonly onConfirm: () => Promise<unknown>
}

export function buildBatchActions(
  selectedKeys: ReadonlySet<string>,
): readonly BatchAction[] {
  const ids = Array.from(selectedKeys)
  const count = ids.length
  return [
    {
      key: 'batch-publish',
      label: '批量公开',
      disabled: count === 0 || count > BATCH_PUBLISH_LIMIT,
      onConfirm: () => batchPublish(ids),
    },
    {
      key: 'batch-unpublish',
      label: '批量隐藏',
      variant: 'danger',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认隐藏 ${count} 条视频？`, description: '已上架视频将同步下架' },
      onConfirm: () => batchUnpublish(ids),
    },
    {
      key: 'batch-approve',
      label: '批量通过审核',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      onConfirm: () => Promise.all(ids.map((id) => reviewVideo(id, 'approve'))),
    },
    {
      key: 'batch-reject',
      label: '批量拒绝审核',
      variant: 'danger',
      disabled: count === 0 || count > BATCH_DANGER_LIMIT,
      confirm: { title: `确认拒绝 ${count} 条视频审核？` },
      onConfirm: () => Promise.all(ids.map((id) => reviewVideo(id, 'reject'))),
    },
  ]
}

const BATCH_BTN_BASE_STYLE: CSSProperties = {
  height: 'var(--row-h-compact, 24px)',
  padding: '0 var(--button-padding-x)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const BATCH_BTN_DANGER_STYLE: CSSProperties = {
  ...BATCH_BTN_BASE_STYLE,
  borderColor: 'var(--state-error-border)',
  color: 'var(--state-error-fg)',
}
const BATCH_CONFIRM_WRAP_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  fontSize: 'var(--font-size-xs)',
}

interface BatchActionsRowProps {
  readonly actions: readonly BatchAction[]
  readonly onActionResolved: () => void
}

export function BatchActionsRow({ actions, onActionResolved }: BatchActionsRowProps) {
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)
  const handleClick = (action: BatchAction) => {
    if (action.disabled) return
    if (action.confirm) {
      setPendingConfirm(action.key)
      return
    }
    void action.onConfirm().then(onActionResolved)
  }
  const handleConfirmOk = (action: BatchAction) => {
    setPendingConfirm(null)
    void action.onConfirm().then(onActionResolved)
  }
  return (
    <>
      {actions.map((action) => {
        if (pendingConfirm === action.key && action.confirm) {
          return (
            <span key={action.key} style={BATCH_CONFIRM_WRAP_STYLE} data-confirm-prompt={action.key}>
              <span>{action.confirm.title}</span>
              <button
                type="button"
                style={{ ...BATCH_BTN_BASE_STYLE, borderColor: 'var(--accent-default)', color: 'var(--admin-accent-on-soft)' }}
                onClick={() => handleConfirmOk(action)}
              >确认</button>
              <button
                type="button"
                style={{ ...BATCH_BTN_BASE_STYLE, color: 'var(--fg-muted)' }}
                onClick={() => setPendingConfirm(null)}
              >取消</button>
            </span>
          )
        }
        return (
          <button
            key={action.key}
            type="button"
            style={action.variant === 'danger' ? BATCH_BTN_DANGER_STYLE : BATCH_BTN_BASE_STYLE}
            disabled={action.disabled}
            onClick={() => handleClick(action)}
            data-action-key={action.key}
          >
            {action.label}
          </button>
        )
      })}
    </>
  )
}
