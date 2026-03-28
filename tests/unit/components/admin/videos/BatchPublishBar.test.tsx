/**
 * tests/unit/components/admin/videos/BatchPublishBar.test.tsx
 * CHG-213: BatchPublishBar 批量可见性与审核操作
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'

const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

describe('BatchPublishBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockResolvedValue({})
  })

  it('selectedIds 为空时不渲染', () => {
    render(
      <BatchPublishBar selectedIds={[]} onSuccess={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.queryByTestId('batch-publish-bar')).toBeNull()
  })

  it('selectedIds 有值时渲染浮动栏', () => {
    render(
      <BatchPublishBar selectedIds={['id-1', 'id-2']} onSuccess={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByTestId('batch-publish-bar')).toBeTruthy()
  })

  it('显示正确的选中数量', () => {
    render(
      <BatchPublishBar selectedIds={['a', 'b', 'c']} onSuccess={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByTestId('batch-publish-count').textContent).toContain('3')
  })

  it('点击取消调用 onClear', () => {
    const onClear = vi.fn()
    render(
      <BatchPublishBar selectedIds={['id-1']} onSuccess={vi.fn()} onClear={onClear} />
    )
    fireEvent.click(screen.getByTestId('batch-clear-btn'))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('超过 50 条时上架/下架按钮 disabled', () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`)
    render(
      <BatchPublishBar selectedIds={ids} onSuccess={vi.fn()} onClear={vi.fn()} />
    )
    const publishBtn = screen.getByTestId('batch-publish-btn') as HTMLButtonElement
    const hideBtn = screen.getByTestId('batch-hide-btn') as HTMLButtonElement
    expect(publishBtn.disabled).toBe(true)
    expect(hideBtn.disabled).toBe(true)
  })

  it('50 条以内按钮可用', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`)
    render(
      <BatchPublishBar selectedIds={ids} onSuccess={vi.fn()} onClear={vi.fn()} />
    )
    const publishBtn = screen.getByTestId('batch-publish-btn') as HTMLButtonElement
    expect(publishBtn.disabled).toBe(false)
  })

  it('批量公开走 batch-publish 接口并在成功后清空选择', async () => {
    const onSuccess = vi.fn()
    const onClear = vi.fn()

    render(
      <BatchPublishBar selectedIds={['id-1', 'id-2']} onSuccess={onSuccess} onClear={onClear} />
    )

    fireEvent.click(screen.getByTestId('batch-publish-btn'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/batch-publish', {
        ids: ['id-1', 'id-2'],
        isPublished: true,
      })
      expect(onSuccess).toHaveBeenCalledOnce()
      expect(onClear).toHaveBeenCalledOnce()
    })
  })

  it('批量隐藏走 batch-unpublish 接口', async () => {
    render(
      <BatchPublishBar selectedIds={['id-1', 'id-2']} onSuccess={vi.fn()} onClear={vi.fn()} />
    )

    fireEvent.click(screen.getByTestId('batch-hide-btn'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/batch-unpublish', { ids: ['id-1', 'id-2'] })
    })
  })

  it('批量通过调用 review 接口', async () => {
    render(
      <BatchPublishBar selectedIds={['id-1']} onSuccess={vi.fn()} onClear={vi.fn()} />
    )

    fireEvent.click(screen.getByTestId('batch-approve-btn'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/id-1/review', { action: 'approve' })
    })
  })
})
