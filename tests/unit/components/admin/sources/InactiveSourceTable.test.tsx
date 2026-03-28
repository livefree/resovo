/**
 * InactiveSourceTable.test.tsx — CHG-262
 * 验证：数据渲染 / 列显示切换 / 空状态
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InactiveSourceTable } from '@/components/admin/sources/InactiveSourceTable'

const getMock = vi.fn()
const postMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}))

vi.mock('@/components/admin/sources/SourceVerifyButton', () => ({
  SourceVerifyButton: ({ sourceId }: { sourceId: string }) => (
    <button type="button" data-testid={`source-verify-btn-${sourceId}`}>验证</button>
  ),
}))

vi.mock('@/components/admin/sources/SourceUrlReplaceModal', () => ({
  SourceUrlReplaceModal: () => null,
}))

vi.mock('@/components/admin/sources/BatchDeleteBar', () => ({
  BatchDeleteBar: () => null,
}))

vi.mock('@/components/admin/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}))

const MOCK_ROWS = [
  {
    id: 'src1',
    video_id: 'v1',
    source_url: 'https://example.com/a',
    source_name: 'A',
    quality: null,
    type: 'direct',
    is_active: false,
    season_number: 1,
    episode_number: 1,
    last_checked: '2026-03-20T00:00:00Z',
    created_at: '2026-03-01T00:00:00Z',
    video_title: 'Alpha',
  },
  {
    id: 'src2',
    video_id: 'v2',
    source_url: 'https://example.com/b',
    source_name: 'B',
    quality: null,
    type: 'direct',
    is_active: false,
    season_number: 1,
    episode_number: 2,
    last_checked: null,
    created_at: '2026-03-02T00:00:00Z',
    video_title: 'Beta',
  },
]

describe('InactiveSourceTable (CHG-262)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
    deleteMock.mockResolvedValue({})
  })

  it('renders source rows with video title and url', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=inactive')
  })

  it('supports status=all mode', async () => {
    render(<InactiveSourceTable status="all" />)
    await screen.findByText('Alpha')
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=all')
  })

  it('supports column visibility toggle', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')

    // Open panel, toggle off coordinate, close panel, verify header is gone
    fireEvent.click(screen.getByTestId('inactive-source-columns-toggle'))
    fireEvent.click(screen.getByTestId('inactive-source-columns-panel-toggle-coordinate'))
    fireEvent.click(screen.getByTestId('inactive-source-columns-toggle')) // close panel

    await waitFor(() => {
      expect(screen.queryByText('S/E')).toBeNull()
    })
  })

  it('shows empty state when no sources', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<InactiveSourceTable />)
    await screen.findByText('暂无失效源')
  })
})
