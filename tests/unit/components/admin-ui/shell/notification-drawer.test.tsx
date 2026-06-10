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

  it('未读项 opacity=1 / 已读项 opacity=0.6（视觉区分；NTLG-NTF-DISMISS-C1 H-1 上提行容器）', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const row1 = document.body.querySelector('[data-notification-row="n1"]') as HTMLElement
    const row2 = document.body.querySelector('[data-notification-row="n2"]') as HTMLElement
    expect(row1.style.opacity).toBe('1')
    expect(row2.style.opacity).toBe('0.6')
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

describe('NotificationDrawer — NTLG-P2-c-UI-1 category 分组 + digest 摘要完整显示', () => {
  const GROUPED: readonly NotificationItem[] = [
    { id: 'g1', title: '审核积压超阈值', level: 'warn', createdAt: '2026-06-09T03:00:00Z', read: false, category: 'general' },
    { id: 'b1', title: '采集即将开始', level: 'info', createdAt: '2026-06-09T02:00:00Z', read: false, category: 'background' },
    {
      id: 'g2',
      title: '采集完成',
      body: '新增 12 视频 · 8 线路 · 1 站点失败 · 0 错误',
      level: 'info',
      createdAt: '2026-06-09T01:00:00Z',
      read: false,
      category: 'general',
    },
  ]

  it('两组都有内容 → 渲染 general + background 两区，general 在前', () => {
    render(<NotificationDrawer open items={GROUPED} onClose={vi.fn()} />)
    const groups = Array.from(document.body.querySelectorAll('[data-notification-group]'))
    expect(groups.map((g) => g.getAttribute('data-notification-group'))).toEqual(['general', 'background'])
  })

  it('区头渲染分组文案 + 区内计数', () => {
    render(<NotificationDrawer open items={GROUPED} onClose={vi.fn()} />)
    const generalGroup = document.body.querySelector('[data-notification-group="general"]') as HTMLElement
    expect(generalGroup.querySelector('[data-notification-group-title]')?.textContent).toContain('系统通知')
    expect(generalGroup.querySelector('[data-notification-group-count]')?.textContent).toBe('2')
    const bgGroup = document.body.querySelector('[data-notification-group="background"]') as HTMLElement
    expect(bgGroup.querySelector('[data-notification-group-title]')?.textContent).toContain('后台动态')
    expect(bgGroup.querySelector('[data-notification-group-count]')?.textContent).toBe('1')
  })

  it('item 渲染在对应 category 区内（g1/g2 → general，b1 → background）', () => {
    render(<NotificationDrawer open items={GROUPED} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-group="general"] [data-notification-item="g1"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-group="general"] [data-notification-item="g2"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-group="background"] [data-notification-item="b1"]')).toBeTruthy()
  })

  it('category undefined → 归 general 默认组', () => {
    const noCat: readonly NotificationItem[] = [
      { id: 'x1', title: '无分类项', level: 'info', createdAt: '2026-06-09T00:00:00Z', read: false },
    ]
    render(<NotificationDrawer open items={noCat} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-group="general"] [data-notification-item="x1"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-group="background"]')).toBeNull()
  })

  it('空组不渲染区头（仅 background 有内容 → 无 general 区）', () => {
    const onlyBg: readonly NotificationItem[] = [
      { id: 'b9', title: '高危冻结', level: 'danger', createdAt: '2026-06-09T00:00:00Z', read: false, category: 'background' },
    ]
    render(<NotificationDrawer open items={onlyBg} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-group="general"]')).toBeNull()
    expect(document.body.querySelector('[data-notification-group="background"]')).toBeTruthy()
  })

  it('digest 摘要完整显示（多 metric body 解除单行截断 whiteSpace=normal）', () => {
    render(<NotificationDrawer open items={GROUPED} onClose={vi.fn()} />)
    const body = document.body.querySelector('[data-notification-item="g2"] [data-notification-item-body]') as HTMLElement
    expect(body.textContent).toBe('新增 12 视频 · 8 线路 · 1 站点失败 · 0 错误')
    expect(body.style.whiteSpace).toBe('normal')
    expect(body.style.whiteSpace).not.toBe('nowrap')
  })
})

describe('NotificationDrawer — NTLG-NTF-UNREAD-FILTER 只看未读切换', () => {
  it('默认显示全部 → 切换按钮文案「只看未读」+ data-active=false + 全部项渲染', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const toggle = document.body.querySelector('[data-notification-unread-toggle]') as HTMLButtonElement
    expect(toggle.textContent).toBe('只看未读')
    expect(toggle.getAttribute('data-active')).toBe('false')
    expect(document.body.querySelector('[data-notification-item="n1"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-item="n2"]')).toBeTruthy()
  })

  it('点击切换 → 仅未读项可见（已读 n2 隐藏）+ 文案「显示全部」+ active=true', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const toggle = document.body.querySelector('[data-notification-unread-toggle]') as HTMLButtonElement
    fireEvent.click(toggle)
    expect(toggle.textContent).toBe('显示全部')
    expect(toggle.getAttribute('data-active')).toBe('true')
    expect(document.body.querySelector('[data-notification-item="n1"]')).toBeTruthy() // 未读保留
    expect(document.body.querySelector('[data-notification-item="n2"]')).toBeNull() // 已读隐藏
  })

  it('再次点击 → 恢复显示全部（已读 n2 重现）', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} />)
    const toggle = document.body.querySelector('[data-notification-unread-toggle]') as HTMLButtonElement
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggle.textContent).toBe('只看未读')
    expect(document.body.querySelector('[data-notification-item="n2"]')).toBeTruthy()
  })

  it('全部已读 + 只看未读 → 显示「暂无未读通知」空态（区别于 items=[] 的「暂无通知」）', () => {
    const allRead: readonly NotificationItem[] = [
      { id: 'r1', title: '已读项', level: 'info', createdAt: '2026-06-09T00:00:00Z', read: true },
    ]
    render(<NotificationDrawer open items={allRead} onClose={vi.fn()} />)
    fireEvent.click(document.body.querySelector('[data-notification-unread-toggle]') as HTMLButtonElement)
    expect(document.body.querySelector('[data-notification-empty-unread]')?.textContent).toBe('暂无未读通知')
    expect(document.body.querySelector('[data-notification-empty]')).toBeNull()
  })
})

