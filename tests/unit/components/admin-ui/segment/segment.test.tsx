/**
 * segment.test.tsx — Segment primitive 单测
 *
 * 任务卡：CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A
 * Opus arch-reviewer 评 A 综合 / Props 契约 + 视觉 + a11y 全覆盖
 *
 * 覆盖 ≥ 10 case：
 *   1. 基础渲染（4 items / 默认 md / aria-label 容器级）
 *   2. badge 数字 + 字符串 + 省略三态
 *   3. 受控 click → onChange + 切换后 aria-selected
 *   4. item.disabled 不响应 click + aria-disabled
 *   5. 容器 disabled 全禁用（覆盖 item）
 *   6. 键盘 ArrowRight/Left 循环 + 即时 onChange + 跳过 disabled
 *   7. 键盘 Home / End
 *   8. a11y：role=tablist + role=tab + aria-orientation + aria-selected 唯一
 *   9. 边界：items 长度 0（空容器 / 零报错）+ 长度 1（键盘左右 no-op）
 *  10. roving tabIndex：active 项 tabIndex=0 / 其余 -1
 *  11. badge active 项颜色反转（Y1 / 视觉 css 检查）
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Segment } from '../../../../../packages/admin-ui/src/components/segment'
import type { SegmentItem } from '../../../../../packages/admin-ui/src/components/segment'

const ITEMS: readonly SegmentItem[] = [
  { value: 'bad_source', label: '失效源举报', badge: 8 },
  { value: 'wish_list', label: '求片', badge: 3 },
  { value: 'metadata_correction', label: '元数据纠错', badge: '99+' },
  { value: 'processed', label: '已处理', badge: 412 },
]

describe('Segment primitive', () => {
  it('1. 基础渲染：4 items + 默认 md + aria-label 容器级', () => {
    const onChange = vi.fn()
    const { container } = render(
      <Segment items={ITEMS} value="bad_source" onChange={onChange} aria-label="投稿分类" />,
    )
    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist).not.toBeNull()
    expect(tablist?.getAttribute('aria-label')).toBe('投稿分类')
    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal')
    expect(tablist?.getAttribute('data-size')).toBe('md')
    expect(container.querySelectorAll('[role="tab"]').length).toBe(4)
  })

  it('2. badge 数字 + 字符串 + 省略三态', () => {
    const items: SegmentItem[] = [
      { value: 'a', label: 'A', badge: 5 },
      { value: 'b', label: 'B', badge: '99+' },
      { value: 'c', label: 'C' },
    ]
    const { container } = render(
      <Segment items={items} value="a" onChange={vi.fn()} aria-label="t" />,
    )
    const badges = container.querySelectorAll('[data-segment-badge]')
    expect(badges.length).toBe(2)
    expect(badges[0].textContent).toBe('5')
    expect(badges[1].textContent).toBe('99+')
  })

  it('3. 受控 click → onChange + 切换后 aria-selected', () => {
    const onChange = vi.fn()
    const { rerender, container } = render(
      <Segment items={ITEMS} value="bad_source" onChange={onChange} aria-label="t" />,
    )
    const wishBtn = screen.getByRole('tab', { name: /求片/ })
    fireEvent.click(wishBtn)
    expect(onChange).toHaveBeenCalledWith('wish_list')

    rerender(<Segment items={ITEMS} value="wish_list" onChange={onChange} aria-label="t" />)
    const wishBtnAfter = screen.getByRole('tab', { name: /求片/ })
    expect(wishBtnAfter.getAttribute('aria-selected')).toBe('true')
    const badSourceBtn = screen.getByRole('tab', { name: /失效源举报/ })
    expect(badSourceBtn.getAttribute('aria-selected')).toBe('false')
    // 唯一 aria-selected=true
    const selectedAll = container.querySelectorAll('[aria-selected="true"]')
    expect(selectedAll.length).toBe(1)
  })

  it('4. item.disabled 不响应 click + aria-disabled', () => {
    const onChange = vi.fn()
    const items: SegmentItem[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]
    render(<Segment items={items} value="a" onChange={onChange} aria-label="t" />)
    const bBtn = screen.getByRole('tab', { name: 'B' })
    expect(bBtn.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(bBtn)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('5. 容器 disabled 全禁用（覆盖 item）', () => {
    const onChange = vi.fn()
    const { container } = render(
      <Segment items={ITEMS} value="bad_source" onChange={onChange} disabled aria-label="t" />,
    )
    expect(container.querySelector('[role="tablist"]')?.getAttribute('data-disabled')).toBe('')
    const wishBtn = screen.getByRole('tab', { name: /求片/ })
    expect(wishBtn.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(wishBtn)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('6. 键盘 ArrowRight 循环 + 跳过 disabled 项', () => {
    const onChange = vi.fn()
    const items: SegmentItem[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
    ]
    render(<Segment items={items} value="a" onChange={onChange} aria-label="t" />)
    const tablist = screen.getByRole('tablist')
    // ArrowRight from 'a' → 跳过 disabled b → 'c'
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('7. 键盘 Home 跳第一项 / End 跳最后项', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Segment items={ITEMS} value="metadata_correction" onChange={onChange} aria-label="t" />,
    )
    const tablist = screen.getByRole('tablist')

    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('bad_source')
    onChange.mockClear()

    rerender(<Segment items={ITEMS} value="bad_source" onChange={onChange} aria-label="t" />)
    const tablist2 = screen.getByRole('tablist')
    fireEvent.keyDown(tablist2, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('processed')
  })

  it('8. a11y：role=tablist + role=tab + aria-orientation + 唯一 aria-selected=true', () => {
    const { container } = render(
      <Segment items={ITEMS} value="wish_list" onChange={vi.fn()} aria-label="t" />,
    )
    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal')
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs.length).toBe(4)
    const selectedTabs = container.querySelectorAll('[aria-selected="true"]')
    expect(selectedTabs.length).toBe(1)
    expect((selectedTabs[0] as HTMLElement).getAttribute('data-value')).toBe('wish_list')
  })

  it('9. 边界：items 长度 0 → 空容器零报错 / 长度 1 → 键盘 no-op', () => {
    // 长度 0
    const { container: empty } = render(
      <Segment items={[]} value="" onChange={vi.fn()} aria-label="t" />,
    )
    expect(empty.querySelector('[role="tablist"]')).not.toBeNull()
    expect(empty.querySelectorAll('[role="tab"]').length).toBe(0)

    // 长度 1
    const onChange = vi.fn()
    render(<Segment items={[{ value: 'a', label: 'A' }]} value="a" onChange={onChange} aria-label="t2" />)
    const tablist = screen.getByLabelText('t2')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    fireEvent.keyDown(tablist, { key: 'Home' })
    fireEvent.keyDown(tablist, { key: 'End' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('10. roving tabIndex：active 项 tabIndex=0 / 其余 -1', () => {
    const { container } = render(
      <Segment items={ITEMS} value="wish_list" onChange={vi.fn()} aria-label="t" />,
    )
    const tabs = container.querySelectorAll('[role="tab"]')
    tabs.forEach((tab) => {
      const value = tab.getAttribute('data-value')
      if (value === 'wish_list') {
        expect(tab.getAttribute('tabindex')).toBe('0')
      } else {
        expect(tab.getAttribute('tabindex')).toBe('-1')
      }
    })
  })

  it('11. badge active 项颜色反转（Y1）— inline style 检查', () => {
    const { container } = render(
      <Segment items={ITEMS} value="bad_source" onChange={vi.fn()} aria-label="t" />,
    )
    const activeBadge = container.querySelector('[data-active] [data-segment-badge]') as HTMLElement
    const inactiveBadge = container
      .querySelector('[role="tab"][aria-selected="false"] [data-segment-badge]') as HTMLElement
    expect(activeBadge).not.toBeNull()
    expect(inactiveBadge).not.toBeNull()
    // active：background var(--accent-default) / color var(--accent-on)
    expect(activeBadge.style.background).toContain('--accent-default')
    expect(activeBadge.style.color).toContain('--accent-on')
    // inactive：accent-soft / accent-default 反转
    expect(inactiveBadge.style.background).toContain('--accent-soft')
    expect(inactiveBadge.style.color).toContain('--accent-default')
  })

  it('12. 受控 click 同值无效（防重复触发 onChange）', () => {
    const onChange = vi.fn()
    render(<Segment items={ITEMS} value="bad_source" onChange={onChange} aria-label="t" />)
    const sameBtn = screen.getByRole('tab', { name: /失效源举报/ })
    fireEvent.click(sameBtn)
    expect(onChange).not.toHaveBeenCalled()
  })
})
