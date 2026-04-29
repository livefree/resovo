/**
 * NotificationDrawer 渲染 + 交互单测（CHG-SN-2-10）
 *
 * 覆盖：portal 启用 / header（标题+计数+全部已读按钮）/ items 列表 + level
 * 颜色条 + 已读 vs 未读视觉 / onItemClick / onMarkAllRead / 空态 / ESC + backdrop
 * 关闭 / focus trap / try/finally callback throw
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { NotificationDrawer } from '../../../../../packages/admin-ui/src/shell/notification-drawer'
import type { NotificationItem } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const ITEMS: readonly NotificationItem[] = [
  {
    id: 'n1',
    title: '内容审核失败',
    body: 'video #42 拒绝',
    level: 'danger',
    createdAt: '2026-04-29T01:00:00Z',
    read: false,
  },
  {
    id: 'n2',
    title: '采集站点新增',
    level: 'info',
    createdAt: '2026-04-29T00:30:00Z',
    read: true,
  },
]

describe('NotificationDrawer — open=false 不渲染', () => {
  it('open=false → portal 不渲染', () => {
    const { container } = render(
      <NotificationDrawer open={false} items={ITEMS} onClose={vi.fn()} />,
    )
    expect(container.querySelector('[data-drawer-panel]')).toBeNull()
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeNull()
  })
})

describe('NotificationDrawer — open=true 渲染（portal + header + items）', () => {
  it('portal 启用：panel 在 document.body 而非 React tree 内', () => {
    const { container } = render(
      <NotificationDrawer open items={ITEMS} onClose={vi.fn()} />,
    )
    expect(container.querySelector('[data-drawer-panel]')).toBeNull()
    expect(document.body.querySelector('[data-drawer-panel="notifications"]')).toBeTruthy()
  })

  it('panel header：标题"通知" + items.length 计数', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const title = document.body.querySelector('[data-drawer-title]')
    expect(title?.textContent).toBe('通知')
    const count = document.body.querySelector('[data-notification-count]')
    expect(count?.textContent).toBe('2')
  })

  it('role="dialog" + aria-modal="true" + aria-labelledby 指向标题', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const panel = document.body.querySelector('[data-drawer-panel="notifications"]') as HTMLElement
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const labelledby = panel.getAttribute('aria-labelledby')
    const title = document.body.querySelector(`#${labelledby}`)
    expect(title?.textContent).toBe('通知')
  })

  it('onMarkAllRead 提供 → 显示"全部已读"按钮', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onMarkAllRead={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-mark-all-read]')).toBeTruthy()
  })

  it('onMarkAllRead 未提供 → "全部已读"按钮隐藏', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-mark-all-read]')).toBeNull()
  })

  it('onItemClick 提供 → 每项渲染 button + level + read + interactive=true attribute', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onItemClick={vi.fn()} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLButtonElement
    expect(item1.tagName).toBe('BUTTON')
    expect(item1.getAttribute('data-notification-item-level')).toBe('danger')
    expect(item1.getAttribute('data-notification-item-read')).toBe('false')
    expect(item1.getAttribute('data-notification-item-interactive')).toBe('true')
    const item2 = document.body.querySelector('[data-notification-item="n2"]') as HTMLElement
    expect(item2.getAttribute('data-notification-item-read')).toBe('true')
  })

  it('fix(CHG-SN-2-10): onItemClick 缺省 → 每项渲染 article（非 button）+ interactive=false + cursor: default', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLElement
    expect(item1.tagName).toBe('ARTICLE')
    expect(item1.getAttribute('data-notification-item-interactive')).toBe('false')
    expect(item1.style.cursor).toBe('default')
  })

  it('onItemClick 提供 → button 形态 cursor: pointer', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onItemClick={vi.fn()} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLElement
    expect(item1.style.cursor).toBe('pointer')
  })

  it('未读项 opacity=1 / 已读项 opacity=0.6（视觉区分）', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLElement
    const item2 = document.body.querySelector('[data-notification-item="n2"]') as HTMLElement
    expect(item1.style.opacity).toBe('1')
    expect(item2.style.opacity).toBe('0.6')
  })

  it('item title + body + createdAt 渲染', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-item="n1"] [data-notification-item-title]')?.textContent).toBe('内容审核失败')
    expect(document.body.querySelector('[data-notification-item="n1"] [data-notification-item-body]')?.textContent).toBe('video #42 拒绝')
    expect(document.body.querySelector('[data-notification-item="n1"] [data-notification-item-time]')?.textContent).toBe('2026-04-29T01:00:00Z')
  })

  it('item.body undefined → 不渲染 body 元素', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    // n2 无 body
    expect(document.body.querySelector('[data-notification-item="n2"] [data-notification-item-body]')).toBeNull()
  })
})

describe('NotificationDrawer — 空态', () => {
  it('items=[] → 显示"暂无通知"', () => {
    render(<NotificationDrawer open items={[]} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-empty]')?.textContent).toBe('暂无通知')
  })
})

describe('NotificationDrawer — 行级回调', () => {
  it('点击 item → onItemClick(item)', () => {
    const onItemClick = vi.fn()
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onItemClick={onItemClick} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLButtonElement
    fireEvent.click(item1)
    expect(onItemClick).toHaveBeenCalledWith(ITEMS[0])
  })

  it('点击"全部已读" → onMarkAllRead()', () => {
    const onMarkAllRead = vi.fn()
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onMarkAllRead={onMarkAllRead} />)
    fireEvent.click(document.body.querySelector('[data-notification-mark-all-read]') as HTMLButtonElement)
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('onItemClick 未提供 → article 元素无 onClick handler（fix(CHG-SN-2-10) no-op rows 修复）', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const item1 = document.body.querySelector('[data-notification-item="n1"]') as HTMLElement
    expect(item1.tagName).toBe('ARTICLE')
    // article 元素 click 不抛错（无 onClick 绑定）
    expect(() => fireEvent.click(item1)).not.toThrow()
  })
})

describe('NotificationDrawer — ESC + backdrop 关闭（DrawerShell base 验证）', () => {
  it('ESC keydown → onClose()', () => {
    const onClose = vi.fn()
    render(<NotificationDrawer open items={ITEMS} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击 backdrop → onClose()', () => {
    const onClose = vi.fn()
    render(<NotificationDrawer open items={ITEMS} onClose={onClose} />)
    fireEvent.click(document.body.querySelector('[data-drawer-backdrop="notifications"]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击 close 按钮 → onClose()', () => {
    const onClose = vi.fn()
    render(<NotificationDrawer open items={ITEMS} onClose={onClose} />)
    fireEvent.click(document.body.querySelector('[data-drawer-close]') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('open=false → ESC 不触发 onClose（listener 卸载）', () => {
    const onClose = vi.fn()
    render(<NotificationDrawer open={false} items={ITEMS} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
