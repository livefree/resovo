/**
 * AdminInput 单测（CHG-SN-5-PRE-03-C / SEQ-20260506-02）
 * 覆盖：基础渲染 / type / size / prefix-suffix / error 态 / disabled / focus 切换 / a11y / token-only 颜色 / props 透传
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { AdminInput } from '../../../../../packages/admin-ui/src/components/admin-input/admin-input'

// ── 基础渲染 ─────────────────────────────────────────────────────

describe('AdminInput — 基础渲染', () => {
  it('渲染 data-admin-input wrapper + data-admin-input-control input', () => {
    const { container } = render(<AdminInput placeholder="搜索" />)
    expect(container.querySelector('[data-admin-input]')).toBeTruthy()
    expect(container.querySelector('[data-admin-input-control]')).toBeTruthy()
  })

  it('placeholder 透传', () => {
    const { container } = render(<AdminInput placeholder="搜视频" />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.placeholder).toBe('搜视频')
  })
})

// ── type ─────────────────────────────────────────────────────────

describe('AdminInput — type', () => {
  it('默认 type=text', () => {
    const { container } = render(<AdminInput />)
    expect((container.querySelector('input') as HTMLInputElement).type).toBe('text')
  })

  it.each(['email', 'password', 'number', 'search', 'tel', 'url'] as const)(
    'type=%s 透传到 input',
    (t) => {
      const { container } = render(<AdminInput type={t} />)
      expect((container.querySelector('input') as HTMLInputElement).type).toBe(t)
    },
  )
})

// ── size ─────────────────────────────────────────────────────────

describe('AdminInput — size', () => {
  it('默认 size=md → 28px wrapper 高', () => {
    const { container } = render(<AdminInput />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.getAttribute('data-size')).toBe('md')
    expect(wrapper.style.height).toBe('28px')
  })

  it('size=sm → 24px', () => {
    const { container } = render(<AdminInput size="sm" />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.style.height).toBe('24px')
  })

  it('size=lg → 32px + font-size-sm', () => {
    const { container } = render(<AdminInput size="lg" />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.style.height).toBe('32px')
    expect(wrapper.style.fontSize).toBe('var(--font-size-sm)')
  })
})

// ── prefix / suffix ──────────────────────────────────────────────

describe('AdminInput — prefix / suffix', () => {
  it('prefix 渲染到 data-admin-input-prefix slot', () => {
    const { container } = render(
      <AdminInput prefix={<span data-testid="px">¥</span>} />,
    )
    const slot = container.querySelector('[data-admin-input-prefix]')
    expect(slot?.querySelector('[data-testid="px"]')).toBeTruthy()
  })

  it('suffix 渲染到 data-admin-input-suffix slot', () => {
    const { container } = render(
      <AdminInput suffix={<span data-testid="sx">/100</span>} />,
    )
    const slot = container.querySelector('[data-admin-input-suffix]')
    expect(slot?.querySelector('[data-testid="sx"]')).toBeTruthy()
  })

  it('未传 prefix/suffix → 不渲染对应 slot', () => {
    const { container } = render(<AdminInput />)
    expect(container.querySelector('[data-admin-input-prefix]')).toBeNull()
    expect(container.querySelector('[data-admin-input-suffix]')).toBeNull()
  })
})

// ── error 态 ─────────────────────────────────────────────────────

describe('AdminInput — error', () => {
  it('error=true → data-error 属性 + aria-invalid + danger border 颜色', () => {
    const { container } = render(<AdminInput error />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    const input = container.querySelector('input') as HTMLInputElement
    expect(wrapper.hasAttribute('data-error')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(wrapper.style.borderColor).toContain('var(--border-danger')
  })

  it('error=false → 无 data-error + 无 aria-invalid', () => {
    const { container } = render(<AdminInput />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    const input = container.querySelector('input') as HTMLInputElement
    expect(wrapper.hasAttribute('data-error')).toBe(false)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })
})

// ── disabled ─────────────────────────────────────────────────────

describe('AdminInput — disabled', () => {
  it('disabled=true → input.disabled + wrapper opacity 0.5 + data-disabled', () => {
    const { container } = render(<AdminInput disabled />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(wrapper.style.opacity).toBe('0.5')
    expect(wrapper.style.cursor).toBe('not-allowed')
    expect(wrapper.hasAttribute('data-disabled')).toBe(true)
  })
})

// ── focus 切换 ───────────────────────────────────────────────────

describe('AdminInput — focus 切换', () => {
  it('focus → wrapper border-color 切到 border-strong / accent-default', () => {
    const { container } = render(<AdminInput />)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.focus(input)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.style.borderColor).toContain('var(--border-strong')
  })

  it('focus → blur 还原默认 borderColor (var(--border-default))', () => {
    const { container } = render(<AdminInput />)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.blur(input)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.style.borderColor).toBe('var(--border-default)')
  })

  it('onFocus / onBlur 透传', () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    const { container } = render(<AdminInput onFocus={onFocus} onBlur={onBlur} />)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

// ── a11y / props 透传 ────────────────────────────────────────────

describe('AdminInput — a11y / props 透传', () => {
  it('aria-label 透传到 input', () => {
    const { container } = render(<AdminInput aria-label="关键词" />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.getAttribute('aria-label')).toBe('关键词')
  })

  it('data-testid 容器透传', () => {
    const { container } = render(<AdminInput data-testid="ai-search" />)
    expect(container.querySelector('[data-testid="ai-search"]')).toBeTruthy()
  })

  it('value + onChange 受控模式', () => {
    const onChange = vi.fn()
    const { container } = render(<AdminInput value="abc" onChange={onChange} />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('abc')
    fireEvent.change(input, { target: { value: 'xyz' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('maxLength + name + autoComplete 等原生 attr 透传', () => {
    const { container } = render(
      <AdminInput name="email" maxLength={64} autoComplete="email" />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.name).toBe('email')
    expect(input.maxLength).toBe(64)
    expect(input.autocomplete).toBe('email')
  })
})

// ── 零硬编码颜色 ────────────────────────────────────────────────

describe('AdminInput — 零硬编码颜色', () => {
  it('wrapper background = var(--bg-surface)', () => {
    const { container } = render(<AdminInput />)
    const wrapper = container.querySelector('[data-admin-input]') as HTMLElement
    expect(wrapper.style.background).toBe('var(--bg-surface)')
  })

  it('input color = var(--fg-default)', () => {
    const { container } = render(<AdminInput />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.style.color).toBe('var(--fg-default)')
  })
})
