/**
 * BannerOpsSection.test.tsx — Banner tab home_banners 编辑器测试
 * （CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1）
 *
 * 覆盖（视图卡 ≥9 用例规范）：
 * - loading / error+retry / 空态 / 列表渲染
 * - 状态 Pill 派生（生效中 / 待生效 / 已过期 / 已停用）
 * - 启停 toggle → updateBanner({ isActive })
 * - 删除 Modal 确认链 → deleteBanner + 行移除；取消不调用
 * - 新建 Drawer 提交 → createBanner（注入末尾 sortOrder）
 * - 编辑 Drawer 预填 + 提交 → updateBanner
 * - imageUrl 必填本地校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

// ── mock @dnd-kit（HomeOpsClient.test 同范式：jsdom 不支持 sensors）──
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

// ── mock banners API ──
vi.mock('../../../../../../apps/server-next/src/lib/banners/api', () => ({
  listBanners: vi.fn(),
  getBanner: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
  reorderBanners: vi.fn(),
}))

import {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../../../../../../apps/server-next/src/lib/banners/api'
import { BannerOpsSection } from '../../../../../../apps/server-next/src/app/admin/home/_client/BannerOpsSection'
import { deriveBannerStatus } from '../../../../../../apps/server-next/src/app/admin/home/_client/BannerCard'
import type { Banner } from '../../../../../../apps/server-next/src/lib/banners/types'

const mockedList = vi.mocked(listBanners)
const mockedCreate = vi.mocked(createBanner)
const mockedUpdate = vi.mocked(updateBanner)
const mockedDelete = vi.mocked(deleteBanner)

const BANNER: Banner = {
  id: 'b0000000-0000-0000-0000-000000000001',
  title: { 'zh-CN': '夏日专题' },
  imageUrl: 'https://cdn.example.com/banner.jpg',
  linkType: 'external',
  linkTarget: 'https://promo.example.com',
  sortOrder: 0,
  activeFrom: null,
  activeTo: null,
  isActive: true,
  brandScope: 'all-brands',
  brandSlug: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

function listResult(data: Banner[]) {
  return { data, pagination: { total: data.length, page: 1, limit: 100, hasNext: false } }
}

/** AdminInput 的 data-testid 在容器 div，真实 input 为内层 [data-admin-input-control] */
function inputOf(testId: string): HTMLInputElement {
  const input = screen.getByTestId(testId).querySelector('input')
  if (!input) throw new Error(`no inner input under ${testId}`)
  return input
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockedList.mockResolvedValue(listResult([BANNER]))
})

describe('BannerOpsSection — 加载与列表', () => {
  it('加载中渲染 LoadingState（skeleton）', () => {
    mockedList.mockReturnValue(new Promise(() => {})) // 永挂起
    const { container } = render(<BannerOpsSection />)
    expect(container.querySelector('[data-testid="banner-ops-section"]')).toBeNull()
  })

  it('加载成功 → 列表卡片渲染（标题 + 状态 Pill + 横图）', async () => {
    render(<BannerOpsSection />)
    await waitFor(() => {
      expect(screen.queryByTestId(`banner-card-${BANNER.id}`)).not.toBeNull()
    })
    expect(screen.getByText('夏日专题')).not.toBeNull()
    expect(screen.getByTestId(`banner-status-${BANNER.id}`).textContent).toBe('生效中')
    expect(screen.getByTestId(`banner-thumb-${BANNER.id}`).getAttribute('src')).toBe(BANNER.imageUrl)
  })

  it('listBanners 失败 → ErrorState + 重试重新加载', async () => {
    mockedList.mockRejectedValue(new Error('network failure'))
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByText('Banner 加载失败')).not.toBeNull())

    mockedList.mockReset()
    mockedList.mockResolvedValue(listResult([BANNER]))
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => {
      expect(screen.queryByTestId(`banner-card-${BANNER.id}`)).not.toBeNull()
    })
  })

  it('空列表 → EmptyState 文案（横版大图建议）', async () => {
    mockedList.mockResolvedValue(listResult([]))
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByText('暂无 Banner')).not.toBeNull())
    expect(screen.getByText(/1920×1080/)).not.toBeNull()
  })
})

