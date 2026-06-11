/**
 * LinesPanelLineKeys.test.tsx — MODUX-P2-3-FIX 数字键选线路（item 1 验收补全）
 *
 * 验证审核台 LinesPanel 数字键 1–9 选第 N 条线路（复用 onLineSelect 既有切源路径）：
 *   - 受控用法（onLineSelect 提供）→ 数字键调 onLineSelect(第 N 条线路)
 *   - 越界数字（无对应线路）→ 不触发
 *
 * 重 hook（useSourceLinesController / useLineHealthDrawer）+ UI（LinesPanelUI）mock；
 * groupSourcesByLine mock 返回已知聚合；KeyboardShortcuts 保真（数字键为被测目标）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const LINE_A = { key: 'siteA|lineA', episodes: [{ id: 'epA', episodeNumber: 1, isActive: true, sourceUrl: 'http://a/1' }] }
const LINE_B = { key: 'siteB|lineB', episodes: [{ id: 'epB', episodeNumber: 1, isActive: true, sourceUrl: 'http://b/1' }] }

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    LinesPanel: () => null,
    LineHealthDrawer: () => null,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
    groupSourcesByLine: vi.fn(() => [LINE_A, LINE_B]),
  }
})

const controllerActions = {
  toggleEpisode: vi.fn(), disableDead: vi.fn(), refetch: vi.fn(), fetchHealth: vi.fn(),
  probeEpisode: vi.fn(), renderCheckEpisode: vi.fn(), probeAllSources: vi.fn(), renderCheckAllSources: vi.fn(),
}
vi.mock('../../../../../../apps/server-next/src/lib/sources/use-source-lines-controller', () => ({
  useSourceLinesController: () => ([
    {
      lines: [], loading: false, error: null,
      togglingIds: new Set(), probingIds: new Set(), renderCheckingIds: new Set(),
      probingAllSources: false, renderCheckingAllSources: false,
    },
    controllerActions,
  ]),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/use-line-health-drawer', () => ({
  useLineHealthDrawer: () => ([
    { open: false, events: [], loading: false, error: null, pagination: null },
    { open: vi.fn(), close: vi.fn(), changePage: vi.fn(), retry: vi.fn() },
  ]),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  toDisplayState: () => 'unknown',
}))

import { LinesPanel } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/LinesPanel'

function dispatchKeydown(key: string): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('LinesPanel · 数字键选线路（MODUX-P2-3-FIX / item 1）', () => {
  afterEach(() => cleanup())

  it("'1' → onLineSelect(第 1 条线路)", () => {
    const onLineSelect = vi.fn()
    render(<LinesPanel videoId="v1" onLineSelect={onLineSelect} />)
    dispatchKeydown('1')
    expect(onLineSelect).toHaveBeenCalledWith({ lineKey: 'siteA|lineA', line: LINE_A, firstActiveUrl: 'http://a/1' })
  })

  it("'2' → onLineSelect(第 2 条线路)", () => {
    const onLineSelect = vi.fn()
    render(<LinesPanel videoId="v1" onLineSelect={onLineSelect} />)
    dispatchKeydown('2')
    expect(onLineSelect).toHaveBeenCalledWith({ lineKey: 'siteB|lineB', line: LINE_B, firstActiveUrl: 'http://b/1' })
  })

  it("'3' 越界（仅 2 条线路）→ 不触发", () => {
    const onLineSelect = vi.fn()
    render(<LinesPanel videoId="v1" onLineSelect={onLineSelect} />)
    dispatchKeydown('3')
    expect(onLineSelect).not.toHaveBeenCalled()
  })

  it('无 onLineSelect（sources 展开用法）→ 数字键不绑定、不报错', () => {
    render(<LinesPanel videoId="v1" />)
    expect(() => dispatchKeydown('1')).not.toThrow()
  })

  it('模态浮层（aria-modal）打开时 → 数字键抑制（MODUX-P2-3-FIX-2，不在浮层后误切线路）', () => {
    const onLineSelect = vi.fn()
    render(<LinesPanel videoId="v1" onLineSelect={onLineSelect} />)
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    try {
      dispatchKeydown('1')
      expect(onLineSelect).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(modal)
    }
  })
})
