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
})

describe('matchRewrite — M2 homepage rule', () => {
  it('matches / (exact)', () => {
    const r = matchRewrite('/')
    expect(r.matched).toBe(true)
    if (r.matched) expect(r.rule.domain).toBe('home')
  })
  it('matches /en (locale-aware exact)', () => {
    const r = matchRewrite('/en')
    expect(r.matched).toBe(true)
    if (r.matched) expect(r.rule.domain).toBe('home')
  })
  it('matches /zh-CN (locale-aware exact)', () => {
    const r = matchRewrite('/zh-CN')
    expect(r.matched).toBe(true)
    if (r.matched) expect(r.rule.domain).toBe('home')
  })
  it('does not match /en/browse (only / is exact)', () => {
    const r = matchRewrite('/en/browse')
    expect(r.matched).toBe(false)
  })
})

describe('matchRewrite — M3 detail page prefix rules', () => {
  const detailPaths = ['/movie', '/series', '/anime', '/tvshow', '/others'] as const

  for (const path of detailPaths) {
    it(`matches ${path}/some-slug (prefix)`, () => {
      const r = matchRewrite(`${path}/some-slug-abc123`)
      expect(r.matched).toBe(true)
      if (r.matched) expect(r.rule.domain).toBe('player')
    })

    it(`matches /en${path}/some-slug (locale-aware prefix)`, () => {
      const r = matchRewrite(`/en${path}/some-slug-abc123`)
      expect(r.matched).toBe(true)
    })

    it(`matches /zh-CN${path}/some-slug (locale-aware prefix)`, () => {
      const r = matchRewrite(`/zh-CN${path}/some-slug-abc123`)
      expect(r.matched).toBe(true)
    })
  }

  it('does not match /movies (no partial prefix match)', () => {
    const r = matchRewrite('/movies/test')
    expect(r.matched).toBe(false)
  })
})

describe('matchRewrite — M3 /watch prefix rule', () => {
  it('matches /watch/some-slug', () => {
    const r = matchRewrite('/watch/test-movie-aB3kR9x1')
    expect(r.matched).toBe(true)
  })

  it('matches /en/watch/some-slug (locale-aware)', () => {
    const r = matchRewrite('/en/watch/test-movie-aB3kR9x1')
    expect(r.matched).toBe(true)
  })

  it('matches /zh-CN/watch/some-slug (locale-aware)', () => {
    const r = matchRewrite('/zh-CN/watch/test-anime-bC4lS0y2')
    expect(r.matched).toBe(true)
  })

  it('does not match /watchlist (no partial prefix match)', () => {
    const r = matchRewrite('/watchlist')
    expect(r.matched).toBe(false)
  })
})

describe('matchRewrite — M5 /search prefix rule (CHORE-06)', () => {
  it('matches /search exactly', () => {
    const r = matchRewrite('/search')
    expect(r.matched).toBe(true)
    if (r.matched) {
      expect(r.rule.domain).toBe('search')
      expect(r.rule.milestone).toBe('M5')
    }
  })

  it('matches /search/sub path (prefix)', () => {
    const r = matchRewrite('/search/advanced')
    expect(r.matched).toBe(true)
  })

  it('matches /en/search (locale-aware)', () => {
    const r = matchRewrite('/en/search')
    expect(r.matched).toBe(true)
    if (r.matched) expect(r.rule.domain).toBe('search')
  })

  it('matches /zh-CN/search (locale-aware)', () => {
    const r = matchRewrite('/zh-CN/search')
    expect(r.matched).toBe(true)
  })

  it('matches /en/search/deep/path (locale-aware prefix)', () => {
    const r = matchRewrite('/en/search/advanced')
    expect(r.matched).toBe(true)
  })

  it('does not match /searches (prefix boundary, no partial)', () => {
    const r = matchRewrite('/searches')
    expect(r.matched).toBe(false)
  })

  it('does not match /search-results (prefix boundary)', () => {
    const r = matchRewrite('/search-results')
    expect(r.matched).toBe(false)
  })
})
