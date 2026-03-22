/**
 * tests/unit/components/admin/DataTable.test.tsx
 * CHG-24: DataTable 渲染列、loading 骨架屏、空状态、排序
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type Column } from '@/components/admin/DataTable'

interface Row {
  id: string
  name: string
  status: string
}

const COLUMNS: Column<Row>[] = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: '名称', sortKey: 'name' },
  { key: 'status', title: '状态', render: (row) => <span data-testid={`status-${row.id}`}>{row.status}</span> },
]

const DATA: Row[] = [
  { id: '1', name: '视频A', status: 'active' },
  { id: '2', name: '视频B', status: 'inactive' },
]

describe('DataTable', () => {
  it('渲染表头列名', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />)
    expect(screen.getByTestId('th-id').textContent).toBe('ID')
    expect(screen.getByTestId('th-name').textContent).toContain('名称')
    expect(screen.getByTestId('th-status').textContent).toBe('状态')
  })

  it('渲染数据行', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />)
    expect(screen.getByTestId('table-row-0')).toBeTruthy()
    expect(screen.getByTestId('table-row-1')).toBeTruthy()
  })

  it('自定义 render 函数', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />)
    expect(screen.getByTestId('status-1').textContent).toBe('active')
    expect(screen.getByTestId('status-2').textContent).toBe('inactive')
  })

  it('isLoading=true 时显示骨架屏，不显示数据行', () => {
    render(<DataTable columns={COLUMNS} data={DATA} isLoading />)
    expect(screen.queryByTestId('table-row-0')).toBeNull()
    // 骨架屏单元格通过 animate-pulse 存在
    const skeletonCells = document.querySelectorAll('.animate-pulse')
    expect(skeletonCells.length).toBeGreaterThan(0)
  })

  it('data 为空时显示 emptyText', () => {
    render(<DataTable columns={COLUMNS} data={[]} emptyText="没有数据" />)
    expect(screen.getByTestId('table-empty').textContent).toBe('没有数据')
  })

  it('点击可排序列标题触发 onSort', () => {
    const onSort = vi.fn()
    render(<DataTable columns={COLUMNS} data={DATA} onSort={onSort} />)
    fireEvent.click(screen.getByTestId('th-name'))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('不可排序列点击不触发 onSort', () => {
    const onSort = vi.fn()
    render(<DataTable columns={COLUMNS} data={DATA} onSort={onSort} />)
    fireEvent.click(screen.getByTestId('th-id'))
    expect(onSort).not.toHaveBeenCalled()
  })

  it('sortBy 匹配列时显示排序方向箭头', () => {
    render(<DataTable columns={COLUMNS} data={DATA} sortBy="name" sortDir="asc" />)
    expect(screen.getByTestId('th-name').textContent).toContain('↑')
  })
})
