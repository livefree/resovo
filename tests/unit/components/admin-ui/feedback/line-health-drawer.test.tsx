/**
 * LineHealthDrawer 单测（CHG-SN-4-04 D-14 第 2 件）
 *
 * 覆盖契约硬约束：
 *   - open=false → 不渲染（Drawer 原语）
 *   - 头部 BarSignal 聚合状态
 *   - body 状态切换：error / loading / empty / list
 *   - events 渲染（origin / time / http_code / latency_ms / error_detail）
 *   - 分页可选 + prev/next 边界 disable
 *   - 文案 slot（emptyText / loadingText）
 *   - title 透传到 Drawer
 *   - data-* + testId 钩子
 *   - 颜色仅 var(--*) token
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { SourceHealthEvent } from '@resovo/types'
import { LineHealthDrawer } from '../../../../../packages/admin-ui/src/components/feedback/line-health-drawer'

afterEach(() => cleanup())

const mkEvent = (overrides: Partial<SourceHealthEvent> = {}): SourceHealthEvent => ({
  id: overrides.id ?? 'evt-1',
  videoId: 'video-1',
  sourceId: 'src-1',
  origin: 'scheduled_probe',
  oldStatus: null,
  newStatus: null,
  triggeredBy: null,
  errorDetail: null,
  httpCode: null,
  latencyMs: null,
  createdAt: '2026-05-02T10:00:00Z',
  ...overrides,
})

describe('LineHealthDrawer — open 控制', () => {
  it('open=false → 不渲染任何 portal 内容', () => {
    const { container } = render(
      <LineHealthDrawer
        open={false}
        onClose={() => {}}
        title="线路 1"
        probeState="ok"
        renderState="ok"
        events={[]}
      />,
    )
    expect(container.querySelector('[data-line-health-drawer]')).toBeNull()
    expect(document.querySelector('[data-line-health-drawer]')).toBeNull()
  })

  it('open=true → portal 渲染 data-line-health-drawer + Drawer dialog', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="线路 1"
        probeState="ok"
        renderState="ok"
        events={[]}
      />,
    )
    expect(document.querySelector('[data-line-health-drawer]')).toBeTruthy()
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
  })
})

describe('LineHealthDrawer — title + 头部聚合', () => {
  it('title 透传到 Drawer 头部', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="HD 线路 · 站点 A"
        probeState="ok"
        renderState="dead"
        events={[]}
      />,
    )
    expect(screen.getByText('HD 线路 · 站点 A')).toBeTruthy()
  })

  it('头部渲染 BarSignal 双柱', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="partial"
        renderState="dead"
        events={[]}
      />,
    )
    const barSignal = document.querySelector('[data-bar-signal]')
    expect(barSignal).toBeTruthy()
    expect(document.querySelector('[data-bar-signal-bar="probe"]')?.getAttribute('data-bar-signal-state')).toBe('partial')
    expect(document.querySelector('[data-bar-signal-bar="render"]')?.getAttribute('data-bar-signal-state')).toBe('dead')
  })
})

describe('LineHealthDrawer — error 态优先', () => {
  it('error 非 null → 渲染 ErrorState；不渲染 list/empty/loading', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        error={{ message: '加载失败：网络异常' }}
      />,
    )
    expect(document.querySelector('[data-line-health-error]')).toBeTruthy()
    expect(document.querySelector('[data-line-health-list]')).toBeNull()
    expect(document.querySelector('[data-line-health-empty]')).toBeNull()
    expect(document.querySelector('[data-line-health-loading]')).toBeNull()
  })

  it('error 含 onRetry → ErrorState 触发重试回调', () => {
    const retry = vi.fn()
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
        error={{ message: 'fail', onRetry: retry }}
      />,
    )
    // ErrorState 提供 retry button；通过文案查找
    const retryBtn = screen.getByRole('button', { name: /重试|retry/i })
    fireEvent.click(retryBtn)
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('LineHealthDrawer — loading 态', () => {
  it('loading=true 且无 error → 渲染 LoadingState', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
        loading={true}
      />,
    )
    expect(document.querySelector('[data-line-health-loading]')).toBeTruthy()
    expect(document.querySelector('[data-line-health-list]')).toBeNull()
    expect(document.querySelector('[data-line-health-empty]')).toBeNull()
  })

  it('自定义 loadingText 注入 LoadingState label', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
        loading={true}
        loadingText="拉取证据中…"
      />,
    )
    expect(screen.getByText('拉取证据中…')).toBeTruthy()
  })
})

describe('LineHealthDrawer — empty 态', () => {
  it('events=[] 且无 error/loading → 渲染 EmptyState', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
      />,
    )
    expect(document.querySelector('[data-line-health-empty]')).toBeTruthy()
    expect(screen.getByText('暂无健康事件记录')).toBeTruthy()
  })

  it('自定义 emptyText 覆盖默认', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
        emptyText="该线路 7 天内无事件"
      />,
    )
    expect(screen.getByText('该线路 7 天内无事件')).toBeTruthy()
  })
})

describe('LineHealthDrawer — events list', () => {
  it('渲染每条 event 的 origin / createdAt', () => {
    const events = [
      mkEvent({ id: 'e1', origin: 'scheduled_probe', createdAt: '2026-05-02T10:00:00Z' }),
      mkEvent({ id: 'e2', origin: 'render_check', createdAt: '2026-05-02T11:00:00Z' }),
    ]
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={events}
      />,
    )
    expect(document.querySelectorAll('[data-line-health-event]')).toHaveLength(2)
    expect(screen.getByText('scheduled_probe')).toBeTruthy()
    expect(screen.getByText('render_check')).toBeTruthy()
  })

  it('event 含 httpCode + latencyMs → 渲染 meta', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent({ httpCode: 502, latencyMs: 1234 })]}
      />,
    )
    expect(screen.getByText('HTTP 502')).toBeTruthy()
    expect(screen.getByText('1234 ms')).toBeTruthy()
  })

  it('event 含 errorDetail → 渲染详细错误信息', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent({ errorDetail: 'TLS handshake failed: cert expired' })]}
      />,
    )
    expect(document.querySelector('[data-line-health-event-detail]')?.textContent).toBe(
      'TLS handshake failed: cert expired',
    )
  })

  it('event 无 httpCode/latency → 不渲染 meta 容器', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
      />,
    )
    expect(document.querySelector('[data-line-health-event-http]')).toBeNull()
    expect(document.querySelector('[data-line-health-event-latency]')).toBeNull()
  })

  it('event origin 写入 data-line-health-event-origin', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent({ origin: 'circuit_breaker' })]}
      />,
    )
    const item = document.querySelector('[data-line-health-event]')
    expect(item?.getAttribute('data-line-health-event-origin')).toBe('circuit_breaker')
  })
})

describe('LineHealthDrawer — pagination', () => {
  it('未传 pagination → 不渲染分页栏', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
      />,
    )
    expect(document.querySelector('[data-line-health-pagination]')).toBeNull()
  })

  it('传 pagination → 渲染分页栏 + summary', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        pagination={{ page: 2, total: 47, limit: 20, onPageChange: () => {} }}
      />,
    )
    expect(document.querySelector('[data-line-health-pagination]')).toBeTruthy()
    expect(screen.getByText(/2 \/ 3.*共 47 条/)).toBeTruthy()
  })

  it('page=1 → 上一页 disabled；下一页 enabled', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        pagination={{ page: 1, total: 47, limit: 20, onPageChange: () => {} }}
      />,
    )
    const prev = document.querySelector('[data-line-health-pagination-prev]') as HTMLButtonElement
    const next = document.querySelector('[data-line-health-pagination-next]') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)
  })

  it('page=最末页 → 下一页 disabled', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        pagination={{ page: 3, total: 47, limit: 20, onPageChange: () => {} }}
      />,
    )
    const next = document.querySelector('[data-line-health-pagination-next]') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('点击下一页触发 onPageChange(+1)', () => {
    const onPageChange = vi.fn()
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        pagination={{ page: 1, total: 47, limit: 20, onPageChange }}
      />,
    )
    const next = document.querySelector('[data-line-health-pagination-next]') as HTMLButtonElement
    fireEvent.click(next)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('点击上一页触发 onPageChange(-1)', () => {
    const onPageChange = vi.fn()
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
        pagination={{ page: 2, total: 47, limit: 20, onPageChange }}
      />,
    )
    const prev = document.querySelector('[data-line-health-pagination-prev]') as HTMLButtonElement
    fireEvent.click(prev)
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})

describe('LineHealthDrawer — onClose 行为', () => {
  it('Drawer 关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    render(
      <LineHealthDrawer
        open={true}
        onClose={onClose}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[]}
      />,
    )
    const closeBtn = document.querySelector('[data-close-btn]') as HTMLButtonElement
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('LineHealthDrawer — token 引用', () => {
  it('event item border + radius 走 var(--*)', () => {
    render(
      <LineHealthDrawer
        open={true}
        onClose={() => {}}
        title="t"
        probeState="ok"
        renderState="ok"
        events={[mkEvent()]}
      />,
    )
    const item = document.querySelector('[data-line-health-event]') as HTMLElement
    const style = item.getAttribute('style') ?? ''
    expect(style).toMatch(/var\(--border-subtle\)/)
    expect(style).toMatch(/var\(--radius-md\)/)
  })
})
