/**
 * HomeModuleDrawer.test.tsx — 运营位模块 Drawer 表单（CHG-HOME-UX-05）
 *
 * 覆盖：
 *   #1 title 多语言 payload 仅非空键（buildTitlePayload）
 *   #2 datetime-local 对称往返：编辑不动保存 → startAt/endAt ISO 不漂移
 *      （v1 BannerForm `.slice(0,16)` 模式的时差 bug 在此守护不回归）
 *   #3 auto-fill：video 选中 → 空 titleZh/imageUrl 预填；已填不覆盖
 *   #4 上传按钮可见性：新建态隐藏（仅外链）/ 编辑态可见
 *   #5 imageUrl 空串提交为 null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ── mock picker-fetcher（auto-fill 取数通道）──
const mockFetchPickerById = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/videos/picker-fetcher', () => ({
  videoPickerFetcher: vi.fn(),
  fetchPickerItemByIdSafe: (...args: unknown[]) => mockFetchPickerById(...args),
}))

// ── mock home-modules api（ModuleImageField 上传通道）──
vi.mock('../../../../../../apps/server-next/src/lib/home-modules/api', () => ({
  uploadHomeModuleImage: vi.fn(),
}))

// ── mock ContentRefPicker 为轻量 input（驱动 onChange 触发 auto-fill；其余 admin-ui 原样）──
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    ContentRefPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
      <input
        data-testid="mock-content-ref"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  }
})

import { HomeModuleDrawer } from '../../../../../../apps/server-next/src/app/admin/home/_client/HomeModuleDrawer'
import type { HomeModule } from '../../../../../../apps/server-next/src/lib/home-modules/types'

const MODULE_FIXTURE: HomeModule = {
  id: 'm-001',
  slot: 'banner',
  brandScope: 'all-brands',
  brandSlug: null,
  ordering: 0,
  contentRefType: 'video',
  contentRefId: 'v-abc',
  title: { 'zh-CN': '既有标题' },
  imageUrl: 'https://cdn.example.com/existing.jpg',
  startAt: '2099-06-01T08:00:00.000Z',
  endAt: '2099-06-30T23:59:00.000Z',
  enabled: true,
  metadata: {},
  createdAt: '2026-05-12T00:00:00Z',
  updatedAt: '2026-05-12T00:00:00Z',
}

const PICKER_ITEM = {
  id: 'v-new',
  shortId: 'new1',
  title: '自动带出标题',
  titleEn: null,
  type: 'movie',
  year: 2026,
  coverUrl: 'https://cdn.example.com/auto-cover.jpg',
  isPublished: true,
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockFetchPickerById.mockResolvedValue(PICKER_ITEM)
})

function renderDrawer(module: HomeModule | null, onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <HomeModuleDrawer
      open
      module={module}
      defaultSlot="banner"
      onClose={vi.fn()}
      onSave={onSave}
    />,
  )
  return onSave
}

describe('HomeModuleDrawer — title 多语言 payload', () => {
  it('仅非空键进 payload；中英都空 → title={}', async () => {
    const onSave = renderDrawer(null)
    fireEvent.change(screen.getByTestId('mock-content-ref'), { target: { value: 'v-x' } })
    fireEvent.change(screen.getByLabelText('标题（中文）'), { target: { value: ' 暑期专题 ' } })
    fireEvent.click(screen.getByTestId('drawer-submit'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const body = onSave.mock.calls[0][0]
    expect(body.title).toEqual({ 'zh-CN': '暑期专题' })  // trim + en 空键不传
  })
})

describe('HomeModuleDrawer — datetime-local 对称往返（BannerForm 漂移 bug 守护）', () => {
  it('编辑模块不动时间直接保存 → startAt/endAt 与原始 ISO 等时刻（零漂移）', async () => {
    const onSave = renderDrawer(MODULE_FIXTURE)
    // datetime-local 输入已渲染本地化值
    expect((screen.getByTestId('drawer-start-at') as HTMLInputElement).value).not.toBe('')
    fireEvent.click(screen.getByTestId('drawer-submit'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const body = onSave.mock.calls[0][0]
    // 对称性断言：往返后时间戳等值（不依赖测试机时区）
    expect(new Date(body.startAt).getTime()).toBe(new Date(MODULE_FIXTURE.startAt as string).getTime())
    expect(new Date(body.endAt).getTime()).toBe(new Date(MODULE_FIXTURE.endAt as string).getTime())
  })

  it('时间留空 → 提交 null（立即/永久语义）', async () => {
    const onSave = renderDrawer(null)
    fireEvent.change(screen.getByTestId('mock-content-ref'), { target: { value: 'v-x' } })
    fireEvent.click(screen.getByTestId('drawer-submit'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const body = onSave.mock.calls[0][0]
    expect(body.startAt).toBeNull()
    expect(body.endAt).toBeNull()
  })
})

describe('HomeModuleDrawer — auto-fill（D-104-10）', () => {
  it('video 选中 → 空 titleZh/imageUrl 预填视频标题/封面', async () => {
    renderDrawer(null)
    fireEvent.change(screen.getByTestId('mock-content-ref'), { target: { value: 'v-new' } })
    await waitFor(() => {
      expect((screen.getByLabelText('标题（中文）') as HTMLInputElement).value).toBe('自动带出标题')
    })
    expect((screen.getByLabelText('运营横图 URL') as HTMLInputElement).value).toBe('https://cdn.example.com/auto-cover.jpg')
  })

  it('已填字段不被 auto-fill 覆盖', async () => {
    renderDrawer(null)
    fireEvent.change(screen.getByLabelText('标题（中文）'), { target: { value: '手填标题' } })
    fireEvent.change(screen.getByTestId('mock-content-ref'), { target: { value: 'v-new' } })
    // imageUrl 空 → 预填；titleZh 已填 → 保留
    await waitFor(() => {
      expect((screen.getByLabelText('运营横图 URL') as HTMLInputElement).value).toBe('https://cdn.example.com/auto-cover.jpg')
    })
    expect((screen.getByLabelText('标题（中文）') as HTMLInputElement).value).toBe('手填标题')
  })

  it('404（item=null）→ 零预填', async () => {
    mockFetchPickerById.mockResolvedValue(null)
    renderDrawer(null)
    fireEvent.change(screen.getByTestId('mock-content-ref'), { target: { value: 'v-dead' } })
    await waitFor(() => expect(mockFetchPickerById).toHaveBeenCalled())
    expect((screen.getByLabelText('标题（中文）') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('运营横图 URL') as HTMLInputElement).value).toBe('')
  })
})

describe('HomeModuleDrawer — 图片字段（ModuleImageField）', () => {
  it('新建态：上传按钮隐藏 + 提示「保存后可上传」', () => {
    renderDrawer(null)
    expect(screen.queryByTestId('drawer-image-upload-btn')).toBeNull()
    expect(screen.queryByText(/保存后可上传/)).not.toBeNull()
  })

  it('编辑态：上传按钮可见 + 既有 imageUrl 显示 16:9 预览', () => {
    renderDrawer(MODULE_FIXTURE)
    expect(screen.queryByTestId('drawer-image-upload-btn')).not.toBeNull()
    expect((screen.getByTestId('drawer-image-preview') as HTMLImageElement).src).toBe('https://cdn.example.com/existing.jpg')
  })

  it('imageUrl 空串提交为 null', async () => {
    const onSave = renderDrawer(MODULE_FIXTURE)
    fireEvent.change(screen.getByLabelText('运营横图 URL'), { target: { value: '  ' } })
    fireEvent.click(screen.getByTestId('drawer-submit'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].imageUrl).toBeNull()
  })
})
