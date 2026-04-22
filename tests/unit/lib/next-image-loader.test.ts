/**
 * tests/unit/lib/next-image-loader.test.ts — CDN-01
 *
 * 验证 next/image custom loader（apps/web-next/src/lib/image/next-image-loader.ts）：
 * - passthrough 默认：src 原样返回
 * - cloudflare 模式：src 包装成 Cloudflare Images URL
 * - env 读取：IMAGE_LOADER / IMAGE_LOADER_CF_ACCOUNT_HASH
 *
 * 与 apps/web-next/src/lib/image/image-loader.ts 的 getLoader() 共享选型逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import nextImageLoader from '../../../apps/web-next/src/lib/image/next-image-loader'

describe('nextImageLoader — CDN-01', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // 清理可能污染的 env
    delete process.env['IMAGE_LOADER']
    delete process.env['NEXT_PUBLIC_IMAGE_LOADER']
    delete process.env['IMAGE_LOADER_CF_ACCOUNT_HASH']
    delete process.env['NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('默认模式（passthrough）', () => {
    it('无 env 时走 passthrough，src 原样返回', () => {
      const result = nextImageLoader({ src: 'https://example.com/foo.jpg', width: 800 })
      expect(result).toBe('https://example.com/foo.jpg')
    })

    it('width 与 quality 在 passthrough 下不影响 URL', () => {
      const result = nextImageLoader({ src: 'https://example.com/a.png', width: 1920, quality: 50 })
      expect(result).toBe('https://example.com/a.png')
    })

    it('显式 IMAGE_LOADER=passthrough 等同默认', () => {
      process.env['IMAGE_LOADER'] = 'passthrough'
      const result = nextImageLoader({ src: 'https://example.com/x.webp', width: 640 })
      expect(result).toBe('https://example.com/x.webp')
    })

    it('空 src 返回空字符串', () => {
      const result = nextImageLoader({ src: '', width: 100 })
      expect(result).toBe('')
    })
  })

  describe('Cloudflare 模式', () => {
    beforeEach(() => {
      process.env['IMAGE_LOADER'] = 'cloudflare'
      process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'test-account-hash'
    })

    it('src 包装成 imagedelivery.net URL，含 width/quality/format 参数', () => {
      const result = nextImageLoader({ src: 'https://origin.example/foo.jpg', width: 800, quality: 75 })
      expect(result).toContain('https://imagedelivery.net/test-account-hash/')
      expect(result).toContain('w=800')
      expect(result).toContain('q=75')
      expect(result).toContain('f=auto')
    })

    it('不传 quality 时使用默认（cloudflareLoader 内建 80）', () => {
      const result = nextImageLoader({ src: 'https://origin.example/a.png', width: 1024 })
      expect(result).toContain('w=1024')
      expect(result).toContain('q=80')
    })

    it('account hash 为空时仍构造 URL（但前缀不含 hash 段）', () => {
      delete process.env['IMAGE_LOADER_CF_ACCOUNT_HASH']
      const result = nextImageLoader({ src: 'https://origin.example/a.png', width: 400 })
      // cloudflareLoader 拼接 `/${hash}/`，空 hash 会产生 `//`；仅断言开头匹配 domain
      expect(result).toMatch(/^https:\/\/imagedelivery\.net\//)
    })
  })

  describe('NEXT_PUBLIC_ fallback', () => {
    it('server env 未设时读 NEXT_PUBLIC_IMAGE_LOADER', () => {
      process.env['NEXT_PUBLIC_IMAGE_LOADER'] = 'cloudflare'
      process.env['NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'pub-hash'
      const result = nextImageLoader({ src: 'https://o.example/a.jpg', width: 320 })
      expect(result).toContain('https://imagedelivery.net/pub-hash/')
    })
  })
})
