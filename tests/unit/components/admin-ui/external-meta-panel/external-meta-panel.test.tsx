/**
 * ExternalMetaPanel 单测（ADR-172 AMENDMENT 3 / META-18）
 *
 * 三区：源并集总览（4 源 logo + ID + 匹配方式 + 置信度 + 主源）/ 真源字段区 / Bangumi 条目块（anime-only）。
 * density='drawer' 含未命中灰显占位；'compact' 仅命中。纯展示零回调。
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import type { EnrichmentSummary, ExternalRefSummary, BangumiEntrySummary, VideoType } from '@resovo/types'
import { ExternalMetaPanel } from '../../../../../packages/admin-ui/src/components/external-meta-panel/external-meta-panel'
import type { ExternalMetaCatalogFields } from '../../../../../packages/admin-ui/src/components/external-meta-panel/types'

afterEach(() => cleanup())

// ── 夹具 ──────────────────────────────────────────────────────────────

function makeSummary(over: Partial<EnrichmentSummary> = {}): EnrichmentSummary {
  return {
    doubanStatus: 'matched',
    bangumiStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 90,
    enrichedAt: '2026-05-30T00:00:00Z',
    titleEnIsPinyin: false,
    doubanConfidence: 0.9,
    bangumiSubjectId: 388781,
    doubanId: '1453238',
    tmdbId: 37854,
    imdbId: 'tt0388629',
    ...over,
  }
}

function makeRef(over: Partial<ExternalRefSummary> = {}): ExternalRefSummary {
  return {
    provider: 'bangumi',
    externalId: '388781',
    matchStatus: 'auto_matched',
    matchMethod: 'title_norm',
    confidence: 0.92,
    isPrimary: true,
    ...over,
  }
}

const BANGUMI_INFO: BangumiEntrySummary = {
  bangumiId: 388781,
  titleCn: '师兄啊师兄',
  titleJp: 'シーション・ア・シーション',
  year: 2023,
  rating: 7.8,
  summary: '一段修仙故事的概述文本。',
  airDate: '2023-01-15',
  coverUrl: 'https://example.com/c.jpg',
  rank: 1200,
  nsfw: false,
}

const row = (c: HTMLElement, source: string) =>
  c.querySelector(`[data-external-source-row][data-source="${source}"]`) as HTMLElement | null
const allRows = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-external-source-row]'))
const bangumiBlock = (c: HTMLElement) => c.querySelector('[data-external-bangumi-block]')
const catalogBox = (c: HTMLElement) => c.querySelector('[data-external-catalog-fields]')

// ── 源并集总览 ────────────────────────────────────────────────────────

describe('ExternalMetaPanel — 源并集总览', () => {
  it('drawer + anime 全命中：渲染 4 源行（douban/bangumi/tmdb/imdb）', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'anime' as VideoType} density="drawer" />,
    )
    expect(allRows(container)).toHaveLength(4)
    expect(row(container, 'douban')).not.toBeNull()
    expect(row(container, 'bangumi')).not.toBeNull()
    expect(row(container, 'tmdb')).not.toBeNull()
    expect(row(container, 'imdb')).not.toBeNull()
  })

  it('非 anime：不渲染 bangumi 源行', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} density="drawer" />,
    )
    expect(row(container, 'bangumi')).toBeNull()
    expect(row(container, 'douban')).not.toBeNull()
  })

  it('compact：仅渲染命中源（未命中过滤）', () => {
    const summary = makeSummary({
      doubanStatus: 'matched', bangumiStatus: 'pending',
      bangumiSubjectId: null, tmdbId: null, imdbId: null,
    })
    const { container } = render(
      <ExternalMetaPanel summary={summary} type={'anime' as VideoType} density="compact" />,
    )
    // douban 命中保留；bangumi/tmdb/imdb 未命中过滤
    expect(row(container, 'douban')).not.toBeNull()
    expect(row(container, 'bangumi')).toBeNull()
    expect(row(container, 'tmdb')).toBeNull()
    expect(allRows(container)).toHaveLength(1)
  })

  it('drawer：未命中源灰显占位（state=absent 仍渲染行）', () => {
    const summary = makeSummary({ tmdbId: null })
    const { container } = render(
      <ExternalMetaPanel summary={summary} type={'movie' as VideoType} density="drawer" />,
    )
    const tmdb = row(container, 'tmdb')
    expect(tmdb).not.toBeNull()
    expect(tmdb?.getAttribute('data-state')).toBe('absent')
  })

  it('compact + 全未命中：渲染空态文案', () => {
    const summary = makeSummary({
      doubanStatus: 'pending', bangumiStatus: 'pending',
      doubanId: null, bangumiSubjectId: null, tmdbId: null, imdbId: null,
    })
    const { container } = render(
      <ExternalMetaPanel summary={summary} type={'movie' as VideoType} density="compact" />,
    )
    expect(allRows(container)).toHaveLength(0)
    expect(container.textContent).toContain('暂无外部源匹配')
  })

  it('externalRefs：展示外部 ID + 匹配方式文案 + 置信度 % + 主源标记', () => {
    const refs: ExternalRefSummary[] = [
      makeRef({ provider: 'douban', externalId: '1453238', matchStatus: 'manual_confirmed', confidence: null, isPrimary: true }),
    ]
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} externalRefs={refs} density="drawer" />,
    )
    const douban = row(container, 'douban')!
    expect(douban.textContent).toContain('1453238')
    expect(douban.textContent).toContain('人工确认')
    expect(douban.textContent).toContain('主源')
  })

  it('externalRefs 带 confidence：渲染百分比', () => {
    const refs: ExternalRefSummary[] = [makeRef({ provider: 'bangumi', confidence: 0.92 })]
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'anime' as VideoType} externalRefs={refs} density="drawer" />,
    )
    expect(row(container, 'bangumi')!.textContent).toContain('92%')
  })

  it('externalRefs：渲染匹配方式（matchMethod）—— 已知映射文案', () => {
    const refs: ExternalRefSummary[] = [
      makeRef({ provider: 'douban', matchMethod: 'imdb_id', matchStatus: 'auto_matched' }),
    ]
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} externalRefs={refs} density="drawer" />,
    )
    expect(row(container, 'douban')!.textContent).toContain('IMDb ID')
  })

  it('externalRefs：未知 matchMethod 回退原始串（不丢信息）', () => {
    const refs: ExternalRefSummary[] = [
      makeRef({ provider: 'tmdb', matchMethod: 'some_future_method', matchStatus: 'auto_matched' }),
    ]
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} externalRefs={refs} density="drawer" />,
    )
    expect(row(container, 'tmdb')!.textContent).toContain('some_future_method')
  })

  it('无 ref 命中源：回退 summary id + 「已匹配」文案', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} density="drawer" />,
    )
    const douban = row(container, 'douban')!
    expect(douban.textContent).toContain('1453238') // 回退 summary.doubanId
    expect(douban.textContent).toContain('已匹配')
  })
})

// ── Bangumi 条目块 ────────────────────────────────────────────────────

describe('ExternalMetaPanel — Bangumi 条目块', () => {
  it('anime + bangumiInfo：渲染日文原名/放送日/排名/评分', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'anime' as VideoType} bangumiInfo={BANGUMI_INFO} density="drawer" />,
    )
    const block = bangumiBlock(container)
    expect(block).not.toBeNull()
    expect(block!.textContent).toContain(BANGUMI_INFO.titleJp!)
    expect(block!.textContent).toContain('2023-01-15')
    expect(block!.textContent).toContain('#1200')
    expect(block!.textContent).toContain('7.8')
  })

  it('非 anime：即便传 bangumiInfo 也不渲染条目块', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} bangumiInfo={BANGUMI_INFO} density="drawer" />,
    )
    expect(bangumiBlock(container)).toBeNull()
  })

  it('anime + 无 bangumiInfo：不渲染条目块', () => {
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'anime' as VideoType} density="drawer" />,
    )
    expect(bangumiBlock(container)).toBeNull()
  })
})

// ── 真源字段区 ────────────────────────────────────────────────────────

describe('ExternalMetaPanel — 真源字段区', () => {
  it('catalogFields：渲染原名 + 评分(含人数) + 来源标注', () => {
    const cf: ExternalMetaCatalogFields = {
      titleOriginal: 'One Piece', rating: 9.5, ratingVotes: 12345, metadataSource: 'bangumi',
    }
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'anime' as VideoType} catalogFields={cf} density="drawer" />,
    )
    const box = catalogBox(container)
    expect(box).not.toBeNull()
    expect(box!.textContent).toContain('One Piece')
    expect(box!.textContent).toContain('9.5')
    expect(box!.textContent).toContain('12345')
    expect(box!.textContent).toContain('bangumi')
  })

  it('catalogFields 全空：不渲染真源字段区', () => {
    const cf: ExternalMetaCatalogFields = { titleOriginal: null, rating: null }
    const { container } = render(
      <ExternalMetaPanel summary={makeSummary()} type={'movie' as VideoType} catalogFields={cf} density="drawer" />,
    )
    expect(catalogBox(container)).toBeNull()
  })
})
