/**
 * AdminCard 单测（CHG-SN-5-PRE-03-E / SEQ-20260506-02）
 * 覆盖：基础渲染 / surface / padding / header 三 slot / footer / status / a11y / token-only 颜色
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { AdminCard } from '../../../../../packages/admin-ui/src/components/admin-card/admin-card'

// ── 基础渲染 ─────────────────────────────────────────────────────

describe('AdminCard — 基础渲染', () => {
  it('渲染 data-admin-card 容器 + body', () => {
    const { container } = render(<AdminCard>内容</AdminCard>)
    expect(container.querySelector('[data-admin-card]')).toBeTruthy()
    expect(container.querySelector('[data-admin-card-body]')?.textContent).toBe('内容')
  })

  it('未传 header → 不渲染 data-admin-card-header', () => {
    const { container } = render(<AdminCard>x</AdminCard>)
    expect(container.querySelector('[data-admin-card-header]')).toBeNull()
  })

  it('未传 footer → 不渲染 data-admin-card-footer', () => {
    const { container } = render(<AdminCard>x</AdminCard>)
    expect(container.querySelector('[data-admin-card-footer]')).toBeNull()
  })

  it('header 全空 → 不渲染 header（避免空容器）', () => {
    const { container } = render(<AdminCard header={{}}>x</AdminCard>)
    expect(container.querySelector('[data-admin-card-header]')).toBeNull()
  })
})

// ── surface ──────────────────────────────────────────────────────

describe('AdminCard — surface 层级', () => {
  it('默认 surface=elevated → bg-surface-elevated', () => {
    const { container } = render(<AdminCard>x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.getAttribute('data-surface')).toBe('elevated')
    expect(root.style.background).toBe('var(--bg-surface-elevated)')
  })

  it('surface=plain → bg-surface', () => {
    const { container } = render(<AdminCard surface="plain">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.background).toBe('var(--bg-surface)')
  })

  it('surface=subtle → 用 bg-subtle 回退到 bg-surface', () => {
    const { container } = render(<AdminCard surface="subtle">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.background).toContain('var(--bg-subtle')
  })
})

// ── padding ──────────────────────────────────────────────────────

describe('AdminCard — body padding', () => {
  it('默认 padding=md → 14px', () => {
    const { container } = render(<AdminCard>x</AdminCard>)
    const body = container.querySelector('[data-admin-card-body]') as HTMLElement
    expect(body.style.padding).toBe('14px')
  })

  it('padding=none → 0（撤销）', () => {
    const { container } = render(<AdminCard padding="none">x</AdminCard>)
    const body = container.querySelector('[data-admin-card-body]') as HTMLElement
    expect(body.style.padding).toBe('0px')
  })

  it('padding=lg → 20px', () => {
    const { container } = render(<AdminCard padding="lg">x</AdminCard>)
    const body = container.querySelector('[data-admin-card-body]') as HTMLElement
    expect(body.style.padding).toBe('20px')
  })

  it('padding=sm → 8px', () => {
    const { container } = render(<AdminCard padding="sm">x</AdminCard>)
    const body = container.querySelector('[data-admin-card-body]') as HTMLElement
    expect(body.style.padding).toBe('8px')
  })
})

// ── header 三 slot ───────────────────────────────────────────────

describe('AdminCard — header 三 slot', () => {
  it('header.title string → <h3>', () => {
    const { container } = render(<AdminCard header={{ title: '关注事项' }}>x</AdminCard>)
    const title = container.querySelector('[data-admin-card-title]') as HTMLElement
    expect(title.tagName).toBe('H3')
    expect(title.textContent).toBe('关注事项')
  })

  it('header.title ReactNode → <div>', () => {
    const { container } = render(
      <AdminCard header={{ title: <span data-testid="rich-title">混合标题</span> }}>x</AdminCard>,
    )
    const title = container.querySelector('[data-admin-card-title]') as HTMLElement
    expect(title.tagName).toBe('DIV')
    expect(title.querySelector('[data-testid="rich-title"]')?.textContent).toBe('混合标题')
  })

  it('header.subtitle string → <p>', () => {
    const { container } = render(
      <AdminCard header={{ title: 't', subtitle: '按优先级排序' }}>x</AdminCard>,
    )
    const sub = container.querySelector('[data-admin-card-subtitle]') as HTMLElement
    expect(sub.tagName).toBe('P')
    expect(sub.textContent).toBe('按优先级排序')
  })

  it('header.actions 渲染到 data-admin-card-actions', () => {
    const { container } = render(
      <AdminCard header={{ title: 't', actions: <button data-testid="resolve">全部解决</button> }}>x</AdminCard>,
    )
    const actions = container.querySelector('[data-admin-card-actions]')
    expect(actions?.querySelector('[data-testid="resolve"]')).toBeTruthy()
  })

  it('仅传 actions（无 title / subtitle）→ header 仍渲染', () => {
    const { container } = render(
      <AdminCard header={{ actions: <button data-testid="only-action">x</button> }}>body</AdminCard>,
    )
    expect(container.querySelector('[data-admin-card-header]')).toBeTruthy()
    expect(container.querySelector('[data-testid="only-action"]')).toBeTruthy()
  })
})

// ── footer ───────────────────────────────────────────────────────

describe('AdminCard — footer', () => {
  it('footer 渲染到 data-admin-card-footer + 顶部 border', () => {
    const { container } = render(
      <AdminCard footer={<span data-testid="ft">查看更多</span>}>x</AdminCard>,
    )
    const footer = container.querySelector('[data-admin-card-footer]') as HTMLElement
    expect(footer).toBeTruthy()
    expect(footer.querySelector('[data-testid="ft"]')).toBeTruthy()
    expect(footer.style.borderTop).toContain('1px solid')
  })
})

// ── status ───────────────────────────────────────────────────────

describe('AdminCard — status 修饰', () => {
  it('status=warn → border-color 切到 warn token + data-status', () => {
    const { container } = render(<AdminCard status="warn">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.getAttribute('data-status')).toBe('warn')
    expect(root.style.borderColor).toContain('var(--border-warn')
  })

  it('status=danger → border-color danger', () => {
    const { container } = render(<AdminCard status="danger">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.borderColor).toContain('var(--border-danger')
  })

  it('status=ok → border-color ok', () => {
    const { container } = render(<AdminCard status="ok">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.borderColor).toContain('var(--border-ok')
  })

  it('未传 status → border-color 默认', () => {
    const { container } = render(<AdminCard>x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.borderColor).toBe('var(--border-default)')
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('AdminCard — a11y', () => {
  it('role + aria-label 透传', () => {
    const { container } = render(
      <AdminCard role="region" aria-label="关注事项卡">x</AdminCard>,
    )
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.getAttribute('role')).toBe('region')
    expect(root.getAttribute('aria-label')).toBe('关注事项卡')
  })

  it('data-testid 透传', () => {
    const { container } = render(<AdminCard data-testid="card-attention">x</AdminCard>)
    expect(container.querySelector('[data-testid="card-attention"]')).toBeTruthy()
  })
})

// ── 扩展槽位（headingLevel / className / style） ───────────────────

describe('AdminCard — 扩展槽位', () => {
  it('默认 headingLevel=3 → string title 渲染 <h3>', () => {
    const { container } = render(<AdminCard header={{ title: 't' }}>x</AdminCard>)
    expect((container.querySelector('[data-admin-card-title]') as HTMLElement).tagName).toBe('H3')
  })

  it('headingLevel=2 → <h2>（PageHeader+AdminCard 平级场景）', () => {
    const { container } = render(<AdminCard headingLevel={2} header={{ title: 't' }}>x</AdminCard>)
    expect((container.querySelector('[data-admin-card-title]') as HTMLElement).tagName).toBe('H2')
  })

  it('headingLevel=4 → <h4>（深度嵌套场景）', () => {
    const { container } = render(<AdminCard headingLevel={4} header={{ title: 't' }}>x</AdminCard>)
    expect((container.querySelector('[data-admin-card-title]') as HTMLElement).tagName).toBe('H4')
  })

  it('className 传递到 root', () => {
    const { container } = render(<AdminCard className="grid-area-attention">x</AdminCard>)
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.className).toContain('grid-area-attention')
  })

  it('style 透传 + 不破坏 surface 默认背景', () => {
    const { container } = render(
      <AdminCard style={{ marginTop: '20px', flexBasis: '300px' }}>x</AdminCard>,
    )
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.marginTop).toBe('20px')
    expect(root.style.flexBasis).toBe('300px')
    expect(root.style.background).toBe('var(--bg-surface-elevated)')
  })

  it('style 显式覆盖 background 时优先于 surface', () => {
    const { container } = render(
      <AdminCard style={{ background: 'var(--bg-custom)' }}>x</AdminCard>,
    )
    const root = container.querySelector('[data-admin-card]') as HTMLElement
    expect(root.style.background).toBe('var(--bg-custom)')
  })
})
