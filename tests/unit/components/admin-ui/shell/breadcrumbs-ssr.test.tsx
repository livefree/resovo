/**
 * Breadcrumbs SSR 单测（CHG-SN-2-05 范式遵守 — Shell 范式章法 5）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - renderToString 零 throw（空/非空 items）
 *   - SSR 输出含 nav 容器 + items 内容（无 hydration mismatch 风险）
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Breadcrumbs } from '../../../../../packages/admin-ui/src/shell/breadcrumbs'

describe('Breadcrumbs — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('空 items renderToString 不抛错（返 null）', () => {
    expect(() => renderToString(<Breadcrumbs items={[]} />)).not.toThrow()
    const html = renderToString(<Breadcrumbs items={[]} />)
    expect(html).toBe('')
  })

  it('非空 items renderToString 不抛错', () => {
    const items = [
      { label: '运营中心' },
      { label: '管理台站', href: '/admin' },
    ]
    expect(() => renderToString(<Breadcrumbs items={items} />)).not.toThrow()
  })

  it('SSR 输出含 items label 内容', () => {
    const html = renderToString(
      <Breadcrumbs items={[{ label: 'a', href: '/a' }, { label: 'b' }]} />,
    )
    expect(html).toContain('data-breadcrumbs')
    expect(html).toContain('a')
    expect(html).toContain('b')
    expect(html).toContain('aria-label="面包屑"')
    expect(html).toContain('<strong')
  })
})
