/**
 * Drawer SSR 单测（CHG-SN-2-10 范式遵守 — Shell 范式章法 5C）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - open=false renderToString 输出空字符串（DrawerShell return null）
 *   - open=true renderToString 不抛错（useEffect / focus 在 SSR 不执行；createPortal 在 SSR 输出 null）
 *
 * 注：React 18 createPortal 在 SSR 默认返回 null（panel 不会出现在 renderToString 输出中），
 * 这是 React SSR 的设计行为；客户端 hydration 时再执行 portal 渲染。
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { NotificationDrawer } from '../../../../../packages/admin-ui/src/shell/notification-drawer'
import { TaskDrawer } from '../../../../../packages/admin-ui/src/shell/task-drawer'
import type { NotificationItem, TaskItem } from '../../../../../packages/admin-ui/src/shell/types'

const N_ITEMS: readonly NotificationItem[] = [
  { id: 'n1', title: 't1', level: 'info', createdAt: '2026-04-29T00:00:00Z', read: false },
]

const T_ITEMS: readonly TaskItem[] = [
  { id: 't1', title: 'task', status: 'running', progress: 50, startedAt: '2026-04-29T00:00:00Z' },
]

const NOOP = () => {}

describe('NotificationDrawer — SSR', () => {
  it('open=false → 输出空字符串', () => {
    const html = renderToString(
      <NotificationDrawer open={false} items={N_ITEMS} onClose={NOOP} />,
    )
    expect(html).toBe('')
  })

  it('open=true → renderToString 不抛错（createPortal SSR 输出 null）', () => {
    expect(() =>
      renderToString(
        <NotificationDrawer open items={N_ITEMS} onClose={NOOP} onItemClick={NOOP} onMarkAllRead={NOOP} />,
      ),
    ).not.toThrow()
  })

  it('items=[] open=true → renderToString 不抛错', () => {
    expect(() =>
      renderToString(<NotificationDrawer open items={[]} onClose={NOOP} />),
    ).not.toThrow()
  })
})

describe('TaskDrawer — SSR', () => {
  it('open=false → 输出空字符串', () => {
    const html = renderToString(
      <TaskDrawer open={false} items={T_ITEMS} onClose={NOOP} />,
    )
    expect(html).toBe('')
  })

  it('open=true → renderToString 不抛错（含 progress bar / cancel / retry actions）', () => {
    const items: readonly TaskItem[] = [
      { id: 't1', title: 'running', status: 'running', progress: 50, startedAt: '2026-04-29T00:00:00Z' },
      { id: 't2', title: 'failed', status: 'failed', errorMessage: 'err', startedAt: '2026-04-29T00:00:00Z' },
    ]
    expect(() =>
      renderToString(
        <TaskDrawer open items={items} onClose={NOOP} onCancel={NOOP} onRetry={NOOP} />,
      ),
    ).not.toThrow()
  })

  it('items=[] open=true → renderToString 不抛错', () => {
    expect(() =>
      renderToString(<TaskDrawer open items={[]} onClose={NOOP} />),
    ).not.toThrow()
  })
})
