'use client'

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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { OverlayBackdrop } from '../components/overlay/overlay-backdrop'
import { useFormatShortcut } from './platform'
import type { CommandGroup, CommandItem } from './types'

export interface CommandPaletteProps {
  readonly open: boolean
  /** 本地命令分组（导航/快捷操作）；**继续**走客户端 `label.includes(query)` 过滤 */
  readonly groups: readonly CommandGroup[]
  readonly onClose: () => void
  readonly onAction: (item: CommandItem) => void
  readonly placeholder?: string
  /**
   * 输入词变更回调（ADR-200 D-200-1）：发**原始** query（每 keystroke）。
   * 组件因 `open=false` 内部重置 query（→ ''）时也会触发 `onQueryChange('')`（防下次打开闪现上次远程结果 = stale）。
   * 防抖 + AbortController 取消在途请求由消费方负责（组件保持纯）。消费方应 memoize 此回调。
   */
  readonly onQueryChange?: (q: string) => void
  /**
   * 已由**服务端过滤**的结果组（ADR-200 D-200-1 / §4.1.6 AMENDMENT）：**跳过本地 `label.includes` 过滤、原样展示**
   * （服务端命中拼音/别名/url/short_id 时 label 未必含 query 子串，作为普通 `groups` 注入会被本地过滤误杀）。
   * flatItems 顺序 = 本地 `groups` 在前、`prefilteredGroups` 在后，activeIndex 跨全部；异步到达不改变已落在本地组项上的 activeId。
   * **消费方须保证 item.id 在 groups + prefilteredGroups 间全局唯一**（activeId/key 以 id 为身份）。
   */
  readonly prefilteredGroups?: readonly CommandGroup[]
  /** 远程请求中（ADR-200 D-200-1）；输入框**永不因 loading unmount**；驱动 aria-busy + 空态优先级最高 */
  readonly loading?: boolean
  /** 空态自定义节点（ADR-200 D-200-1）；空态优先级：`loading` > `emptyRemoteState` > 内置"无匹配结果" */
  readonly emptyRemoteState?: ReactNode
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
  // CHG-SN-6-RETRO-4：拆 border:0 + borderBottom 冲突
  borderTop: 0,
  borderLeft: 0,
  borderRight: 0,
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--fg-default)',
  fontFamily: 'inherit',
  // outline 由 InteractionStyles §5 focus-visible 兜底（CHG-UX-06）
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
  fontFamily: 'inherit',
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

/** 稳定空引用，避免 prefilteredGroups 默认值每次新建数组触发 useMemo 重算 */
const EMPTY_GROUPS: readonly CommandGroup[] = []

/** 视觉隐藏（保留可访问性，供 live region 计数播报 D-200-9） */
const SR_ONLY_STYLE: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
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

