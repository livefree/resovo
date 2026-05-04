'use client'

/**
 * views-menu.tsx — Saved Views 切换器 + 保存入口（CHG-DESIGN-02 Step 4/7）
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx DTViewList
 * 范围（Step 4）：
 *   - 渲染当前激活视图按钮（"视图 · {label} ▾"），点击展开下拉
 *   - 列出 personal/team 视图，scope 徽章
 *   - 底部"保存当前为个人/团队视图"，点击调消费方 onSave(scope)
 *   - label 由消费方自管（设计稿 datatable.jsx 默认走 alert prompt 演示）
 *
 * 持久化（Step 6）：personal scope 走 useTableQuery 内部 storage-sync；
 * team scope 调消费方后端 API。本步 Step 4 仅 UI + callback，不持有状态。
 *
 * 范式：完全对照 header-menu.tsx — portal 渲染、ESC + 点击外部关闭、
 *      anchorRef.getBoundingClientRect 计算位置。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TableView, ViewScope, ViewsConfig } from './types'

interface Pos { top: number; left: number }
const DEFAULT_POS: Pos = { top: 0, left: 0 }

// ── Trigger 按钮 ───────────────────────────────────────────────────

const TRIGGER_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  background: 'var(--bg-surface-row)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-default)',
  fontSize: '12px',
  cursor: 'pointer',
  font: 'inherit',
}

const TRIGGER_LABEL_PREFIX_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: '11px',
}

const TRIGGER_LABEL_VALUE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const TRIGGER_CHEVRON_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: '10px',
}

// ── Dropdown popover ────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
  minWidth: '240px',
  // outline 由 InteractionStyles §5 focus-visible 兜底；浮层根非 tab target，子级 menuitem 才需 ring（CHG-UX-06 / arch-reviewer Y3）
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 12px',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--fg-default)',
  background: 'transparent',
  border: 0,
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
}

const ACTIVE_ROW_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  color: 'var(--admin-accent-on-soft)',
  background: 'var(--admin-accent-soft)',
}

const SCOPE_BADGE_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '10px',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-raised)',
  color: 'var(--fg-muted)',
}

const SCOPE_BADGE_TEAM_STYLE: React.CSSProperties = {
  ...SCOPE_BADGE_STYLE,
  color: 'var(--state-info-fg)',
  background: 'var(--state-info-bg)',
}

const SEP_STYLE: React.CSSProperties = {
  height: '1px',
  background: 'var(--border-subtle)',
  margin: '4px 0',
}

const SAVE_PERSONAL_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  color: 'var(--admin-accent-on-soft)',
}

const SAVE_TEAM_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  color: 'var(--state-info-fg)',
}

// ── ViewsMenu ───────────────────────────────────────────────────────

export interface ViewsMenuProps {
  readonly config: ViewsConfig
  readonly 'data-testid'?: string
}

export function ViewsMenu({ config, 'data-testid': testId }: ViewsMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const recalc = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current
      const trigger = triggerRef.current
      if (!panel) return
      if (panel.contains(e.target as Node)) return
      if (trigger?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  const handlePick = useCallback((id: string) => {
    config.onChange?.(id)
    setOpen(false)
  }, [config])

  const handleSave = useCallback((scope: ViewScope) => {
    config.onSave?.(scope)
    setOpen(false)
  }, [config])

  const activeView = config.activeId
    ? config.items.find((v) => v.id === config.activeId)
    : undefined
  const activeLabel = activeView?.label ?? '默认'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-views-trigger
        data-interactive="trigger"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={TRIGGER_STYLE}
      >
        <span style={TRIGGER_LABEL_PREFIX_STYLE}>视图</span>
        <span style={TRIGGER_LABEL_VALUE_STYLE}>{activeLabel}</span>
        <span aria-hidden="true" style={TRIGGER_CHEVRON_STYLE}>▾</span>
      </button>
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label="视图切换"
          tabIndex={-1}
          style={{ ...PANEL_STYLE, top: pos.top, left: pos.left }}
          data-views-menu
        >
          {config.items.length === 0 && (
            <div style={{ ...ROW_STYLE, color: 'var(--fg-muted)', fontStyle: 'italic', cursor: 'default' }}>
              暂无保存的视图
            </div>
          )}
          {config.items.map((view) => (
            <ViewRow
              key={view.id}
              view={view}
              active={view.id === config.activeId}
              onPick={handlePick}
            />
          ))}
          {config.onSave && (
            <>
              <div style={SEP_STYLE} aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                style={SAVE_PERSONAL_STYLE}
                onClick={() => handleSave('personal')}
                data-views-save-personal
              >＋ 保存当前为个人视图</button>
              <button
                type="button"
                role="menuitem"
                style={SAVE_TEAM_STYLE}
                onClick={() => handleSave('team')}
                data-views-save-team
              >＋ 保存当前为团队视图</button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

interface ViewRowProps {
  readonly view: TableView
  readonly active: boolean
  readonly onPick: (id: string) => void
}

function ViewRow({ view, active, onPick }: ViewRowProps): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      style={active ? ACTIVE_ROW_STYLE : ROW_STYLE}
      onClick={() => onPick(view.id)}
      data-view-id={view.id}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {view.label}
      </span>
      <span style={view.scope === 'team' ? SCOPE_BADGE_TEAM_STYLE : SCOPE_BADGE_STYLE}>
        {view.scope === 'team' ? '团队' : '个人'}
      </span>
    </button>
  )
}
