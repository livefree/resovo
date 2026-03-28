import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'

const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

describe('SourceVerifyButton (CHG-287)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('点击验证后展示成功响应时间并触发 onVerified', async () => {
    postMock.mockResolvedValueOnce({
      data: { isActive: true, responseMs: 132, statusCode: 200 },
    })
    const onVerified = vi.fn()

    render(<SourceVerifyButton sourceId="src-1" onVerified={onVerified} />)
    fireEvent.click(screen.getByTestId('source-verify-btn-src-1'))

    await waitFor(() => {
      expect(screen.getByTestId('source-verify-result-src-1').textContent).toContain('✓ 132ms')
    })

    expect(postMock).toHaveBeenCalledWith('/admin/sources/src-1/verify')
    expect(onVerified).toHaveBeenCalledWith({ isActive: true, responseMs: 132, statusCode: 200 })
  })

  it('失效且无状态码时展示超时', async () => {
    postMock.mockResolvedValueOnce({
      data: { isActive: false, responseMs: 10000, statusCode: null },
    })

    render(<SourceVerifyButton sourceId="src-2" />)
    fireEvent.click(screen.getByTestId('source-verify-btn-src-2'))

    await waitFor(() => {
      expect(screen.getByTestId('source-verify-result-src-2').textContent).toBe('✗ 超时')
    })
  })

  it('返回结构不匹配时展示返回异常', async () => {
    postMock.mockResolvedValueOnce({ data: { jobId: 'job-1' } })

    render(<SourceVerifyButton sourceId="src-3" />)
    fireEvent.click(screen.getByTestId('source-verify-btn-src-3'))

    await waitFor(() => {
      expect(screen.getByTestId('source-verify-result-src-3').textContent).toBe('✗ 返回异常')
    })
  })

  it('请求失败时展示验证失败', async () => {
    postMock.mockRejectedValueOnce(new Error('network error'))

    render(<SourceVerifyButton sourceId="src-4" />)
    fireEvent.click(screen.getByTestId('source-verify-btn-src-4'))

    await waitFor(() => {
      expect(screen.getByTestId('source-verify-result-src-4').textContent).toBe('✗ 验证失败')
    })
  })
})
