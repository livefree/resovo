/**
 * HealthBadge SSR 单测（CHG-SN-2-06 范式遵守 — Shell 范式章法 5）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 零 throw
 *   - SSR 输出含 3 项指标 + style 标签（@keyframes 内联注入）+ aria attributes
 *   - 纯渲染无 useEffect 副作用 → 无 hydration mismatch 风险
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { HealthBadge } from '../../../../../packages/admin-ui/src/shell/health-badge'
import type { HealthSnapshot } from '../../../../../packages/admin-ui/src/shell/types'

const SNAPSHOT: HealthSnapshot = {
  crawler: { running: 3, total: 12, status: 'ok' },
  invalidRate: { rate: 0.013, status: 'ok' },
  moderationPending: { count: 484, status: 'warn' },
}

describe('HealthBadge — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('renderToString 不抛错', () => {
    expect(() => renderToString(<HealthBadge snapshot={SNAPSHOT} />)).not.toThrow()
  })

  it('SSR 输出含 3 项指标文本（React JSX 文本插值 SSR 含 <!-- --> 注释切片，按子串匹配）', () => {
    const html = renderToString(<HealthBadge snapshot={SNAPSHOT} />)
    // 采集 3/12
    expect(html).toContain('采集')
    expect(html).toContain('>3<')
    expect(html).toContain('>12<')
    // 失效率 1.3%（formatPercent 是单一字符串，无插值切片）
    expect(html).toContain('失效率')
    expect(html).toContain('1.3%')
    // 待审 484
    expect(html).toContain('待审')
    expect(html).toContain('>484<')
  })

  it('SSR 输出含 @keyframes <style> 标签 + data-* attributes', () => {
    const html = renderToString(<HealthBadge snapshot={SNAPSHOT} />)
    expect(html).toContain('data-resovo-health-pulse')
    expect(html).toContain('@keyframes resovo-health-pulse')
    expect(html).toContain('data-health-badge')
    expect(html).toContain('data-health-item="crawler"')
    expect(html).toContain('data-health-item="invalid-rate"')
    expect(html).toContain('data-health-item="moderation-pending"')
  })

  it('SSR 输出含 aria-label="系统健康指标"（a11y）', () => {
    const html = renderToString(<HealthBadge snapshot={SNAPSHOT} />)
    expect(html).toContain('aria-label="系统健康指标"')
    expect(html).toContain('role="status"')
  })
})
