/**
 * PendingFilterPanel.test.tsx — MODUX-P3-2 待审列表筛选弹层
 *
 * 验证弹层行为（不驱动 AdminSelect 内部 combobox，聚焦 draft 同步 + 应用/清除回调契约）：
 *   - open=true 渲染 7 维字段 + 弹层标题
 *   - 「应用筛选」透传当前 value（draft 初始 = value）+ 调 onClose
 *   - 「清除全部」后应用 → onApply({})（全维度清空）
 *   - open=false 不渲染（Modal 闭）
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { PendingFilterPanel } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/PendingFilterPanel'

type Props = Parameters<typeof PendingFilterPanel>[0]

function renderPanel(over: Partial<Props> = {}): Props {
  const props: Props = {
    open: true,
    onClose: vi.fn(),
    value: {},
    onApply: vi.fn(),
    ...over,
  }
  render(<PendingFilterPanel {...props} />)
  return props
}

describe('PendingFilterPanel · 筛选弹层（MODUX-P3-2）', () => {
  afterEach(() => cleanup())

  it('open=true → 渲染 7 维字段 + 标题', () => {
    renderPanel()
    expect(screen.getByTestId('moderation-filter-panel')).toBeTruthy()
    expect(screen.getByText('筛选待审视频')).toBeTruthy()
    for (const id of ['filter-type', 'filter-decade', 'filter-enrichment', 'filter-source-check', 'filter-douban', 'filter-staff-note', 'filter-manual-review']) {
      expect(screen.getByTestId(id)).toBeTruthy()
    }
  })

  it('open=false → 不渲染弹层', () => {
    renderPanel({ open: false })
    expect(screen.queryByTestId('moderation-filter-panel')).toBeNull()
  })

  it('「应用筛选」透传 value（draft 初始 = value）+ 关闭', () => {
    const value = { type: 'movie', decade: 2020, enrichmentStatus: 'complete' }
    const props = renderPanel({ value })
    act(() => { screen.getByTestId('filter-apply').click() })
    expect(props.onApply).toHaveBeenCalledWith(value)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('「清除全部」后应用 → onApply({})（全维度清空）', () => {
    const props = renderPanel({ value: { type: 'movie', decade: 2020 } })
    act(() => { screen.getByTestId('filter-clear').click() })
    act(() => { screen.getByTestId('filter-apply').click() })
    expect(props.onApply).toHaveBeenCalledWith({})
  })
})
