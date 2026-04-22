/**
 * tests/unit/components/media/SafeImageNext.test.tsx — CDN-02
 *
 * 验证 SafeImage mode='next' 分支：
 * - 默认路径（不传 mode）仍渲染 LazyImage（零回归）
 * - mode='next' + 有 src → 渲染 next/image（mocked 为 <img data-testid="next-image">）
 * - mode='next' + 空 src → 渲染 FallbackCover
 * - mode='next' + error → 切 FallbackCover + 触发 onLoadFail
 * - imageLoader prop 在 mode='next' 下不生效（不影响 src 变换；global loader 由 next.config 管）
 * - data-testid 透传
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks（必须在 import SafeImage 之前）──────────────────────────

vi.mock('../../../../apps/web-next/src/lib/image/image-loader', () => ({
  getLoader: () => (src: string) => src,
  passthroughLoader: (src: string) => src,
  buildImageUrl: (src: string) => src,
}))

vi.mock('../../../../apps/web-next/src/components/primitives/lazy-image', () => ({
  LazyImage: ({
    src,
    alt,
    onError,
  }: {
    src: string
    alt: string
    onError?: () => void
  }) => (
    <img src={src} alt={alt} data-testid="lazy-image" onError={onError} />
  ),
}))

// Mock next/image — fill mode 下 next/image 最终渲染为 <img>
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    priority,
    placeholder,
    blurDataURL,
    sizes,
  }: {
    src: string
    alt: string
    onError?: () => void
    priority?: boolean
    placeholder?: string
    blurDataURL?: string
    sizes?: string
  }) => (
    <img
      src={src}
      alt={alt}
      data-testid="next-image"
      data-priority={priority ? 'true' : 'false'}
      data-placeholder={placeholder ?? ''}
      data-blur-data-url={blurDataURL ?? ''}
      data-sizes={sizes ?? ''}
      onError={onError}
    />
  ),
}))

import { SafeImage } from '../../../../apps/web-next/src/components/media/SafeImage'

describe('SafeImage — mode dispatch (CDN-02)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('默认不传 mode → 走 LazyImage（零回归）', () => {
    render(<SafeImage src="https://cdn.example/a.jpg" alt="a" width={100} height={150} />)
    expect(screen.getByTestId('lazy-image')).toBeDefined()
    expect(screen.queryByTestId('next-image')).toBeNull()
  })

  it('mode="lazy" 显式传入 → 走 LazyImage', () => {
    render(<SafeImage mode="lazy" src="https://cdn.example/b.jpg" alt="b" width={100} height={150} />)
    expect(screen.getByTestId('lazy-image')).toBeDefined()
    expect(screen.queryByTestId('next-image')).toBeNull()
  })

  it('mode="next" + 有 src → 走 next/image', () => {
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/c.jpg"
        alt="c"
        width={320}
        height={180}
        aspect="16:9"
      />,
    )
    const nextImg = screen.getByTestId('next-image')
    expect(nextImg).toBeDefined()
    expect(nextImg.getAttribute('src')).toBe('https://cdn.example/c.jpg')
    expect(nextImg.getAttribute('alt')).toBe('c')
  })
})

describe('SafeImageNext — 空 src 降级', () => {
  it('mode="next" + src=undefined → 渲染 FallbackCover，不触发 onLoadFail', () => {
    const onLoadFail = vi.fn()
    render(
      <SafeImage
        mode="next"
        src={undefined}
        alt="test"
        width={320}
        height={180}
        onLoadFail={onLoadFail}
      />,
    )
    expect(onLoadFail).not.toHaveBeenCalled()
    expect(screen.queryByTestId('next-image')).toBeNull()
  })

  it('mode="next" + src="" → 渲染 FallbackCover', () => {
    render(<SafeImage mode="next" src="" alt="x" width={320} height={180} />)
    expect(screen.queryByTestId('next-image')).toBeNull()
  })
})

describe('SafeImageNext — 错误降级', () => {
  it('onError 触发 → 切 FallbackCover + 调用 onLoadFail({ reason: "network" })', () => {
    const onLoadFail = vi.fn()
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/broken.jpg"
        alt="broken"
        width={320}
        height={180}
        onLoadFail={onLoadFail}
      />,
    )
    const img = screen.getByTestId('next-image')
    fireEvent.error(img)
    expect(onLoadFail).toHaveBeenCalledOnce()
    expect(onLoadFail).toHaveBeenCalledWith({
      src: 'https://cdn.example/broken.jpg',
      reason: 'network',
    })
    // 错误后 next-image 应被 FallbackCover 取代
    expect(screen.queryByTestId('next-image')).toBeNull()
  })

  it('onError 触发 → 同时调用 deprecated onLoadError', () => {
    const onLoadError = vi.fn()
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/e.jpg"
        alt="e"
        width={320}
        height={180}
        onLoadError={onLoadError}
      />,
    )
    fireEvent.error(screen.getByTestId('next-image'))
    expect(onLoadError).toHaveBeenCalledWith({
      src: 'https://cdn.example/e.jpg',
      reason: 'network',
    })
  })
})

describe('SafeImageNext — props 透传', () => {
  it('blurDataURL 触发 placeholder="blur"', () => {
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/f.jpg"
        alt="f"
        width={320}
        height={180}
        blurDataURL="data:image/png;base64,iVBORw0K"
      />,
    )
    const img = screen.getByTestId('next-image')
    expect(img.getAttribute('data-placeholder')).toBe('blur')
    expect(img.getAttribute('data-blur-data-url')).toBe('data:image/png;base64,iVBORw0K')
  })

  it('无 blurDataURL 时无 placeholder', () => {
    render(
      <SafeImage mode="next" src="https://cdn.example/g.jpg" alt="g" width={320} height={180} />,
    )
    const img = screen.getByTestId('next-image')
    expect(img.getAttribute('data-placeholder')).toBe('')
  })

  it('priority 透传', () => {
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/h.jpg"
        alt="h"
        width={320}
        height={180}
        priority
      />,
    )
    expect(screen.getByTestId('next-image').getAttribute('data-priority')).toBe('true')
  })

  it('sizes 默认 100vw，可被 override', () => {
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/i.jpg"
        alt="i"
        width={320}
        height={180}
        sizes="320px"
      />,
    )
    expect(screen.getByTestId('next-image').getAttribute('data-sizes')).toBe('320px')
  })

  it('data-testid 透传到外层 aspect wrapper', () => {
    render(
      <SafeImage
        mode="next"
        src="https://cdn.example/j.jpg"
        alt="j"
        width={320}
        height={180}
        aspect="16:9"
        data-testid="demo-wrapper"
      />,
    )
    expect(screen.getByTestId('demo-wrapper')).toBeDefined()
  })
})

describe('SafeImageNext — aspect 映射 aspectRatio CSS', () => {
  it('aspect="16:9" → 外层 wrapper 的 aspectRatio="16 / 9"', () => {
    const { container } = render(
      <SafeImage
        mode="next"
        src="https://cdn.example/k.jpg"
        alt="k"
        width={320}
        height={180}
        aspect="16:9"
        data-testid="wrap"
      />,
    )
    const wrap = container.querySelector('[data-testid="wrap"]') as HTMLElement
    expect(wrap.style.aspectRatio).toBe('16 / 9')
  })

  it('无 aspect 但有 width/height → aspectRatio 从 width/height 计算', () => {
    const { container } = render(
      <SafeImage
        mode="next"
        src="https://cdn.example/l.jpg"
        alt="l"
        width={640}
        height={360}
        data-testid="wrap2"
      />,
    )
    const wrap = container.querySelector('[data-testid="wrap2"]') as HTMLElement
    expect(wrap.style.aspectRatio).toBe('640 / 360')
  })
})
