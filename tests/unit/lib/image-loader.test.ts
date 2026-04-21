import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  passthroughLoader,
  cloudflareLoader,
  getLoader,
} from '../../../apps/web-next/src/lib/image/image-loader'

// ── passthroughLoader ────────────────────────────────────────────

describe('passthroughLoader', () => {
  it('原样返回 src', () => {
    expect(passthroughLoader('https://example.com/img.jpg', {})).toBe('https://example.com/img.jpg')
  })

  it('忽略 width / quality / format 参数', () => {
    const url = 'https://cdn.example.com/photo.png'
    expect(passthroughLoader(url, { width: 800, quality: 75, format: 'webp' })).toBe(url)
  })

  it('空字符串 src → 返回空字符串', () => {
    expect(passthroughLoader('', {})).toBe('')
  })
})

// ── cloudflareLoader ──────────────────────────────────────────────

describe('cloudflareLoader', () => {
  beforeEach(() => {
    vi.stubEnv('IMAGE_LOADER_CF_ACCOUNT_HASH', 'test-account-hash')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('拼接 width + 默认 quality + 默认 format', () => {
    const result = cloudflareLoader('https://origin.com/img.jpg', { width: 800 })
    expect(result).toBe('https://imagedelivery.net/test-account-hash/https://origin.com/img.jpg/w=800,q=80,f=auto')
  })

  it('不传 width 时省略 w= 参数', () => {
    const result = cloudflareLoader('https://origin.com/img.jpg', {})
    expect(result).toBe('https://imagedelivery.net/test-account-hash/https://origin.com/img.jpg/q=80,f=auto')
  })

  it('使用自定义 quality 和 format', () => {
    const result = cloudflareLoader('https://origin.com/img.jpg', { width: 400, quality: 90, format: 'webp' })
    expect(result).toBe('https://imagedelivery.net/test-account-hash/https://origin.com/img.jpg/w=400,q=90,f=webp')
  })

  it('空字符串 src → 返回空字符串', () => {
    expect(cloudflareLoader('', { width: 800 })).toBe('')
  })
})

// ── getLoader ─────────────────────────────────────────────────────

describe('getLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("getLoader('passthrough') 返回 passthroughLoader", () => {
    expect(getLoader('passthrough')).toBe(passthroughLoader)
  })

  it("getLoader('cloudflare') 返回 cloudflareLoader", () => {
    expect(getLoader('cloudflare')).toBe(cloudflareLoader)
  })

  it('无参数时读 IMAGE_LOADER env，值为 cloudflare → 返回 cloudflareLoader', () => {
    vi.stubEnv('IMAGE_LOADER', 'cloudflare')
    expect(getLoader()).toBe(cloudflareLoader)
  })

  it('无参数时读 IMAGE_LOADER env，值为 passthrough → 返回 passthroughLoader', () => {
    vi.stubEnv('IMAGE_LOADER', 'passthrough')
    expect(getLoader()).toBe(passthroughLoader)
  })

  it('IMAGE_LOADER 未设置时默认返回 passthroughLoader', () => {
    vi.stubEnv('IMAGE_LOADER', '')
    // '' 不等于 'cloudflare'，应降级为 passthrough
    expect(getLoader()).toBe(passthroughLoader)
  })

  it('NEXT_PUBLIC_IMAGE_LOADER 作为后备 env', () => {
    vi.stubEnv('IMAGE_LOADER', '')
    vi.stubEnv('NEXT_PUBLIC_IMAGE_LOADER', 'cloudflare')
    expect(getLoader()).toBe(cloudflareLoader)
  })

  it('显式参数优先于 env', () => {
    vi.stubEnv('IMAGE_LOADER', 'cloudflare')
    expect(getLoader('passthrough')).toBe(passthroughLoader)
  })
})
