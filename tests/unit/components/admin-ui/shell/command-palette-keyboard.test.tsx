/**
 * CommandPalette 键盘导航 + 交互单测（CHG-SN-2-11）
 *
 * 覆盖：
 *   - ArrowDown/ArrowUp 循环 + 跨 group 扁平索引
 *   - Enter 触发 onAction(item) + onClose
 *   - Esc 触发 onClose
 *   - mouse hover (onMouseEnter) 同步 activeIndex
 *   - click button 触发 onAction(item) + onClose
 *   - backdrop click → onClose
 *   - query 过滤（不区分大小写 + label.includes）
 *   - query 变化时 activeIndex 重置为 0
 *   - try/finally 保护：onAction throw 仍调 onClose；onClose throw 不抛出
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../../../../../packages/admin-ui/src/shell/command-palette'
import type { CommandGroup } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const GROUPS: readonly CommandGroup[] = [
  {
    id: 'nav',
    label: '导航',
    items: [
      { id: 'g-dashboard', label: '管理台站', kind: 'navigate', href: '/admin' },
      { id: 'g-moderation', label: '内容审核', kind: 'navigate', href: '/admin/moderation' },
    ],
  },
  {
    id: 'actions',
    label: '快捷操作',
    items: [
      { id: 'a-toggle-theme', label: '切换主题', kind: 'invoke' },
      { id: 'a-help', label: '帮助', kind: 'invoke' },
    ],
  },
]

function getDialog(): HTMLElement {
  return document.body.querySelector('[data-command-palette]') as HTMLElement
}

function getInput(): HTMLInputElement {
  return document.body.querySelector('[data-command-palette-input]') as HTMLInputElement
}

function activeId(): string | null {
  const input = getInput()
  return input.getAttribute('aria-activedescendant')
}

describe('CommandPalette — 键盘 ArrowDown/Up 循环 + 跨 group 扁平索引', () => {
  it('ArrowDown：0 → 1 → 2 → 3 → 0（4 项循环）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    expect(activeId()).toBe('command-option-g-dashboard')
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-g-moderation')
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-a-toggle-theme')  // 跨 group
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-a-help')
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-g-dashboard')  // 循环回首项
  })

  it('ArrowUp：0 → 3 → 2 → 1 → 0（反向循环）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    expect(activeId()).toBe('command-option-g-dashboard')
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(activeId()).toBe('command-option-a-help')  // 反向循环到末项
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(activeId()).toBe('command-option-a-toggle-theme')
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(activeId()).toBe('command-option-g-moderation')
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(activeId()).toBe('command-option-g-dashboard')
  })
})

describe('CommandPalette — Enter 触发 onAction + onClose', () => {
  it('Enter 触发当前 activeItem 的 onAction + 自动 onClose', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />)
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]?.id).toBe('g-dashboard')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ArrowDown 2 次后 Enter → 触发第 3 项（a-toggle-theme）', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />)
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onAction.mock.calls[0]?.[0]?.id).toBe('a-toggle-theme')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('flatItems 为空时 Enter 不触发 onAction（无效操作）', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open groups={[]} onClose={onClose} onAction={onAction} />)
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(onAction).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('CommandPalette — Esc 触发 onClose', () => {
  it('Esc → onClose 调用一次', () => {
    const onClose = vi.fn()
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={vi.fn()} />)
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('flatItems 为空时 Esc 仍触发 onClose', () => {
    const onClose = vi.fn()
    render(<CommandPalette open groups={[]} onClose={onClose} onAction={vi.fn()} />)
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CommandPalette — mouse hover 同步 activeIndex', () => {
  it('onMouseEnter 第 2 项 → aria-activedescendant 切到该项', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const moderation = document.body.querySelector('[data-command-palette-item="g-moderation"]') as HTMLElement
    fireEvent.mouseEnter(moderation)
    expect(activeId()).toBe('command-option-g-moderation')
  })

  it('hover 跨 group 第 3 项（a-toggle-theme）→ activeIndex 跳到扁平索引 2', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const toggle = document.body.querySelector('[data-command-palette-item="a-toggle-theme"]') as HTMLElement
    fireEvent.mouseEnter(toggle)
    expect(activeId()).toBe('command-option-a-toggle-theme')
    // 视觉 active 也跟随
    expect(toggle.getAttribute('data-command-palette-item-active')).toBe('true')
  })
})

describe('CommandPalette — 点击 item 触发 onAction + onClose', () => {
  it('click button → onAction(item) + onClose', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />)
    const help = document.body.querySelector('[data-command-palette-item="a-help"]') as HTMLButtonElement
    fireEvent.click(help)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]?.id).toBe('a-help')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CommandPalette — backdrop click → onClose', () => {
  it('点击 backdrop 触发 onClose', () => {
    const onClose = vi.fn()
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={vi.fn()} />)
    const backdrop = document.body.querySelector('[data-command-palette-backdrop]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CommandPalette — query 过滤', () => {
  it('query="审核" → 只渲染含"审核"的项（不区分大小写）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: '审核' } })
    const options = document.body.querySelectorAll('[role="option"]')
    expect(options.length).toBe(1)
    expect(document.body.querySelector('[data-command-palette-item="g-moderation"]')).toBeTruthy()
    expect(document.body.querySelector('[data-command-palette-item="g-dashboard"]')).toBeNull()
  })

  it('query="ZZZZZZZZZ" → 空态"无匹配结果"', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: 'ZZZZZZZZZ' } })
    expect(document.body.querySelector('[data-command-palette-empty]')?.textContent).toBe('无匹配结果')
  })

  it('query="   "（仅空白）→ trim 后等价空 query，4 项全显示', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: '   ' } })
    expect(document.body.querySelectorAll('[role="option"]').length).toBe(4)
  })

  it('英文 query 不区分大小写', () => {
    const groups: readonly CommandGroup[] = [
      {
        id: 'g',
        label: 'g',
        items: [
          { id: 'a', label: 'Dashboard', kind: 'invoke' },
          { id: 'b', label: 'Settings', kind: 'invoke' },
        ],
      },
    ]
    render(<CommandPalette open groups={groups} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: 'DASH' } })
    const options = document.body.querySelectorAll('[role="option"]')
    expect(options.length).toBe(1)
    expect(document.body.querySelector('[data-command-palette-item="a"]')).toBeTruthy()
  })

  it('query 变化时 activeIndex 重置为 0（首个匹配项）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    const input = getInput()
    // 先 ArrowDown 切到第 3 项
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-a-toggle-theme')
    // 输入 query → 重置到 index 0（即过滤后首项）
    fireEvent.change(input, { target: { value: '管理' } })
    expect(activeId()).toBe('command-option-g-dashboard')
  })
})

describe('CommandPalette — try/finally 保护', () => {
  it('onAction throw → 仍调用 onClose（finally）', () => {
    // try/finally 语义：onAction 抛错后 finally 块继续执行 onClose；
    // React 事件系统吞掉 handler 同步抛错，这里通过 window error 监听器捕获以避免 vitest unhandled error 噪声。
    const errorHandler = (e: ErrorEvent) => e.preventDefault()
    window.addEventListener('error', errorHandler)
    try {
      const onAction = vi.fn(() => {
        throw new Error('boom')
      })
      const onClose = vi.fn()
      render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />)
      const dialog = getDialog()
      fireEvent.keyDown(dialog, { key: 'Enter' })
      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('error', errorHandler)
    }
  })

  it('Esc onClose throw → 静默捕获（不抛出）', () => {
    const onClose = vi.fn(() => {
      throw new Error('close-fail')
    })
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={vi.fn()} />)
    const dialog = getDialog()
    expect(() => fireEvent.keyDown(dialog, { key: 'Escape' })).not.toThrow()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click onClose throw → 静默捕获', () => {
    const onClose = vi.fn(() => {
      throw new Error('close-fail')
    })
    render(<CommandPalette open groups={GROUPS} onClose={onClose} onAction={vi.fn()} />)
    const backdrop = document.body.querySelector('[data-command-palette-backdrop]') as HTMLElement
    expect(() => fireEvent.click(backdrop)).not.toThrow()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CommandPalette — open=true → false 时 query 重置', () => {
  it('再次 open=true 时 query 为空（filterAndFlatten 全显示）', () => {
    const { rerender } = render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: '审核' } })
    expect(document.body.querySelectorAll('[role="option"]').length).toBe(1)
    rerender(<CommandPalette open={false} groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    rerender(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const inputAfter = getInput()
    expect(inputAfter.value).toBe('')
    expect(document.body.querySelectorAll('[role="option"]').length).toBe(4)
  })
})
