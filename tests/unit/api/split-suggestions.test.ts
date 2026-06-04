/**
 * split-suggestions.test.ts — 拆分自动分组建议纯函数测试
 * （ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B）
 *
 * 覆盖：维度优先级单维分组 / dominant facets / unassignedLines（R-105-S2 禁猜测）/
 * intra_site_multi_title 盲区信号 / external_id_conflict / episode_overlap /
 * suggestedMeta 确定性 / 线路键与 LineMatrixRow 一一对应（Y-105-S5 义务）/ 确定性幂等
 */

import { describe, it, expect } from 'vitest'
import { buildSplitSuggestions } from '@/api/services/identity/splitSuggestions'
import type { SplitSuggestionsInput } from '@/api/services/identity/splitSuggestions'
import type { TitleObservationRow } from '@/api/db/queries/titleObservations'
import type { LineMatrixRow } from '@resovo/types'

const VIDEO_ID = '00000000-0000-0000-0000-000000000001'

function makeLine(
  siteKey: string,
  sourceName: string,
  sourceIds: string[],
  episodes: (number | null)[] = [1],
): LineMatrixRow {
  return {
    sourceSiteKey: siteKey,
    sourceName,
    displayName: null,
    episodes: sourceIds.map((sid, i) => ({
      episodeNumber: (episodes[i] ?? episodes[0] ?? 1) as number,
      sourceId: sid,
      sourceUrl: `https://example.com/${sid}`,
      probeStatus: 'unknown',
      renderStatus: 'unknown',
      isActive: true,
    })),
  } as unknown as LineMatrixRow
}

function makeObservation(
  siteKey: string,
  rawTitle: string,
  opts: {
    coreTitleKey?: string
    seasonNumber?: number | null
    releaseMarker?: string | null
    edition?: string | null
    observedCount?: number
    lastSeenAt?: string
    hash?: string
  } = {},
): TitleObservationRow {
  return {
    siteKey,
    rawTitle,
    rawTitleHash: opts.hash ?? `hash-${rawTitle}`,
    observedCount: opts.observedCount ?? 1,
    lastSeenAt: opts.lastSeenAt ?? '2026-06-01T00:00:00Z',
    parsedFacets: {
      coreTitleKey: opts.coreTitleKey ?? 'default-core',
      titleKind: 'original',
      confidence: 1,
      facets: {
        seasonNumber: opts.seasonNumber ?? null,
        edition: opts.edition ?? null,
        languageVariant: null,
        releaseMarker: opts.releaseMarker ?? null,
        qualityNoise: [],
        sourceNoise: [],
        bracketTokens: [],
      },
    },
  }
}

function makeInput(partial: Partial<SplitSuggestionsInput>): SplitSuggestionsInput {
  return {
    videoId: VIDEO_ID,
    videoType: 'anime',
    lines: [],
    observations: [],
    externalIdConflictProviders: [],
    ...partial,
  }
}

describe('buildSplitSuggestions — 维度分组', () => {
  it('跨 site core_title 分裂（主场景）：dimension=core_title_key + 2 组 + dominant raw_title 预填', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1', 's2'], [1, 2]),
        makeLine('site-b', '线路1', ['s3']),
      ],
      observations: [
        makeObservation('site-a', '作品A 高清', { coreTitleKey: 'zuopin-a', observedCount: 5 }),
        makeObservation('site-b', '作品B 完整版', { coreTitleKey: 'zuopin-b', observedCount: 3 }),
      ],
    }))
    expect(result.suggestible).toBe(true)
    expect(result.dimension).toBe('core_title_key')
    expect(result.groups).toHaveLength(2)
    // facetValue 升序确定性
    expect(result.groups[0]!.groupKey).toBe('core_title_key:zuopin-a')
    expect(result.groups[1]!.groupKey).toBe('core_title_key:zuopin-b')
    expect(result.groups[0]!.suggestedMeta).toEqual({ title: '作品A 高清', type: 'anime' })
    expect(result.groups[1]!.suggestedMeta).toEqual({ title: '作品B 完整版', type: 'anime' })
    expect(result.groups[0]!.lines[0]!.sourceIds).toEqual(['s1', 's2'])
    expect(result.unassignedLines).toHaveLength(0)
    // multi_core_title signal 同步产出
    expect(result.signals).toContainEqual({ kind: 'multi_core_title', values: ['zuopin-a', 'zuopin-b'] })
  })

  it('season 分裂（core 同）：dimension=season + facetValue 升序', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', '某剧 第二季', { coreTitleKey: 'mouju', seasonNumber: 2 }),
        makeObservation('site-b', '某剧', { coreTitleKey: 'mouju', seasonNumber: 1 }),
      ],
    }))
    expect(result.dimension).toBe('season')
    expect(result.groups.map((g) => g.facetValue)).toEqual(['1', '2'])
  })

  it('release_marker 分裂（core+season 同）', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', '某番 剧场版', { coreTitleKey: 'moufan', releaseMarker: '剧场版' }),
        makeObservation('site-b', '某番 OVA', { coreTitleKey: 'moufan', releaseMarker: 'OVA' }),
      ],
    }))
    expect(result.dimension).toBe('release_marker')
    expect(result.groups.map((g) => g.facetValue)).toEqual(['OVA', '剧场版'])
  })

  it('edition 分裂（最低优先级）', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', '某片 加长版', { coreTitleKey: 'moupian', edition: '加长版' }),
        makeObservation('site-b', '某片 导演剪辑版', { coreTitleKey: 'moupian', edition: '导演剪辑版' }),
      ],
    }))
    expect(result.dimension).toBe('edition')
  })

  it('维度优先级：core 与 season 同时可分 → 取 core_title_key，两个 multi 信号都产出', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a', seasonNumber: 1 }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b', seasonNumber: 2 }),
      ],
    }))
    expect(result.dimension).toBe('core_title_key')
    expect(result.signals.map((s) => s.kind)).toEqual(
      expect.arrayContaining(['multi_core_title', 'multi_season']),
    )
  })

  it('全线路 facet 一致 → suggestible=false + groups=[] + 全部进 unassignedLines', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', '同作品', { coreTitleKey: 'same' }),
        makeObservation('site-b', '同作品', { coreTitleKey: 'same' }),
      ],
    }))
    expect(result.suggestible).toBe(false)
    expect(result.dimension).toBeNull()
    expect(result.groups).toHaveLength(0)
    expect(result.unassignedLines).toHaveLength(2)
  })
})

