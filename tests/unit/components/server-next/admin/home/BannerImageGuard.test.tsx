/**
 * BannerImageGuard.test.tsx — Banner 横图警告级校验组件
 * （CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6 / D-052-9 口径）
 *
 * 覆盖：空 URL 不渲染 / 达标 ok + 安全区预览 / 尺寸警告 / 探测失败提醒 /
 * BannerDrawer 集成（警告在场提交不被阻断——警告级零拦截）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// probe mock（evaluateBannerImage 用真实现——规则真伪由纯函数测试承担）
const mockProbe = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/banners/image-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../apps/server-next/src/lib/banners/image-guard')>()
  return {
    ...actual,
    probeImageSize: (...args: unknown[]) => mockProbe(...args),
  }
})

import { BannerImageGuard } from '../../../../../../apps/server-next/src/app/admin/home/_client/BannerImageGuard'
import { BannerDrawer } from '../../../../../../apps/server-next/src/app/admin/home/_client/BannerDrawer'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BannerImageGuard — 警告级校验（不阻断）', () => {
  it('空 URL → 不渲染（idle）', () => {
    render(<BannerImageGuard imageUrl="" debounceMs={0} />)
    expect(screen.queryByTestId('banner-image-guard')).toBeNull()
  })

  it('达标尺寸 → ok 文案 + desktop/mobile 安全区预览（§6.4）', async () => {
    mockProbe.mockResolvedValue({ width: 1920, height: 1080 })
    render(<BannerImageGuard imageUrl="https://cdn.example.com/ok.jpg" debounceMs={0} />)

    await waitFor(() => expect(screen.queryByTestId('banner-image-ok')).not.toBeNull())
    expect(screen.getByTestId('banner-image-ok').textContent).toContain('1920×1080')
    expect(screen.queryByTestId('banner-image-warnings')).toBeNull()
    const preview = screen.getByTestId('banner-safe-area-preview')
    expect(preview.textContent).toContain('Desktop 首屏')
    expect(preview.textContent).toContain('Mobile')
    expect(preview.querySelectorAll('img')).toHaveLength(2)
  })

  it('低尺寸 → below_min 警告 +「不阻断」声明文案', async () => {
    mockProbe.mockResolvedValue({ width: 1024, height: 576 })
    render(<BannerImageGuard imageUrl="https://cdn.example.com/small.jpg" debounceMs={0} />)

    await waitFor(() => expect(screen.queryByTestId('banner-image-warning-below_min')).not.toBeNull())
    expect(screen.getByTestId('banner-image-warnings').textContent).toContain('不阻断')
    // 安全区预览在警告态同样渲染（运营对照裁切效果）
    expect(screen.queryByTestId('banner-safe-area-preview')).not.toBeNull()
  })

  it('比例超界 → ratio_out_of_range 警告（建议裁切）', async () => {
    mockProbe.mockResolvedValue({ width: 2000, height: 2000 })
    render(<BannerImageGuard imageUrl="https://cdn.example.com/square.jpg" debounceMs={0} />)

    await waitFor(() => expect(screen.queryByTestId('banner-image-warning-ratio_out_of_range')).not.toBeNull())
  })

  it('探测失败 → 风险提醒（运营确认后仍可发布，§6.6）', async () => {
    mockProbe.mockRejectedValue(new Error('load error'))
    render(<BannerImageGuard imageUrl="https://broken.example.com/x.jpg" debounceMs={0} />)

    await waitFor(() => expect(screen.queryByTestId('banner-image-probe-failed')).not.toBeNull())
    expect(screen.getByTestId('banner-image-probe-failed').textContent).toContain('仍可发布')
  })

  it('URL 清空 → 警告态复位为不渲染', async () => {
    mockProbe.mockResolvedValue({ width: 1024, height: 576 })
    const { rerender } = render(<BannerImageGuard imageUrl="https://cdn.example.com/small.jpg" debounceMs={0} />)
    await waitFor(() => expect(screen.queryByTestId('banner-image-guard')).not.toBeNull())

    rerender(<BannerImageGuard imageUrl="" debounceMs={0} />)
    await waitFor(() => expect(screen.queryByTestId('banner-image-guard')).toBeNull())
  })
})

describe('BannerDrawer 集成 — 警告级零拦截（D-052-9）', () => {
  it('探测失败警告在场，提交仍直达 onSave（不被阻断）', async () => {
    mockProbe.mockRejectedValue(new Error('probe fail'))
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<BannerDrawer open banner={null} onClose={vi.fn()} onSave={onSave} />)

    // 填必填字段（imageUrl + linkTarget）
    const imageInput = screen.getByTestId('banner-image-url').querySelector('input')!
    fireEvent.change(imageInput, { target: { value: 'https://broken.example.com/banner.jpg' } })
    const linkInput = screen.getByTestId('banner-link-target').querySelector('input')!
    fireEvent.change(linkInput, { target: { value: 'https://promo.example.com' } })

    // 等探测失败警告渲染（BannerDrawer 内默认 600ms 防抖）
    await waitFor(
      () => expect(screen.queryByTestId('banner-image-probe-failed')).not.toBeNull(),
      { timeout: 3000 },
    )

    fireEvent.click(screen.getByTestId('banner-drawer-submit'))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://broken.example.com/banner.jpg' }),
      null,
    )
  })
})
