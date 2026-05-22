'use client'

/**
 * FilterPresetPopover — 筛选预设列表 Popover（CHG-SN-4-FIX-F · plan v1.6 §1 G7）
 *
 * 视觉规约：
 *   - 单条预设行 ≤ 40px（标题 13px + 简述 11px 双行）
 *   - 默认预设 ⭐ 颜色 var(--state-warning-fg)
 *   - 操作按钮：应用 / 设默认 / 删除（chip btn 风格）
 *   - 底部："+ 保存当前筛选为预设" 入口
 *
 * 关闭策略：点击 backdrop（绝对定位 fullscreen 透明 div）→ onClose；ESC 键 → onClose。
 */
import React, { useEffect, useRef } from 'react'
import { M } from '@/i18n/messages/zh-CN/moderation'
import { summarizeQuery } from '@/lib/moderation/use-filter-presets'
import type { FilterPreset } from '@/lib/moderation/use-filter-presets'

const POPOVER_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 320,
  maxHeight: 420,
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const HEADER_STYLE: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

// CHG-SN-8-GAPS-PRESET-LOCAL-BADGE：localStorage 仅本地警示 chip（GAPS.md #G-moderation-preset-team）
const LOCAL_BADGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 7px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 500,
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
  cursor: 'help',
  whiteSpace: 'nowrap',
}

const LIST_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 'var(--font-size-xs)',
}

const ROW_HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const NAME_STYLE: React.CSSProperties = {
  flex: 1,
  fontWeight: 600,
  fontSize: 'var(--font-size-sm-tight)',
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const STAR_STYLE: React.CSSProperties = {
  color: 'var(--state-warning-fg)',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
}

const STAR_INACTIVE_STYLE: React.CSSProperties = {
  color: 'var(--fg-subtle)',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
  opacity: 0.4,
}

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 4,
}

const CHIP_BTN_STYLE: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xxs)',
}

const CHIP_BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...CHIP_BTN_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const CHIP_BTN_DANGER_STYLE: React.CSSProperties = {
  ...CHIP_BTN_STYLE,
  color: 'var(--state-error-fg)',
  borderColor: 'var(--state-error-border)',
}

const EMPTY_STYLE: React.CSSProperties = {
  padding: '20px 14px',
  textAlign: 'center',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FOOTER_STYLE: React.CSSProperties = {
  padding: '10px 14px',
  borderTop: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

const SAVE_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'transparent',
  zIndex: 40,
}

export interface FilterPresetPopoverProps {
  readonly open: boolean
  readonly anchorRef: React.RefObject<HTMLDivElement | null>
  readonly presets: readonly FilterPreset[]
  readonly onApply: (preset: FilterPreset) => void
  readonly onSetDefault: (preset: FilterPreset) => void
  readonly onUnsetDefault: (preset: FilterPreset) => void
  readonly onRemove: (preset: FilterPreset) => void
  readonly onSaveCurrent: () => void
  readonly onClose: () => void
}

export function FilterPresetPopover({
  open,
  anchorRef,
  presets,
  onApply,
  onSetDefault,
  onUnsetDefault,
  onRemove,
  onSaveCurrent,
  onClose,
}: FilterPresetPopoverProps): React.ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null)

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div style={BACKDROP_STYLE} aria-hidden="true" onClick={onClose} data-filter-preset-backdrop />
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={M.preset.popoverTitle}
        style={POPOVER_STYLE}
        data-filter-preset-popover
      >
        <div style={HEADER_STYLE}>
          <span>{M.preset.popoverTitle}</span>
          <span
            style={LOCAL_BADGE_STYLE}
            title={M.preset.localOnlyTooltip}
            data-testid="filter-preset-local-badge"
          >
            {M.preset.localOnlyBadge}
          </span>
        </div>

        <div style={LIST_STYLE}>
          {presets.length === 0 ? (
            <div style={EMPTY_STYLE}>{M.preset.empty}</div>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} style={ROW_STYLE} data-preset-row data-preset-id={preset.id}>
                <div style={ROW_HEAD_STYLE}>
                  <span style={preset.isDefault ? STAR_STYLE : STAR_INACTIVE_STYLE} aria-hidden="true">⭐</span>
                  <span style={NAME_STYLE} title={preset.name}>{preset.name}</span>
                </div>
                <div style={SUMMARY_STYLE} title={summarizeQuery(preset.query)}>
                  {summarizeQuery(preset.query)}
                </div>
                <div style={ACTIONS_STYLE}>
                  <button type="button" style={CHIP_BTN_PRIMARY_STYLE} onClick={() => onApply(preset)}>
                    {M.preset.applyBtn}
                  </button>
                  {preset.isDefault ? (
                    <button type="button" style={CHIP_BTN_STYLE} onClick={() => onUnsetDefault(preset)}>
                      {M.preset.unsetDefaultBtn}
                    </button>
                  ) : (
                    <button type="button" style={CHIP_BTN_STYLE} onClick={() => onSetDefault(preset)}>
                      {M.preset.setDefaultBtn}
                    </button>
                  )}
                  <span style={{ flex: 1 }} />
                  <button type="button" style={CHIP_BTN_DANGER_STYLE} onClick={() => onRemove(preset)}>
                    {M.preset.removeBtn}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={FOOTER_STYLE}>
          <button type="button" style={SAVE_BTN_STYLE} onClick={onSaveCurrent}>
            {M.preset.saveCurrentBtn}
          </button>
        </div>
      </div>
    </>
  )
}
