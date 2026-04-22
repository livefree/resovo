/**
 * tests/unit/components/media/image-loader.test.ts
 * IMG-03.5: image-loader 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  passthroughLoader,
  buildImageUrl,
  cloudflareLoader,
  getLoader,
} from '../../../../apps/web-next/src/lib/image/image-loader'

describe('passthroughLoader', () => {
  it('返回原始 src', () => {
    expect(passthroughLoader('https://cdn.example.com/img.jpg', {})).toBe('https://cdn.example.com/img.jpg')
  })

  it('空 src → 返回空字符串', () => {
    expect(passthroughLoader('', {})).toBe('')
  })
})

describe('buildImageUrl（deprecated alias）', () => {
  it('与 passthroughLoader 行为一致', () => {
    const src = 'https://cdn.example.com/test.jpg'
    expect(buildImageUrl(src, {})).toBe(passthroughLoader(src, {}))
  })
})

describe('cloudflareLoader', () => {
  it('空 src → 返回空字符串', () => {
    expect(cloudflareLoader('', {})).toBe('')
  })

  it('生成正确的 Cloudflare Images URL（含 width）', () => {
    process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'acc123'
    const url = cloudflareLoader('image-id-xyz', { width: 800, quality: 75, format: 'webp' })
    expect(url).toBe('https://imagedelivery.net/acc123/image-id-xyz/w=800,q=75,f=webp')
  })

  it('不传 width → URL 中无 w= 参数', () => {
    process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'acc123'
    const url = cloudflareLoader('img-id', { format: 'auto' })
    expect(url).not.toContain('w=')
    expect(url).toContain('f=auto')
  })

  it('不传 quality → 默认 q=80', () => {
    process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'acc123'
    const url = cloudflareLoader('img-id', {})
    expect(url).toContain('q=80')
  })
})

describe('getLoader', () => {
  const originalImageLoader = process.env['IMAGE_LOADER']

  beforeEach(() => {
    delete process.env['IMAGE_LOADER']
    delete process.env['NEXT_PUBLIC_IMAGE_LOADER']
  })

  afterEach(() => {
    if (originalImageLoader !== undefined) {
      process.env['IMAGE_LOADER'] = originalImageLoader
    } else {
      delete process.env['IMAGE_LOADER']
    }
  })

  it('默认（无 env）→ passthrough loader', () => {
    const loader = getLoader()
    expect(loader('https://example.com/img.jpg', {})).toBe('https://example.com/img.jpg')
  })

  it('IMAGE_LOADER=cloudflare → cloudflare loader', () => {
    process.env['IMAGE_LOADER'] = 'cloudflare'
    process.env['IMAGE_LOADER_CF_ACCOUNT_HASH'] = 'cfhash'
    const loader = getLoader()
    const url = loader('some-id', { width: 400 })
    expect(url).toContain('imagedelivery.net/cfhash/some-id')
  })

  it('NEXT_PUBLIC_IMAGE_LOADER=passthrough → passthrough loader', () => {
    process.env['NEXT_PUBLIC_IMAGE_LOADER'] = 'passthrough'
    const loader = getLoader()
    expect(loader('https://cdn.com/x.jpg', {})).toBe('https://cdn.com/x.jpg')
  })
})
