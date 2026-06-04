/**
 * splitSuggestions.ts — 拆分自动分组建议纯函数（ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B）
 *
 * 确定性单维分组：维度优先级 core_title_key > season > release_marker > edition，
 * 取第一个能把有观测线路分成 ≥2 个非空组的维度。
 *
 * 数据形态（与 ADR 事实口径一致）：
 *   - 线路清单真源 = getVideoMatrix 的 LineMatrixRow（R-105-S9：键 (siteKey, sourceName) 逐字一致，
 *     line 粒度不丢——site 级 facet 仅决定该 line 落哪个 group）；
 *   - facet 信号源 = title_observations 的 site 级聚合（观测写入 source_name 恒 NULL；
 *     dominant = observed_count DESC, last_seen_at DESC, raw_title_hash ASC 首行，排序已在 SQL 落定）；
 *   - site 级粒度盲区：同 site 全部线路必然同组；site 内多标题以 intra_site_multi_title 信号
 *     显式提示（盲区从静默错误降级为运营可见）。
 *
 * 纯函数零副作用（R-105-S1）；无观测/维度 facet 缺失线路进 unassignedLines（R-105-S2 禁止猜测）。
 */

import type {
  LineMatrixRow,
  SplitSignal,
  SplitSuggestionDimension,
  SplitSuggestionGroup,
  SplitSuggestionLine,
  SplitSuggestionsResult,
  VideoType,
} from '@resovo/types'
import type { TitleObservationRow } from '@/api/db/queries/titleObservations'

/** 维度优先级（D-105-1；与 ADR-105a 强负 veto 维度同源 / Y-105-S1 对称性） */
const DIMENSION_PRIORITY: readonly SplitSuggestionDimension[] = [
  'core_title_key',
  'season',
  'release_marker',
  'edition',
]

/** observedTitles 展示 top-K */
const OBSERVED_TITLES_TOP_K = 3

/**
 * intra_site_multi_title「未压倒」判定：dominant.observedCount < 次行.observedCount × 该系数
 * → site 内多标题势均力敌，提示人工核查（Y-105-S2 同级确定性常量）。
 */
const DOMINANT_OVERWHELM_RATIO = 2

export interface SplitSuggestionsInput {
  readonly videoId: string
  /** 原 video type（suggestedMeta.type 继承 / D-105-1） */
  readonly videoType: VideoType
  /** getVideoMatrix 输出（线路真源，R-105-S9） */
  readonly lines: readonly LineMatrixRow[]
  /** listObservationsByVideoId 输出（已按 siteKey ASC + dominant 排序） */
  readonly observations: readonly TitleObservationRow[]
  /** listExternalIdConflictProviders 输出（升序） */
  readonly externalIdConflictProviders: readonly string[]
}

/** parsed_facets_jsonb 快照的窄化读取（builder 写入形状 {coreTitleKey, facets:{...}}） */
function readFacetValue(
  parsedFacets: Record<string, unknown>,
  dimension: SplitSuggestionDimension,
): string | null {
  if (dimension === 'core_title_key') {
    const v = parsedFacets['coreTitleKey']
    return typeof v === 'string' && v !== '' ? v : null
  }
  const facets = parsedFacets['facets']
  if (typeof facets !== 'object' || facets === null) return null
  const f = facets as Record<string, unknown>
  if (dimension === 'season') {
    const v = f['seasonNumber']
    return typeof v === 'number' ? String(v) : null
  }
  const key = dimension === 'release_marker' ? 'releaseMarker' : 'edition'
  const v = f[key]
  return typeof v === 'string' && v !== '' ? v : null
}

interface SiteObservationGroup {
  readonly dominant: TitleObservationRow
  readonly rows: readonly TitleObservationRow[]
}

/** 观测按 site 聚合（入参排序保证每 site 首行 = dominant） */
function groupObservationsBySite(
  observations: readonly TitleObservationRow[],
): Map<string, SiteObservationGroup> {
  const map = new Map<string, { dominant: TitleObservationRow; rows: TitleObservationRow[] }>()
  for (const row of observations) {
    const entry = map.get(row.siteKey)
    if (entry) {
      entry.rows.push(row)
    } else {
      map.set(row.siteKey, { dominant: row, rows: [row] })
    }
  }
  return map
}

/** LineMatrixRow → SplitSuggestionLine（episodeRange 防御 null episode_number） */
function toSuggestionLine(
  line: LineMatrixRow,
  siteObs: SiteObservationGroup | undefined,
): SplitSuggestionLine {
  const episodeNumbers = line.episodes
    .map((e) => e.episodeNumber)
    .filter((n): n is number => typeof n === 'number')
  return {
    sourceSiteKey: line.sourceSiteKey,
    sourceName: line.sourceName,
    sourceIds: line.episodes.map((e) => e.sourceId),
    episodeRange: {
      min: episodeNumbers.length > 0 ? Math.min(...episodeNumbers) : null,
      max: episodeNumbers.length > 0 ? Math.max(...episodeNumbers) : null,
    },
    observedTitles: (siteObs?.rows ?? [])
      .slice(0, OBSERVED_TITLES_TOP_K)
      .map((r) => ({ rawTitle: r.rawTitle, observedCount: r.observedCount })),
  }
}

/** 组内 dominant 观测集合 → 建议标题（observed_count DESC, last_seen_at DESC, raw_title ASC） */
function pickSuggestedTitle(dominants: readonly TitleObservationRow[]): string {
  const sorted = [...dominants].sort((a, b) => {
    if (b.observedCount !== a.observedCount) return b.observedCount - a.observedCount
    if (a.lastSeenAt !== b.lastSeenAt) return a.lastSeenAt < b.lastSeenAt ? 1 : -1
    return a.rawTitle < b.rawTitle ? -1 : a.rawTitle > b.rawTitle ? 1 : 0
  })
  return sorted[0]!.rawTitle
}

