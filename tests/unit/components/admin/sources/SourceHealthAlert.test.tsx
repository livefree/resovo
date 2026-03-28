import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceHealthAlert } from '@/components/admin/sources/SourceHealthAlert'

const getMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}))

describe('SourceHealthAlert (CHG-215)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: { count: 2, videoIds: ['v1', 'v2'], verifySchedulerEnabled: true } })
    patchMock.mockResolvedValue({})
  })

  it('renders shell video count from api', async () => {
    render(<SourceHealthAlert />)

    expect(await screen.findByTestId('source-health-alert')).toBeTruthy()
    expect(screen.getByText('检测到 2 个空壳视频')).toBeTruthy()
    expect(screen.getByTestId('source-health-verify-status').textContent).toContain('运行中')
  })

  it('hides shell videos through visibility api', async () => {
    const onResolved = vi.fn()
    render(<SourceHealthAlert onResolved={onResolved} />)

    await screen.findByTestId('source-health-alert')
    fireEvent.click(screen.getByTestId('source-health-hide-btn'))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v1/visibility', { visibility: 'hidden' })
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v2/visibility', { visibility: 'hidden' })
      expect(onResolved).toHaveBeenCalledOnce()
    })
  })
})
