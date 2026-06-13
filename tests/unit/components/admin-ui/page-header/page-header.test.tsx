/**
 * PageHeader 单测（CHG-SN-5-PRE-03-A / SEQ-20260506-02）
 * 覆盖：基础渲染 / 三 slot / heading 语义级别 / a11y / data-testid / token-only 颜色
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { PageHeader } from '../../../../../packages/admin-ui/src/components/page-header/page-header'
import { VISUALLY_HIDDEN_STYLE } from '../../../../../packages/admin-ui/src/components/page-header/visually-hidden'

// ── 基础渲染 ─────────────────────────────────────────────────────

describe('PageHeader — 基础渲染', () => {
  it('渲染 data-page-header 容器', () => {
    const { container } = render(<PageHeader title="视频库" />)
    expect(container.querySelector('[data-page-header]')).toBeTruthy()
  })

  it('string title → h1 默认', () => {
    const { container } = render(<PageHeader title="视频库" />)
    const heading = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(heading.tagName).toBe('H1')
    expect(heading.textContent).toBe('视频库')
  })

  it('headingLevel=2 → h2', () => {
    const { container } = render(<PageHeader title="子区块" headingLevel={2} />)
    const heading = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(heading.tagName).toBe('H2')
  })

  it('ReactNode title → div（不强制 heading）', () => {
    const { container } = render(<PageHeader title={<span>自定义标题</span>} />)
    const titleEl = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(titleEl.tagName).toBe('DIV')
    expect(titleEl.querySelector('span')?.textContent).toBe('自定义标题')
  })
})

// ── 三 slot ──────────────────────────────────────────────────────

describe('PageHeader — 三 slot', () => {
  it('subtitle string → <p>', () => {
    const { container } = render(<PageHeader title="t" subtitle="120 条视频 · 最新采集 5 分钟前" />)
    const sub = container.querySelector('[data-page-header-subtitle]') as HTMLElement
    expect(sub.tagName).toBe('P')
    expect(sub.textContent).toContain('120 条视频')
  })

  it('subtitle ReactNode → <div>', () => {
    const { container } = render(<PageHeader title="t" subtitle={<span data-testid="sub-rich">rich</span>} />)
    const sub = container.querySelector('[data-page-header-subtitle]') as HTMLElement
    expect(sub.tagName).toBe('DIV')
    expect(sub.querySelector('[data-testid="sub-rich"]')?.textContent).toBe('rich')
  })

  it('未传 subtitle → 不渲染 data-page-header-subtitle', () => {
    const { container } = render(<PageHeader title="t" />)
    expect(container.querySelector('[data-page-header-subtitle]')).toBeNull()
  })

  it('actions 渲染到 data-page-header-actions 容器', () => {
    const { container } = render(
      <PageHeader title="t" actions={<button data-testid="primary-btn">触发采集</button>} />,
    )
    const actions = container.querySelector('[data-page-header-actions]') as HTMLElement
    expect(actions).toBeTruthy()
    expect(actions.querySelector('[data-testid="primary-btn"]')).toBeTruthy()
  })

  it('未传 actions → 不渲染 data-page-header-actions', () => {
    const { container } = render(<PageHeader title="t" />)
    expect(container.querySelector('[data-page-header-actions]')).toBeNull()
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('PageHeader — a11y', () => {
  it('默认容器为 <header>（reference §5 对齐）', () => {
    const { container } = render(<PageHeader title="t" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.tagName).toBe('HEADER')
  })

  it('as="div" → 容器为 <div>（嵌入 <main> 内的子区块场景）', () => {
    const { container } = render(<PageHeader title="t" as="div" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.tagName).toBe('DIV')
  })

  it('as="section" → 容器为 <section>', () => {
    const { container } = render(<PageHeader title="t" as="section" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.tagName).toBe('SECTION')
  })

  it('默认不设 role（由 as 元素的隐式语义承载）', () => {
    const { container } = render(<PageHeader title="t" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.hasAttribute('role')).toBe(false)
  })

  it('显式传 role 时生效', () => {
    const { container } = render(<PageHeader title="t" role="banner" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.getAttribute('role')).toBe('banner')
  })

  it('aria-label 传递', () => {
    const { container } = render(<PageHeader title="t" aria-label="视频库页头" />)
    const root = container.querySelector('[data-page-header]') as HTMLElement
    expect(root.getAttribute('aria-label')).toBe('视频库页头')
  })

  it('data-testid 传递', () => {
    const { container } = render(<PageHeader title="t" data-testid="ph-videos" />)
    expect(container.querySelector('[data-testid="ph-videos"]')).toBeTruthy()
  })
})

// ── titleVisuallyHidden（HDR-DEDUP 卡1 / arch-reviewer C1·C3） ───

describe('PageHeader — titleVisuallyHidden', () => {
  it('默认不传 → heading 不套 sr-only 样式（向后兼容）', () => {
    const { container } = render(<PageHeader title="视频库" />)
    const heading = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(heading.style.position).not.toBe('absolute')
    expect(heading.style.overflow).not.toBe('hidden')
  })

  it('true + string title → heading 仍渲染、文本不变、套 sr-only 样式（保 a11y）', () => {
    const { container } = render(<PageHeader title="视频库" titleVisuallyHidden />)
    const heading = container.querySelector('[data-page-header-title]') as HTMLElement
    // 元素仍在 DOM + 仍是 h1 + 文本不变（屏幕阅读器 / heading 导航可达）
    expect(heading.tagName).toBe('H1')
    expect(heading.textContent).toBe('视频库')
    // 套 sr-only 视觉隐藏样式（jsdom CSSOM 不反射 clip 简写，断言可靠反射的属性）
    expect(heading.style.position).toBe('absolute')
    expect(heading.style.overflow).toBe('hidden')
    expect(heading.style.width).toBe('1px')
  })

  it('true + string title → subtitle / actions 仍正常可见渲染（不受影响）', () => {
    const { container } = render(
      <PageHeader
        title="视频库"
        titleVisuallyHidden
        subtitle="共 120 位用户"
        actions={<button data-testid="ph-act">刷新</button>}
      />,
    )
    const sub = container.querySelector('[data-page-header-subtitle]') as HTMLElement
    expect(sub.style.position).not.toBe('absolute')
    expect(sub.textContent).toContain('共 120 位用户')
    expect(container.querySelector('[data-testid="ph-act"]')).toBeTruthy()
  })

  it('C3：true + ReactNode title → 不套 sr-only（ReactNode title 不受影响）', () => {
    const { container } = render(
      <PageHeader title={<span>动态问候</span>} titleVisuallyHidden />,
    )
    const titleEl = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(titleEl.tagName).toBe('DIV')
    expect(titleEl.style.position).not.toBe('absolute')
  })

  it('C2：VISUALLY_HIDDEN_STYLE 共享常量为视觉隐藏方案且零颜色字段', () => {
    expect(VISUALLY_HIDDEN_STYLE.position).toBe('absolute')
    expect(VISUALLY_HIDDEN_STYLE.overflow).toBe('hidden')
    expect(VISUALLY_HIDDEN_STYLE.width).toBe(1)
    expect('color' in VISUALLY_HIDDEN_STYLE).toBe(false)
  })
})

// ── 零硬编码颜色（token-only） ──────────────────────────────────

describe('PageHeader — 零硬编码颜色', () => {
  it('title 颜色用 var(--fg-default)', () => {
    const { container } = render(<PageHeader title="t" />)
    const title = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(title.style.color).toBe('var(--fg-default)')
  })

  it('subtitle 颜色用 var(--fg-muted)', () => {
    const { container } = render(<PageHeader title="t" subtitle="sub" />)
    const sub = container.querySelector('[data-page-header-subtitle]') as HTMLElement
    expect(sub.style.color).toBe('var(--fg-muted)')
  })

  it('title 字号用 var(--font-size-lg)', () => {
    const { container } = render(<PageHeader title="t" />)
    const title = container.querySelector('[data-page-header-title]') as HTMLElement
    expect(title.style.fontSize).toBe('var(--font-size-lg)')
  })
})
