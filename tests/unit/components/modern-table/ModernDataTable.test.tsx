import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'

interface DemoRow {
  id: string
  title: string
  status: string
  createdAt: string
}

const COLUMNS: Array<TableColumn<DemoRow>> = [
  {
    id: 'id',
    header: 'ID',
    accessor: (row) => row.id,
  },
  {
    id: 'title',
    header: '标题',
    accessor: (row) => row.title,
    enableSorting: true,
  },
  {
    id: 'status',
    header: '状态',
    accessor: (row) => row.status,
  },
  {
    id: 'created_at',
    header: '创建时间',
    accessor: (row) => row.createdAt,
  },
]

const ROWS: DemoRow[] = [
  {
    id: 'v1',
    title: 'Alpha Movie Very Long Title',
    status: 'approved',
    createdAt: '2026-03-25',
  },
]

describe('ModernDataTable (CHG-204)', () => {
  it('renders empty state', () => {
    render(
      <ModernDataTable
        columns={COLUMNS}
        rows={[]}
        emptyText="暂无数据"
      />,
    )

    expect(screen.getByText('暂无数据')).toBeTruthy()
  })

  it('applies absolute column widths and accumulated table width', () => {
    render(
      <ModernDataTable
        columns={COLUMNS}
        rows={ROWS}
      />,
    )

    const headers = screen.getAllByRole('columnheader')
    expect(headers[0]?.getAttribute('style')).toContain('width: 80px')
    expect(headers[1]?.getAttribute('style')).toContain('width: 300px')
    expect(headers[2]?.getAttribute('style')).toContain('width: 100px')
    expect(headers[3]?.getAttribute('style')).toContain('width: 160px')

    const table = screen.getByTestId('modern-data-table-table')
    expect(table.getAttribute('style')).toContain('width: 640px')
  })

  it('keeps row height fixed and no-wrap cell styles', () => {
    render(
      <ModernDataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row) => row.id}
      />,
    )

    const row = screen.getByTestId('modern-table-row-v1')
    expect(row.className).toContain('h-12')

    const titleCell = screen.getByText('Alpha Movie Very Long Title').closest('td')
    expect(titleCell?.className).toContain('whitespace-nowrap')
    expect(titleCell?.className).toContain('overflow-hidden')
    expect(titleCell?.className).toContain('text-ellipsis')
  })

  it('renders sort indicator on sorted column', () => {
    const sort: TableSortState = { field: 'title', direction: 'asc' }

    render(
      <ModernDataTable
        columns={COLUMNS}
        rows={ROWS}
        sort={sort}
        onSortChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('modern-table-sort-title').textContent).toContain('↑')
  })
})
