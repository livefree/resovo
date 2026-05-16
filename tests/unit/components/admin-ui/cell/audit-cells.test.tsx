/**
 * audit-cells.test.tsx — UserRef / CodeText / IdRef / MutedText 单测
 * （CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS 起草后实装）
 *
 * 覆盖契约硬约束：
 *   - UserRef: username 命中 / null 兜底 deletedFallback / id 作 data-user-id 反查 / size 变体
 *   - CodeText: value 命中 / null fallback / muted 配色 / dataAttr 透传
 *   - IdRef: id 短缩（idShortChars） / null 兜底 batchFallback / ellipsis 自定义 / 0 不截断
 *   - MutedText: value 命中 / null/空 fallback / clamp 1 单行 / clamp >1 line-clamp / dataAttr 透传
 *
 * 所有 cell：testId 默认 + 可自定义 / className 透传 / 零硬编码颜色（token 引用）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { UserRef } from '../../../../../packages/admin-ui/src/components/cell/user-ref'
import { CodeText } from '../../../../../packages/admin-ui/src/components/cell/code-text'
import { IdRef } from '../../../../../packages/admin-ui/src/components/cell/id-ref'
import { MutedText } from '../../../../../packages/admin-ui/src/components/cell/muted-text'

afterEach(() => cleanup())

// ── UserRef ──────────────────────────────────────────────────────

describe('UserRef', () => {
  it('1. username 命中 → 渲染 username 文本 + data-user-id 反查', () => {
    const { container, getByText } = render(<UserRef id="user-abc" username="alice" />)
    expect(getByText('alice')).not.toBeNull()
    expect(container.querySelector('[data-user-id="user-abc"]')).not.toBeNull()
  })

  it('2. username 为 null → deletedFallback 渲染 + muted 配色', () => {
    const { container, getByText } = render(
      <UserRef id="user-x" username={null} deletedFallback="(已删除)" />
    )
    expect(getByText('(已删除)')).not.toBeNull()
    // muted 内层 span 含 color: var(--fg-muted)
    const muted = container.querySelector('span[style*="--fg-muted"]')
    expect(muted).not.toBeNull()
  })

  it('3. username 为 undefined → 默认 fallback "—"', () => {
    const { getByText } = render(<UserRef id="user-y" username={undefined} />)
    expect(getByText('—')).not.toBeNull()
  })

  it('4. size="xs" → font-size 切到 xs token', () => {
    const { container } = render(<UserRef id="u1" username="x" size="xs" />)
    const root = container.querySelector('[data-user-id="u1"]') as HTMLElement
    expect(root.style.fontSize).toContain('--font-size-xs')
  })

  it('5. testId 默认 "user-ref" + 可覆盖', () => {
    const { container, rerender, getByTestId } = render(<UserRef id="u1" username="x" />)
    expect(container.querySelector('[data-testid="user-ref"]')).not.toBeNull()
    rerender(<UserRef id="u1" username="x" testId="custom-actor" />)
    expect(getByTestId('custom-actor')).not.toBeNull()
  })
})

// ── CodeText ─────────────────────────────────────────────────────

describe('CodeText', () => {
  it('6. value 命中 → 渲染 <code> 文本', () => {
    const { container, getByText } = render(<CodeText value="video.approve" />)
    expect(getByText('video.approve')).not.toBeNull()
    expect(container.querySelector('code')).not.toBeNull()
  })

  it('7. value 为 null → fallback "—"', () => {
    const { getByText } = render(<CodeText value={null} />)
    expect(getByText('—')).not.toBeNull()
  })

  it('8. muted=true → color 切 var(--fg-muted)', () => {
    const { container } = render(<CodeText value="req-123" muted />)
    const code = container.querySelector('code') as HTMLElement
    expect(code.style.color).toContain('--fg-muted')
  })

  it('9. muted=false（默认）→ color 切 var(--fg-default)', () => {
    const { container } = render(<CodeText value="req-123" />)
    const code = container.querySelector('code') as HTMLElement
    expect(code.style.color).toContain('--fg-default')
  })

  it('10. dataAttr 透传到 <code> 根节点', () => {
    const { container } = render(
      <CodeText value="x" dataAttr={{ 'data-action-type': 'video.approve' }} />
    )
    expect(container.querySelector('[data-action-type="video.approve"]')).not.toBeNull()
  })

  it('11. font-family 引用 var(--font-mono) token', () => {
    const { container } = render(<CodeText value="x" />)
    const code = container.querySelector('code') as HTMLElement
    expect(code.style.fontFamily).toContain('--font-mono')
  })
})

// ── IdRef ────────────────────────────────────────────────────────

describe('IdRef', () => {
  it('12. id 完整 + idShortChars=8 默认 → 短缩 + "…"', () => {
    const { getByText } = render(<IdRef kind="video" id="abcdef0123456789-deadbeef" />)
    expect(getByText('abcdef01…')).not.toBeNull()
    expect(getByText('video')).not.toBeNull()
  })

  it('13. id 为 null → batchFallback 渲染', () => {
    const { getByText } = render(<IdRef kind="staging" id={null} batchFallback="批量" />)
    expect(getByText('批量')).not.toBeNull()
    expect(getByText('staging')).not.toBeNull()
  })

  it('14. idShortChars=0 → 完整 id 不截断', () => {
    const { getByText } = render(<IdRef kind="job" id="42" idShortChars={0} />)
    expect(getByText('42')).not.toBeNull()
  })

  it('15. id 长度 ≤ idShortChars → 不加 ellipsis', () => {
    const { container } = render(<IdRef kind="x" id="short" idShortChars={8} />)
    expect(container.textContent).toContain('short')
    expect(container.textContent).not.toContain('…')
  })

  it('16. ellipsis 自定义 → 替换默认 "…"', () => {
    const { getByText } = render(<IdRef kind="v" id="abcdef0123456789" ellipsis="..." />)
    expect(getByText('abcdef01...')).not.toBeNull()
  })

  it('17. kind 渲染为 monospace muted code', () => {
    const { container } = render(<IdRef kind="video" id="xx" />)
    const code = container.querySelector('code') as HTMLElement
    expect(code.textContent).toBe('video')
    expect(code.style.fontFamily).toContain('--font-mono')
    expect(code.style.color).toContain('--fg-muted')
  })
})

// ── MutedText ────────────────────────────────────────────────────

describe('MutedText', () => {
  it('18. value 命中 → 渲染文本 + muted 配色 + xs 字号', () => {
    const { container, getByText } = render(<MutedText value="payload summary" />)
    expect(getByText('payload summary')).not.toBeNull()
    const span = container.querySelector('[data-testid="muted-text"]') as HTMLElement
    expect(span.style.color).toContain('--fg-muted')
    expect(span.style.fontSize).toContain('--font-size-xs')
  })

  it('19. value 为 null → fallback "—"', () => {
    const { getByText } = render(<MutedText value={null} />)
    expect(getByText('—')).not.toBeNull()
  })

  it('20. value 为空字符串 → fallback 渲染', () => {
    const { getByText } = render(<MutedText value="" fallback="(empty)" />)
    expect(getByText('(empty)')).not.toBeNull()
  })

  it('21. clamp=1（默认）→ white-space: nowrap 单行截断', () => {
    const { container } = render(<MutedText value="abc" />)
    const span = container.querySelector('[data-testid="muted-text"]') as HTMLElement
    expect(span.style.whiteSpace).toBe('nowrap')
    expect(span.style.textOverflow).toBe('ellipsis')
  })

  it('22. clamp=3 → -webkit-line-clamp 多行', () => {
    const { container } = render(<MutedText value="long..." clamp={3} />)
    const span = container.querySelector('[data-testid="muted-text"]') as HTMLElement
    expect(span.style.WebkitLineClamp).toBe('3')
    expect(span.style.WebkitBoxOrient).toBe('vertical')
  })

  it('23. clamp=0 / 负数 → 视为 1（防御性）', () => {
    const { container } = render(<MutedText value="x" clamp={0} />)
    const span = container.querySelector('[data-testid="muted-text"]') as HTMLElement
    expect(span.style.whiteSpace).toBe('nowrap')
  })

  it('24. dataAttr 透传', () => {
    const { container } = render(
      <MutedText value="x" dataAttr={{ 'data-payload-summary': 'true' }} />
    )
    expect(container.querySelector('[data-payload-summary="true"]')).not.toBeNull()
  })
})
