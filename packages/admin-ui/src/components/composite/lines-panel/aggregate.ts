/**
 * aggregate.ts — 视频线路聚合纯函数（FIX-B Stage B）
 *
 * 真源：lines-panel.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 约束（R2 / R6）：
 *   - 零 React 依赖（纯 TS，Edge Runtime 兼容）
 *   - 不 import apps/** 或 server-next/**
 *   - groupSourcesByLine 为纯函数（相同输入相同输出）
 *
 * 聚合键：`${siteKey}|${lineName}`，source_site_key null → fallback 'unknown'
 *
 * 状态聚合规则：
 *   全 ok → ok / 含 ok 不全 ok → partial / 全 dead → dead / 全 pending → pending / 其他 → unknown
 */

import type { DualSignalDisplayState, ResolutionTier } from '@resovo/types'
import type {
  RawSourceRow,
  LineAggregate,
  EpisodeMini,
  GroupSourcesOptions,
} from './lines-panel.types'

// ── 状态映射 ────────────────────────────────────────────────────────────────

function toDisplayState(status: string): DualSignalDisplayState {
  switch (status) {
    case 'ok':      return 'ok'
    case 'partial': return 'partial'
    case 'dead':    return 'dead'
    case 'pending': return 'pending'
    default:        return 'unknown'
  }
}

function aggregateStates(states: DualSignalDisplayState[]): DualSignalDisplayState {
  if (states.length === 0) return 'unknown'
  if (states.every(s => s === 'ok'))      return 'ok'
  if (states.some(s => s === 'ok'))       return 'partial'
  if (states.every(s => s === 'dead'))    return 'dead'
  if (states.every(s => s === 'pending')) return 'pending'
  return 'unknown'
}

// ── 质量等级映射 ─────────────────────────────────────────────────────────────

const QUALITY_ORDER: ResolutionTier[] = ['4K', '2K', '1080P', '720P', '480P', '360P', '240P']

function toResolutionTier(q: string | null | undefined): ResolutionTier | null {
  if (!q) return null
  return (QUALITY_ORDER as string[]).includes(q) ? (q as ResolutionTier) : null
}

function pickHighestQuality(qualities: Array<ResolutionTier | null>): ResolutionTier | null {
  for (const tier of QUALITY_ORDER) {
    if (qualities.includes(tier)) return tier
  }
  return null
}

// ── 中位数计算 ───────────────────────────────────────────────────────────────

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

// ── Hostname 解析（URL API，Edge Runtime 兼容） ──────────────────────────────

function parseHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    return hostname || null
  } catch {
    return null
  }
}

// ── 默认排序：activeCount desc → probeAggregate asc → lineName asc ──────────

const STATE_SORT_RANK: Record<DualSignalDisplayState, number> = {
  ok: 1, partial: 2, unknown: 3, pending: 4, dead: 5,
}

function defaultSort(a: LineAggregate, b: LineAggregate): number {
  const activeDiff = b.activeCount - a.activeCount
  if (activeDiff !== 0) return activeDiff
  const probeDiff = STATE_SORT_RANK[a.probeAggregate] - STATE_SORT_RANK[b.probeAggregate]
  if (probeDiff !== 0) return probeDiff
  return a.lineName.localeCompare(b.lineName)
}

// ── 主函数 ───────────────────────────────────────────────────────────────────

/**
 * 将平铺的 video_sources 行按 `(siteKey, lineName)` 聚合为 LineAggregate 数组。
 *
 * 幂等纯函数：输入相同则输出相同，不修改原数组。
 */
export function groupSourcesByLine(
  sources: ReadonlyArray<RawSourceRow>,
  options?: GroupSourcesOptions,
): LineAggregate[] {
  const groups = new Map<string, RawSourceRow[]>()

  for (const row of sources) {
    const siteKey = row.source_site_key ?? 'unknown'
    const key = `${siteKey}|${row.source_name}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  const lines: LineAggregate[] = []

  for (const [key, rows] of groups) {
    const firstRow = rows[0]
    const siteKey = firstRow.source_site_key ?? 'unknown'
    const lineName = firstRow.source_name

    const sortedRows = [...rows].sort((a, b) => {
      if (a.episode_number === null && b.episode_number === null) return 0
      if (a.episode_number === null) return 1
      if (b.episode_number === null) return -1
      return a.episode_number - b.episode_number
    })

    const episodes: EpisodeMini[] = sortedRows.map(row => ({
      id: row.id,
      episodeNumber: row.episode_number,
      probe: toDisplayState(row.probe_status),
      render: toDisplayState(row.render_status),
      latencyMs: row.latency_ms,
      isActive: row.is_active,
      sourceUrl: row.source_url,
      updatedAt: row.updated_at,
    }))

    const activeCount = episodes.filter(e => e.isActive).length
    const probeAggregate = aggregateStates(episodes.map(e => e.probe))
    const renderAggregate = aggregateStates(episodes.map(e => e.render))

    const activeLatencies = episodes
      .filter(e => e.isActive && e.latencyMs !== null)
      .map(e => e.latencyMs as number)
    const latencyMedianMs = computeMedian(activeLatencies)

    const qualityHighest = pickHighestQuality(rows.map(r => toResolutionTier(r.quality_detected)))

    const hostname = (firstRow.hostname ?? null) || parseHostname(firstRow.source_url)

    // CHG-368-B-C-UI / ADR-164 D-164-2 + D-164-4：codename / retired_at 取首行。
    // 同 (siteKey, sourceName) 复合 PK 下 source_line_aliases 1:N 反向 join 出的
    // codename / retired_at 必然来自同一别名行（行间一致），取首行即可。
    lines.push({
      key,
      siteKey,
      lineName,
      hostname,
      totalEpisodes: episodes.length,
      activeCount,
      probeAggregate,
      renderAggregate,
      latencyMedianMs,
      qualityHighest,
      episodes,
      codename: firstRow.codename ?? null,
      retiredAt: firstRow.retired_at ?? null,
    })
  }

  const sortFn = options?.sortLines ?? defaultSort
  return lines.sort(sortFn)
}