/** 线路键（与 getVideoMatrix linesMap 键同构，仅信号展示用） */
function lineKey(line: SplitSuggestionLine): string {
  return `${line.sourceSiteKey}::${line.sourceName}`
}

export function buildSplitSuggestions(input: SplitSuggestionsInput): SplitSuggestionsResult {
  const { videoId, videoType, lines, observations, externalIdConflictProviders } = input
  const siteMap = groupObservationsBySite(observations)
  const signals: SplitSignal[] = []

  // ── video 级信号：外部 ID 冲突 ─────────────────────────────────────
  if (externalIdConflictProviders.length > 0) {
    signals.push({ kind: 'external_id_conflict', providers: externalIdConflictProviders })
  }

  // ── site 内多标题盲区信号（siteKey 升序 = 观测入参序）────────────────
  for (const [siteKey, group] of siteMap) {
    if (group.rows.length < 2) continue
    const dominant = group.rows[0]!
    const second = group.rows[1]!
    const dominantCore = readFacetValue(dominant.parsedFacets, 'core_title_key')
    const secondCore = readFacetValue(second.parsedFacets, 'core_title_key')
    const coreDiffers = dominantCore !== secondCore
    const notOverwhelming = dominant.observedCount < second.observedCount * DOMINANT_OVERWHELM_RATIO
    if (coreDiffers || notOverwhelming) {
      signals.push({ kind: 'intra_site_multi_title', siteKey })
    }
  }

  // ── 线路 → site facet 继承 ────────────────────────────────────────
  const lineEntries = lines.map((line) => {
    const siteObs = siteMap.get(line.sourceSiteKey)
    return {
      suggestion: toSuggestionLine(line, siteObs),
      dominant: siteObs?.dominant ?? null,
    }
  })

  // ── multi_* 信号 + 维度选定（优先级取首个 ≥2 组维度）────────────────
  const MULTI_KIND: Record<SplitSuggestionDimension, 'multi_core_title' | 'multi_season' | 'multi_release_marker' | 'multi_edition'> = {
    core_title_key: 'multi_core_title',
    season: 'multi_season',
    release_marker: 'multi_release_marker',
    edition: 'multi_edition',
  }
  let chosenDimension: SplitSuggestionDimension | null = null
  let chosenBuckets: Map<string, typeof lineEntries> | null = null

  for (const dimension of DIMENSION_PRIORITY) {
    const buckets = new Map<string, typeof lineEntries>()
    for (const entry of lineEntries) {
      if (!entry.dominant) continue
      const value = readFacetValue(entry.dominant.parsedFacets, dimension)
      if (value === null) continue
      const bucket = buckets.get(value)
      if (bucket) bucket.push(entry)
      else buckets.set(value, [entry])
    }
    if (buckets.size >= 2) {
      signals.push({ kind: MULTI_KIND[dimension], values: [...buckets.keys()].sort() })
      if (chosenDimension === null) {
        chosenDimension = dimension
        chosenBuckets = buckets
      }
    }
  }

  // ── 分组产出（facetValue 升序确定性）──────────────────────────────
  const groups: SplitSuggestionGroup[] = []
  const assignedLineKeys = new Set<string>()
  if (chosenDimension !== null && chosenBuckets !== null) {
    for (const facetValue of [...chosenBuckets.keys()].sort()) {
      const entries = chosenBuckets.get(facetValue)!
      for (const e of entries) assignedLineKeys.add(lineKey(e.suggestion))
      groups.push({
        groupKey: `${chosenDimension}:${facetValue}`,
        facetValue,
        lines: entries.map((e) => e.suggestion),
        suggestedMeta: {
          title: pickSuggestedTitle(entries.map((e) => e.dominant!)),
          type: videoType,
        },
      })
    }
  }

  const unassignedLines = lineEntries
    .filter((e) => !assignedLineKeys.has(lineKey(e.suggestion)))
    .map((e) => e.suggestion)

  // ── episode_overlap 信号（组间 episodeRange 重叠 ≥1 集 / Y-105-S2）────
  if (groups.length >= 2) {
    const overlapKeys = new Set<string>()
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]!.lines[0]
        const b = groups[j]!.lines[0]
        const ra = groupEpisodeRange(groups[i]!)
        const rb = groupEpisodeRange(groups[j]!)
        if (ra.min === null || ra.max === null || rb.min === null || rb.max === null) continue
        if (ra.min <= rb.max && rb.min <= ra.max) {
          if (a) overlapKeys.add(lineKey(a))
          if (b) overlapKeys.add(lineKey(b))
        }
      }
    }
    if (overlapKeys.size > 0) {
      signals.push({ kind: 'episode_overlap', lineKeys: [...overlapKeys].sort() })
    }
  }

  return {
    videoId,
    suggestible: groups.length >= 2,
    dimension: chosenDimension,
    signals,
    groups,
    unassignedLines,
  }
}

/** 组内全线路 episodeRange 并集 */
function groupEpisodeRange(group: SplitSuggestionGroup): { min: number | null; max: number | null } {
  let min: number | null = null
  let max: number | null = null
  for (const line of group.lines) {
    if (line.episodeRange.min !== null && (min === null || line.episodeRange.min < min)) {
      min = line.episodeRange.min
    }
    if (line.episodeRange.max !== null && (max === null || line.episodeRange.max > max)) {
      max = line.episodeRange.max
    }
  }
  return { min, max }
}
