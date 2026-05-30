'use client'

/**
 * enrichment-badge-cluster.tsx — EnrichmentBadgeCluster 组合簇（ADR-172 + AMENDMENT 2）
 *
 * 真源：enrichment-badge.types.ts（arch-reviewer Opus PASS 契约）
 *
 * AMENDMENT 2 重设计（纯派生，零受控状态）：
 *   - logo 行固定排序：douban → bangumi(anime) → tmdb → imdb（SourceLogoBadge 品牌 logo）
 *   - source kind 已移除（源健康由 DualSignal/source_health 表达，去重）
 *   - state 推导：douban/bangumi 据 status（matched/candidate/其余 absent）；tmdb/imdb=ID 非空?matched:absent
 *   - density='row'：仅渲染命中（state!=='absent'）彩色 logo + pinyin⚠；无 meta chip、无富集时间
 *   - density='header'：全部适用 logo（命中彩色 / 未命中灰显，暴露缺口）+ pinyin⚠ + meta chip + 富集时间
 *   - anime-only：bangumi 仅 type==='anime'（ADR-170 D-170-4）；tmdb/imdb 对所有 type 渲染
 *   - href 经 SOURCE_HREF_BUILDERS 组件内构造（命中且 id 非空时跳外部页）
 *
 * 固定 data attribute：data-enrichment-badge-cluster + data-type + data-density
 */
import React from 'react'
import { EnrichmentBadge } from './enrichment-badge'
import { SourceLogoBadge } from './source-logo-badge'
import { SOURCE_HREF_BUILDERS } from './enrichment-logos'
import type {
  EnrichmentBadgeClusterProps,
  SourceLogoKind,
  SourceLogoSize,
  SourceMatchState,
} from './enrichment-badge.types'
import type { DoubanStatus, BangumiStatus } from '@resovo/types'

const TIME_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  whiteSpace: 'nowrap',
}

/** douban/bangumi 4 态 status → SourceMatchState（matched/candidate/其余 absent）。 */
function deriveMatchState(status: DoubanStatus | BangumiStatus): SourceMatchState {
  if (status === 'matched') return 'matched'
  if (status === 'candidate') return 'candidate'
  return 'absent'
}

interface LogoEntry {
  readonly source: SourceLogoKind
  readonly state: SourceMatchState
  readonly href?: string
}

export function EnrichmentBadgeCluster({
  summary,
  type,
  density,
  enrichedAtLabel,
  testId,
}: EnrichmentBadgeClusterProps): React.ReactElement {
  const isHeader = density === 'header'
  const size: SourceLogoSize = isHeader ? 'md' : 'sm'
  const isAnime = type === 'anime'

  // ── 构造 logo 行条目（固定排序 douban → bangumi(anime) → tmdb → imdb）──
  const entries: LogoEntry[] = []

  const doubanState = deriveMatchState(summary.doubanStatus)
  entries.push({
    source: 'douban',
    state: doubanState,
    href: doubanState !== 'absent' && summary.doubanId
      ? SOURCE_HREF_BUILDERS.douban(summary.doubanId)
      : undefined,
  })

  if (isAnime) {
    const bangumiState = deriveMatchState(summary.bangumiStatus)
    entries.push({
      source: 'bangumi',
      state: bangumiState,
      href: bangumiState !== 'absent' && summary.bangumiSubjectId != null
        ? SOURCE_HREF_BUILDERS.bangumi(summary.bangumiSubjectId)
        : undefined,
    })
  }

  const tmdbState: SourceMatchState = summary.tmdbId != null ? 'matched' : 'absent'
  entries.push({
    source: 'tmdb',
    state: tmdbState,
    href: tmdbState !== 'absent' && summary.tmdbId != null
      ? SOURCE_HREF_BUILDERS.tmdb(summary.tmdbId)
      : undefined,
  })

  const imdbState: SourceMatchState = summary.imdbId != null ? 'matched' : 'absent'
  entries.push({
    source: 'imdb',
    state: imdbState,
    href: imdbState !== 'absent' && summary.imdbId
      ? SOURCE_HREF_BUILDERS.imdb(summary.imdbId)
      : undefined,
  })

  // row：仅命中（彩色）logo；header：全部（含 absent 灰显）
  const visibleEntries = isHeader ? entries : entries.filter((e) => e.state !== 'absent')

  const rootStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: isHeader ? '6px' : '4px',
  }

  return (
    <span
      data-enrichment-badge-cluster
      data-type={type}
      data-density={density}
      data-testid={testId}
      style={rootStyle}
    >
      {visibleEntries.map((e) => (
        <SourceLogoBadge key={e.source} source={e.source} state={e.state} href={e.href} size={size} />
      ))}
      {/* pinyin 警告（两密度均渲染） */}
      <EnrichmentBadge kind="pinyin" isPinyin={summary.titleEnIsPinyin} size={size} />
      {/* meta 完整度 chip（仅 header） */}
      {isHeader && <EnrichmentBadge kind="meta" score={summary.metaScore} size={size} />}
      {/* 富集时间（仅 header） */}
      {isHeader && (
        <span data-enrichment-cluster-time style={TIME_STYLE}>
          {enrichedAtLabel ?? '未富集'}
        </span>
      )}
    </span>
  )
}
