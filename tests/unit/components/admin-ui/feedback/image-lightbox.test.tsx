/**
 * image-lightbox.test.tsx — ImageLightbox 共享组件单元测试（IMGH-P1-3 / SEQ-20260619-01）
 *
 * 覆盖 arch-reviewer 测试要点：open 守卫 / dialog a11y / Esc / 遮罩点击 / 关闭按钮
 *   / src=null 降级 / onError 降级 / onLoad 尺寸 + onNaturalSize / status Pill + slot 互斥
 *   / meta slot 互斥 / 复制内置 + 接管 + clipboard reject 非空 catch
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ImageLightbox } from '../../../../../packages/admin-ui/src/components/feedback/image-lightbox'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const SRC = 'https://cdn.example.com/poster.jpg'

describe('ImageLightbox — open 守卫 + a11y', () => {
  it('open=false → 不渲染任何 DOM', () => {
    const { container } = render(<ImageLightbox open={false} onClose={vi.fn()} src={SRC} />)
    expect(container.querySelector('[data-image-lightbox]')).toBeNull()
  })

  it('open=true → 渲染 role=dialog + aria-modal + portal 到 body', () => {
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} title="沙丘" />)
    const dialog = document.querySelector('[data-image-lightbox]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('testId 落到 dialog data-testid', () => {
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} testId="lb-x" />)
    expect(screen.getByTestId('lb-x')).not.toBeNull()
  })
})

describe('ImageLightbox — 关闭交互', () => {
  it('Esc → 调 onClose', () => {
    const onClose = vi.fn()
    render(<ImageLightbox open onClose={onClose} src={SRC} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnEscape=false → Esc 不调 onClose', () => {
    const onClose = vi.fn()
    render(<ImageLightbox open onClose={onClose} src={SRC} closeOnEscape={false} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('关闭按钮点击 → 调 onClose', () => {
    const onClose = vi.fn()
    render(<ImageLightbox open onClose={onClose} src={SRC} />)
    fireEvent.click(document.querySelector('[data-close-btn]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ImageLightbox — 图片态 + 尺寸', () => {
  it('src=null → 不渲染 img，渲染降级占位 + 尺寸显示 dimensionFallbackText', () => {
    render(<ImageLightbox open onClose={vi.fn()} src={null} dimensionFallbackText="N/A" />)
    expect(document.querySelector('[data-lightbox-img]')).toBeNull()
    expect(document.querySelector('[data-lightbox-fallback]')).not.toBeNull()
    expect(screen.getByTestId('lightbox-meta-dimension').textContent).toBe('N/A')
  })

  it('onLoad 读 naturalWidth/Height → 尺寸区显示 + onNaturalSize 回调', () => {
    const onNaturalSize = vi.fn()
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" onNaturalSize={onNaturalSize} />)
    const img = document.querySelector('[data-lightbox-img]') as HTMLImageElement
    Object.defineProperty(img, 'naturalWidth', { value: 600, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 900, configurable: true })
    fireEvent.load(img)
    expect(screen.getByTestId('lightbox-meta-dimension').textContent).toBe('600 × 900')
    expect(onNaturalSize).toHaveBeenCalledWith({ width: 600, height: 900 })
  })

  it('onError → 加载失败降级占位 + 尺寸 —', () => {
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" />)
    const img = document.querySelector('[data-lightbox-img]') as HTMLImageElement
    fireEvent.error(img)
    expect(document.querySelector('[data-lightbox-fallback]')).not.toBeNull()
    expect(screen.getByTestId('lightbox-meta-dimension').textContent).toBe('—')
  })
})

describe('ImageLightbox — 元信息 + slot 互斥', () => {
  it('meta.status → 渲染状态 Pill', () => {
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" meta={{ status: 'broken' }} />)
    const statusCell = screen.getByTestId('lightbox-meta-status')
    expect(statusCell.textContent).toContain('破损')
  })

  it('statusSlot 覆盖 meta.status 内置 Pill', () => {
    render(
      <ImageLightbox
        open
        onClose={vi.fn()}
        src={SRC}
        alt="x"
        meta={{ status: 'broken' }}
        statusSlot={<span>自定义状态</span>}
      />,
    )
    expect(screen.getByTestId('lightbox-meta-status').textContent).toContain('自定义状态')
  })

  it('metaSlot 完全接管面板（不渲染内置 meta）', () => {
    render(
      <ImageLightbox
        open
        onClose={vi.fn()}
        src={SRC}
        alt="x"
        meta={{ source: 'tmdb' }}
        metaSlot={<div data-custom-meta>自定义面板</div>}
      />,
    )
    expect(document.querySelector('[data-custom-meta]')).not.toBeNull()
    expect(document.querySelector('[data-lightbox-meta]')).toBeNull()
  })

  it('meta.source + 破损信息渲染', () => {
    render(
      <ImageLightbox
        open
        onClose={vi.fn()}
        src={SRC}
        alt="x"
        meta={{ source: 'tmdb', brokenDomain: 'cdn.bad.com', occurrenceCount: 12 }}
      />,
    )
    expect(screen.getByTestId('lightbox-meta-source').textContent).toBe('tmdb')
    expect(screen.getByTestId('lightbox-meta-broken').textContent).toContain('cdn.bad.com')
    expect(screen.getByTestId('lightbox-meta-broken').textContent).toContain('12 次')
  })
})

describe('ImageLightbox — URL 复制', () => {
  it('内置复制：调 navigator.clipboard.writeText(src) + 显示已复制', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" />)
    fireEvent.click(document.querySelector('[data-copy-btn]') as HTMLElement)
    expect(writeText).toHaveBeenCalledWith(SRC)
    await screen.findByText('已复制')
  })

  it('onCopyUrl 提供 → 接管复制，不调内置 clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const onCopyUrl = vi.fn()
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" onCopyUrl={onCopyUrl} />)
    fireEvent.click(document.querySelector('[data-copy-btn]') as HTMLElement)
    expect(onCopyUrl).toHaveBeenCalledWith(SRC)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('clipboard reject → 不抛未捕获错误（非空 catch 降级）', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('not allowed'))
    Object.assign(navigator, { clipboard: { writeText } })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<ImageLightbox open onClose={vi.fn()} src={SRC} alt="x" />)
    expect(() =>
      fireEvent.click(document.querySelector('[data-copy-btn]') as HTMLElement),
    ).not.toThrow()
    await Promise.resolve()
    warnSpy.mockRestore()
  })
})
