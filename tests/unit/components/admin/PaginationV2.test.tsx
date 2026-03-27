import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PaginationV2 } from '@/components/admin/PaginationV2'

describe('PaginationV2 (CHG-237)', () => {
  it('renders total, page buttons, prev/next, and jump input', () => {
    render(
      <PaginationV2 page={1} total={50} pageSize={20} onPageChange={() => {}} />
    )
    expect(screen.getByTestId('pagination-v2-total').textContent).toBe('共 50 条')
    expect(screen.getByTestId('pagination-v2-prev')).not.toBeNull()
    expect(screen.getByTestId('pagination-v2-next')).not.toBeNull()
    expect(screen.getByTestId('pagination-v2-jump-input')).not.toBeNull()
  })

  it('calls onPageChange when clicking a page button', () => {
    const onChange = vi.fn()
    render(
      <PaginationV2 page={1} total={100} pageSize={20} onPageChange={onChange} />
    )
    fireEvent.click(screen.getByTestId('pagination-v2-page-3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageSizeChange when selecting a page size', () => {
    const onPageSizeChange = vi.fn()
    render(
      <PaginationV2
        page={1}
        total={100}
        pageSize={20}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    )
    fireEvent.change(screen.getByTestId('pagination-v2-page-size'), {
      target: { value: '50' },
    })
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('shows ellipsis for large page counts', () => {
    render(
      <PaginationV2 page={5} total={200} pageSize={10} onPageChange={() => {}} />
    )
    const ellipses = screen.getAllByTestId('pagination-v2-ellipsis')
    expect(ellipses.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('pagination-v2-page-1')).not.toBeNull()
    expect(screen.getByTestId('pagination-v2-page-20')).not.toBeNull()
  })

  it('jumps to page on Enter key', () => {
    const onChange = vi.fn()
    render(
      <PaginationV2 page={1} total={100} pageSize={20} onPageChange={onChange} />
    )
    const input = screen.getByTestId('pagination-v2-jump-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('jumps to page on button click', () => {
    const onChange = vi.fn()
    render(
      <PaginationV2 page={1} total={100} pageSize={20} onPageChange={onChange} />
    )
    fireEvent.change(screen.getByTestId('pagination-v2-jump-input'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByTestId('pagination-v2-jump-btn'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('prev button is disabled on first page', () => {
    render(
      <PaginationV2 page={1} total={100} pageSize={20} onPageChange={() => {}} />
    )
    const prev = screen.getByTestId('pagination-v2-prev') as HTMLButtonElement
    const next = screen.getByTestId('pagination-v2-next') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)
  })

  it('next button is disabled on last page', () => {
    render(
      <PaginationV2 page={5} total={100} pageSize={20} onPageChange={() => {}} />
    )
    const next = screen.getByTestId('pagination-v2-next') as HTMLButtonElement
    const prev = screen.getByTestId('pagination-v2-prev') as HTMLButtonElement
    expect(next.disabled).toBe(true)
    expect(prev.disabled).toBe(false)
  })
})
