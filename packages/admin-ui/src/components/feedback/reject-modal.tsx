'use client'

/**
 * reject-modal.tsx — RejectModal 共享组件实装（CHG-SN-4-04 D-14 第 3 件）
 *
 * 真源：reject-modal.types.ts（arch-reviewer Opus 2 轮 PASS 契约）
 *
 * 实装契约（契约一致性硬约束）：
 *   - 包壳 admin-ui Modal 原语（默认 size='md'）；继承 focus trap / Esc 关闭
 *   - 标签 radio group：消费方传入已过滤排序的 labels
 *   - reason textarea：默认 maxLength=500（plan §3.1）；可由 reasonMaxLength 覆盖
 *   - onSubmit 返回 Promise；本组件不自动关闭，由消费方调用 onClose
 *   - submitting 受控 disable
 *   - 提交守门：未选标签 → submit disable；overLimit → submit disable
 *   - 不下沉 i18n：title / reasonPlaceholder / submitLabel / cancelLabel slot
 *
 * 固定 data attribute：
 *   - data-reject-modal-form 挂在 body 表单容器
 *   - data-reject-modal-label-{key} 每个 label radio
 *   - data-reject-modal-reason 挂在 textarea
 *   - data-reject-modal-submit / data-reject-modal-cancel 按钮
 *   - testId 透传到 Modal data-testid
 */
import React, { useEffect, useState } from 'react'
import { Modal } from '../overlay'
import type { RejectModalProps } from './reject-modal.types'

const DEFAULT_TITLE = '拒绝该视频'
const DEFAULT_REASON_PLACEHOLDER = '附加说明（可选，最长 500 字）'
const DEFAULT_SUBMIT_LABEL = '确认拒绝'
const DEFAULT_CANCEL_LABEL = '取消'
const DEFAULT_REASON_MAX_LENGTH = 500

const FORM_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px',
}

const LABELS_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const LABEL_OPTION_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 10px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--fg-default)',
  background: 'var(--bg-surface)',
}

const LABEL_OPTION_SELECTED_STYLE: React.CSSProperties = {
  ...LABEL_OPTION_STYLE,
  borderColor: 'var(--accent-default)',
  background: 'var(--admin-accent-soft)',
}

const TEXTAREA_WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: '88px',
  padding: '8px 10px',
  fontSize: '13px',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  color: 'var(--fg-default)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const CHAR_COUNT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  alignSelf: 'flex-end',
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 20px',
  borderTop: '1px solid var(--border-subtle)',
}

const BUTTON_BASE_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  border: '1px solid transparent',
}

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  background: 'var(--state-error-fg)',
  color: 'var(--state-error-bg)',
  borderColor: 'var(--state-error-fg)',
}

const GHOST_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  background: 'transparent',
  color: 'var(--fg-default)',
  borderColor: 'var(--border-subtle)',
}

export function RejectModal({
  open,
  onClose,
  labels,
  defaultLabelKey,
  onSubmit,
  submitting,
  title,
  reasonPlaceholder,
  submitLabel,
  cancelLabel,
  reasonMaxLength,
  testId,
}: RejectModalProps): React.ReactElement {
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultLabelKey ?? null)
  const [reason, setReason] = useState('')

  // open 切换为 true 时重置表单状态（避免上次 stale）
  useEffect(() => {
    if (open) {
      setSelectedKey(defaultLabelKey ?? null)
      setReason('')
    }
  }, [open, defaultLabelKey])

  const maxLength = reasonMaxLength ?? DEFAULT_REASON_MAX_LENGTH
  const trimmedReason = reason.trim()
  const overLimit = reason.length > maxLength
  const canSubmit = !!selectedKey && !submitting && !overLimit

  const handleSubmit = (): void => {
    if (!canSubmit || !selectedKey) return
    void onSubmit({
      labelKey: selectedKey,
      reason: trimmedReason === '' ? undefined : trimmedReason,
    })
  }

  return (
    <Modal
      open={open}
      size="md"
      onClose={onClose}
      title={title ?? DEFAULT_TITLE}
      data-testid={testId}
    >
      <div style={FORM_STYLE} data-reject-modal-form role="group">
        <div style={LABELS_GROUP_STYLE} role="radiogroup" aria-label="拒绝原因">
          {labels.map((label) => {
            const isSelected = selectedKey === label.labelKey
            return (
              <label
                key={label.labelKey}
                data-reject-modal-label={label.labelKey}
                data-reject-modal-label-selected={isSelected ? 'true' : undefined}
                style={isSelected ? LABEL_OPTION_SELECTED_STYLE : LABEL_OPTION_STYLE}
              >
                <input
                  type="radio"
                  name="reject-label"
                  value={label.labelKey}
                  checked={isSelected}
                  onChange={() => setSelectedKey(label.labelKey)}
                  disabled={submitting}
                />
                <span>{label.label}</span>
              </label>
            )
          })}
        </div>

        <div style={TEXTAREA_WRAP_STYLE}>
          <textarea
            data-reject-modal-reason
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder ?? DEFAULT_REASON_PLACEHOLDER}
            maxLength={maxLength}
            disabled={submitting}
            style={TEXTAREA_STYLE}
          />
          <span data-reject-modal-charcount style={CHAR_COUNT_STYLE}>
            {reason.length} / {maxLength}
          </span>
        </div>
      </div>

      <div style={FOOTER_STYLE}>
        <button
          type="button"
          data-reject-modal-cancel
          onClick={onClose}
          disabled={submitting}
          style={GHOST_BUTTON_STYLE}
        >
          {cancelLabel ?? DEFAULT_CANCEL_LABEL}
        </button>
        <button
          type="button"
          data-reject-modal-submit
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={PRIMARY_BUTTON_STYLE}
        >
          {submitLabel ?? DEFAULT_SUBMIT_LABEL}
        </button>
      </div>
    </Modal>
  )
}
