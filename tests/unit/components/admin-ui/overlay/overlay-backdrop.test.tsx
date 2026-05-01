/**
 * OverlayBackdrop 单测（SEQ-20260501-01 CHG-DESIGN-13）
 *
 * 锁定契约：
 *   1. 默认 backdropTone='none' → background: transparent（不是 var(--bg-overlay)）
 *   2. backdropTone='dim' → background: var(--bg-overlay)
 *   3. 无 children → aria-hidden="true"（遮罩对辅助技术不可见）
 *   4. 有 children → 默认不输出 aria-hidden（dialog 内容辅助技术可见）
 *   5. ariaHidden 显式覆盖（有 children + ariaHidden=true → aria-hidden="true"）
 *   6. onClick 签名为 MouseEventHandler<HTMLDivElement>（e.target === e.currentTarget 语义不丢）
 *   7. legacy data attr 正确透传：data-drawer-backdrop / data-modal-backdrop / data-command-palette-backdrop
 *   8. style 合并：调用方 style 的 layout 属性生效；background/zIndex 被末位覆盖
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { OverlayBackdrop } from '../../../../../packages/admin-ui/src/components/overlay/overlay-backdrop'

// ── 1. 默认透明 ────────────────────────────────────────────────────

describe('OverlayBackdrop — backdropTone 默认 none', () => {
  it('未传 backdropTone 时 background 为 transparent', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).toBe('transparent')
  })

  it('backdropTone="none" 明确传入时 background 为 transparent', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" backdropTone="none" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).toBe('transparent')
  })

  it('默认 background 不是 var(--bg-overlay)', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).not.toBe('var(--bg-overlay)')
  })
})

// ── 2. dim opt-in ────────────────────────────────────────────────

describe('OverlayBackdrop — backdropTone="dim"', () => {
  it('backdropTone="dim" → background 为 var(--bg-overlay)', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" backdropTone="dim" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).toBe('var(--bg-overlay)')
  })
})

// ── 3. 无 children → aria-hidden ──────────────────────────────────

describe('OverlayBackdrop — aria-hidden 无 children', () => {
  it('无 children 时默认输出 aria-hidden="true"', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })
})

// ── 4. 有 children → 默认不隐藏 ───────────────────────────────────

describe('OverlayBackdrop — aria-hidden 有 children', () => {
  it('有 children 时默认不输出 aria-hidden', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)">
        <div role="dialog">弹窗内容</div>
      </OverlayBackdrop>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBeNull()
  })
})

// ── 5. ariaHidden 显式覆盖 ────────────────────────────────────────

describe('OverlayBackdrop — ariaHidden 显式覆盖', () => {
  it('有 children + ariaHidden=true → aria-hidden="true"', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" ariaHidden={true}>
        <div role="dialog">内容</div>
      </OverlayBackdrop>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('无 children + ariaHidden=false → 不输出 aria-hidden', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" ariaHidden={false} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBeNull()
  })
})

// ── 6. onClick MouseEventHandler 签名 ────────────────────────────

describe('OverlayBackdrop — onClick MouseEventHandler 签名', () => {
  it('onClick 收到 MouseEvent，target/currentTarget 语义完整', () => {
    let capturedTarget: EventTarget | null = null
    let capturedCurrentTarget: EventTarget | null = null

    const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
      capturedTarget = e.target
      capturedCurrentTarget = e.currentTarget
    }

    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" onClick={handleClick} />,
    )
    const el = container.firstElementChild as HTMLElement
    fireEvent.click(el)

    expect(capturedTarget).toBe(el)
    expect(capturedCurrentTarget).toBe(el)
  })

  it('点击内部 children 时 target !== currentTarget', () => {
    let capturedTarget: EventTarget | null = null
    let capturedCurrentTarget: EventTarget | null = null

    const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
      capturedTarget = e.target
      capturedCurrentTarget = e.currentTarget
    }

    const { container, getByText } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" onClick={handleClick}>
        <button type="button">内部按钮</button>
      </OverlayBackdrop>,
    )
    const backdrop = container.firstElementChild as HTMLElement
    fireEvent.click(getByText('内部按钮'))

    expect(capturedCurrentTarget).toBe(backdrop)
    expect(capturedTarget).not.toBe(backdrop)
  })
})

// ── 7. legacy data attr 透传 ─────────────────────────────────────

describe('OverlayBackdrop — legacy data attr 透传', () => {
  it('data-drawer-backdrop 布尔 true → 属性出现（空字符串）', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" data-drawer-backdrop={true} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.hasAttribute('data-drawer-backdrop')).toBe(true)
  })

  it('data-drawer-backdrop 字符串 → 属性值正确', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" data-drawer-backdrop="notifications" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-drawer-backdrop')).toBe('notifications')
  })

  it('data-modal-backdrop 布尔 true → 属性出现', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" data-modal-backdrop={true} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.hasAttribute('data-modal-backdrop')).toBe(true)
  })

  it('data-command-palette-backdrop 布尔 true → 属性出现', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" data-command-palette-backdrop={true} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.hasAttribute('data-command-palette-backdrop')).toBe(true)
  })

  it('data-overlay-backdrop 字符串透传', () => {
    const { container } = render(
      <OverlayBackdrop zIndex="var(--z-modal)" data-overlay-backdrop="drawer" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-overlay-backdrop')).toBe('drawer')
  })
})

// ── 8. style 合并顺序 ─────────────────────────────────────────────

describe('OverlayBackdrop — style 合并：background/zIndex 不可被调用方覆盖', () => {
  it('调用方 style.background 被 backdropTone 覆盖', () => {
    const { container } = render(
      <OverlayBackdrop
        zIndex="var(--z-modal)"
        backdropTone="none"
        style={{ background: 'red' }}
      />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).toBe('transparent')
    expect(el.style.background).not.toBe('red')
  })

  it('调用方 style 的 layout 属性生效（display flex）', () => {
    const { container } = render(
      <OverlayBackdrop
        zIndex="var(--z-modal)"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.display).toBe('flex')
    expect(el.style.alignItems).toBe('center')
    expect(el.style.justifyContent).toBe('center')
  })
})
