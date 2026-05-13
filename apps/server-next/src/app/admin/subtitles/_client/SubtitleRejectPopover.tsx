'use client'

/**
 * SubtitleRejectPopover.tsx — 字幕拒绝原因输入弹层（CHG-SN-5-02）
 *
 * 消费 admin-ui 通用原语：Popover + AdminInput + AdminButton。
 * 触发：行操作"拒绝"按钮；内容：模板 chips（一键填入）+ 自由文本 + 确认/取消。
 */

import { useState, type CSSProperties, type ReactElement } from 'react'
import { Popover, AdminInput, AdminButton } from '@resovo/admin-ui'

const REJECT_TEMPLATES = ['字幕语言不符', '格式错误或损坏', '内容与视频不匹配', '重复提交'] as const

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '280px',
  padding: '12px',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

const TEMPLATES_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
}

const TEMPLATE_BTN_STYLE: CSSProperties = {
  height: '20px',
  padding: '0 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-2xs)',
  cursor: 'pointer',
  font: 'inherit',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
  marginTop: '4px',
}

interface SubtitleRejectPopoverProps {
  readonly trigger: ReactElement
  readonly pending?: boolean
  readonly onConfirm: (reason: string | undefined) => void
  readonly 'data-testid'?: string
}

export function SubtitleRejectPopover({
  trigger,
  pending,
  onConfirm,
  'data-testid': testId,
}: SubtitleRejectPopoverProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  function close() {
    setOpen(false)
    setReason('')
  }

  function handleConfirm() {
    if (pending) return
    onConfirm(reason.trim() ? reason.trim() : undefined)
    close()
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={trigger}
      content={
        <div style={PANEL_STYLE} data-testid={testId ?? 'subtitle-reject-popover'}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>拒绝理由（可选）</div>
          <div style={TEMPLATES_ROW_STYLE}>
            {REJECT_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                style={TEMPLATE_BTN_STYLE}
                onClick={() => setReason(tpl)}
                data-testid={`subtitle-reject-template-${tpl}`}
              >
                {tpl}
              </button>
            ))}
          </div>
          <AdminInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="选填，最长 200 字"
            maxLength={200}
            size="sm"
            data-testid="subtitle-reject-reason-input"
          />
          <div style={FOOTER_STYLE}>
            <AdminButton
              variant="default"
              size="sm"
              onClick={close}
              data-testid="subtitle-reject-cancel"
            >
              取消
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              loading={pending}
              onClick={handleConfirm}
              data-testid="subtitle-reject-confirm"
            >
              拒绝
            </AdminButton>
          </div>
        </div>
      }
    />
  )
}
