/**
 * build-tmdb-href.test.ts — CHG-TMDB-HREF-KIND（闭合 D-172-AMD2-C）
 *
 * TMDB 的 movie 与 tv id 命名空间独立，同一数字 id 两边是不同作品。buildTmdbHref 据 kind
 * 选 /movie 或 /tv 路径段，修复剧集 tmdb 外链跳到无关电影的 bug。
 */

import { describe, it, expect } from 'vitest'
import { buildTmdbHref, SOURCE_HREF_BUILDERS } from '@resovo/admin-ui'

describe('buildTmdbHref — movie/tv 命名空间分流', () => {
  it('kind=movie → /movie/ 路径段', () => {
    expect(buildTmdbHref(323486, 'movie')).toBe('https://www.themoviedb.org/movie/323486')
  })

  it('kind=tv → /tv/ 路径段（剧集修复）', () => {
    expect(buildTmdbHref(323486, 'tv')).toBe('https://www.themoviedb.org/tv/323486')
  })

  it('同一 id 两 kind 落不同 URL（命名空间独立的实证）', () => {
    expect(buildTmdbHref(323486, 'movie')).not.toBe(buildTmdbHref(323486, 'tv'))
  })

  it('string id 亦可', () => {
    expect(buildTmdbHref('1429', 'tv')).toBe('https://www.themoviedb.org/tv/1429')
  })
})

describe('SOURCE_HREF_BUILDERS.tmdb — 遗留入口默认 movie（仅退役消费点）', () => {
  it('委托 buildTmdbHref(id, movie)', () => {
    expect(SOURCE_HREF_BUILDERS.tmdb(99)).toBe('https://www.themoviedb.org/movie/99')
  })
})
