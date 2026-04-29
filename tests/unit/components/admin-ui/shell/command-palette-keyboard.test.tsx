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

describe('CommandPalette — focus trap (Tab/Shift+Tab 循环)', () => {
  it('Tab 在末项 button 时循环回 input', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    const input = getInput()
    // 模拟焦点到末项 button（最后一个 focusable）
    const lastButton = document.body.querySelector('[data-command-palette-item="a-help"]') as HTMLButtonElement
    lastButton.focus()
    expect(document.activeElement).toBe(lastButton)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(input)
  })

  it('Shift+Tab 在 input（首项）时循环回末项 button', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    const input = getInput()
    input.focus()
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    const lastButton = document.body.querySelector('[data-command-palette-item="a-help"]')
    expect(document.activeElement).toBe(lastButton)
  })

  it('Tab 在中间项不拦截（默认行为，由浏览器处理）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    const middleButton = document.body.querySelector('[data-command-palette-item="g-moderation"]') as HTMLButtonElement
    middleButton.focus()
    const evt = fireEvent.keyDown(dialog, { key: 'Tab' })
    // 中间项 Tab 不 preventDefault；浏览器走默认顺序
    expect(evt).toBe(true)  // event 未被消费 → 返回 true
  })

  it('焦点不在 panel 内 → focus trap 不拦截', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = getDialog()
    // 焦点在 body（非 panel 内）
    document.body.focus()
    expect(() => fireEvent.keyDown(dialog, { key: 'Tab' })).not.toThrow()
  })
})

describe('CommandPalette — groups 异步变化时 activeIndex 夹逼', () => {
  it('groups 收缩使 activeIndex 越界 → reset 到 0（Enter 选首项不 no-op）', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />,
    )
    const dialog = getDialog()
    // 移到第 4 项（末项 a-help，activeIndex=3）
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-a-help')
    // groups 收缩到 1 组 1 项 → 原 activeIndex=3 越界
    const shrunk: readonly CommandGroup[] = [
      { id: 'nav', label: '导航', items: [{ id: 'g-dashboard', label: '管理台站', kind: 'navigate', href: '/admin' }] },
    ]
    rerender(<CommandPalette open groups={shrunk} onClose={onClose} onAction={onAction} />)
    // 夹逼后 activeIndex 应为 0
    expect(activeId()).toBe('command-option-g-dashboard')
    // Enter 触发首项（不 no-op）
    fireEvent.keyDown(getDialog(), { key: 'Enter' })
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]?.id).toBe('g-dashboard')
  })

  it('groups empty → repopulate 全新 items（同长度但 id 不同）→ active 回首项（不选错项）', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <CommandPalette open groups={GROUPS} onClose={onClose} onAction={onAction} />,
    )
    const dialog = getDialog()
    // 移到末项（activeId='a-help'，index=3）
    fireEvent.keyDown(dialog, { key: 'ArrowUp' })
    expect(activeId()).toBe('command-option-a-help')
    // 中间态：groups 全空
    rerender(<CommandPalette open groups={[]} onClose={onClose} onAction={onAction} />)
    expect(document.body.querySelector('[data-command-palette-empty]')).toBeTruthy()
    // 重新注入 4 个完全不同 id 的 items（与原 activeId 'a-help' 无重合）
    const fresh: readonly CommandGroup[] = [
      {
        id: 'search',
        label: '搜索结果',
        items: [
          { id: 's-1', label: '搜索 1', kind: 'invoke' },
          { id: 's-2', label: '搜索 2', kind: 'invoke' },
          { id: 's-3', label: '搜索 3', kind: 'invoke' },
          { id: 's-4', label: '搜索 4', kind: 'invoke' },
        ],
      },
    ]
    rerender(<CommandPalette open groups={fresh} onClose={onClose} onAction={onAction} />)
    // 原 activeId 'a-help' 在新 flatItems 中不存在 → 回退首项 's-1'（不指向 's-4' 即不选错项）
    expect(activeId()).toBe('command-option-s-1')
    // Enter 触发 's-1'（绝不可能是 's-4' 这个 stale 末项）
    fireEvent.keyDown(getDialog(), { key: 'Enter' })
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]?.id).toBe('s-1')
  })

  it('groups 同长度内容替换（id 全异）→ active 回首项', () => {
    const { rerender } = render(
      <CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />,
    )
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(activeId()).toBe('command-option-a-toggle-theme')
    // 同长度（4 项）但 id 全异
    const replaced: readonly CommandGroup[] = [
      {
        id: 'g',
        label: 'g',
        items: [
          { id: 'r-1', label: 'A', kind: 'invoke' },
          { id: 'r-2', label: 'B', kind: 'invoke' },
          { id: 'r-3', label: 'C', kind: 'invoke' },
          { id: 'r-4', label: 'D', kind: 'invoke' },
        ],
      },
    ]
    rerender(<CommandPalette open groups={replaced} onClose={vi.fn()} onAction={vi.fn()} />)
    // 原 activeId 不在新列表 → 回首项（避免数值 index 残留指向 'r-3'）
    expect(activeId()).toBe('command-option-r-1')
  })

  it('groups 重排（id 不变但顺序变化）→ active 跟随原 id 到新位置', () => {
    const { rerender } = render(
      <CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />,
    )
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })  // activeId='g-moderation' index=1
    expect(activeId()).toBe('command-option-g-moderation')
    // 重排：actions 组提到前面 → g-moderation 仍是 nav 第 2 项，但全局扁平索引变化
    const reordered: readonly CommandGroup[] = [GROUPS[1]!, GROUPS[0]!]
    rerender(<CommandPalette open groups={reordered} onClose={vi.fn()} onAction={vi.fn()} />)
    // activeId 跟随到新位置（不再是数值 index 1，而是 g-moderation 在新顺序中的位置）
    expect(activeId()).toBe('command-option-g-moderation')
  })

  it('groups 扩张（消费方异步注入"搜索结果"组）→ activeIndex 不变（仍指向原项）', () => {
    const { rerender } = render(
      <CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />,
    )
    const dialog = getDialog()
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })  // 移到 index=1
    expect(activeId()).toBe('command-option-g-moderation')
    const expanded: readonly CommandGroup[] = [
      ...GROUPS,
      {
        id: 'search',
        label: '搜索结果',
        items: [{ id: 's-1', label: '搜索匹配项', kind: 'invoke' }],
      },
    ]
    rerender(<CommandPalette open groups={expanded} onClose={vi.fn()} onAction={vi.fn()} />)
    // 扩张时 activeIndex=1 仍在范围内 → 不夹逼，仍指向 g-moderation
    expect(activeId()).toBe('command-option-g-moderation')
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
