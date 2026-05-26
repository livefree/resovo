/**
 * BackgroundEventBell.test.tsx — CW1-E-EP BackgroundEventBell 组件单测
 * ADR-152 step 10 覆盖：
 *
 *   #1 空 events → 不显示 unread dot（bell 按钮存在）
 *   #2 有 events → 显示 unread dot
 *   #3 degraded=true → 显示 ⚠ 角标
 *   #4 点击 bell → popover 出现（aria-expanded=true）
 *   #5 popover 内显示 upcoming 段落标题
 *   #6 popover 内显示 finished 段落标题
 *   #7 upcoming 事件渲染 title
 *   #8 finished 事件渲染 title
 *   #9 点击 Esc → popover 关闭
 *   #10 点击 ✕ 按钮 → popover 关闭
 *   #11 有 href 事件行点击 → router.push 被调用
 *   #12 空 events 显示空状态文案"暂无后台事件"
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AdminBackgroundEvent } from '@resovo/types'

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => '/admin',
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// 动态 import 避免 mock 顺序问题
async function importBell() {
  return (await import('../../../../../../apps/server-next/src/components/admin-shell/BackgroundEventBell')).BackgroundEventBell
}

const upcomingEv: AdminBackgroundEvent = {
  lane: 'upcoming',
  id: 'auto_crawl:next',
  kind: 'auto_crawl',
  status: 'scheduled',
  level: 'info',
  title: '下次自动采集',
  scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
  href: '/admin/crawler',
}

const finishedEv: AdminBackgroundEvent = {
  lane: 'finished',
  id: 'crawler_run:run-1',
  kind: 'crawler_run',
  status: 'failed',
  level: 'danger',
  title: '全站批量采集',
  finishedAt: new Date(Date.now() - 600_000).toISOString(),
  runId: 'run-1',
  href: '/admin/crawler/runs/run-1',
}

describe('BackgroundEventBell — 铃铛按钮', () => {
  it('#1 空 events → 铃铛按钮存在，无 unread dot', async () => {
    const Bell = await importBell()
    render(<Bell events={[]} degraded={false} />)
    const btn = screen.getByRole('button', { name: '后台事件' })
    expect(btn).toBeDefined()
    // 无 unread dot（aria-label="有后台事件" 不存在）
    expect(screen.queryByLabelText('有后台事件')).toBeNull()
  })

  it('#2 有 events → 显示 unread dot（popover 未打开时）', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    expect(screen.getByLabelText('有后台事件')).toBeDefined()
  })

  it('#3 degraded=true → 显示 ⚠ 角标', async () => {
    const Bell = await importBell()
    render(<Bell events={[]} degraded={true} />)
    expect(screen.getByLabelText('服务降级')).toBeDefined()
  })

  it('#4 点击 bell → popover 出现（aria-expanded=true）', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    const btn = screen.getByRole('button', { name: '后台事件' })
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('dialog', { name: '后台事件' })).toBeDefined()
  })

  it('#5 popover 内显示"即将 / 进行中"段落（有 upcoming 事件时）', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByText('即将 / 进行中')).toBeDefined()
  })

  it('#6 popover 内显示"近期完成 / 失败"段落（有 finished 事件时）', async () => {
    const Bell = await importBell()
    render(<Bell events={[finishedEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByText('近期完成 / 失败')).toBeDefined()
  })

  it('#7 upcoming 事件 title 渲染', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByText('下次自动采集')).toBeDefined()
  })

  it('#8 finished 事件 title 渲染', async () => {
    const Bell = await importBell()
    render(<Bell events={[finishedEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByText('全站批量采集')).toBeDefined()
  })

  it('#9 点击 Esc → popover 关闭', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('#10 点击 ✕ 按钮 → popover 关闭', async () => {
    const Bell = await importBell()
    render(<Bell events={[upcomingEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('#11 有 href 的事件行点击 → router.push 被调用', async () => {
    const Bell = await importBell()
    render(<Bell events={[finishedEv]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    // 找到事件行并点击
    const row = screen.getByText('全站批量采集').closest('[role="button"]')
    expect(row).toBeDefined()
    if (row) fireEvent.click(row)
    expect(routerPush).toHaveBeenCalledWith('/admin/crawler/runs/run-1')
  })

  it('#12 空 events 显示"暂无后台事件"', async () => {
    const Bell = await importBell()
    render(<Bell events={[]} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: '后台事件' }))
    expect(screen.getByText('暂无后台事件')).toBeDefined()
  })
})
