/**
 * SelectionActionBar 单测（CHG-SN-2-17）
 * 覆盖：visible / selectedCount / totalMatched / selectionMode 切换 /
 *       actions 按钮 / disabled action / confirm / onClearSelection /
 *       variant / data-testid
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SelectionActionBar } from '../../../../../packages/admin-ui/src/components/data-table/selection-action-bar'
import type { SelectionAction } from '../../../../../packages/admin-ui/src/components/data-table/selection-action-bar'

const ACTIONS: SelectionAction[] = [
  { key: 'export', label: '导出', onClick: vi.fn(), variant: 'default' },
  { key: 'delete', label: '删除', onClick: vi.fn(), variant: 'danger' },
]

function makeBar(overrides: Partial<Parameters<typeof SelectionActionBar>[0]> = {}) {
  const onClearSelection = vi.fn()
  const result = render(
    <SelectionActionBar
      visible={true}
      selectedCount={5}
      selectionMode="page"
      onClearSelection={onClearSelection}
      actions={ACTIONS}
      {...overrides}
    />,
  )
  return { ...result, onClearSelection }
}

// ── visible ──────────────────────────────────────────────────────

describe('SelectionActionBar — visible', () => {
  it('visible=false 不渲染', () => {
    makeBar({ visible: false })
    expect(document.querySelector('[data-selection-action-bar]')).toBeNull()
  })

  it('visible=true 渲染', () => {
    makeBar()
    expect(document.querySelector('[data-selection-action-bar]')).toBeTruthy()
  })

  it('data-testid 传递', () => {
    makeBar({ 'data-testid': 'sel-bar' })
    expect(document.querySelector('[data-testid="sel-bar"]')).toBeTruthy()
  })
})

// ── selectedCount ────────────────────────────────────────────────

describe('SelectionActionBar — selectedCount', () => {
  it('显示"已选 N 条"', () => {
    makeBar({ selectedCount: 3 })
    expect(screen.getByText('已选 3 条')).toBeTruthy()
  })

  it('selectedCount=0 显示"已选 0 条"', () => {
    makeBar({ selectedCount: 0 })
    expect(screen.getByText('已选 0 条')).toBeTruthy()
  })
})

// ── selectionMode + totalMatched ─────────────────────────────────

describe('SelectionActionBar — selectionMode + totalMatched', () => {
  it('mode=page + totalMatched 提供 → 显示"选择全部 X 条"按钮', () => {
    makeBar({ selectionMode: 'page', totalMatched: 100, onSelectionModeChange: vi.fn() })
    expect(screen.getByText('选择全部 100 条')).toBeTruthy()
  })

  it('mode=page + 无 totalMatched → 不显示"选择全部"按钮', () => {
    makeBar({ selectionMode: 'page', totalMatched: undefined })
    expect(document.querySelector('[data-select-all-matched]')).toBeNull()
  })

  it('点击"选择全部"触发 onSelectionModeChange("all-matched")', () => {
    const onSelectionModeChange = vi.fn()
    makeBar({ selectionMode: 'page', totalMatched: 50, onSelectionModeChange })
    fireEvent.click(screen.getByText('选择全部 50 条'))
    expect(onSelectionModeChange).toHaveBeenCalledWith('all-matched')
  })

  it('mode=all-matched + totalMatched → 显示"已选全部 X 条"', () => {
    makeBar({ selectionMode: 'all-matched', totalMatched: 200 })
    expect(screen.getByText('已选全部 200 条')).toBeTruthy()
  })

  it('mode=all-matched → 显示"取消全选"按钮', () => {
    makeBar({ selectionMode: 'all-matched', totalMatched: 200, onSelectionModeChange: vi.fn() })
    expect(document.querySelector('[data-deselect-all-matched]')).toBeTruthy()
  })

  it('点击"取消全选"触发 onSelectionModeChange("page")', () => {
    const onSelectionModeChange = vi.fn()
    makeBar({ selectionMode: 'all-matched', totalMatched: 200, onSelectionModeChange })
    fireEvent.click(document.querySelector('[data-deselect-all-matched]')!)
    expect(onSelectionModeChange).toHaveBeenCalledWith('page')
  })
})

// ── actions ──────────────────────────────────────────────────────

describe('SelectionActionBar — actions', () => {
  it('渲染所有 action 按钮', () => {
    makeBar()
    expect(screen.getByText('导出')).toBeTruthy()
    expect(screen.getByText('删除')).toBeTruthy()
  })

  it('点击 action 触发 onClick', () => {
    const onClick = vi.fn()
    const actions: SelectionAction[] = [{ key: 'a', label: '操作', onClick }]
    makeBar({ actions })
    fireEvent.click(screen.getByText('操作'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled action 按钮有 disabled 属性', () => {
    const actions: SelectionAction[] = [{ key: 'a', label: '禁用操作', onClick: vi.fn(), disabled: true }]
    makeBar({ actions })
    const btn = screen.getByText('禁用操作').closest('button')
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('空 actions 不渲染 action 按钮', () => {
    makeBar({ actions: [] })
    expect(document.querySelector('[data-action-key]')).toBeNull()
  })

  it('action icon 渲染', () => {
    const actions: SelectionAction[] = [
      { key: 'a', label: 'A', onClick: vi.fn(), icon: <span data-act-icon="true" /> },
    ]
    makeBar({ actions })
    expect(document.querySelector('[data-act-icon="true"]')).toBeTruthy()
  })
})

// ── confirm ───────────────────────────────────────────────────────

describe('SelectionActionBar — confirm 流程', () => {
  it('有 confirm 的 action 点击后显示确认提示', () => {
    const onClick = vi.fn()
    const actions: SelectionAction[] = [
      { key: 'del', label: '批量删除', onClick, confirm: { title: '确认删除？' } },
    ]
    makeBar({ actions })
    fireEvent.click(screen.getByText('批量删除'))
    expect(screen.getByText('确认删除？')).toBeTruthy()
  })

  it('confirm 点击"确认"后触发 onClick', () => {
    const onClick = vi.fn()
    const actions: SelectionAction[] = [
      { key: 'del', label: '批量删除', onClick, confirm: { title: '确认删除？' } },
    ]
    makeBar({ actions })
    fireEvent.click(screen.getByText('批量删除'))
    fireEvent.click(screen.getByText('确认'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('confirm 点击"取消"后不触发 onClick', () => {
    const onClick = vi.fn()
    const actions: SelectionAction[] = [
      { key: 'del', label: '批量删除', onClick, confirm: { title: '确认删除？' } },
    ]
    makeBar({ actions })
    fireEvent.click(screen.getByText('批量删除'))
    fireEvent.click(screen.getByText('取消'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

// ── onClearSelection ──────────────────────────────────────────────

describe('SelectionActionBar — 清除选择', () => {
  it('点击"清除选择"触发 onClearSelection', () => {
    const { onClearSelection } = makeBar()
    fireEvent.click(screen.getByText('清除选择'))
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })
})

// ── variant ──────────────────────────────────────────────────────

describe('SelectionActionBar — variant', () => {
  it('默认 variant=sticky-bottom', () => {
    makeBar()
    const bar = document.querySelector('[data-selection-action-bar]')
    expect(bar?.getAttribute('data-variant')).toBe('sticky-bottom')
  })

  it('variant=sticky-top 属性正确', () => {
    makeBar({ variant: 'sticky-top' })
    const bar = document.querySelector('[data-selection-action-bar]')
    expect(bar?.getAttribute('data-variant')).toBe('sticky-top')
  })
})
