/**
 * command-palette-remote.test.tsx — SEARCH-02-B CommandPalette 远程搜索扩展（ADR-200 D-200-1）
 *
 * 覆盖：onQueryChange（keystroke + open=false 重置发 ''）/ prefilteredGroups 跳本地过滤 /
 *       flatItems 本地在前·prefiltered 在后 + activeIndex 跨组 + 异步到达不重置 local activeId /
 *       空态优先级 loading>emptyRemoteState>内置 / loading aria-busy / live region 计数
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../../../../../packages/admin-ui/src/shell/command-palette'
import type { CommandGroup } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => cleanup())

const NAV: readonly CommandGroup[] = [
  {
    id: 'nav',
    label: '导航',
    items: [
      { id: 'n-moderation', label: '内容审核', kind: 'navigate', href: '/admin/moderation' },
      { id: 'n-videos', label: '视频库', kind: 'navigate', href: '/admin/videos' },
    ],
  },
]

const PREFILTERED: readonly CommandGroup[] = [
  {
    id: 'search-video',
    label: '视频',
    items: [
      // label 含拼音命中但不含原 query 子串：服务端命中、本地过滤会误杀
      { id: 's-v1', label: '钢铁侠 2008', kind: 'navigate', href: '/admin/videos?v.f.q=钢铁侠' },
    ],
  },
]

function el(sel: string) {
  return document.body.querySelector(sel)
}
function options() {
  return Array.from(document.body.querySelectorAll('[role="option"]'))
}

describe('CommandPalette — onQueryChange（ADR-200 D-200-1）', () => {
  it('keystroke 发原始 query', () => {
    const onQueryChange = vi.fn()
    render(<CommandPalette open groups={NAV} onClose={vi.fn()} onAction={vi.fn()} onQueryChange={onQueryChange} />)
    const input = el('[data-command-palette-input]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'gangtie' } })
    expect(onQueryChange).toHaveBeenCalledWith('gangtie')
  })

  it('open=false 内部重置 query → 发 onQueryChange("")（防 stale）', () => {
    const onQueryChange = vi.fn()
    const { rerender } = render(<CommandPalette open groups={NAV} onClose={vi.fn()} onAction={vi.fn()} onQueryChange={onQueryChange} />)
    fireEvent.change(el('[data-command-palette-input]') as HTMLInputElement, { target: { value: 'abc' } })
    onQueryChange.mockClear()
    rerender(<CommandPalette open={false} groups={NAV} onClose={vi.fn()} onAction={vi.fn()} onQueryChange={onQueryChange} />)
    expect(onQueryChange).toHaveBeenLastCalledWith('')
  })
})

describe('CommandPalette — prefilteredGroups 跳本地过滤（§4.1.6 AMENDMENT）', () => {
  it('query 与 prefiltered label 不含子串时仍原样展示（不被本地 label.includes 误杀）', () => {
    render(
      <CommandPalette
        open
        groups={NAV}
        prefilteredGroups={PREFILTERED}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    )
    // query='gangtie' → 本地 nav 全被过滤（label 不含），prefiltered 钢铁侠仍在
    fireEvent.change(el('[data-command-palette-input]') as HTMLInputElement, { target: { value: 'gangtie' } })
    expect(el('[data-command-palette-item="s-v1"]')).toBeTruthy()
    expect(el('[data-command-palette-group="nav"]')).toBeNull()
    expect(el('[data-command-palette-group="search-video"]')).toBeTruthy()
  })

  it('flatItems 本地在前、prefiltered 在后（query="" 全显示，首项=本地首项）', () => {
    render(<CommandPalette open groups={NAV} prefilteredGroups={PREFILTERED} onClose={vi.fn()} onAction={vi.fn()} />)
    const opts = options()
    expect(opts).toHaveLength(3) // 2 nav + 1 prefiltered
    expect(opts[0]?.getAttribute('id')).toBe('command-option-n-moderation')
    expect(opts[2]?.getAttribute('id')).toBe('command-option-s-v1')
    // activeIndex=0 → 本地首项 active
    expect((el('[data-command-palette-item="n-moderation"]') as HTMLElement).getAttribute('data-command-palette-item-active')).toBe('true')
  })

  it('prefiltered 异步到达不重置已落在本地组的 activeId', () => {
    const { rerender } = render(<CommandPalette open groups={NAV} onClose={vi.fn()} onAction={vi.fn()} />)
    // ArrowDown → active 移到本地第 2 项 n-videos
    fireEvent.keyDown(el('[data-command-palette]') as HTMLElement, { key: 'ArrowDown' })
    expect((el('[data-command-palette-item="n-videos"]') as HTMLElement).getAttribute('data-command-palette-item-active')).toBe('true')
    // prefiltered 异步注入（query 未变）
    rerender(<CommandPalette open groups={NAV} prefilteredGroups={PREFILTERED} onClose={vi.fn()} onAction={vi.fn()} />)
    // active 仍在 n-videos（未被 prefiltered 到达重置）
    expect((el('[data-command-palette-item="n-videos"]') as HTMLElement).getAttribute('data-command-palette-item-active')).toBe('true')
    expect(options()).toHaveLength(3)
  })
})

describe('CommandPalette — 空态优先级 + loading（D-200-1 / D-200-9）', () => {
  it('loading + 空 → "搜索中…"（优先级最高，压过 emptyRemoteState）', () => {
    render(<CommandPalette open groups={[]} loading emptyRemoteState={<div data-custom-empty>定制空</div>} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(el('[data-command-palette-empty]')?.textContent).toBe('搜索中…')
    expect(el('[data-custom-empty]')).toBeNull()
  })

  it('非 loading + 空 + emptyRemoteState → 渲染定制空态', () => {
    render(<CommandPalette open groups={[]} emptyRemoteState={<div data-custom-empty>无远程结果</div>} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(el('[data-custom-empty]')?.textContent).toBe('无远程结果')
  })

  it('非 loading + 空 + 无 emptyRemoteState → 内置"无匹配结果"', () => {
    render(<CommandPalette open groups={[]} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(el('[data-command-palette-empty]')?.textContent).toBe('无匹配结果')
  })

  it('loading=true → dialog/input/listbox 带 aria-busy（输入框不 unmount）', () => {
    render(<CommandPalette open groups={NAV} loading onClose={vi.fn()} onAction={vi.fn()} />)
    expect((el('[data-command-palette]') as HTMLElement).getAttribute('aria-busy')).toBe('true')
    expect((el('[data-command-palette-input]') as HTMLElement).getAttribute('aria-busy')).toBe('true')
    expect((el('[data-command-palette-listbox]') as HTMLElement).getAttribute('aria-busy')).toBe('true')
  })

  it('结果计数 live region（role=status aria-live）', () => {
    render(<CommandPalette open groups={NAV} onClose={vi.fn()} onAction={vi.fn()} />)
    const status = el('[data-command-palette-status]') as HTMLElement
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('2 条结果')
    cleanup()
    render(<CommandPalette open groups={NAV} loading onClose={vi.fn()} onAction={vi.fn()} />)
    expect((el('[data-command-palette-status]') as HTMLElement).textContent).toBe('搜索中')
  })
})
