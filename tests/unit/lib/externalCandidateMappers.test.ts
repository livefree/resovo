/**
 * tests/unit/lib/externalCandidateMappers.test.ts
 * META-04: mapDoubanDumpEntryToCandidate / mapDoubanAdapterDetailsToCandidate 单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  mapDoubanDumpEntryToCandidate,
  mapDoubanAdapterDetailsToCandidate,
} from '@/api/lib/externalCandidateMappers'
import type { DoubanEntryMatch } from '@/api/db/queries/externalData'
import type { DoubanSubjectDetails } from '@/api/lib/doubanAdapter'

// ── fixtures ─────────────────────────────────────────────────────

const DUMP_ENTRY: DoubanEntryMatch = {
  doubanId: '26670818',
  title: '肖申克的救赎',
  year: 1994,
  rating: 9.7,
  description: '一部关于希望的电影',
  coverUrl: 'https://img.douban.com/cover.jpg',
  directors: ['弗兰克·德拉邦特'],
  cast: ['蒂姆·罗宾斯', '摩根·弗里曼'],
  writers: ['弗兰克·德拉邦特'],
  genres: ['剧情', '犯罪'],
  country: '美国',
  aliases: ['The Shawshank Redemption', '月黑高飞'],
  imdbId: 'tt0111161',
  languages: ['英语'],
  durationMinutes: 142,
  tags: ['经典', '励志'],
  doubanVotes: 2800000,
  regions: ['美国'],
  releaseDate: '1994-09-10',
  actorIds: ['11111', '22222'],
  directorIds: ['33333'],
  officialSite: null,
}

const ADAPTER_DETAILS: DoubanSubjectDetails = {
  id: '26670818',
  title: '肖申克的救赎',
  poster: 'https://img.douban.com/poster.jpg',
  rate: '9.7',
  year: '1994',
  directors: ['弗兰克·德拉邦特'],
  screenwriters: ['弗兰克·德拉邦特'],
  cast: ['蒂姆·罗宾斯'],
  genres: ['剧情', '犯罪'],
  countries: ['美国'],
  languages: ['英语'],
  episodes: undefined,
  episodeLength: undefined,
  movieDuration: 142,
  firstAired: '1994-09-10',
  plotSummary: '一部关于希望的电影',
  celebrities: [],
  recommendations: [{ id: '1292052', title: '教父', poster: 'https://img.douban.com/p.jpg', rate: '9.3' }],
  actors: [
    { id: '11111', name: '蒂姆·罗宾斯', avatar: '', role: '主演' },
    { id: '22222', name: '摩根·弗里曼', avatar: '', role: '主演' },
  ],
  backdrop: 'https://img.douban.com/backdrop.jpg',
  trailerUrl: 'https://v.douban.com/trailer.mp4',
}

// ── mapDoubanDumpEntryToCandidate ─────────────────────────────────

describe('mapDoubanDumpEntryToCandidate', () => {
  it('基础字段正确映射', () => {
    const c = mapDoubanDumpEntryToCandidate(DUMP_ENTRY)
    expect(c.provider).toBe('douban')
    expect(c.externalId).toBe('26670818')
    expect(c.title).toBe('肖申克的救赎')
    expect(c.year).toBe(1994)
    expect(c.rating).toBe(9.7)
    expect(c.ratingVotes).toBe(2800000)
    expect(c.imdbId).toBe('tt0111161')
    expect(c.durationMinutes).toBe(142)
    expect(c.releaseDate).toBe('1994-09-10')
    expect(c.sourceFreshness).toBe('offline')
  })

  it('aliases / tags / languages / countries 正确映射', () => {
    const c = mapDoubanDumpEntryToCandidate(DUMP_ENTRY)
    expect(c.aliases).toEqual(['The Shawshank Redemption', '月黑高飞'])
    expect(c.tags).toEqual(['经典', '励志'])
    expect(c.languages).toEqual(['英语'])
    expect(c.countries).toEqual(['美国'])
  })

  it('directors 保留 id + role', () => {
    const c = mapDoubanDumpEntryToCandidate(DUMP_ENTRY)
    expect(c.directors).toHaveLength(1)
    expect(c.directors![0]).toMatchObject({ id: '33333', name: '弗兰克·德拉邦特', role: '导演' })
  })

  it('cast 从 actorIds 提取 id', () => {
    const c = mapDoubanDumpEntryToCandidate(DUMP_ENTRY)
    expect(c.cast).toHaveLength(2)
    expect(c.cast![0]).toMatchObject({ id: '11111', name: '蒂姆·罗宾斯' })
    expect(c.cast![1]).toMatchObject({ id: '22222', name: '摩根·弗里曼' })
  })

  it('confidence 默认 0，可通过 opts 覆盖', () => {
    expect(mapDoubanDumpEntryToCandidate(DUMP_ENTRY).confidence).toBe(0)
    const c = mapDoubanDumpEntryToCandidate(DUMP_ENTRY, {
      confidence: 0.92,
      confidenceBreakdown: { title: 0.5, year: 0.3, imdb: 0.12 },
    })
    expect(c.confidence).toBe(0.92)
    expect(c.confidenceBreakdown).toEqual({ title: 0.5, year: 0.3, imdb: 0.12 })
  })

  it('空数组字段映射为 undefined（不携带空列表）', () => {
    const entry: DoubanEntryMatch = {
      ...DUMP_ENTRY,
      aliases: [],
      tags: [],
      languages: [],
      actorIds: [],
      directorIds: [],
    }
    const c = mapDoubanDumpEntryToCandidate(entry)
    expect(c.aliases).toBeUndefined()
    expect(c.tags).toBeUndefined()
    expect(c.languages).toBeUndefined()
  })

  it('null 字段映射为 undefined', () => {
    const entry: DoubanEntryMatch = { ...DUMP_ENTRY, rating: null, coverUrl: null, imdbId: null }
    const c = mapDoubanDumpEntryToCandidate(entry)
    expect(c.rating).toBeUndefined()
    expect(c.coverUrl).toBeUndefined()
    expect(c.imdbId).toBeUndefined()
  })
})

// ── mapDoubanAdapterDetailsToCandidate ───────────────────────────

describe('mapDoubanAdapterDetailsToCandidate', () => {
  it('基础字段正确映射', () => {
    const c = mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS)
    expect(c.provider).toBe('douban')
    expect(c.externalId).toBe('26670818')
    expect(c.title).toBe('肖申克的救赎')
    expect(c.year).toBe(1994)
    expect(c.rating).toBe(9.7)
    expect(c.durationMinutes).toBe(142)
    expect(c.sourceFreshness).toBe('online')
  })

  it('backdrop / trailerUrl 正确映射', () => {
    const c = mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS)
    expect(c.backdropUrl).toBe('https://img.douban.com/backdrop.jpg')
    expect(c.trailerUrl).toBe('https://v.douban.com/trailer.mp4')
  })

  it('actors（含 id）优先于 cast 数组', () => {
    const c = mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS)
    expect(c.cast).toHaveLength(2)
    expect(c.cast![0]).toMatchObject({ id: '11111', name: '蒂姆·罗宾斯' })
  })

  it('actors 为空时 fallback 到 cast 数组', () => {
    const details: DoubanSubjectDetails = { ...ADAPTER_DETAILS, actors: [] }
    const c = mapDoubanAdapterDetailsToCandidate(details)
    expect(c.cast).toHaveLength(1)
    expect(c.cast![0].name).toBe('蒂姆·罗宾斯')
    expect(c.cast![0].id).toBeUndefined()
  })

  it('recommendations 正确映射', () => {
    const c = mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS)
    expect(c.recommendations).toHaveLength(1)
    expect(c.recommendations![0]).toMatchObject({
      externalId: '1292052',
      title: '教父',
      rating: 9.3,
    })
  })

  it('year 字符串转 number', () => {
    const c = mapDoubanAdapterDetailsToCandidate({ ...ADAPTER_DETAILS, year: '2001' })
    expect(c.year).toBe(2001)
  })

  it('rate 字符串转 number', () => {
    const c = mapDoubanAdapterDetailsToCandidate({ ...ADAPTER_DETAILS, rate: '8.5' })
    expect(c.rating).toBe(8.5)
  })

  it('无效 rate（空字符串）映射为 undefined', () => {
    const c = mapDoubanAdapterDetailsToCandidate({ ...ADAPTER_DETAILS, rate: '' })
    expect(c.rating).toBeUndefined()
  })

  it('confidence 默认 0，可通过 opts 覆盖', () => {
    expect(mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS).confidence).toBe(0)
    const c = mapDoubanAdapterDetailsToCandidate(ADAPTER_DETAILS, { confidence: 0.88 })
    expect(c.confidence).toBe(0.88)
  })
})
