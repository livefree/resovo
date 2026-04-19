import { describe, it, expect } from 'vitest'
import { matchRewrite, stripLocale } from '@/lib/rewrite-match'

describe('stripLocale', () => {
  it('strips /en prefix', () => {
    expect(stripLocale('/en/watch/abc')).toEqual({ locale: 'en', rest: '/watch/abc' })
  })
  it('strips /zh-CN prefix', () => {
    expect(stripLocale('/zh-CN/search')).toEqual({ locale: 'zh-CN', rest: '/search' })
  })
  it('handles /en exactly', () => {
    expect(stripLocale('/en')).toEqual({ locale: 'en', rest: '/' })
  })
  it('leaves non-locale paths unchanged', () => {
    expect(stripLocale('/watch/abc')).toEqual({ locale: null, rest: '/watch/abc' })
  })
  it('does not strip partial match (e.g. /english)', () => {
    expect(stripLocale('/english/page')).toEqual({ locale: null, rest: '/english/page' })
  })
})

describe('matchRewrite — next-placeholder scaffold rule', () => {
  it('matches /next-placeholder exactly', () => {
    const r = matchRewrite('/next-placeholder')
    expect(r.matched).toBe(true)
    if (r.matched) expect(r.rule.domain).toBe('scaffold')
  })
  it('matches /next-placeholder/sub', () => {
    const r = matchRewrite('/next-placeholder/sub')
    expect(r.matched).toBe(true)
  })
  it('matches /en/next-placeholder', () => {
    const r = matchRewrite('/en/next-placeholder')
    expect(r.matched).toBe(true)
  })
  it('matches /zh-CN/next-placeholder', () => {
    const r = matchRewrite('/zh-CN/next-placeholder')
    expect(r.matched).toBe(true)
  })
  it('does not match /next-placeholder-extra (prefix boundary)', () => {
    const r = matchRewrite('/next-placeholder-extra')
    expect(r.matched).toBe(false)
  })
  it('does not match unrelated path', () => {
    const r = matchRewrite('/en/browse')
    expect(r.matched).toBe(false)
  })
  it('does not match /', () => {
    const r = matchRewrite('/')
    expect(r.matched).toBe(false)
  })
})
