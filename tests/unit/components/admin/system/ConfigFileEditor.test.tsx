import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConfigFileEditor } from '@/components/admin/system/config-file/ConfigFileEditor'

const getMock = vi.fn()
const postMock = vi.fn()
const notifySuccessMock = vi.fn()
const notifyErrorMock = vi.fn()

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args),
    error: (...args: unknown[]) => notifyErrorMock(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
  ApiClientError: class extends Error {
    code = 'INTERNAL_ERROR'
    status = 500
  },
}))

describe('ConfigFileEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: { configFile: '', subscriptionUrl: '' } })
    postMock.mockResolvedValue({ data: { ok: true, synced: 0, skipped: 0 } })
    notifySuccessMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('can switch to local upload tab', async () => {
    render(<ConfigFileEditor />)

    await screen.findByTestId('config-tab-local')
    fireEvent.click(screen.getByTestId('config-tab-local'))

    expect(screen.getByTestId('config-local-file-input')).not.toBeNull()
  })

  it('loads local json file into textarea', async () => {
    render(<ConfigFileEditor />)
    await screen.findByTestId('config-tab-local')
    fireEvent.click(screen.getByTestId('config-tab-local'))

    const fileInput = screen.getByTestId('config-local-file-input') as HTMLInputElement
    const file = new File(['{}'], 'sources.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({ api_site: { demo: { name: 'Demo', api: 'https://demo.test/api.php/provide/vod' } } })),
    })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(notifySuccessMock).toHaveBeenCalledWith('本地文件加载成功')
    })

    const textarea = screen.getByPlaceholderText(/crawler_sites/) as HTMLTextAreaElement
    expect(textarea.value).toContain('"api_site"')
    expect(screen.getByText('已选择：sources.json')).not.toBeNull()
  })

  it('shows error when local file is invalid json', async () => {
    render(<ConfigFileEditor />)
    await screen.findByTestId('config-tab-local')
    fireEvent.click(screen.getByTestId('config-tab-local'))

    const fileInput = screen.getByTestId('config-local-file-input') as HTMLInputElement
    const badFile = new File(['{}'], 'bad.json', { type: 'application/json' })
    Object.defineProperty(badFile, 'text', {
      value: vi.fn().mockResolvedValue('{bad json'),
    })
    fireEvent.change(fileInput, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(notifyErrorMock).toHaveBeenCalledWith(expect.stringMatching(/本地文件解析失败/))
    })
  })
})
