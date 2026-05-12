'use client'

/**
 * popover.tsx — admin-ui 通用 Popover 原语
 * 真源：ADR-115（admin-ui Popover 通用原语 API 契约 / CHG-SN-5-PRE-03-F / SEQ-20260506-02 / M-SN-5.5）
 *
 * v1 minimum viable subset（ADR-115 §3.1 第 4 条）：
 *   - 实现 9 props：trigger / content / open / onOpenChange / defaultOpen / placement（6 基础方位）
 *     / offset / closeOnEscape / closeOnOutsideClick / hasPopup / aria-label / data-testid
 *   - 标 `@experimental` 不实现 4 props：modal / closeOnTabOut / portalContainer / arrow
 *   - 5 类 dismiss 中 4 类生效：trigger toggle + ESC + outside click + programmatic；
 *     Tab out 标 @experimental 不生效（v1 仅 non-modal，未引入 focus-trap）
 *
 * 不变约束：
 *   - 零业务视图消费
 *   - 不引入 BrandProvider / ThemeProvider
 *   - 零图标库依赖
 *   - Edge Runtime 兼容（模块顶层零 window / document 访问）
 *   - z-index 经 var(--z-admin-popover) 引用（design-tokens 1050），不硬编码
 *   - 不复用 useOverlay（避开其 body.style.overflow scroll lock 副作用，ADR-115 §2.3）
 */

import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { computePosition, type PopoverPlacement } from './compute-position'

export type { PopoverPlacement } from './compute-position'

export type PopoverHasPopup = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid'

export interface PopoverProps {
  /**
   * 触发元素（必须是单个 React 元素）。Popover 通过 React.cloneElement 注入：
   * onClick（toggle open）/ ref（getBoundingClientRect 定位）/ aria-haspopup / aria-expanded /
   * aria-controls。消费方原 onClick 会被先调用再 toggle（不依赖消费方实现 toggle）。
   *
   * trigger 必须支持 ref forwarding（ADR-115 §2.1）：原生 HTML 元素天然支持；自定义
   * 函数组件须 React.forwardRef。v1 对 ref 注入失败做 console.warn 降级。
   */
  readonly trigger: React.ReactElement
  /** 弹层内容 */
  readonly content: React.ReactNode
  /** 受控开关；省略 → 内部状态自管（非受控）*/
  readonly open?: boolean
  /** 受控变更回调（受控模式必传）；非受控也可监听 */
  readonly onOpenChange?: (next: boolean) => void
  /** 默认非受控初始 open；默认 false */
  readonly defaultOpen?: boolean
  /**
   * 弹层位置；默认 'bottom-start'。v1 实施 6 方位：
   * 'top' / 'bottom' / 'left' / 'right' / 'bottom-start' / 'bottom-end'。
   * 其余 -start / -end 变体在 v1 走 fallback 到对应基础方位（标 @experimental）。
   */
  readonly placement?: PopoverPlacement
  /** trigger 到 content 距离（px）；默认 4 */
  readonly offset?: number
  /**
   * @experimental v1 不实现（ADR-115 §3.1 第 4 条；保留 type 向前兼容）。
   * 设计意图：modal=true → focus-trap + 不锁背景滚动；v1 仅 non-modal。
   */
  readonly modal?: boolean
  /** ESC 关闭；默认 true */
  readonly closeOnEscape?: boolean
  /** outside click 关闭；默认 true */
  readonly closeOnOutsideClick?: boolean
  /**
   * @experimental v1 不实现（ADR-115 §3.1 第 4 条）。
   * 设计意图：Tab 离开 content 时关闭；需 focus 监听，留待 ADR-115a 解锁。
   */
  readonly closeOnTabOut?: boolean
  /**
   * @experimental v1 不实现（ADR-115 §3.1 第 4 条 / §2.6）。
   * 实施总是 portal 到 document.body；prop 保留 type 向前兼容。
   */
  readonly portalContainer?: HTMLElement | null
  /**
   * @experimental v1 不实现（ADR-115 §3.1 第 4 条）。
   * 设计意图：显示指向 trigger 的箭头；留待 ADR-115a 解锁。
   */
  readonly arrow?: boolean
  /** ARIA aria-haspopup 类型 + content role；默认 'dialog'。仅控制 ARIA 属性，不影响内部键盘（ADR-115 §2.7）*/
  readonly hasPopup?: PopoverHasPopup
  /** content a11y 标签 */
  readonly 'aria-label'?: string
  /** content 测试 id */
  readonly 'data-testid'?: string
}

const POPOVER_STYLE_BASE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-popover)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  outline: 'none',
}

const DEFAULT_OFFSET = 4
const DEFAULT_PLACEMENT: PopoverPlacement = 'bottom-start'
const ESTIMATED_CONTENT_SIZE = { width: 200, height: 80 }

/**
 * 警告 v1 标 @experimental 但消费方传入的 prop（仅 dev 环境提示一次）。
 */
const experimentalWarned = new Set<string>()
function warnExperimental(propName: string): void {
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return
  if (experimentalWarned.has(propName)) return
  experimentalWarned.add(propName)
  // eslint-disable-next-line no-console
  console.warn(
    `[admin-ui Popover] prop "${propName}" 标 @experimental，v1 不实施（ADR-115 §3.1）；` +
    `等待 ADR-115a 解锁后启用`,
  )
}

