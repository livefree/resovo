/**
 * AdminButton 单测（CHG-SN-5-PRE-03-B / SEQ-20260506-02）
 * 覆盖：基础渲染 / variant / size / loading / disabled / icon slot / a11y / token-only colors / forwards rest props
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { AdminButton } from '../../../../../packages/admin-ui/src/components/admin-button/admin-button'

// ── 基础渲染 ─────────────────────────────────────────────────────

describe('AdminButton — 基础渲染', () => {
  it('渲染 data-admin-button 容器 + label', () => {
    const { container, getByText } = render(<AdminButton>采集</AdminButton>)
    expect(container.querySelector('[data-admin-button]')).toBeTruthy()
    expect(getByText('采集')).toBeTruthy()
  })

  it('默认 type=button（避免在 form 内意外提交）', () => {
    const { container } = render(<AdminButton>x</AdminButton>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('显式 type=submit 透传', () => {
    const { container } = render(<AdminButton type="submit">提交</AdminButton>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('type')).toBe('submit')
  })
})

// ── variant ──────────────────────────────────────────────────────

describe('AdminButton — variant', () => {
  it('默认 variant=default', () => {
    const { container } = render(<AdminButton>x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.getAttribute('data-variant')).toBe('default')
  })

  it('primary → accent-default 背景 + fg-on-accent 颜色', () => {
    const { container } = render(<AdminButton variant="primary">x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.style.background).toBe('var(--accent-default)')
    expect(btn.style.color).toBe('var(--fg-on-accent)')
  })

  it('danger → fg-danger 颜色', () => {
    const { container } = render(<AdminButton variant="danger">x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.style.color).toBe('var(--fg-danger)')
  })

  it('ghost → 透明背景', () => {
    const { container } = render(<AdminButton variant="ghost">x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.style.background).toBe('transparent')
  })
})

// ── size ─────────────────────────────────────────────────────────

describe('AdminButton — size', () => {
  it('默认 size=md → 28px 高', () => {
    const { container } = render(<AdminButton>x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.getAttribute('data-size')).toBe('md')
    expect(btn.style.height).toBe('28px')
  })

  it('size=sm → 24px', () => {
    const { container } = render(<AdminButton size="sm">x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.style.height).toBe('24px')
  })

  it('size=lg → 32px + font-size-sm', () => {
    const { container } = render(<AdminButton size="lg">x</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLElement
    expect(btn.style.height).toBe('32px')
    expect(btn.style.fontSize).toBe('var(--font-size-sm)')
  })
})

// ── loading ──────────────────────────────────────────────────────

describe('AdminButton — loading', () => {
  it('loading=true → 渲染 spinner + data-loading + aria-busy + aria-disabled', () => {
    const { container } = render(<AdminButton loading>采集</AdminButton>)
    const btn = container.querySelector('[data-admin-button]') as HTMLButtonElement
    expect(btn.hasAttribute('data-loading')).toBe(true)
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('[data-admin-button-spinner]')).toBeTruthy()
  })

  // arch-reviewer R-1
  it('loading=true → 原生 disabled 阻断 keyboard / 程式化 .click() / AT 激活', () => {
    const onClick = vi.fn()
    const { container } = render(<AdminButton loading onClick={onClick}>x</AdminButton>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    btn.click()  // 程式化 .click() 也被原生 disabled 阻断
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading=true → leftIcon 被 spinner 替代（保持宽度稳定）', () => {
    const { container } = render(
      <AdminButton loading leftIcon={<span data-testid="left">←</span>}>x</AdminButton>,
    )
    expect(container.querySelector('[data-admin-button-spinner]')).toBeTruthy()
    expect(container.querySelector('[data-testid="left"]')).toBeNull()
  })

  it('loading=true → rightIcon 也被抑制（避免 spinner + rightIcon 视觉重叠）', () => {
    const { container } = render(
      <AdminButton loading rightIcon={<span data-testid="right">→</span>}>x</AdminButton>,
    )
    expect(container.querySelector('[data-testid="right"]')).toBeNull()
  })

  // arch-reviewer Y-1
  it('loading=true → spinner @keyframes 自注入（不依赖消费方声明）', () => {
    const { container } = render(<AdminButton loading>x</AdminButton>)
    const styleEl = container.querySelector('style')
    expect(styleEl?.textContent).toContain('@keyframes admin-button-spin')
  })
})

// ── disabled ─────────────────────────────────────────────────────

describe('AdminButton — disabled', () => {
  it('disabled=true → button disabled + aria-disabled + opacity 0.5', () => {
    const { container } = render(<AdminButton disabled>x</AdminButton>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.style.opacity).toBe('0.5')
    expect(btn.style.cursor).toBe('not-allowed')
  })

  it('disabled=true → onClick 自然不触发（浏览器行为）', () => {
    const onClick = vi.fn()
    const { container } = render(<AdminButton disabled onClick={onClick}>x</AdminButton>)
    fireEvent.click(container.querySelector('button')!)
    expect(onClick).not.toHaveBeenCalled()
  })
})

// ── icon slot ────────────────────────────────────────────────────

describe('AdminButton — icon slot', () => {
  it('leftIcon 渲染到 data-admin-button-left-icon', () => {
    const { container } = render(
      <AdminButton leftIcon={<span data-testid="lico">+</span>}>新增</AdminButton>,
    )
    const slot = container.querySelector('[data-admin-button-left-icon]')
    expect(slot?.querySelector('[data-testid="lico"]')).toBeTruthy()
  })

  it('rightIcon 渲染到 data-admin-button-right-icon', () => {
    const { container } = render(
      <AdminButton rightIcon={<span data-testid="rico">→</span>}>下一步</AdminButton>,
    )
    const slot = container.querySelector('[data-admin-button-right-icon]')
    expect(slot?.querySelector('[data-testid="rico"]')).toBeTruthy()
  })

  it('未传 icon → 不渲染对应 slot', () => {
    const { container } = render(<AdminButton>x</AdminButton>)
    expect(container.querySelector('[data-admin-button-left-icon]')).toBeNull()
    expect(container.querySelector('[data-admin-button-right-icon]')).toBeNull()
  })

  // 纯 icon 按钮场景（无 children）
  it('children=undefined + 仅 leftIcon → 渲染 icon 不渲染 label', () => {
    const { container } = render(
      <AdminButton aria-label="收藏" leftIcon={<span data-testid="heart">♥</span>} />,
    )
    expect(container.querySelector('[data-testid="heart"]')).toBeTruthy()
    expect(container.querySelector('[data-admin-button-label]')).toBeNull()
  })
})

// ── secondary 别名 ────────────────────────────────────────────────

describe('AdminButton — secondary 别名', () => {
  it('secondary 与 default 视觉等价（同源对象引用避免漂移）', () => {
    const { container: c1 } = render(<AdminButton variant="default">a</AdminButton>)
    const { container: c2 } = render(<AdminButton variant="secondary">b</AdminButton>)
    const btn1 = c1.querySelector('[data-admin-button]') as HTMLElement
    const btn2 = c2.querySelector('[data-admin-button]') as HTMLElement
    expect(btn1.style.background).toBe(btn2.style.background)
    expect(btn1.style.color).toBe(btn2.style.color)
    expect(btn1.style.border).toBe(btn2.style.border)
  })
})

// ── a11y / props 透传 ────────────────────────────────────────────

describe('AdminButton — a11y / props 透传', () => {
  it('aria-label 透传', () => {
    const { container } = render(<AdminButton aria-label="启动全量采集">采集</AdminButton>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBe('启动全量采集')
  })

  it('data-testid 透传', () => {
    const { container } = render(<AdminButton data-testid="ab-trigger">x</AdminButton>)
    expect(container.querySelector('[data-testid="ab-trigger"]')).toBeTruthy()
  })

  it('onClick 默认触发', () => {
    const onClick = vi.fn()
    const { container } = render(<AdminButton onClick={onClick}>x</AdminButton>)
    fireEvent.click(container.querySelector('button')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('style 通过 styleOverride 合并到末位（消费方覆盖）', () => {
    const { container } = render(
      <AdminButton variant="primary" style={{ minWidth: '120px' }}>x</AdminButton>,
    )
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.style.minWidth).toBe('120px')
    // 不破坏 variant 默认 background
    expect(btn.style.background).toBe('var(--accent-default)')
  })
})