describe('buildSplitSuggestions — unassignedLines（R-105-S2 禁猜测）', () => {
  it('site 无观测的线路不归组，进 unassignedLines', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1']),
        makeLine('site-b', '线路1', ['s2']),
        makeLine('site-noobs', '线路1', ['s3']),
      ],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
    }))
    expect(result.suggestible).toBe(true)
    expect(result.unassignedLines).toHaveLength(1)
    expect(result.unassignedLines[0]!.sourceSiteKey).toBe('site-noobs')
    expect(result.unassignedLines[0]!.observedTitles).toHaveLength(0)
  })

  it('选定维度下 facet 为 null 的线路进 unassignedLines（season 维度示例）', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1']),
        makeLine('site-b', '线路1', ['s2']),
        makeLine('site-c', '线路1', ['s3']),
      ],
      observations: [
        makeObservation('site-a', 'X S1', { coreTitleKey: 'x', seasonNumber: 1 }),
        makeObservation('site-b', 'X S2', { coreTitleKey: 'x', seasonNumber: 2 }),
        makeObservation('site-c', 'X', { coreTitleKey: 'x', seasonNumber: null }),
      ],
    }))
    expect(result.dimension).toBe('season')
    expect(result.unassignedLines.map((l) => l.sourceSiteKey)).toEqual(['site-c'])
  })

  it('同 site 多线路必然同组（site 级盲区，line 粒度不丢）', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1']),
        makeLine('site-a', '线路2', ['s2']),
        makeLine('site-b', '线路1', ['s3']),
      ],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
    }))
    const groupA = result.groups.find((g) => g.facetValue === 'a')!
    expect(groupA.lines).toHaveLength(2)
    expect(groupA.lines.map((l) => l.sourceName)).toEqual(['线路1', '线路2'])
  })
})

