import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TableBadgeCell } from '@/components/admin/shared/modern-table/cells/TableBadgeCell'
import { TableCheckboxCell } from '@/components/admin/shared/modern-table/cells/TableCheckboxCell'
import { TableDateCell } from '@/components/admin/shared/modern-table/cells/TableDateCell'
import { TableImageCell } from '@/components/admin/shared/modern-table/cells/TableImageCell'
import { TableSwitchCell } from '@/components/admin/shared/modern-table/cells/TableSwitchCell'
import { TableTextCell } from '@/components/admin/shared/modern-table/cells/TableTextCell'
import { TableUrlCell } from '@/components/admin/shared/modern-table/cells/TableUrlCell'

describe('modern-table cells (CHG-205)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('TableTextCell renders fallback for empty text', () => {
    render(<TableTextCell value="" fallback="空值" />)
    expect(screen.getByTestId('table-text-cell').textContent).toBe('空值')
  })

  it('TableBadgeCell renders tone prefix and label', () => {
    render(<TableBadgeCell label="已通过" tone="success" />)
    expect(screen.getByTestId('table-badge-cell').textContent).toContain('✓')
    expect(screen.getByTestId('table-badge-cell').textContent).toContain('已通过')
  })

  it('TableImageCell renders fallback when src is empty', () => {
    render(<TableImageCell src={null} alt="poster" />)
    expect(screen.getByTestId('table-image-cell-fallback').textContent).toContain('无图')
  })

  it('TableDateCell renders relative text with injected now', () => {
    const now = new Date('2026-03-25T10:00:00.000Z')
    render(<TableDateCell value="2026-03-25T09:00:00.000Z" now={now} />)
    expect(screen.getByTestId('table-date-cell').textContent).toContain('1小时前')
  })

  it('TableCheckboxCell supports indeterminate and emits onChange', () => {
    const onChange = vi.fn()
    render(<TableCheckboxCell checked={false} indeterminate onChange={onChange} />)

    const checkbox = screen.getByTestId('table-checkbox-cell') as HTMLInputElement
    expect(checkbox.indeterminate).toBe(true)

    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('TableSwitchCell applies optimistic update and rollback on failure', async () => {
    const onToggle = vi.fn().mockRejectedValueOnce(new Error('network failed'))
    render(<TableSwitchCell value={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByTestId('table-switch-toggle'))
    expect(onToggle).toHaveBeenCalledWith(true)

    await waitFor(() => {
      expect(screen.getByText('network failed')).toBeTruthy()
      expect(screen.getByTestId('table-switch-toggle').getAttribute('aria-label')).toBe('开启')
    })
  })

  it('TableUrlCell copies URL and shows copied hint', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<TableUrlCell url="https://video.example.com/path/file.m3u8" />)

    fireEvent.click(screen.getByTestId('table-url-copy-btn'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://video.example.com/path/file.m3u8')
      expect(screen.getByText('已复制')).toBeTruthy()
    })
  })
})
