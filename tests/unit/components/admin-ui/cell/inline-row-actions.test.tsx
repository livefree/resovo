/**
 * InlineRowActions 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { InlineRowActions } from '../../../../../packages/admin-ui/src/components/cell/inline-row-actions'
import type { InlineRowAction } from '../../../../../packages/admin-ui/src/components/cell/inline-row-actions.types'

afterEach(() => cleanup())

const NOOP = (): void => {}

function makeAction(over: Partial<InlineRowAction> = {}): InlineRowAction {
  return { key: 'a', children: 'A', onClick: NOOP, ...over }
}

describe('InlineRowActions — 基础渲染', () => {
  it('挂载 data-row-actions + role=group + ariaLabel 默认 "行操作"', () => {
    const { container } = render(<InlineRowActions actions={[]} />)
    const root = container.querySelector('[data-row-actions]')!
    expect(root.getAttribute('role')).toBe('group')
    expect(root.getAttribute('aria-label')).toBe('行操作')
  })

  it('actions 顺序 = 渲染顺序', () => {
    const actions = [
      makeAction({ key: 'edit', children: '编辑' }),
      makeAction({ key: 'play', children: '播放' }),
      makeAction({ key: 'publish', children: '上架' }),
    ]
    const { container } = render(<InlineRowActions actions={actions} />)
    const buttons = Array.from(container.querySelectorAll('[data-action-key]'))
    expect(buttons.map((b) => b.getAttribute('data-action-key'))).toEqual(['edit', 'play', 'publish'])
  })

  it('每个 button type=button（防 form submit）', () => {
    const actions = [makeAction({ key: 'a', children: 'A' })]
    const { container } = render(<InlineRowActions actions={actions} />)
    const btn = container.querySelector('[data-action-key="a"]') as HTMLButtonElement
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})

describe('InlineRowActions — primary / danger 互斥', () => {
  it('primary=true → data-primary + 紫底白字', () => {
    const actions = [makeAction({ key: 'p', children: '上架', primary: true })]
    const { container } = render(<InlineRowActions actions={actions} />)
    const btn = container.querySelector('[data-action-key="p"]') as HTMLElement
    expect(btn.getAttribute('data-primary')).toBe('true')
    expect(btn.style.background).toContain('--accent-default')
  })

  it('danger=true → data-danger + state-error 染色', () => {
    const actions = [makeAction({ key: 'd', children: '删除', danger: true })]
    const { container } = render(<InlineRowActions actions={actions} />)
    const btn = container.querySelector('[data-action-key="d"]') as HTMLElement
    expect(btn.getAttribute('data-danger')).toBe('true')
    expect(btn.style.color).toContain('--state-error-fg')
  })

  it('primary + danger 同时 → primary 优先 + console.warn + 不渲染 data-danger', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const actions = [makeAction({ key: 'pd', children: 'X', primary: true, danger: true })]
    const { container } = render(<InlineRowActions actions={actions} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/mutually exclusive/)
    const btn = container.querySelector('[data-action-key="pd"]') as HTMLElement
    expect(btn.getAttribute('data-primary')).toBe('true')
    expect(btn.getAttribute('data-danger')).toBeNull()
    warn.mockRestore()
  })

  it('既不 primary 也不 danger → 默认中性按钮', () => {
    const actions = [makeAction({ key: 'n', children: 'N' })]
    const { container } = render(<InlineRowActions actions={actions} />)
    const btn = container.querySelector('[data-action-key="n"]') as HTMLElement
    expect(btn.getAttribute('data-primary')).toBeNull()
    expect(btn.getAttribute('data-danger')).toBeNull()
    expect(btn.style.background).toContain('--bg-surface')
  })
})

describe('InlineRowActions — 点击 + e.stopPropagation', () => {
  it('onClick 调用', () => {
    const onClick = vi.fn()
    const actions = [makeAction({ key: 'c', children: 'C', onClick })]
    const { container } = render(<InlineRowActions actions={actions} />)
    fireEvent.click(container.querySelector('[data-action-key="c"]')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('点击事件不冒泡到父容器（stopPropagation）', () => {
    const childClick = vi.fn()
    const parentClick = vi.fn()
    const actions = [makeAction({ key: 'c', children: 'C', onClick: childClick })]
    const { container } = render(
      <div onClick={parentClick}>
        <InlineRowActions actions={actions} />
      </div>,
    )
    fireEvent.click(container.querySelector('[data-action-key="c"]')!)
    expect(childClick).toHaveBeenCalled()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('disabled=true → onClick 不调 + opacity 0.5', () => {
    const onClick = vi.fn()
    const actions = [makeAction({ key: 'd', children: 'D', onClick, disabled: true })]
    const { container } = render(<InlineRowActions actions={actions} />)
    const btn = container.querySelector('[data-action-key="d"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.style.opacity).toBe('0.5')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('InlineRowActions — alwaysVisible / a11y', () => {
  it('alwaysVisible=true → 渲染 opacity:1 + data-always-visible="true"', () => {
    const { container } = render(<InlineRowActions actions={[]} alwaysVisible />)
    const root = container.querySelector('[data-row-actions]') as HTMLElement
    expect(root.getAttribute('data-always-visible')).toBe('true')
    expect(root.style.opacity).toBe('1')
  })

  it('alwaysVisible 默认 false → 不渲染 data-always-visible', () => {
    const { container } = render(<InlineRowActions actions={[]} />)
    const root = container.querySelector('[data-row-actions]') as HTMLElement
    expect(root.getAttribute('data-always-visible')).toBeNull()
  })

  it('action.title 渲染为 button.title attribute', () => {
    const actions = [makeAction({ key: 't', children: '✎', title: '编辑' })]
    const { container } = render(<InlineRowActions actions={actions} />)
    expect(container.querySelector('[data-action-key="t"]')?.getAttribute('title')).toBe('编辑')
  })

  it('自定义 ariaLabel + testId', () => {
    const { container } = render(
      <InlineRowActions actions={[]} ariaLabel="视频行操作" testId="row-1-actions" />,
    )
    const root = container.querySelector('[data-row-actions]')!
    expect(root.getAttribute('aria-label')).toBe('视频行操作')
    expect(root.getAttribute('data-testid')).toBe('row-1-actions')
  })
})
