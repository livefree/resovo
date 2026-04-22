/**
 * SafeImageNext.loader-integration.test.tsx — CDN-02 集成验证（对齐 P2.2 修复）
 *
 * 目标：证明"SafeImage mode='next' + IMAGE_LOADER=cloudflare → img.src 确实经过
 * next.config.ts custom loader 变换"的完整路径可达。
 *
 * 独立文件策略（避免 SafeImageNext.test.tsx 的 mock dispatch 冲突）：
 * 本文件顶层 vi.mock next/image 让 mock 真实调用 nextImageLoader default export
 * —— 模拟 Next.js 在渲染 <Image> 时自动调用 images.loaderFile 的行为。
 *
 * 这组 case 锁住 CDN-02 的核心目标："mode='next' 不是到 next/image 就完事，
 * 必须经过 custom loader"。passthrough case 覆盖默认 dev；cloudflare case
 * 覆盖未来 CF Images 接入（env 切换生效）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mocks 需在 import SafeImage 之前

vi.mock('../../../../apps/web-next/src/lib/image/image-loader', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../apps/web-next/src/lib/image/image-loader')
  >('../../../../apps/web-next/src/lib/image/image-loader')
  return actual // 使用真实实现，让 getLoader() 按 env 切换
})

vi.mock('../../../../apps/web-next/src/components/primitives/lazy-image', () => ({
  LazyImage: () => null, // 本文件不测 lazy 分支
}))

// 关键：让 mocked next/image 真实调用 nextImageLoader.default，
// 模拟 Next.js images.loaderFile 的实际行为
vi.mock('next/image', async () => {
  const loaderModule = await vi.importActual<
    typeof import('../../../../apps/web-next/src/lib/image/next-image-loader')
  >('../../../../apps/web-next/src/lib/image/next-image-loader')
  return {
    default: ({
      src,
      width,
      quality,
      alt,
    }: {
      src: string
      width?: number
      quality?: number
      alt: string
    }) => {
      const transformed = loaderModule.default({
        src,
        width: width ?? 640,
        quality,
      })
      return <img src={transformed} alt={alt} data-testid="loader-composed" />
    },
  }
})

import { SafeImage } from '../../../../apps/web-next/src/components/media/SafeImage'

describe('SafeImageNext — custom loader 端到端变换（CDN-01 + CDN-02 集成）', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.IMAGE_LOADER
    delete process.env.NEXT_PUBLIC_IMAGE_LOADER
    delete process.env.IMAGE_LOADER_CF_ACCOUNT_HASH
    delete process.env.NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('IMAGE_LOADER=cloudflare + hash → <Image> 渲染 src 变为 imagedelivery.net URL', () => {
    process.env.IMAGE_LOADER = 'cloudflare'
    process.env.IMAGE_LOADER_CF_ACCOUNT_HASH = 'acc-hash-cf'
    render(
      <SafeImage
        mode="next"
        src="https://origin.example/poster.jpg"
        alt="demo"
        width={800}
        height={450}
        aspect="16:9"
      />,
    )
    const img = screen.getByTestId('loader-composed') as HTMLImageElement
    // 浏览器 <img> 会把 src 做 URL resolve，判断 pathname / hostname 包含特征即可
    expect(img.src).toContain('imagedelivery.net/acc-hash-cf')
    expect(img.src).toContain('w=')
    expect(img.src).toContain('f=auto')
  })

  it('IMAGE_LOADER 未设 → src 保持原样（passthrough）', () => {
    render(
      <SafeImage
        mode="next"
        src="https://origin.example/passthrough.png"
        alt="demo"
        width={400}
        height={225}
        aspect="16:9"
      />,
    )
    const img = screen.getByTestId('loader-composed') as HTMLImageElement
    expect(img.src).toBe('https://origin.example/passthrough.png')
  })

  it('显式 IMAGE_LOADER=passthrough → src 原样', () => {
    process.env.IMAGE_LOADER = 'passthrough'
    render(
      <SafeImage
        mode="next"
        src="https://origin.example/explicit.webp"
        alt="demo"
        width={200}
        height={112}
        aspect="16:9"
      />,
    )
    const img = screen.getByTestId('loader-composed') as HTMLImageElement
    expect(img.src).toBe('https://origin.example/explicit.webp')
  })

  it('NEXT_PUBLIC_IMAGE_LOADER=cloudflare（client env）同样生效', () => {
    process.env.NEXT_PUBLIC_IMAGE_LOADER = 'cloudflare'
    process.env.NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH = 'pub-hash'
    render(
      <SafeImage
        mode="next"
        src="https://origin.example/pub.jpg"
        alt="demo"
        width={320}
        height={180}
        aspect="16:9"
      />,
    )
    const img = screen.getByTestId('loader-composed') as HTMLImageElement
    expect(img.src).toContain('imagedelivery.net/pub-hash')
  })
})
