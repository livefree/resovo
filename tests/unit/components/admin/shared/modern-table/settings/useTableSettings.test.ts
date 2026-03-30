/**
 * useTableSettings.test.ts — CHG-313
 * 验证 updateWidth 列宽持久化功能（新增）及 visible/sortable 基本行为
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings/useTableSettings'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const COLUMNS = [
  { id: 'name',    label: '名称',   defaultVisible: true,  defaultSortable: true },
  { id: 'status',  label: '状态',   defaultVisible: true,  defaultSortable: true },
  { id: 'actions', label: '操作',   defaultVisible: true,  defaultSortable: false, required: true },
]

function makeColumns(): TableColumn<{ id: string }>[] {
  return [
    { id: 'name',    header: '名称', accessor: (r) => r.id, width: 200, minWidth: 100, enableResizing: true },
    { id: 'status',  header: '状态', accessor: (r) => r.id, width: 150, minWidth: 80,  enableResizing: true },
    { id: 'actions', header: '操作', accessor: (r) => r.id, width: 120, minWidth: 80,  enableResizing: false },
  ]
}

describe('useTableSettings — updateWidth (CHG-313)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('updateWidth overrides column width in applyToColumns', async () => {
    const { result } = renderHook(() =>
      useTableSettings({ tableId: 'test-table', columns: COLUMNS }),
    )

    act(() => {
      result.current.updateWidth('name', 350)
    })

    const applied = result.current.applyToColumns(makeColumns())
    const nameCol = applied.find((c) => c.id === 'name')
    expect(nameCol?.width).toBe(350)

    // Other columns keep default width
    const statusCol = applied.find((c) => c.id === 'status')
    expect(statusCol?.width).toBe(150)
  })

  it('persists widths to localStorage', async () => {
    const { result } = renderHook(() =>
      useTableSettings({ tableId: 'persist-table', columns: COLUMNS }),
    )

    act(() => {
      result.current.updateWidth('status', 280)
    })

    const raw = localStorage.getItem('admin:table:settings:persist-table:v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { widths?: Record<string, number> }
    expect(parsed.widths?.status).toBe(280)
  })

  it('reset clears widths', async () => {
    const { result } = renderHook(() =>
      useTableSettings({ tableId: 'reset-table', columns: COLUMNS }),
    )

    act(() => {
      result.current.updateWidth('name', 400)
    })

    act(() => {
      result.current.reset()
    })

    const applied = result.current.applyToColumns(makeColumns())
    const nameCol = applied.find((c) => c.id === 'name')
    expect(nameCol?.width).toBe(200) // back to default
  })

  it('does not hide required column via updateSetting', () => {
    const { result } = renderHook(() =>
      useTableSettings({ tableId: 'required-table', columns: COLUMNS }),
    )

    act(() => {
      result.current.updateSetting('actions', 'visible', false)
    })

    const applied = result.current.applyToColumns(makeColumns())
    expect(applied.find((c) => c.id === 'actions')).toBeTruthy()
  })
})