describe('buildSplitSuggestions — 信号', () => {
  it('external_id_conflict 透传', () => {
    const result = buildSplitSuggestions(makeInput({
      externalIdConflictProviders: ['douban', 'tmdb'],
    }))
    expect(result.signals).toContainEqual({ kind: 'external_id_conflict', providers: ['douban', 'tmdb'] })
  })

  it('intra_site_multi_title：site 内 dominant 与次行 coreTitleKey 不同 → 信号', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1'])],
      observations: [
        makeObservation('site-a', '作品甲', { coreTitleKey: 'jia', observedCount: 10, hash: 'h1' }),
        makeObservation('site-a', '作品乙', { coreTitleKey: 'yi', observedCount: 1, hash: 'h2' }),
      ],
    }))
    expect(result.signals).toContainEqual({ kind: 'intra_site_multi_title', siteKey: 'site-a' })
  })

  it('intra_site_multi_title：core 同但 observed_count 未压倒（< 2×次行）→ 信号', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1'])],
      observations: [
        makeObservation('site-a', '标题甲', { coreTitleKey: 'same', observedCount: 3, hash: 'h1' }),
        makeObservation('site-a', '标题乙', { coreTitleKey: 'same', observedCount: 2, hash: 'h2' }),
      ],
    }))
    expect(result.signals).toContainEqual({ kind: 'intra_site_multi_title', siteKey: 'site-a' })
  })

  it('intra_site_multi_title：core 同且压倒（≥ 2×次行）→ 无信号', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1'])],
      observations: [
        makeObservation('site-a', '标题甲', { coreTitleKey: 'same', observedCount: 10, hash: 'h1' }),
        makeObservation('site-a', '标题乙', { coreTitleKey: 'same', observedCount: 2, hash: 'h2' }),
      ],
    }))
    expect(result.signals.filter((s) => s.kind === 'intra_site_multi_title')).toHaveLength(0)
  })

  it('episode_overlap：两建议组 episodeRange 重叠 → 信号', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1', 's2'], [1, 12]),
        makeLine('site-b', '线路1', ['s3', 's4'], [5, 20]),
      ],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
    }))
    const overlap = result.signals.find((s) => s.kind === 'episode_overlap')
    expect(overlap).toBeDefined()
    expect((overlap as { lineKeys: string[] }).lineKeys).toEqual(['site-a::线路1', 'site-b::线路1'])
  })

  it('episode_overlap：区间不重叠 → 无信号', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [
        makeLine('site-a', '线路1', ['s1', 's2'], [1, 12]),
        makeLine('site-b', '线路1', ['s3', 's4'], [13, 24]),
      ],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
    }))
    expect(result.signals.filter((s) => s.kind === 'episode_overlap')).toHaveLength(0)
  })
})

describe('buildSplitSuggestions — suggestedMeta 确定性（Y-105-S4）', () => {
  it('组内多 site：observed_count 最高的 dominant raw_title 胜出', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2']), makeLine('site-c', '线路1', ['s3'])],
      observations: [
        makeObservation('site-a', '名称甲', { coreTitleKey: 'x', observedCount: 2 }),
        makeObservation('site-b', '名称乙', { coreTitleKey: 'x', observedCount: 9 }),
        makeObservation('site-c', '其他作品', { coreTitleKey: 'y', observedCount: 1 }),
      ],
    }))
    const groupX = result.groups.find((g) => g.facetValue === 'x')!
    expect(groupX.suggestedMeta.title).toBe('名称乙')
  })

  it('observed_count 平局 → last_seen_at 新者胜，再平局 → raw_title 字典序', () => {
    const result = buildSplitSuggestions(makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2']), makeLine('site-c', '线路1', ['s3'])],
      observations: [
        makeObservation('site-a', 'B标题', { coreTitleKey: 'x', observedCount: 5, lastSeenAt: '2026-06-02T00:00:00Z' }),
        makeObservation('site-b', 'A标题', { coreTitleKey: 'x', observedCount: 5, lastSeenAt: '2026-06-01T00:00:00Z' }),
        makeObservation('site-c', '其他', { coreTitleKey: 'y' }),
      ],
    }))
    const groupX = result.groups.find((g) => g.facetValue === 'x')!
    expect(groupX.suggestedMeta.title).toBe('B标题')
  })
})

describe('buildSplitSuggestions — 线路键对齐 + 确定性（R-105-S9 / Y-105-S5 义务）', () => {
  it('groups + unassignedLines 的线路键集合 = 输入 LineMatrixRow 键集合（line 粒度不丢）', () => {
    const lines = [
      makeLine('site-a', '线路1', ['s1']),
      makeLine('site-a', '线路2', ['s2']),
      makeLine('site-b', '线路1', ['s3']),
      makeLine('site-noobs', '线路X', ['s4']),
    ]
    const result = buildSplitSuggestions(makeInput({
      lines,
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
    }))
    const outputKeys = [
      ...result.groups.flatMap((g) => g.lines),
      ...result.unassignedLines,
    ].map((l) => `${l.sourceSiteKey}::${l.sourceName}`).sort()
    const inputKeys = lines.map((l) => `${l.sourceSiteKey}::${l.sourceName}`).sort()
    expect(outputKeys).toEqual(inputKeys)
  })

  it('确定性幂等：同输入两次调用 deep equal', () => {
    const input = makeInput({
      lines: [makeLine('site-a', '线路1', ['s1']), makeLine('site-b', '线路1', ['s2'])],
      observations: [
        makeObservation('site-a', 'A', { coreTitleKey: 'a' }),
        makeObservation('site-b', 'B', { coreTitleKey: 'b' }),
      ],
      externalIdConflictProviders: ['douban'],
    })
    expect(buildSplitSuggestions(input)).toEqual(buildSplitSuggestions(input))
  })

  it('episodeRange 防御 null episode_number', () => {
    const line = makeLine('site-a', '线路1', ['s1'])
    ;(line.episodes[0] as { episodeNumber: number | null }).episodeNumber = null
    const result = buildSplitSuggestions(makeInput({ lines: [line] }))
    expect(result.unassignedLines[0]!.episodeRange).toEqual({ min: null, max: null })
  })
})