describe('deriveBannerStatus — 状态派生（D-181-3 字段映射口径）', () => {
  const now = new Date('2026-06-05T12:00:00Z')

  it('isActive=false → 已停用（neutral）', () => {
    expect(deriveBannerStatus({ ...BANNER, isActive: false }, now)).toEqual({ variant: 'neutral', label: '已停用' })
  })

  it('activeTo ≤ now → 已过期（neutral）；activeFrom > now → 待生效（warn）；时效内 → 生效中（ok）', () => {
    expect(deriveBannerStatus({ ...BANNER, activeTo: '2026-06-01T00:00:00Z' }, now))
      .toEqual({ variant: 'neutral', label: '已过期' })
    expect(deriveBannerStatus({ ...BANNER, activeFrom: '2026-07-01T00:00:00Z' }, now))
      .toEqual({ variant: 'warn', label: '待生效' })
    expect(deriveBannerStatus(BANNER, now)).toEqual({ variant: 'ok', label: '生效中' })
  })
})

describe('BannerOpsSection — 启停 / 删除', () => {
  it('点击「停用」→ updateBanner(id, { isActive: false }) + 行内状态更新', async () => {
    mockedUpdate.mockResolvedValue({ ...BANNER, isActive: false })
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId(`banner-toggle-${BANNER.id}`)).not.toBeNull())
    fireEvent.click(screen.getByTestId(`banner-toggle-${BANNER.id}`))
    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(BANNER.id, { isActive: false })
    })
    await waitFor(() => {
      expect(screen.getByTestId(`banner-status-${BANNER.id}`).textContent).toBe('已停用')
    })
  })

  it('删除：点删除 → Modal 含目标摘要 → 确认 → deleteBanner + 行移除', async () => {
    mockedDelete.mockResolvedValue(undefined)
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId(`banner-delete-${BANNER.id}`)).not.toBeNull())
    fireEvent.click(screen.getByTestId(`banner-delete-${BANNER.id}`))
    await waitFor(() => expect(screen.queryByTestId('banner-delete-confirm')).not.toBeNull())
    fireEvent.click(screen.getByTestId('banner-delete-confirm'))
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(BANNER.id))
    await waitFor(() => {
      expect(screen.queryByTestId(`banner-card-${BANNER.id}`)).toBeNull()
    })
  })

  it('删除取消：点取消关闭 Modal 且不调 deleteBanner', async () => {
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId(`banner-delete-${BANNER.id}`)).not.toBeNull())
    fireEvent.click(screen.getByTestId(`banner-delete-${BANNER.id}`))
    await waitFor(() => expect(screen.queryByTestId('banner-delete-cancel')).not.toBeNull())
    fireEvent.click(screen.getByTestId('banner-delete-cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('banner-delete-confirm')).toBeNull()
    })
    expect(mockedDelete).not.toHaveBeenCalled()
  })
})

describe('BannerOpsSection — 新建 / 编辑 Drawer', () => {
  it('新建：填必填项提交 → createBanner 注入末尾 sortOrder', async () => {
    mockedCreate.mockResolvedValue({ ...BANNER, id: 'b-new' })
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId('banner-create-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('banner-create-btn'))

    fireEvent.change(inputOf('banner-image-url'), { target: { value: 'https://cdn.example.com/new.jpg' } })
    fireEvent.change(inputOf('banner-link-target'), { target: { value: 'https://target.example.com' } })
    fireEvent.click(screen.getByTestId('banner-drawer-submit'))

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
        imageUrl: 'https://cdn.example.com/new.jpg',
        linkTarget: 'https://target.example.com',
        linkType: 'external',
        sortOrder: 1, // 既有 1 条 → 末尾追加
      }))
    })
  })

  it('新建：imageUrl 留空提交 → 本地校验错误条，不调 createBanner', async () => {
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId('banner-create-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('banner-create-btn'))
    fireEvent.click(screen.getByTestId('banner-drawer-submit'))

    await waitFor(() => {
      expect(screen.queryByTestId('banner-drawer-error')).not.toBeNull()
    })
    expect(screen.getByTestId('banner-drawer-error').textContent).toContain('横版大图')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('编辑：Drawer 预填既有值 → 提交 → updateBanner(id, body)', async () => {
    mockedUpdate.mockResolvedValue({ ...BANNER, linkTarget: 'https://changed.example.com' })
    render(<BannerOpsSection />)
    await waitFor(() => expect(screen.queryByTestId(`banner-edit-${BANNER.id}`)).not.toBeNull())
    fireEvent.click(screen.getByTestId(`banner-edit-${BANNER.id}`))

    // 预填断言
    await waitFor(() => {
      expect(inputOf('banner-title-zh').value).toBe('夏日专题')
    })
    expect(inputOf('banner-image-url').value).toBe(BANNER.imageUrl)

    fireEvent.change(inputOf('banner-link-target'), { target: { value: 'https://changed.example.com' } })
    fireEvent.click(screen.getByTestId('banner-drawer-submit'))

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(BANNER.id, expect.objectContaining({
        linkTarget: 'https://changed.example.com',
      }))
    })
  })
})
