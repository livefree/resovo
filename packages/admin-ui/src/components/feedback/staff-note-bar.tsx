'use client'

/**
 * staff-note-bar.tsx — StaffNoteBar 共享组件实装（CHG-SN-4-04 D-14 第 4 件）
 *
 * 真源：staff-note-bar.types.ts（arch-reviewer Opus 2 轮 PASS 契约）
 *
 * 实装契约（契约一致性硬约束）：
 *   - note 为 null / undefined / 空串 → return null（消费方零外层条件挂载）
 *   - 两态：display（onEdit 不传 → readonly）/ edit（editing=true 且 onSubmit 已传时生效）
 *   - 颜色：复用 design-tokens `--state-warning-{bg,fg,border}` 系（amber）；零硬编码
 *   - 提交语义：onSubmit(null) 表示清空；resolve 后由消费方控制是否退出 editing
 *   - 取消语义：onCancelEdit 不传 → 取消按钮 disabled
 *   - 不下沉 i18n：所有文案 slot prop（默认中文兜底）
 *
 * 固定 data attribute：
 *   - 根节点 data-staff-note-bar + data-staff-note-mode="display|edit"
 *   - 编辑入口 data-staff-note-edit-trigger
 *   - 编辑提交 data-staff-note-submit
 *   - 编辑取消 data-staff-note-cancel
 *   - testId 渲染为 data-testid
 */
import React, { forwardRef, useEffect, useRef, useState } from 'react'
import type { StaffNoteBarProps } from './staff-note-bar.types'

const DEFAULT_EMPTY_HINT = '输入备注…'
const DEFAULT_EDIT_LABEL = '编辑'
const DEFAULT_SAVE_LABEL = '保存'
const DEFAULT_CANCEL_LABEL = '取消'

const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '8px 12px',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const NOTE_TEXT_STYLE: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const TEXTAREA_STYLE: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  width: '100%',
  minHeight: '64px',
  padding: '6px 8px',
  fontSize: '13px',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  color: 'var(--fg-default)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--state-warning-border)',
  borderRadius: 'var(--radius-sm)',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
  alignItems: 'center',
  flexShrink: 0,
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginTop: '6px',
}

const CHAR_COUNT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const BUTTON_BASE_STYLE: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  lineHeight: 1.4,
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'inherit',
}

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  background: 'var(--state-warning-fg)',
  color: 'var(--state-warning-bg)',
  borderColor: 'var(--state-warning-fg)',
}

const GHOST_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  borderColor: 'var(--state-warning-border)',
  color: 'var(--state-warning-fg)',
}

const EDIT_TRIGGER_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  fontSize: '12px',
  borderColor: 'var(--state-warning-border)',
  color: 'var(--state-warning-fg)',
}

const COLUMN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minWidth: 0,
}

type Ref = HTMLDivElement

export const StaffNoteBar = forwardRef<Ref, StaffNoteBarProps>(function StaffNoteBar(
  {
    note,
    onEdit,
    editing,
    onSubmit,
    onCancelEdit,
    submitting,
    emptyHint,
    editLabel,
    saveLabel,
    cancelLabel,
    noteMaxLength,
    testId,
  },
  ref,
) {
  const isEditMode = Boolean(editing && onEdit && onSubmit)
  const trimmedNote = (note ?? '').trim()

  // 契约：note 空 + 非编辑态 → 不渲染
  if (!isEditMode && !trimmedNote) {
    return null
  }

  if (isEditMode) {
    return (
      <EditMode
        ref={ref}
        initialNote={note ?? ''}
        onSubmit={onSubmit!}
        onCancelEdit={onCancelEdit}
        submitting={submitting}
        emptyHint={emptyHint ?? DEFAULT_EMPTY_HINT}
        saveLabel={saveLabel ?? DEFAULT_SAVE_LABEL}
        cancelLabel={cancelLabel ?? DEFAULT_CANCEL_LABEL}
        noteMaxLength={noteMaxLength}
        testId={testId}
      />
    )
  }

  // display 态
  return (
    <div
      ref={ref}
      data-staff-note-bar
      data-staff-note-mode="display"
      data-testid={testId}
      role="note"
      style={ROOT_STYLE}
    >
      <span data-staff-note-text style={NOTE_TEXT_STYLE}>{note}</span>
      {onEdit && (
        <span style={ACTIONS_STYLE}>
          <button
            type="button"
            data-staff-note-edit-trigger
            data-interactive="icon"
            onClick={onEdit}
            style={EDIT_TRIGGER_STYLE}
          >
            {editLabel ?? DEFAULT_EDIT_LABEL}
          </button>
        </span>
      )}
    </div>
  )
})

// ── Edit 子组件 ─────────────────────────────────────────────────

interface EditModeProps {
  readonly initialNote: string
  readonly onSubmit: (note: string | null) => Promise<void>
  readonly onCancelEdit?: () => void
  readonly submitting?: boolean
  readonly emptyHint: string
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly noteMaxLength?: number
  readonly testId?: string
}

const EditMode = forwardRef<Ref, EditModeProps>(function EditMode(
  {
    initialNote,
    onSubmit,
    onCancelEdit,
    submitting,
    emptyHint,
    saveLabel,
    cancelLabel,
    noteMaxLength,
    testId,
  },
  ref,
) {
  const [draft, setDraft] = useState(initialNote)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // 编辑态进入时重置 draft（避免 stale state 跨次进入）
  useEffect(() => {
    setDraft(initialNote)
  }, [initialNote])

  const handleSubmit = (): void => {
    const trimmed = draft.trim()
    void onSubmit(trimmed === '' ? null : trimmed)
  }

  const overLimit =
    typeof noteMaxLength === 'number' && draft.length > noteMaxLength

  return (
    <div
      ref={ref}
      data-staff-note-bar
      data-staff-note-mode="edit"
      data-testid={testId}
      role="group"
      style={ROOT_STYLE}
    >
      <div style={COLUMN_STYLE}>
        <textarea
          ref={textareaRef}
          data-staff-note-textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={emptyHint}
          maxLength={noteMaxLength}
          disabled={submitting}
          style={TEXTAREA_STYLE}
        />
        <div style={FOOTER_STYLE}>
          <span data-staff-note-charcount style={CHAR_COUNT_STYLE}>
            {typeof noteMaxLength === 'number'
              ? `${draft.length} / ${noteMaxLength}`
              : `${draft.length}`}
          </span>
          <span style={ACTIONS_STYLE}>
            <button
              type="button"
              data-staff-note-cancel
              onClick={onCancelEdit}
              disabled={!onCancelEdit || submitting}
              style={GHOST_BUTTON_STYLE}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              data-staff-note-submit
              onClick={handleSubmit}
              disabled={submitting || overLimit}
              style={PRIMARY_BUTTON_STYLE}
            >
              {saveLabel}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
})
