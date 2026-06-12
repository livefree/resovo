/**
 * tests/unit/api/titleObservation-builder.test.ts — SEQ-20260602-03 / CHG-VIR-6（Phase 1b）
 *
 * 覆盖 Service 层 buildTitleObservation：parseTitle facets 透传 + sha256 raw_title_hash +
 * 默认 source_name=null。
 */

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { buildTitleObservation } from '@/api/services/titleObservation.builder'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'

describe('buildTitleObservation — 解析透传 + 去重 hash', () => {
  it('透传 parseTitle 的 coreTitleKey/titleKind/confidence/facets + parserVersion', () => {
    const input = buildTitleObservation('vid-1', '斗罗大陆 第4季 国语 更新至30集', 'site-a')
    expect(input.videoId).toBe('vid-1')
    expect(input.sourceSiteKey).toBe('site-a')
    expect(input.sourceName).toBeNull() // 默认 site 级观测
    expect(input.rawTitle).toBe('斗罗大陆 第4季 国语 更新至30集')
    expect(input.parserVersion).toBe(TITLE_PARSER_VERSION)
    const facets = input.parsedFacets as Record<string, unknown>
    expect(facets.coreTitleKey).toBe('斗罗大陆')
    expect(facets.titleKind).toBe('crawler')
    expect(facets.facets).toMatchObject({ seasonNumber: 4, audioLanguage: '国语' })
  })

  it('raw_title_hash = sha256(raw_title) hex，确定性（跨 video/site 同标题同 hash）', () => {
    const raw = '复仇者联盟4'
    const a = buildTitleObservation('vid-1', raw, null)
    const b = buildTitleObservation('vid-2', raw, 'x')
    const expected = createHash('sha256').update(raw).digest('hex')
    expect(a.rawTitleHash).toBe(expected)
    expect(a.rawTitleHash).toBe(b.rawTitleHash)
    expect(a.rawTitleHash).toHaveLength(64)
  })

  it('不同标题 → 不同 hash', () => {
    const a = buildTitleObservation('v', '复仇者联盟4', null)
    const b = buildTitleObservation('v', '复仇者联盟3', null)
    expect(a.rawTitleHash).not.toBe(b.rawTitleHash)
  })

  it('显式传 sourceName 时透传', () => {
    expect(buildTitleObservation('vid-1', '某剧', 'site-a', 'line-1').sourceName).toBe('line-1')
  })
})