describe('NotificationDrawer — NTLG-NTF-DISMISS-C1 单项移除 + 清空（ADR-197）', () => {
  // 白名单（D-197-2）：general 纯数字 id ∪ bg-audit: 前缀可 dismiss；upcoming/active 派生项拒
  const MIXED: readonly NotificationItem[] = [
    { id: '101', title: '系统通知（可移除）', level: 'info', createdAt: '2026-06-10T03:00:00Z', read: false, category: 'general' },
    { id: 'bg-audit:7', title: '高危审计（可移除）', level: 'danger', createdAt: '2026-06-10T02:00:00Z', read: true, category: 'background' },
    { id: 'bg-auto_crawl:next', title: '即将采集（不可移除）', level: 'info', createdAt: '2026-06-10T01:00:00Z', read: false, category: 'background' },
  ]

  it('onDismiss 提供 → 仅白名单项显示移除按钮（数字 id + bg-audit: 显示；upcoming 派生项隐藏）', () => {
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} onDismiss={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-item-dismiss="101"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-item-dismiss="bg-audit:7"]')).toBeTruthy()
    expect(document.body.querySelector('[data-notification-item-dismiss="bg-auto_crawl:next"]')).toBeNull()
  })

  it('onDismiss 未提供 → 移除按钮全部隐藏', () => {
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-item-dismiss]')).toBeNull()
  })

  it('非数字字母 id（既有 mock 形态）→ 白名单外不显示移除按钮', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onDismiss={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-item-dismiss]')).toBeNull()
  })

  it('点击移除按钮 → onDismiss(itemKey)，不触发 onItemClick（行外兄弟节点 H-1）', () => {
    const onDismiss = vi.fn()
    const onItemClick = vi.fn()
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} onDismiss={onDismiss} onItemClick={onItemClick} />)
    fireEvent.click(document.body.querySelector('[data-notification-item-dismiss="101"]') as HTMLButtonElement)
    expect(onDismiss).toHaveBeenCalledWith('101')
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it('H-1：行 main 仍为 button（data-notification-item 选择器保留）且与移除按钮非嵌套', () => {
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} onDismiss={vi.fn()} onItemClick={vi.fn()} />)
    const main = document.body.querySelector('[data-notification-item="101"]') as HTMLElement
    expect(main.tagName).toBe('BUTTON')
    expect(main.querySelector('[data-notification-item-dismiss]')).toBeNull()
    const row = document.body.querySelector('[data-notification-row="101"]') as HTMLElement
    expect(row.querySelector('[data-notification-item-dismiss="101"]')).toBeTruthy()
  })

  it('onClearAll 提供且有可清项 → 「清空」显示；点击回传可见 dismissable itemKeys（白名单外不含）', () => {
    const onClearAll = vi.fn()
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} onClearAll={onClearAll} />)
    const btn = document.body.querySelector('[data-notification-clear-all]') as HTMLButtonElement
    expect(btn.textContent).toBe('清空')
    fireEvent.click(btn)
    expect(onClearAll).toHaveBeenCalledWith(['101', 'bg-audit:7'])
  })

  it('onClearAll 提供但无可清项（全部白名单外）→ 「清空」隐藏', () => {
    render(<NotificationDrawer open items={ITEMS} onClose={vi.fn()} onClearAll={vi.fn()} />)
    expect(document.body.querySelector('[data-notification-clear-all]')).toBeNull()
  })

  it('只看未读时清空 → 仅回传可见（未读）dismissable keys（所见即所清）', () => {
    const onClearAll = vi.fn()
    render(<NotificationDrawer open items={MIXED} onClose={vi.fn()} onClearAll={onClearAll} />)
    fireEvent.click(document.body.querySelector('[data-notification-unread-toggle]') as HTMLButtonElement)
    fireEvent.click(document.body.querySelector('[data-notification-clear-all]') as HTMLButtonElement)
    // bg-audit:7 已读 → unreadOnly 下不可见，不回传
    expect(onClearAll).toHaveBeenCalledWith(['101'])
  })
})