export function Popover({
  trigger,
  content,
  open: openControlled,
  onOpenChange,
  defaultOpen = false,
  placement = DEFAULT_PLACEMENT,
  offset = DEFAULT_OFFSET,
  modal,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  closeOnTabOut,
  portalContainer,
  arrow,
  hasPopup = 'dialog',
  'aria-label': ariaLabel,
  'data-testid': testId,
}: PopoverProps): React.ReactElement {
  const isControlled = openControlled !== undefined
  const [openInternal, setOpenInternal] = useState(defaultOpen)
  const open = isControlled ? openControlled : openInternal

  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: PopoverPlacement }>({
    top: 0,
    left: 0,
    placement,
  })

  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const popoverId = useId()

  // 客户端 mount 标记（SSR 守卫）
  useEffect(() => {
    setMounted(true)
  }, [])

  // @experimental prop dev 警告（不阻塞行为）
  useEffect(() => {
    if (modal === true) warnExperimental('modal')
    if (closeOnTabOut === true) warnExperimental('closeOnTabOut')
    if (portalContainer !== undefined && portalContainer !== null) warnExperimental('portalContainer')
    if (arrow === true) warnExperimental('arrow')
  }, [modal, closeOnTabOut, portalContainer, arrow])

  // ref forwarding 失败诊断（dev 模式）：open 时若 triggerRef 仍为 null，说明 trigger 是
  // 不支持 ref 的函数组件，cloneElement 注入的 ref 被忽略 → calcPos 短路，popover 定位回落
  // 到 (0, 0)。提示消费方用 React.forwardRef 修复。
  useEffect(() => {
    if (!open) return
    if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return
    if (triggerRef.current !== null) return
    // eslint-disable-next-line no-console
    console.warn(
      '[admin-ui Popover] trigger ref 注入失败 — 自定义函数组件须用 React.forwardRef 暴露 ref；' +
      '否则 popover 定位回落到 viewport 原点 (0, 0)',
    )
  }, [open])

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setOpenInternal(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  // 计算定位（基于 trigger + content 测量尺寸）
  const calcPos = useCallback(() => {
    const triggerEl = triggerRef.current
    if (!triggerEl) return
    const triggerRect = triggerEl.getBoundingClientRect()
    // contentRef 在 useLayoutEffect 时机已挂载（React 在 layout effect 之前完成 portal DOM mutations）；
    // 仅 offsetWidth/Height 为 0（如未渲染或被 display:none 遮蔽）时才回落到预估尺寸
    const contentEl = contentRef.current
    const contentSize = contentEl
      ? { width: contentEl.offsetWidth || ESTIMATED_CONTENT_SIZE.width, height: contentEl.offsetHeight || ESTIMATED_CONTENT_SIZE.height }
      : ESTIMATED_CONTENT_SIZE
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const result = computePosition({
      trigger: { top: triggerRect.top, left: triggerRect.left, width: triggerRect.width, height: triggerRect.height },
      content: contentSize,
      viewport,
      placement,
      offset,
    })
    setPos(result)
  }, [placement, offset])

  // open 时计算 + 监听 resize / scroll
  useLayoutEffect(() => {
    if (!open) return
    calcPos()
  }, [open, calcPos])

  useEffect(() => {
    if (!open) return
    const handler = () => calcPos()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open, calcPos])

  // ESC 关闭（dismiss 第 2 类）
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      // 焦点回 trigger（可访问性）
      triggerRef.current?.focus?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeOnEscape, setOpen])

  // outside click 关闭（dismiss 第 3 类）
  useEffect(() => {
    if (!open || !closeOnOutsideClick) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (contentRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, closeOnOutsideClick, setOpen])

  // trigger 注入：onClick toggle + ref + ARIA（dismiss 第 1 类 + ARIA §2.7）
  if (!isValidElement(trigger)) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[admin-ui Popover] trigger 必须是单个有效 React 元素')
    }
    return <>{trigger}</>
  }

  const triggerProps = (trigger.props ?? {}) as Record<string, unknown>
  const consumerOnClick = triggerProps.onClick as ((e: React.MouseEvent) => void) | undefined
  const consumerRef = (trigger as unknown as { ref?: React.Ref<HTMLElement> }).ref

  const mergedTrigger = cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
    onClick: (e: React.MouseEvent) => {
      try {
        consumerOnClick?.(e)
      } catch (err) {
        if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[admin-ui Popover] consumer onClick 抛出异常，已吞掉以保 toggle', err)
        }
      }
      setOpen(!open)
    },
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
      // 兼容消费方 ref（function ref / object ref）
      if (typeof consumerRef === 'function') {
        consumerRef(node)
      } else if (consumerRef && typeof consumerRef === 'object' && 'current' in consumerRef) {
        ;(consumerRef as React.MutableRefObject<HTMLElement | null>).current = node
      }
      // 注：ref 注入失败的 dev 诊断在 open useEffect 中做（callback 不被调用时此处不可达）
    },
    'aria-haspopup': hasPopup,
    'aria-expanded': open,
    'aria-controls': open ? popoverId : undefined,
  })

  // popover 节点：依赖 useLayoutEffect calcPos 在 mount 后立即基于实际 contentRef 尺寸定位；
  // contentRef 未挂载时 calcPos 用 ESTIMATED_CONTENT_SIZE 估算（首帧可能轻微错位 < 1 frame）
  const popoverEl = open && mounted ? (
    <div
      ref={contentRef}
      id={popoverId}
      role={hasPopup}
      aria-label={ariaLabel}
      tabIndex={-1}
      data-admin-popover
      data-placement={pos.placement}
      data-testid={testId}
      style={{ ...POPOVER_STYLE_BASE, top: pos.top, left: pos.left }}
    >
      {content}
    </div>
  ) : null

  return (
    <>
      {mergedTrigger}
      {mounted && open && createPortal(popoverEl, document.body)}
    </>
  )
}
