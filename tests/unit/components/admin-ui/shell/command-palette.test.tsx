/**
 * CommandPalette 渲染单测（CHG-SN-2-11）
 *
 * 覆盖：portal + center 对齐 / role+aria-* / 输入框 / 3 组渲染（含空 group 过滤）/
 * activeIndex 视觉 / shortcut 渲染 / meta / icon / 空态 / SSR mounted / placeholder
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
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
      { id: 'g-dashboard', label: '管理台站', shortcut: 'mod+1', kind: 'navigate', href: '/admin' },
      { id: 'g-moderation', label: '内容审核', shortcut: 'mod+2', kind: 'navigate', href: '/admin/moderation' },
    ],
  },
  {
    id: 'actions',
    label: '快捷操作',
    items: [
      { id: 'a-toggle-theme', label: '切换主题', kind: 'invoke', meta: '⌘+,' },
      { id: 'a-help', label: '帮助', kind: 'invoke' },
    ],
  },
  {
    id: 'search',
    label: '搜索结果',
    items: [],
  },
]

describe('CommandPalette — open=false 不渲染', () => {
  it('open=false → portal 不渲染', () => {
    render(
      <CommandPalette open={false} groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />,
    )
    expect(document.body.querySelector('[data-command-palette]')).toBeNull()
  })
})

describe('CommandPalette — open=true 渲染（portal + ARIA）', () => {
  it('portal 启用：panel 在 document.body', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(document.body.querySelector('[data-command-palette]')).toBeTruthy()
  })

  it('容器 role="dialog" + aria-modal="true" + aria-labelledby', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dialog = document.body.querySelector('[data-command-palette]') as HTMLElement
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('command-palette-title')
  })

  it('输入框 role="combobox" + aria-controls + aria-activedescendant', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const input = document.body.querySelector('[data-command-palette-input]') as HTMLInputElement
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-controls')).toBe('command-palette-listbox')
    expect(input.getAttribute('aria-activedescendant')).toBe('command-option-g-dashboard')
  })

  it('listbox role="listbox" + 每 item role="option" + aria-selected', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const listbox = document.body.querySelector('[data-command-palette-listbox]') as HTMLElement
    expect(listbox.tagName).toBe('UL')
    expect(listbox.getAttribute('role')).toBe('listbox')
    const options = document.body.querySelectorAll('[role="option"]')
    expect(options.length).toBe(4)  // 2 nav + 2 actions（search 空 group 过滤）
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')  // activeIndex=0
    expect(options[1]?.getAttribute('aria-selected')).toBe('false')
  })

  it('placeholder 默认"输入命令…" + 自定义 placeholder', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    expect((document.body.querySelector('[data-command-palette-input]') as HTMLInputElement).placeholder).toBe('输入命令…')
    cleanup()
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} placeholder="搜索..." />)
    expect((document.body.querySelector('[data-command-palette-input]') as HTMLInputElement).placeholder).toBe('搜索...')
  })
})

describe('CommandPalette — 3 组渲染 + 空 group 过滤', () => {
  it('渲染 2 个非空 group（search 空 group 自动隐藏）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(document.body.querySelector('[data-command-palette-group="nav"]')).toBeTruthy()
    expect(document.body.querySelector('[data-command-palette-group="actions"]')).toBeTruthy()
    expect(document.body.querySelector('[data-command-palette-group="search"]')).toBeNull()
  })

  it('group label 渲染', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const labels = document.body.querySelectorAll('[data-command-palette-group-label]')
    expect(labels[0]?.textContent).toBe('导航')
    expect(labels[1]?.textContent).toBe('快捷操作')
  })

  it('每项含 button + data-command-palette-item-{id|kind}', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const dashboard = document.body.querySelector('[data-command-palette-item="g-dashboard"]') as HTMLButtonElement
    expect(dashboard.tagName).toBe('BUTTON')
    expect(dashboard.getAttribute('data-command-palette-item-kind')).toBe('navigate')
    const help = document.body.querySelector('[data-command-palette-item="a-help"]') as HTMLButtonElement
    expect(help.getAttribute('data-command-palette-item-kind')).toBe('invoke')
  })

  it('button type="button"（防 submit）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const btn = document.body.querySelector('[data-command-palette-item="g-dashboard"]') as HTMLButtonElement
    expect(btn.getAttribute('type')).toBe('button')
  })
})

describe('CommandPalette — activeIndex 视觉', () => {
  it('初始 activeIndex=0 → 首项（g-dashboard）含 data-command-palette-item-active="true"', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const first = document.body.querySelector('[data-command-palette-item="g-dashboard"]') as HTMLElement
    expect(first.getAttribute('data-command-palette-item-active')).toBe('true')
    const second = document.body.querySelector('[data-command-palette-item="g-moderation"]') as HTMLElement
    expect(second.getAttribute('data-command-palette-item-active')).toBeNull()
  })
})

describe('CommandPalette — item 视觉细节', () => {
  it('shortcut 渲染（jsdom IS_MAC=false → "Ctrl+1"）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const shortcut = document.body.querySelector('[data-command-palette-item="g-dashboard"] [data-command-palette-item-shortcut]')
    expect(shortcut?.textContent).toBe('Ctrl+1')
  })

  it('meta 渲染（仅 meta 提供时）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const meta = document.body.querySelector('[data-command-palette-item="a-toggle-theme"] [data-command-palette-item-meta]')
    expect(meta?.textContent).toBe('⌘+,')
    // 无 meta 项不渲染
    expect(document.body.querySelector('[data-command-palette-item="a-help"] [data-command-palette-item-meta]')).toBeNull()
  })

  it('icon 渲染（仅 icon 提供且非 null 时）', () => {
    const groups: readonly CommandGroup[] = [
      {
        id: 'g',
        label: 'g',
        items: [
          { id: 'with-icon', label: 'A', kind: 'invoke', icon: <svg data-icon="a" /> },
          { id: 'no-icon', label: 'B', kind: 'invoke' },
          { id: 'null-icon', label: 'C', kind: 'invoke', icon: null },
        ],
      },
    ]
    render(<CommandPalette open groups={groups} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(document.body.querySelector('[data-command-palette-item="with-icon"] [data-command-palette-item-icon]')).toBeTruthy()
    expect(document.body.querySelector('[data-command-palette-item="no-icon"] [data-command-palette-item-icon]')).toBeNull()
    expect(document.body.querySelector('[data-command-palette-item="null-icon"] [data-command-palette-item-icon]')).toBeNull()
  })
})

describe('CommandPalette — footer 提示', () => {
  it('footer 显示 ↑↓/↵/Esc 提示', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const footer = document.body.querySelector('[data-command-palette-footer]')
    expect(footer?.textContent).toContain('↑↓')
    expect(footer?.textContent).toContain('↵')
    expect(footer?.textContent).toContain('Esc')
  })
})

describe('CommandPalette — 空态', () => {
  it('groups=[] → 空态"无匹配结果"', () => {
    render(<CommandPalette open groups={[]} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(document.body.querySelector('[data-command-palette-empty]')?.textContent).toBe('无匹配结果')
  })

  it('全空 group → 空态', () => {
    const empty: readonly CommandGroup[] = [
      { id: 'g1', label: 'g1', items: [] },
      { id: 'g2', label: 'g2', items: [] },
    ]
    render(<CommandPalette open groups={empty} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(document.body.querySelector('[data-command-palette-empty]')).toBeTruthy()
  })
})

describe('CommandPalette — z-index', () => {
  it('backdrop + panel 共享 var(--z-shell-cmdk)（覆盖 Drawer）', () => {
    render(<CommandPalette open groups={GROUPS} onClose={vi.fn()} onAction={vi.fn()} />)
    const backdrop = document.body.querySelector('[data-command-palette-backdrop]') as HTMLElement
    const panel = document.body.querySelector('[data-command-palette]') as HTMLElement
    expect(backdrop.style.zIndex).toContain('--z-shell-cmdk')
    expect(panel.style.zIndex).toContain('--z-shell-cmdk')
  })
})
