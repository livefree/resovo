/**
 * TaskDrawer 渲染 + 交互单测（CHG-SN-2-10）
 *
 * 覆盖：portal 启用 / header（标题+运行中数）/ items 列表 + status 配色 +
 * progress bar（仅 running+progress）+ errorMessage（仅 failed）/ 行级
 * onCancel/onRetry / 空态 / ESC + backdrop 关闭
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { TaskDrawer } from '../../../../../packages/admin-ui/src/shell/task-drawer'
import type { TaskItem } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const ITEMS: readonly TaskItem[] = [
  {
    id: 't1',
    title: '采集站点 #1',
    status: 'running',
    progress: 65,
    startedAt: '2026-04-29T01:00:00Z',
  },
  {
    id: 't2',
    title: '生成索引',
    status: 'success',
    startedAt: '2026-04-29T00:30:00Z',
    finishedAt: '2026-04-29T00:35:00Z',
  },
  {
    id: 't3',
    title: '导出报表',
    status: 'failed',
    startedAt: '2026-04-29T00:00:00Z',
    finishedAt: '2026-04-29T00:01:00Z',
    errorMessage: 'connection refused',
  },
  {
    id: 't4',
    title: '清理缓存',
    status: 'pending',
    startedAt: '2026-04-29T01:30:00Z',
  },
]

describe('TaskDrawer — open=false 不渲染', () => {
  it('open=false → portal 不渲染', () => {
    render(<TaskDrawer open={false} items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-drawer-panel="tasks"]')).toBeNull()
  })
})

describe('TaskDrawer — open=true 渲染', () => {
  it('portal 启用：panel 在 document.body', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-drawer-panel="tasks"]')).toBeTruthy()
  })

  it('panel 标题"后台任务" + 运行中数量"运行中 1"', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-drawer-title]')?.textContent).toBe('后台任务')
    expect(document.body.querySelector('[data-task-running-count]')?.textContent).toBe('运行中 1')
  })

  it('items 列表渲染（每项 data-task-item="id" + data-task-item-status）', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t1"]')).toBeTruthy()
    expect(document.body.querySelector('[data-task-item="t1"]')?.getAttribute('data-task-item-status')).toBe('running')
    expect(document.body.querySelector('[data-task-item="t2"]')?.getAttribute('data-task-item-status')).toBe('success')
    expect(document.body.querySelector('[data-task-item="t3"]')?.getAttribute('data-task-item-status')).toBe('failed')
    expect(document.body.querySelector('[data-task-item="t4"]')?.getAttribute('data-task-item-status')).toBe('pending')
  })
})

describe('TaskDrawer — status 配色映射', () => {
  it('pending → state-info / running → state-warning / success → state-success / failed → state-error', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    const t4Badge = document.body.querySelector('[data-task-item="t4"] [data-task-item-status-badge]') as HTMLElement
    const t1Badge = document.body.querySelector('[data-task-item="t1"] [data-task-item-status-badge]') as HTMLElement
    const t2Badge = document.body.querySelector('[data-task-item="t2"] [data-task-item-status-badge]') as HTMLElement
    const t3Badge = document.body.querySelector('[data-task-item="t3"] [data-task-item-status-badge]') as HTMLElement
    expect(t4Badge.style.background).toContain('--state-info-bg')
    expect(t1Badge.style.background).toContain('--state-warning-bg')
    expect(t2Badge.style.background).toContain('--state-success-bg')
    expect(t3Badge.style.background).toContain('--state-error-bg')
  })

  it('status label 中文：待处理/运行中/成功/失败', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t4"] [data-task-item-status-badge]')?.textContent).toBe('待处理')
    expect(document.body.querySelector('[data-task-item="t1"] [data-task-item-status-badge]')?.textContent).toBe('运行中')
    expect(document.body.querySelector('[data-task-item="t2"] [data-task-item-status-badge]')?.textContent).toBe('成功')
    expect(document.body.querySelector('[data-task-item="t3"] [data-task-item-status-badge]')?.textContent).toBe('失败')
  })
})

describe('TaskDrawer — progress bar', () => {
  it('status=running + progress=65 → 渲染 progress bar width=65%', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    const fill = document.body.querySelector('[data-task-item="t1"] [data-task-item-progress-fill]') as HTMLElement
    expect(fill).toBeTruthy()
    expect(fill.style.width).toBe('65%')
    expect(fill.getAttribute('role')).toBe('progressbar')
    expect(fill.getAttribute('aria-valuenow')).toBe('65')
    expect(fill.getAttribute('aria-valuemin')).toBe('0')
    expect(fill.getAttribute('aria-valuemax')).toBe('100')
  })

  it('status=success → 不渲染 progress bar', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t2"] [data-task-item-progress]')).toBeNull()
  })

  it('status=running 但 progress=undefined → 不渲染 progress bar', () => {
    const items: readonly TaskItem[] = [{
      id: 'tx', title: 'x', status: 'running', startedAt: '2026-04-29T00:00:00Z',
    }]
    render(<TaskDrawer open items={items} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="tx"] [data-task-item-progress]')).toBeNull()
  })
})

describe('TaskDrawer — errorMessage（仅 failed）', () => {
  it('status=failed + errorMessage 提供 → 显示错误', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t3"] [data-task-item-error]')?.textContent).toBe('connection refused')
  })

  it('status=success → 不显示 errorMessage 元素', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t2"] [data-task-item-error]')).toBeNull()
  })
})

describe('TaskDrawer — 行级 onCancel / onRetry', () => {
  it('status=running + onCancel 提供 → 显示"取消"按钮', () => {
    const onCancel = vi.fn()
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} onCancel={onCancel} />)
    const cancelBtn = document.body.querySelector('[data-task-item="t1"] [data-task-item-cancel]') as HTMLButtonElement
    expect(cancelBtn).toBeTruthy()
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledWith('t1')
  })

  it('status=failed + onRetry 提供 → 显示"重试"按钮', () => {
    const onRetry = vi.fn()
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} onRetry={onRetry} />)
    const retryBtn = document.body.querySelector('[data-task-item="t3"] [data-task-item-retry]') as HTMLButtonElement
    expect(retryBtn).toBeTruthy()
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('t3')
  })

  it('status=success → 无 cancel/retry 按钮', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t2"] [data-task-item-cancel]')).toBeNull()
    expect(document.body.querySelector('[data-task-item="t2"] [data-task-item-retry]')).toBeNull()
  })

  it('status=running 但 onCancel 未提供 → 不显示"取消"按钮', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t1"] [data-task-item-cancel]')).toBeNull()
  })

  it('status=failed 但 onRetry 未提供 → 不显示"重试"按钮', () => {
    render(<TaskDrawer open items={ITEMS} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-item="t3"] [data-task-item-retry]')).toBeNull()
  })
})

describe('TaskDrawer — 空态', () => {
  it('items=[] → 显示"暂无任务" + 运行中数量"运行中 0"', () => {
    render(<TaskDrawer open items={[]} onClose={vi.fn()} />)
    expect(document.body.querySelector('[data-task-empty]')?.textContent).toBe('暂无任务')
    expect(document.body.querySelector('[data-task-running-count]')?.textContent).toBe('运行中 0')
  })
})

describe('TaskDrawer — ESC + backdrop 关闭（DrawerShell base 验证）', () => {
  it('ESC keydown → onClose()', () => {
    const onClose = vi.fn()
    render(<TaskDrawer open items={ITEMS} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击 backdrop="tasks" → onClose()', () => {
    const onClose = vi.fn()
    render(<TaskDrawer open items={ITEMS} onClose={onClose} />)
    fireEvent.click(document.body.querySelector('[data-drawer-backdrop="tasks"]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
