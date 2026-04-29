/**
 * HealthBadge 渲染单测（CHG-SN-2-06）
 *
 * 覆盖：3 项指标渲染 / status → state token slot 映射 / pulse 动画首项 /
 * invalidRate 百分比格式 / data-* attribute / a11y
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HealthBadge } from '../../../../../packages/admin-ui/src/shell/health-badge'
import type { HealthSnapshot } from '../../../../../packages/admin-ui/src/shell/types'

afterEach(() => {
  cleanup()
})

const SNAPSHOT_OK: HealthSnapshot = {
  crawler: { running: 3, total: 12, status: 'ok' },
  invalidRate: { rate: 0.013, status: 'ok' },
  moderationPending: { count: 484, status: 'warn' },
}

describe('HealthBadge — 3 项指标渲染', () => {
  it('渲染采集 / 失效率 / 待审 3 项', () => {
    render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    expect(screen.getByText('采集 3/12')).toBeTruthy()
    expect(screen.getByText('失效率 1.3%')).toBeTruthy()
    expect(screen.getByText('待审 484')).toBeTruthy()
  })

  it('容器含 role="status" + aria-label="系统健康指标"', () => {
    const { container } = render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    const badge = container.querySelector('[data-health-badge]')
    expect(badge?.getAttribute('role')).toBe('status')
    expect(badge?.getAttribute('aria-label')).toBe('系统健康指标')
  })

  it('3 项含 data-health-item attribute（crawler/invalid-rate/moderation-pending）', () => {
    const { container } = render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    expect(container.querySelector('[data-health-item="crawler"]')).toBeTruthy()
    expect(container.querySelector('[data-health-item="invalid-rate"]')).toBeTruthy()
    expect(container.querySelector('[data-health-item="moderation-pending"]')).toBeTruthy()
  })
})

describe('HealthBadge — status → state token slot 映射', () => {
  it('ok → state-success 颜色变量', () => {
    const snapshot: HealthSnapshot = {
      crawler: { running: 1, total: 1, status: 'ok' },
      invalidRate: { rate: 0, status: 'ok' },
      moderationPending: { count: 0, status: 'ok' },
    }
    const { container } = render(<HealthBadge snapshot={snapshot} />)
    const dots = container.querySelectorAll('[data-health-item] [aria-hidden="true"]')
    dots.forEach((dot) => {
      expect((dot as HTMLElement).style.background).toContain('--state-success-border')
    })
  })

  it('warn → state-warning / danger → state-error', () => {
    const snapshot: HealthSnapshot = {
      crawler: { running: 5, total: 12, status: 'warn' },
      invalidRate: { rate: 0.05, status: 'danger' },
      moderationPending: { count: 100, status: 'warn' },
    }
    const { container } = render(<HealthBadge snapshot={snapshot} />)
    const crawlerDot = container.querySelector('[data-health-item="crawler"] [aria-hidden="true"]') as HTMLElement
    const invalidDot = container.querySelector('[data-health-item="invalid-rate"] [aria-hidden="true"]') as HTMLElement
    const moderationDot = container.querySelector('[data-health-item="moderation-pending"] [aria-hidden="true"]') as HTMLElement
    expect(crawlerDot.style.background).toContain('--state-warning-border')
    expect(invalidDot.style.background).toContain('--state-error-border')
    expect(moderationDot.style.background).toContain('--state-warning-border')
  })
})

describe('HealthBadge — pulse 动画首项（crawler）', () => {
  it('首项（crawler）dot 含 animation: resovo-health-pulse', () => {
    const { container } = render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    const crawlerDot = container.querySelector('[data-health-item="crawler"] [aria-hidden="true"]') as HTMLElement
    expect(crawlerDot.style.animation).toContain('resovo-health-pulse')
  })

  it('其余项（invalid-rate / moderation-pending）dot 无 animation', () => {
    const { container } = render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    const invalidDot = container.querySelector('[data-health-item="invalid-rate"] [aria-hidden="true"]') as HTMLElement
    const moderationDot = container.querySelector('[data-health-item="moderation-pending"] [aria-hidden="true"]') as HTMLElement
    expect(invalidDot.style.animation).toBe('')
    expect(moderationDot.style.animation).toBe('')
  })

  it('@keyframes 通过 <style data-resovo-health-pulse> 标签注入', () => {
    const { container } = render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    const styleEl = container.querySelector('style[data-resovo-health-pulse]')
    expect(styleEl).toBeTruthy()
    expect(styleEl?.textContent).toContain('@keyframes resovo-health-pulse')
  })
})

describe('HealthBadge — invalidRate 百分比格式（1 位小数）', () => {
  it('rate=0.013 → "1.3%"', () => {
    render(<HealthBadge snapshot={SNAPSHOT_OK} />)
    expect(screen.getByText('失效率 1.3%')).toBeTruthy()
  })

  it('rate=0 → "0.0%"', () => {
    const snapshot: HealthSnapshot = {
      ...SNAPSHOT_OK,
      invalidRate: { rate: 0, status: 'ok' },
    }
    render(<HealthBadge snapshot={snapshot} />)
    expect(screen.getByText('失效率 0.0%')).toBeTruthy()
  })

  it('rate=0.0005 → "0.1%"（舍入到 1 位小数）', () => {
    const snapshot: HealthSnapshot = {
      ...SNAPSHOT_OK,
      invalidRate: { rate: 0.0005, status: 'ok' },
    }
    render(<HealthBadge snapshot={snapshot} />)
    expect(screen.getByText('失效率 0.1%')).toBeTruthy()
  })

  it('rate=0.5 → "50.0%"（高失效率）', () => {
    const snapshot: HealthSnapshot = {
      ...SNAPSHOT_OK,
      invalidRate: { rate: 0.5, status: 'danger' },
    }
    render(<HealthBadge snapshot={snapshot} />)
    expect(screen.getByText('失效率 50.0%')).toBeTruthy()
  })
})
