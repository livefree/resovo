'use client'

/**
 * overlay-backdrop.tsx — 统一 backdrop 原语（SEQ-20260501-01 CHG-DESIGN-13）
 * 真源：task-queue.md CHG-DESIGN-13
 *
 * 策略：后台浮层默认透明交互遮罩（backdropTone='none'）；
 * 只有经设计确认的破坏性确认弹窗才允许显式 opt-in backdropTone='dim'。
 *
 * style 合并顺序：{ ...BASE_STYLE, ...style, background, zIndex }
 * 确保调用方只能通过 style 补充 layout（flex、align、padding），
 * 无法覆盖 background（由 backdropTone 控制）和 zIndex（由 zIndex prop 控制）。
 *
 * ariaHidden 规则：
 *   - 无 children（DrawerShell / CommandPalette 独立遮罩）：默认 true
 *   - 有 children（Drawer / Modal 包住 dialog）：默认 false，调用方须显式传 ariaHidden={false}
 */
import React from 'react'

export type BackdropTone = 'none' | 'dim'

export interface OverlayBackdropProps {
  /** z-index token；消费方传入（Drawer → --z-modal；DrawerShell → --z-shell-drawer；CommandPalette → --z-shell-cmdk） */
  readonly zIndex: React.CSSProperties['zIndex']
  /** 'none'（默认）= transparent；'dim' = var(--bg-overlay)；dim 须设计确认 */
  readonly backdropTone?: BackdropTone
  /**
   * backdrop 点击回调。
   * 必须是 MouseEventHandler<HTMLDivElement>：消费方 useOverlay.backdropProps.onClick
   * 依赖 e.target === e.currentTarget 判断点击遮罩本体，用 () => void 会丢失此判断。
   */
  readonly onClick?: React.MouseEventHandler<HTMLDivElement>
  /** 子节点：Drawer/Modal 把 dialog 作为 children；DrawerShell/CommandPalette 遮罩独立不传 */
  readonly children?: React.ReactNode
  /**
   * 额外定位/layout 样式（Modal 需 flex 居中布局）。
   * 不得覆盖 background/zIndex（由 backdropTone/zIndex prop 强制末位覆盖保证）。
   */
  readonly style?: React.CSSProperties
  /** ARIA role；Drawer/Modal 传 'presentation'；DrawerShell/CommandPalette 不传 */
  readonly role?: React.AriaRole
  /**
   * 控制 aria-hidden 输出。
   * 默认值 = (children == null)：无 children 时 true（遮罩对辅助技术不可见）；
   * 有 children 时 false（dialog 内容对辅助技术可见）。
   * Drawer/Modal 必须显式传 ariaHidden={false}，否则 dialog 会被隐藏（a11y 回归）。
   */
  readonly ariaHidden?: boolean
  readonly 'data-testid'?: string
  /** 统一新选择器 */
  readonly 'data-overlay-backdrop'?: string
  /** legacy 选择器：drawer.tsx 透传保留 */
  readonly 'data-drawer-backdrop'?: string | boolean
  /** legacy 选择器：modal.tsx 透传保留 */
  readonly 'data-modal-backdrop'?: string | boolean
  /** legacy 选择器：command-palette.tsx 透传保留 */
  readonly 'data-command-palette-backdrop'?: string | boolean
}

const BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
}

/** 将 string | boolean | undefined 规范为 string | undefined，供 data-* attr 透传 */
function toDataAttr(v: string | boolean | undefined): string | undefined {
  if (v === false || v === undefined) return undefined
  if (v === true) return ''
  return v
}

export function OverlayBackdrop({
  zIndex,
  backdropTone = 'none',
  onClick,
  children,
  style,
  role,
  ariaHidden,
  'data-testid': testId,
  'data-overlay-backdrop': overlayBackdrop,
  'data-drawer-backdrop': drawerBackdrop,
  'data-modal-backdrop': modalBackdrop,
  'data-command-palette-backdrop': commandPaletteBackdrop,
}: OverlayBackdropProps): React.ReactElement {
  const background = backdropTone === 'dim' ? 'var(--bg-overlay)' : 'transparent'
  const hidden = ariaHidden ?? (children == null)

  const computedStyle: React.CSSProperties = {
    ...BASE_STYLE,
    ...style,
    background,
    zIndex,
  }

  return (
    <div
      role={role}
      style={computedStyle}
      aria-hidden={hidden || undefined}
      onClick={onClick}
      data-testid={testId}
      data-overlay-backdrop={overlayBackdrop}
      data-drawer-backdrop={toDataAttr(drawerBackdrop)}
      data-modal-backdrop={toDataAttr(modalBackdrop)}
      data-command-palette-backdrop={toDataAttr(commandPaletteBackdrop)}
    >
      {children}
    </div>
  )
}