export function CommandPalette({
  open, groups, onClose, onAction, placeholder = '输入命令…',
  onQueryChange, prefilteredGroups, loading = false, emptyRemoteState,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  // 选中项以"id"为身份（不以数值索引为身份），消费方异步替换/收缩/扩张/重排 groups 时
  // 自动按 id 重定位；id 在新 flatItems 中不存在 → 回退到首项（fix(CHG-SN-2-11) Codex 边界）
  // undefined 语义：尚未由用户操作过 / query 重置后初始 → 视为首项 active
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = 'command-palette-title'
  const listboxId = 'command-palette-listbox'

  // onQueryChange 经 ref 持最新引用：在 [query] effect 中调用而不污染依赖，
  // 避免消费方未 memoize 回调时 effect 重跑误发重复 query（ADR-200 D-200-1 组件保持纯）
  const onQueryChangeRef = useRef(onQueryChange)
  useEffect(() => {
    onQueryChangeRef.current = onQueryChange
  }, [onQueryChange])

  // mounted SSR-safe（CHG-SN-2-10 DrawerShell 范式复用：React 18 server 不支持 createPortal）
  useEffect(() => {
    setMounted(true)
  }, [])

  // 过滤 + 扁平化：本地 groups 走客户端过滤；prefilteredGroups（服务端已过滤）跳过本地过滤、原样拼接在后
  const { visibleGroups, flatItems } = useMemo(
    () => filterAndFlatten(groups, prefilteredGroups ?? EMPTY_GROUPS, query),
    [groups, prefilteredGroups, query],
  )

  // 派生 activeIndex：按 activeId 在新 flatItems 中定位；id 缺省或不在列表 → 0（首项）
  // flatItems 为空时返回 -1（语义：无 active；Enter 守卫 + aria-activedescendant 处理）
  const activeIndex = useMemo<number>(() => {
    if (flatItems.length === 0) return -1
    if (activeId === undefined) return 0
    const idx = flatItems.findIndex((it) => it.id === activeId)
    return idx >= 0 ? idx : 0
  }, [flatItems, activeId])

  // query 变化时重置选中（active=首项）
  useEffect(() => {
    setActiveId(undefined)
  }, [query])

  // query 变化 → 通知消费方（发原始 query）。同一 effect 覆盖两条 ADR-200 D-200-1 要求：
  //   ① 每 keystroke（query 增量变化）；② open=false 内部重置 query→'' 时发 onQueryChange('')
  //      （消费方据此清远程结果，防下次打开闪现上次结果 = stale）
  useEffect(() => {
    onQueryChangeRef.current?.(query)
  }, [query])

  // open=false → 重置 query（下次 open 时从空查询开始）；query→'' 经上方 effect 触发 onQueryChange('')
  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveId(undefined)
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
        const baseIdx = activeIndex < 0 ? -1 : activeIndex
        const nextIdx = (baseIdx + 1 + flatItems.length) % flatItems.length
        setActiveId(flatItems[nextIdx]?.id)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const baseIdx = activeIndex < 0 ? flatItems.length : activeIndex
        const nextIdx = (baseIdx - 1 + flatItems.length) % flatItems.length
        setActiveId(flatItems[nextIdx]?.id)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (activeIndex < 0) return
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

  const activeItem = activeIndex >= 0 ? flatItems[activeIndex] : undefined
  const activeOptionId = activeItem ? `command-option-${activeItem.id}` : undefined

  return createPortal(
    <>
      <OverlayBackdrop
        zIndex={'var(--z-shell-cmdk)' as unknown as CSSProperties['zIndex']}
        data-command-palette-backdrop
        onClick={handleBackdropClick}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={loading || undefined}
        data-command-palette
        data-command-palette-loading={loading || undefined}
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
          aria-busy={loading || undefined}
          data-command-palette-input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={INPUT_STYLE}
        />
        {/* 结果计数 live region（D-200-9）：loading 中播报"搜索中"，否则播报结果条数 */}
        <span role="status" aria-live="polite" data-command-palette-status style={SR_ONLY_STYLE}>
          {loading ? '搜索中' : `${flatItems.length} 条结果`}
        </span>
        {flatItems.length === 0 ? (
          // 空态优先级（D-200-1）：loading > emptyRemoteState > 内置"无匹配结果"
          <div data-command-palette-empty style={EMPTY_STYLE}>
            {loading ? '搜索中…' : (emptyRemoteState ?? '无匹配结果')}
          </div>
        ) : (
          <ul role="listbox" id={listboxId} data-command-palette-listbox aria-busy={loading || undefined} style={LISTBOX_STYLE}>
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
                            setActiveId(item.id)
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

/**
 * 过滤 + 扁平化（ADR-200 §4.1.6 AMENDMENT）：
 *   - 本地 `groups`（导航/快捷操作）：query 不区分大小写 + `label.includes(query)` 客户端过滤（空 group 自动隐藏）
 *   - `prefilteredGroups`（服务端已过滤）：**跳过本地过滤、原样展示**（仅隐藏空 group）
 *   - flatItems 顺序 = 本地过滤结果在前、prefiltered 在后；activeIndex 跨全部
 */
function filterAndFlatten(
  groups: readonly CommandGroup[],
  prefilteredGroups: readonly CommandGroup[],
  query: string,
): FilterResult {
  const normalized = query.trim().toLowerCase()
  const visibleGroups: CommandGroup[] = []
  const flatItems: CommandItem[] = []

  // 本地 groups：客户端过滤（query='' → 全显示）
  for (const group of groups) {
    const filtered =
      normalized === ''
        ? group.items
        : group.items.filter((item) => item.label.toLowerCase().includes(normalized))
    if (filtered.length > 0) {
      visibleGroups.push(filtered === group.items ? group : { ...group, items: filtered })
      flatItems.push(...filtered)
    }
  }

  // prefilteredGroups：服务端已过滤，跳过本地 label.includes，原样拼接在后
  for (const group of prefilteredGroups) {
    if (group.items.length > 0) {
      visibleGroups.push(group)
      flatItems.push(...group.items)
    }
  }

  return { visibleGroups, flatItems }
}
