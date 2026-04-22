/**
 * tests/unit/components/admin/banners/BannerDragSort.test.tsx
 * M5-ADMIN-BANNER-01: BannerDragSort 拖拽排序保存
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: { patch: (...args: unknown[]) => patchMock(...args) },
}))

const notifySuccess = vi.fn()
const notifyError = vi.fn()

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: { success: notifySuccess, error: notifyError },
}))

vi.mock('@/components/admin/shared/SortableList', () => ({
  SortableList: ({
    items,
    renderItem,
  }: {
    items: Array<{ id: string }>
    renderItem: (i: { id: string }, idx: number) => React.ReactNode
  }) => <div>{items.map((item, idx) => renderItem(item, idx))}</div>,
}))

// ── 测试数据 ──────────────────────────────────────────────────────────────────

const MOCK_BANNER = {
  id: 'b1',
  title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
  imageUrl: 'https://cdn.example.com/banner1.jpg',
  isActive: true,
  sortOrder: 0,
}

// ── 测试 ──────────────────────────────────────────────────────────────────────

describe('BannerDragSort', () => {
  beforeEach(() => {
    patchMock.mockReset()
    notifySuccess.mockReset()
    notifyError.mockReset()
  })

  it('调用 PATCH /admin/banners/reorder 后通知成功', async () => {
    const { BannerDragSort } = await import('@/components/admin/banners/BannerDragSort')
    patchMock.mockResolvedValueOnce({})
    const onClose = vi.fn()
    render(
      <BannerDragSort
        initialBanners={[MOCK_BANNER]}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByTestId('banner-drag-sort-save'))
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith(
      '/admin/banners/reorder',
      { orders: [{ id: 'b1', sortOrder: 0 }] }
    ))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
  })

  it('PATCH 失败时通知错误', async () => {
    const { BannerDragSort } = await import('@/components/admin/banners/BannerDragSort')
    patchMock.mockRejectedValueOnce(new Error('network error'))
    render(
      <BannerDragSort
        initialBanners={[MOCK_BANNER]}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('banner-drag-sort-save'))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
  })
})
