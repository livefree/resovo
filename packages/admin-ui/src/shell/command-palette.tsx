/**
 * command-palette.tsx — ⌘K 命令面板（ADR-103a §4.1.6）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.6 CommandPalette + CommandGroup + CommandItem
 *   - ADR-103a §4.3 z-index var(--z-shell-cmdk) 1200（覆盖 Drawer 1100）
 *   - ADR-103a §4.4 4 项硬约束
 *   - CHG-SN-2-10 DrawerShell mounted SSR-safe 范式（React 18 server 不支持 createPortal 解决方案）
 *   - fix(CHG-SN-2-07) UserMenu portal/visual 契约（z-index + try/finally + focus 模式）
 *
 * 组件形态：
 *   章法 1C/5C 受控浮层（open + onClose + portal + ESC + mounted SSR-safe）+ 模态浮层（中央对齐）
 *   多内部子组件：CommandRow（单项含 useFormatShortcut hydration-safe）+ helper（filter/flatten）
 *
 * 设计要点：
 *   - 模态浮层：portal 到 document.body + center 对齐 + max-width 600px / max-height 60vh
 *   - z-index var(--z-shell-cmdk) 1200（覆盖 Drawer，与 §4.3 4 级层叠不变量一致）
 *   - 输入框：autoFocus + onChange 更新 query + role="combobox" + aria-controls + aria-activedescendant
 *   - 过滤：query 不区分大小写 + label.includes(query)（query="" → 全部显示）
 *   - 3 组渲染：空 group（过滤后无 items）自动隐藏；group label + items 列表
 *   - activeIndex：扁平化跨 group items；初始 0；query 变化时重置为 0
 *   - 键盘导航：ArrowDown/Up（循环）/ Enter（触发 onAction + onClose）/ Esc（onClose）
 *   - mouse hover：onMouseEnter 同步 activeIndex
 *   - 空态：visibleItems.length === 0 → "无匹配结果"
 *   - shortcut 渲染：useFormatShortcut hydration-safe（CommandRow 子组件内每项独立调用）
 *   - mounted SSR-safe：useState false + useEffect setMounted(true)（同 DrawerShell）
 *   - try/finally 保护 onClose / onAction（callback throw 不影响 listener cleanup）
 *
 * a11y：
 *   - 容器 role="dialog" + aria-modal="true" + aria-labelledby
 *   - 输入框 role="combobox" + aria-controls=listboxId + aria-activedescendant=optionId
 *   - 列表 role="listbox"，items role="option" + aria-selected
 *
 * 不做：
 *   - 不内置 nav 数据（消费方组装 groups 注入；已与 ADR §4.1.6 不做段一致）
 *   - 不实现远程搜索（消费方异步注入第三组"搜索结果"）
 *   - 不与路由耦合（onAction 触发后消费方决定 router.push / invoke）
 *   - 不持久化 query 历史 / 不实现 fuzzy match（M-SN-3+ 业务卡视需求扩展）
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFormatShortcut } from './platform'
import type { CommandGroup, CommandItem } from './types'

export interface CommandPaletteProps {
  readonly open: boolean
  readonly groups: readonly CommandGroup[]
  readonly onClose: () => void
  readonly onAction: (item: CommandItem) => void
  readonly placeholder?: string
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg-overlay)',
  zIndex: 'var(--z-shell-cmdk)' as unknown as number,
}

const PANEL_WRAPPER_STYLE: CSSProperties = {
  position: 'fixed',
  top: '15vh',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(600px, 90vw)',
  maxHeight: '60vh',
  zIndex: 'var(--z-shell-cmdk)' as unknown as number,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm)',
  overflow: 'hidden',
}

const INPUT_STYLE: CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--fg-default)',
  font: 'inherit',
  outline: 'none',
  flexShrink: 0,
}

const LISTBOX_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-2) 0',
  margin: 0,
  listStyle: 'none',
}

const GROUP_LABEL_STYLE: CSSProperties = {
  padding: 'var(--space-1) var(--space-4)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const ROW_STYLE_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-4)',
  background: 'transparent',
  border: 0,
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  color: 'var(--fg-default)',
}

const ROW_ACTIVE_STYLE: CSSProperties = {
  ...ROW_STYLE_BASE,
  background: 'var(--bg-surface-elevated)',
}

const ICON_STYLE: CSSProperties = {
  display: 'inline-flex',
  width: '20px',
  height: '20px',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--fg-muted)',
}

const META_STYLE: CSSProperties = {
  marginLeft: 'auto',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
}

const SHORTCUT_STYLE: CSSProperties = {
  marginLeft: 'auto',
  padding: '0 var(--space-2)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  fontFamily: 'monospace',
  flexShrink: 0,
}

const EMPTY_STYLE: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  color: 'var(--fg-muted)',
  textAlign: 'center',
  fontSize: 'var(--font-size-sm)',
}

const FOOTER_STYLE: CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  flexShrink: 0,
}

export function CommandPalette({ open, groups, onClose, onAction, placeholder = '输入命令…' }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = 'command-palette-title'
  const listboxId = 'command-palette-listbox'

  // mounted SSR-safe（CHG-SN-2-10 DrawerShell 范式复用：React 18 server 不支持 createPortal）
  useEffect(() => {
    setMounted(true)
  }, [])

  // 过滤 + 扁平化
  const { visibleGroups, flatItems } = useMemo(
    () => filterAndFlatten(groups, query),
    [groups, query],
  )

  // query 变化时重置 activeIndex 为 0
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // groups/flatItems 变化时夹逼 activeIndex（消费方异步注入"搜索结果"组时防越界 / 防选错项）
  // 当 flatItems.length 变化导致当前 activeIndex 越界 → 重置为 0
  useEffect(() => {
    if (activeIndex >= flatItems.length && flatItems.length > 0) {
      setActiveIndex(0)
    }
  }, [flatItems.length, activeIndex])

  // open=false → 重置 query（下次 open 时从空查询开始）
  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  // mount 时 focus 输入框
  useEffect(() => {
    if (!open || !mounted) return
    inputRef.current?.focus()
  }, [open, mounted])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      // focus trap：Tab/Shift+Tab 在 panel 内循环（aria-modal="true" 不变量）
      // DrawerShell focus trap 范式复用；仅当焦点在 panel 内时启用门禁
      if (event.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const activeEl = document.activeElement
        if (!(activeEl instanceof HTMLElement) || !panel.contains(activeEl)) return
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusables.length === 0) {
          event.preventDefault()
          return
        }
        const currentIndex = focusables.indexOf(activeEl)
        if (currentIndex < 0) return
        if (event.shiftKey) {
          if (currentIndex === 0) {
            event.preventDefault()
            focusables[focusables.length - 1]?.focus()
          }
        } else {
          if (currentIndex === focusables.length - 1) {
            event.preventDefault()
            focusables[0]?.focus()
          }
        }
        return
      }
      if (event.key === 'Escape') {
        event.stopPropagation()
        try {
          onClose()
        } catch {
          // 静默捕获 callback throw
        }
        return
      }
      if (flatItems.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => (i + 1) % flatItems.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const item = flatItems[activeIndex]
        if (!item) return
        try {
          onAction(item)
        } finally {
          try {
            onClose()
          } catch {
            // 静默捕获
          }
        }
      }
    },
    [activeIndex, flatItems, onAction, onClose],
  )

  const handleBackdropClick = useCallback(() => {
    try {
      onClose()
    } catch {
      // 静默捕获
    }
  }, [onClose])

  if (!open || !mounted) return null

  const activeItem = flatItems[activeIndex]
  const activeOptionId = activeItem ? `command-option-${activeItem.id}` : undefined

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-command-palette-backdrop
        onClick={handleBackdropClick}
        style={BACKDROP_STYLE}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-command-palette
        onKeyDown={handleKeyDown}
        style={PANEL_WRAPPER_STYLE}
      >
        <span id={titleId} style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">命令面板</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-label="命令搜索"
          data-command-palette-input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={INPUT_STYLE}
        />
        {flatItems.length === 0 ? (
          <div data-command-palette-empty style={EMPTY_STYLE}>无匹配结果</div>
        ) : (
          <ul role="listbox" id={listboxId} data-command-palette-listbox style={LISTBOX_STYLE}>
            {visibleGroups.map((group) => (
              <li key={group.id} data-command-palette-group={group.id}>
                <div data-command-palette-group-label style={GROUP_LABEL_STYLE}>{group.label}</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {group.items.map((item) => {
                    const isActive = activeItem?.id === item.id
                    return (
                      <li key={item.id} role="option" aria-selected={isActive} id={`command-option-${item.id}`}>
                        <CommandRow
                          item={item}
                          active={isActive}
                          onSelect={() => {
                            try {
                              onAction(item)
                            } finally {
                              try {
                                onClose()
                              } catch {
                                // 静默
                              }
                            }
                          }}
                          onHoverActivate={() => {
                            const idx = flatItems.findIndex((it) => it.id === item.id)
                            if (idx >= 0) setActiveIndex(idx)
                          }}
                        />
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div data-command-palette-footer style={FOOTER_STYLE}>
          <span>↑↓ 移动</span>
          <span>↵ 选择</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── 内部子组件 ────────────────────────────────────────────

interface CommandRowProps {
  readonly item: CommandItem
  readonly active: boolean
  readonly onSelect: () => void
  readonly onHoverActivate: () => void
}

function CommandRow({ item, active, onSelect, onHoverActivate }: CommandRowProps) {
  const shortcutLabel = useFormatShortcut(item.shortcut ?? '')
  return (
    <button
      type="button"
      data-command-palette-item={item.id}
      data-command-palette-item-active={active ? 'true' : undefined}
      data-command-palette-item-kind={item.kind}
      onClick={onSelect}
      onMouseEnter={onHoverActivate}
      style={active ? ROW_ACTIVE_STYLE : ROW_STYLE_BASE}
    >
      {item.icon != null && (
        <span aria-hidden="true" style={ICON_STYLE} data-command-palette-item-icon>
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.label}
      </span>
      {item.meta && (
        <span style={META_STYLE} data-command-palette-item-meta>{item.meta}</span>
      )}
      {item.shortcut && shortcutLabel && (
        <span style={SHORTCUT_STYLE} data-command-palette-item-shortcut>{shortcutLabel}</span>
      )}
    </button>
  )
}

// ── 工具函数 ────────────────────────────────────────────

interface FilterResult {
  readonly visibleGroups: readonly CommandGroup[]
  readonly flatItems: readonly CommandItem[]
}

/** 过滤 + 扁平化：query 不区分大小写 + label.includes(query)；空 group 自动过滤；扁平 items 按 group 顺序排列 */
function filterAndFlatten(groups: readonly CommandGroup[], query: string): FilterResult {
  const normalized = query.trim().toLowerCase()
  if (normalized === '') {
    const flat = groups.flatMap((g) => g.items)
    return { visibleGroups: groups.filter((g) => g.items.length > 0), flatItems: flat }
  }
  const visibleGroups: CommandGroup[] = []
  const flatItems: CommandItem[] = []
  for (const group of groups) {
    const filtered = group.items.filter((item) => item.label.toLowerCase().includes(normalized))
    if (filtered.length > 0) {
      visibleGroups.push({ ...group, items: filtered })
      flatItems.push(...filtered)
    }
  }
  return { visibleGroups, flatItems }
}
