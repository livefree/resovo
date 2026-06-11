import { describe, it, expect } from 'vitest'
import { extractHostname } from '@resovo/media-probe'

/**
 * SRCHEALTH-P3-3-A：source_hostname 语义真源边界集（arch-reviewer 裁决 G-1）。
 * 断言固化 Node `new URL().hostname` 的确切行为——回填脚本与写路径共用本函数，
 * 任何语义漂移（如换 SQL regex 实现）必须先让这里 RED。
 */
describe('extractHostname', () => {
  it('extracts hostname from plain http/https URLs', () => {
    expect(extractHostname('http://cdn.example.com/v/1.m3u8')).toBe('cdn.example.com')
    expect(extractHostname('https://h.example.org/path?q=1')).toBe('h.example.org')
  })

  it('strips port', () => {
    expect(extractHostname('https://h.com:8080/x')).toBe('h.com')
  })

  it('strips userinfo', () => {
    expect(extractHostname('https://user:pass@h.com/')).toBe('h.com')
  })

  it('keeps IPv6 brackets (semantics fixed for backfill/JOIN consistency)', () => {
    expect(extractHostname('http://[::1]:80/x')).toBe('[::1]')
  })

  it('converts IDN to punycode (proves SQL regex backfill is not equivalent)', () => {
    expect(extractHostname('https://例子.com/v.m3u8')).toBe('xn--fsqu00a.com')
  })

  it('lowercases hostname', () => {
    expect(extractHostname('HTTPS://Example.COM/X')).toBe('example.com')
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(extractHostname('  https://h.com/x  ')).toBe('h.com')
  })

  it('returns null for relative paths and garbage', () => {
    expect(extractHostname('/path/only.m3u8')).toBe(null)
    expect(extractHostname('not a url')).toBe(null)
    expect(extractHostname('')).toBe(null)
    expect(extractHostname('   ')).toBe(null)
  })

  it('returns null for hostname-less schemes (magnet)', () => {
    // magnet: 可解析为 URL 但 hostname 为空串 → null（无有效 hostname 不参与降权）
    expect(extractHostname('magnet:?xt=urn:btih:abc')).toBe(null)
  })

  it('does not throw on very long URLs', () => {
    const long = `https://h.com/${'a'.repeat(100_000)}`
    expect(extractHostname(long)).toBe('h.com')
  })
})
