/**
 * FilterPresetPopoverBadge.test.tsx — FilterPresetPopover「仅本地」chip 单测
 * （CHG-SN-8-GAPS-PRESET-LOCAL-BADGE / GAPS.md #G-moderation-preset-team）
 *
 * 覆盖：
 *   1. open=true → 渲染 localOnly chip
 *   2. chip title 含 tooltip 完整文案
 *   3. open=false → 不渲染（含 chip）
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useRef, type ReactElement } from 'react'
import { FilterPresetPopover } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/FilterPresetPopover'

function Harness({ open }: { open: boolean }): ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={anchorRef}>
      <FilterPresetPopover
        open={open}
        anchorRef={anchorRef}
        presets={[]}
        onApply={vi.fn()}
        onSetDefault={vi.fn()}
        onUnsetDefault={vi.fn()}
        onRemove={vi.fn()}
        onSaveCurrent={vi.fn()}
        onClose={vi.fn()}
      />
    </div>
  )
}

afterEach(() => cleanup())

describe('FilterPresetPopover — 「仅本地」chip (#G-moderation-preset-team)', () => {
  it('1. open=true → 渲染 localOnly chip 含「仅本地」文案', () => {
    render(<Harness open={true} />)
    const chip = screen.getByTestId('filter-preset-local-badge')
    expect(chip.textContent).toBe('仅本地')
  })

  it('2. chip title 含 tooltip + 指向 GAPS follow-up', () => {
    render(<Harness open={true} />)
    const chip = screen.getByTestId('filter-preset-local-badge')
    const title = chip.getAttribute('title') ?? ''
    expect(title).toContain('localStorage')
    expect(title).toContain('未跨账号同步')
    expect(title).toContain('#G-moderation-preset-team')
  })

  it('3. open=false → 不渲染 chip（popover 整体不渲染）', () => {
    render(<Harness open={false} />)
    expect(document.querySelector('[data-testid="filter-preset-local-badge"]')).toBeNull()
  })
})
