'use client'

/**
 * KeyboardHelpOverlay.tsx — 审核台键盘快捷键帮助浮层（MODUX-P2-3 / item 1）
 *
 * 审核台**局部**组件（非 AdminShell 全局快捷键职责）：展示 PendingPaneController 注入的
 * 快捷键清单。真源 = controller 的 `shortcuts` 配置（本组件纯展示，items 由 controller 派生）。
 * 遮罩 / Esc / 点击关闭复用 admin-ui `Modal`（不手写 backdrop / keydown）。
 */
import React from 'react'
import { Modal } from '@resovo/admin-ui'

export interface KeyboardHelpItem {
  readonly displayKey: string
  readonly label: string
  readonly group: string
  /** 批量模式下该键暂停（仅 batchModeOn 时灰化提示） */
  readonly batchPaused: boolean
}

export interface KeyboardHelpOverlayProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly items: readonly KeyboardHelpItem[]
  readonly batchModeOn: boolean
}

const KBD_STYLE: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 18,
  textAlign: 'center',
  padding: '1px 6px',
  border: '1px solid var(--border-default)',
  borderRadius: 3,
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'monospace',
  background: 'var(--bg-surface-raised)',
  color: 'var(--fg-default)',
}

const GROUP_HEADER_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '12px 0 4px',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '5px 0',
}

interface HelpGroup {
  readonly name: string
  readonly items: KeyboardHelpItem[]
}

/** 按 group 保序分组（保持 controller 注入顺序） */
function groupItems(items: readonly KeyboardHelpItem[]): HelpGroup[] {
  const groups: HelpGroup[] = []
  for (const it of items) {
    let g = groups.find((x) => x.name === it.group)
    if (!g) {
      g = { name: it.group, items: [] }
      groups.push(g)
    }
    g.items.push(it)
  }
  return groups
}

export function KeyboardHelpOverlay({ open, onClose, items, batchModeOn }: KeyboardHelpOverlayProps): React.ReactElement {
  const groups = groupItems(items)
  return (
    <Modal open={open} onClose={onClose} title="键盘快捷键" size="sm" data-testid="moderation-keyboard-help">
      <div>
        {groups.map((g) => (
          <div key={g.name} data-help-group={g.name}>
            <div style={GROUP_HEADER_STYLE}>{g.name}</div>
            {g.items.map((it) => {
              const paused = batchModeOn && it.batchPaused
              return (
                <div key={it.displayKey} style={{ ...ROW_STYLE, opacity: paused ? 0.45 : 1 }} data-help-row>
                  <kbd style={KBD_STYLE}>{it.displayKey}</kbd>
                  <span style={{ flex: 1, fontSize: 'var(--font-size-sm-tight)', color: 'var(--fg-default)' }}>{it.label}</span>
                  {paused && (
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>批量模式暂停</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ marginTop: 14, fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
          输入框聚焦时快捷键不触发；按 Esc 或点击遮罩关闭。
        </div>
      </div>
    </Modal>
  )
}
