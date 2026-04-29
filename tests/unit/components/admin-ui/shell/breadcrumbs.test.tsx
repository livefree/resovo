/**
 * Breadcrumbs 渲染单测（CHG-SN-2-05）
 *
 * 覆盖：items 渲染 / 最后一项 strong 加粗 / onItemClick 行为（仅 href 项可点）/
 * 分隔符 / 空 items 不渲染 / data-* attribute
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Breadcrumbs } from '../../../../../packages/admin-ui/src/shell/breadcrumbs'

afterEach(() => {
  cleanup()
})

describe('Breadcrumbs — 渲染', () => {
  it('items 为空时返 null（不渲染容器）', () => {
    const { container } = render(<Breadcrumbs items={[]} />)
    expect(container.querySelector('[data-breadcrumbs]')).toBeNull()
  })

  it('单项渲染：仅 strong 加粗（active 项），无分隔符', () => {
    render(<Breadcrumbs items={[{ label: '管理台站', href: '/admin' }]} />)
    expect(screen.getByText('管理台站').tagName).toBe('STRONG')
  })

  it('多项渲染：最后一项 strong；中间项视 href + onItemClick 决定 button vs span', () => {
    const onClick = vi.fn()
    render(
      <Breadcrumbs
        items={[
          { label: '运营中心' },               // 无 href → span
          { label: '管理台站', href: '/admin' }, // 有 href + onClick → button
          { label: '当前视图', href: '/admin/x' }, // 最后一项 → strong（不可点）
        ]}
        onItemClick={onClick}
      />,
    )
    expect(screen.getByText('运营中心').tagName).toBe('SPAN')
    expect(screen.getByText('管理台站').tagName).toBe('BUTTON')
    expect(screen.getByText('当前视图').tagName).toBe('STRONG')
  })
})

describe('Breadcrumbs — onItemClick', () => {
  it('点击有 href 的中间项触发 onItemClick（携带 item + index）', () => {
    const onClick = vi.fn()
    render(
      <Breadcrumbs
        items={[
          { label: 'a', href: '/a' },
          { label: 'b', href: '/b' },
          { label: 'c' },  // 最后项
        ]}
        onItemClick={onClick}
      />,
    )
    screen.getByText('a').click()
    screen.getByText('b').click()
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onClick).toHaveBeenNthCalledWith(1, { label: 'a', href: '/a' }, 0)
    expect(onClick).toHaveBeenNthCalledWith(2, { label: 'b', href: '/b' }, 1)
  })

  it('未传 onItemClick 时有 href 项渲染为 span（非 button，不可点击）', () => {
    render(<Breadcrumbs items={[{ label: 'a', href: '/a' }, { label: 'b' }]} />)
    expect(screen.getByText('a').tagName).toBe('SPAN')
  })

  it('无 href 项不渲染 button（即使传了 onItemClick）', () => {
    const onClick = vi.fn()
    render(<Breadcrumbs items={[{ label: 'a' }, { label: 'b' }]} onItemClick={onClick} />)
    expect(screen.getByText('a').tagName).toBe('SPAN')
  })
})

describe('Breadcrumbs — 分隔符 + a11y', () => {
  it('多项之间渲染 " / " 分隔符（aria-hidden）', () => {
    const { container } = render(
      <Breadcrumbs items={[{ label: 'a', href: '/a' }, { label: 'b' }]} />,
    )
    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBe(1)
    expect(separators[0]?.textContent).toBe('/')
  })

  it('容器含 nav role + aria-label="面包屑"', () => {
    const { container } = render(<Breadcrumbs items={[{ label: 'a' }]} />)
    const nav = container.querySelector('[data-breadcrumbs]')
    expect(nav?.getAttribute('aria-label')).toBe('面包屑')
    expect(nav?.tagName).toBe('NAV')
  })

  it('button / span 含 data-breadcrumb-index attribute（debug 用）', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Breadcrumbs
        items={[{ label: 'a', href: '/a' }, { label: 'b' }, { label: 'c' }]}
        onItemClick={onClick}
      />,
    )
    expect(container.querySelector('[data-breadcrumb-index="0"]')?.tagName).toBe('BUTTON')
    expect(container.querySelector('[data-breadcrumb-index="1"]')?.tagName).toBe('SPAN')
    // 最后一项 strong 不带 data-breadcrumb-index
    expect(container.querySelector('[data-breadcrumb-index="2"]')).toBeNull()
  })

  it('button 显式 type="button"（防表单内嵌入时被误触发 submit）', () => {
    const onClick = vi.fn()
    render(
      <Breadcrumbs
        items={[{ label: 'a', href: '/a' }, { label: 'b' }]}
        onItemClick={onClick}
      />,
    )
    const button = screen.getByText('a') as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
  })
})
