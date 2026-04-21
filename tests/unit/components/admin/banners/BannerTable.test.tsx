/**
 * tests/unit/components/admin/banners/BannerTable.test.tsx
 * M5-ADMIN-BANNER-01: BannerTable 渲染、筛选、分页、排序、拖拽排序面板
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BannerTable } from '@/components/admin/banners/BannerTable'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const getMock = vi.fn()
const deleteMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/admin/shared/dropdown/AdminDropdown', () => ({
  AdminDropdown: ({ items }: { items: Array<{ label: string; onClick: () => void }> }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>{item.label}</button>
      ))}
    </div>
  ),
}))

vi.mock('@/components/admin/shared/batch/SelectionActionBar', () => ({
  SelectionActionBar: () => null,
}))

vi.mock('@/components/admin/PaginationV2', () => ({
  PaginationV2: () => null,
}))

vi.mock('@/components/admin/ConfirmDialog', () => ({
  ConfirmDialog: ({ onConfirm, onClose, description }: { onConfirm: () => void; onClose: () => void; description: string }) => (
    <div data-testid="confirm-dialog">
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>确认</button>
      <button type="button" onClick={onClose}>取消</button>
    </div>
  ),
}))

vi.mock('@/components/admin/banners/BannerDragSort', () => ({
  BannerDragSort: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="banner-drag-sort-mock">
      <button type="button" onClick={onClose}>关闭拖拽</button>
    </div>
  ),
}))

// ── 测试数据 ──────────────────────────────────────────────────────────────────

const MOCK_BANNER = {
  id: 'b1',
  title: { 'zh-CN': '春季特辑', en: 'Spring Special' },
  imageUrl: 'https://cdn.example.com/banner1.jpg',
  linkType: 'video' as const,
  linkTarget: 'mv-spring',
  sortOrder: 1,
  activeFrom: null,
  activeTo: null,
  isActive: true,
  brandScope: 'all-brands' as const,
  brandSlug: null,
  createdAt: '2026-04-21T00:00:00Z',
  updatedAt: '2026-04-21T00:00:00Z',
}

const MOCK_RESPONSE = {
  data: [MOCK_BANNER],
  pagination: { total: 1, page: 1, limit: 20, hasNext: false },
}

beforeEach(() => {
  getMock.mockReset()
  deleteMock.mockReset()
  patchMock.mockReset()
})

// ── 测试 ──────────────────────────────────────────────────────────────────────

describe('BannerTable', () => {
  it('渲染 data-testid="banner-table"', async () => {
    getMock.mockResolvedValueOnce(MOCK_RESPONSE)
    render(<BannerTable />)
    expect(screen.getByTestId('banner-table')).toBeTruthy()
  })

  it('加载后展示 banner 标题', async () => {
    getMock.mockResolvedValueOnce(MOCK_RESPONSE)
    render(<BannerTable />)
    expect(await screen.findByText('春季特辑')).toBeTruthy()
  })

  it('调用 GET /admin/banners 带排序参数', async () => {
    getMock.mockResolvedValueOnce(MOCK_RESPONSE)
    render(<BannerTable />)
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    const url: string = getMock.mock.calls[0][0]
    expect(url).toContain('/admin/banners')
    expect(url).toContain('sortField=sort_order')
  })

  it('点击"编辑排序"显示 BannerDragSort', async () => {
    getMock.mockResolvedValueOnce(MOCK_RESPONSE)
    render(<BannerTable />)
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('banner-reorder-btn'))
    expect(screen.getByTestId('banner-drag-sort-mock')).toBeTruthy()
  })

  it('关闭拖拽面板后触发刷新', async () => {
    getMock.mockResolvedValue(MOCK_RESPONSE)
    render(<BannerTable />)
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('banner-reorder-btn'))
    fireEvent.click(screen.getByText('关闭拖拽'))
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
  })

  it('点击删除按钮弹出确认对话框', async () => {
    getMock.mockResolvedValueOnce(MOCK_RESPONSE)
    render(<BannerTable />)
    await screen.findByText('春季特辑')
    fireEvent.click(screen.getByText('删除'))
    expect(screen.getByTestId('confirm-dialog')).toBeTruthy()
  })

  it('确认删除调用 DELETE API', async () => {
    getMock.mockResolvedValue(MOCK_RESPONSE)
    deleteMock.mockResolvedValueOnce(undefined)
    render(<BannerTable />)
    await screen.findByText('春季特辑')
    fireEvent.click(screen.getByText('删除'))
    fireEvent.click(screen.getByText('确认'))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('/admin/banners/b1'))
  })

  it('API 失败时显示错误 toast', async () => {
    const { notify } = await import('@/components/admin/shared/toast/useAdminToast')
    getMock.mockRejectedValueOnce(new Error('network error'))
    render(<BannerTable />)
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
  })
})

