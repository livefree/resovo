/**
 * tests/unit/components/media/SafeImage.test.tsx
 * IMG-03.5: SafeImage 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks（必须在 import 之前）────────────────────────────────────

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
}))

// 使用相对路径保证 mock 与组件实际 import 的模块 id 一致
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

import { SafeImage } from '../../../../apps/web-next/src/components/media/SafeImage'

describe('SafeImage — 空 src 降级', () => {
  it('src=undefined → 不触发 onLoadFail，渲染 FallbackCover', () => {
    const onLoadFail = vi.fn()
    render(<SafeImage src={undefined} alt="test" width={100} height={100} onLoadFail={onLoadFail} />)
    expect(onLoadFail).not.toHaveBeenCalled()
    expect(screen.queryByTestId('lazy-image')).toBeNull()
  })

  it('src=null + fallback 结构化对象 → 渲染 FallbackCover，不触发回调', () => {
    const onLoadFail = vi.fn()
    render(
      <SafeImage
        src={null}
        alt="test"
        width={100}
        height={100}
        fallback={{ title: '测试标题', type: 'movie', seed: 'vid-abc' }}
        onLoadFail={onLoadFail}
      />
    )
    expect(onLoadFail).not.toHaveBeenCalled()
    expect(screen.queryByTestId('lazy-image')).toBeNull()
  })

  it('src="" → 渲染 FallbackCover，不触发回调', () => {
    const onLoadFail = vi.fn()
    render(<SafeImage src="" alt="test" width={100} height={100} onLoadFail={onLoadFail} />)
    expect(onLoadFail).not.toHaveBeenCalled()
    expect(screen.queryByTestId('lazy-image')).toBeNull()
  })
})

describe('SafeImage — 正常渲染', () => {
  it('有效 src → 渲染 LazyImage', () => {
    render(<SafeImage src="https://cdn.example.com/img.jpg" alt="poster" width={100} height={150} />)
    const img = screen.getByTestId('lazy-image')
    expect(img).toBeDefined()
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/img.jpg')
  })
})

describe('SafeImage — 网络错误降级', () => {
  beforeEach(() => vi.clearAllMocks())

  it('onError 触发 → 调用 onLoadFail({ reason: "network" })', () => {
    const onLoadFail = vi.fn()
    render(
      <SafeImage
        src="https://cdn.example.com/broken.jpg"
        alt="broken"
        width={100}
        height={100}
        onLoadFail={onLoadFail}
      />
    )
    const img = screen.getByTestId('lazy-image')
    fireEvent.error(img)
    expect(onLoadFail).toHaveBeenCalledOnce()
    expect(onLoadFail).toHaveBeenCalledWith({
      src: 'https://cdn.example.com/broken.jpg',
      reason: 'network',
    })
  })

  it('onError 触发 → 同时调用 deprecated onLoadError', () => {
    const onLoadError = vi.fn()
    render(
      <SafeImage
        src="https://cdn.example.com/img.jpg"
        alt="img"
        width={100}
        height={100}
        onLoadError={onLoadError}
      />
    )
    fireEvent.error(screen.getByTestId('lazy-image'))
    expect(onLoadError).toHaveBeenCalledWith({ src: 'https://cdn.example.com/img.jpg', reason: 'network' })
  })

  it('onError 触发后 → 切换为 FallbackCover', () => {
    render(
      <SafeImage src="https://cdn.example.com/img.jpg" alt="img" width={100} height={100} />
    )
    fireEvent.error(screen.getByTestId('lazy-image'))
    expect(screen.queryByTestId('lazy-image')).toBeNull()
  })
})

describe('SafeImage — aspect prop', () => {
  it('aspect 传给 FallbackCover（空 src 时）', () => {
    const { container } = render(
      <SafeImage src={undefined} alt="x" width={100} height={150} aspect="2:3" />
    )
    const fallback = container.querySelector('[role="img"]') as HTMLElement
    expect(fallback?.style.aspectRatio).toBe('2 / 3')
  })
})
