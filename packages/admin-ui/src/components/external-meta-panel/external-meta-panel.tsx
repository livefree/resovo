'use client'

/**
 * external-meta-panel.tsx — 外部元数据真源并集视图（ADR-172 AMENDMENT 3 / META-18）
 *
 * 真源：types.ts（arch-reviewer Opus PASS 契约）
 *
 * 三区纵向布局（非 tab，符合「并集总览，不孤岛」）：
 *   ① 源并集总览：4 源 logo（douban / bangumi(anime) / tmdb / imdb）+ 外部 ID + 匹配方式 + 置信度 + 主源标记
 *   ② 真源字段区：media_catalog 合并值（原名 / 评分+人数）+ metadata_source 标注
 *   ③ Bangumi 条目块（anime-only）：日文原名 / 放送日 / 排名 / 评分 / nsfw / 简介
 *
 * 复用 enrichment-badge 的 SourceLogoBadge + SOURCE_HREF_BUILDERS + SOURCE_LABEL（不重绘 logo/href）。
 * 纯展示零回调；零硬编码颜色（仅经 SourceLogoBadge / --state-* / --fg-* / --bg-* token）。
 *
 * 固定 data attribute：data-external-meta-panel + data-density
 */
import React from 'react'
import { SourceLogoBadge } from '../enrichment-badge/source-logo-badge'
import { SOURCE_HREF_BUILDERS, SOURCE_LABEL } from '../enrichment-badge/enrichment-logos'
import type { SourceMatchState, SourceLogoKind, SourceLogoSize } from '../enrichment-badge/enrichment-badge.types'
import type {
  DoubanStatus, BangumiStatus, ExternalRefProvider, ExternalRefMatchStatus,
  ExternalRefSummary, BangumiEntrySummary,
} from '@resovo/types'
import type { ExternalMetaPanelProps } from './types'

// ── styles（零硬编码颜色）────────────────────────────────────────────

const ROOT_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' }
const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px',
}
const SOURCE_ROW_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '6px 10px', background: 'var(--bg-surface-raised)',
  borderRadius: 'var(--radius-sm)', marginBottom: '4px',
}
const SOURCE_LABEL_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 600 }
const ID_STYLE: React.CSSProperties = { fontFamily: 'monospace', fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }
const MUTED_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }
const PRIMARY_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex', padding: '1px 6px', fontSize: 'var(--font-size-2xs)',
  borderRadius: 'var(--radius-full)', background: 'var(--state-success-bg)', color: 'var(--state-success-fg)',
}
const META_ROW_STYLE: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: '8px',
  padding: '4px 10px', background: 'var(--bg-surface-raised)',
  borderRadius: 'var(--radius-sm)', marginBottom: '3px',
}
const META_LABEL_STYLE: React.CSSProperties = { fontFamily: 'monospace', fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }
const META_VALUE_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', lineHeight: 1.6,
  margin: '6px 0 0', maxHeight: '7.2em', overflow: 'hidden',
}
const EMPTY_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }

// ── 文案/派生 ────────────────────────────────────────────────────────

const MATCH_STATUS_LABEL: Record<ExternalRefMatchStatus, string> = {
  auto_matched: '自动匹配',
  manual_confirmed: '人工确认',
  candidate: '候选',
  rejected: '已忽略',
}

/** douban/bangumi 4 态 status → SourceMatchState（与 EnrichmentBadgeCluster 同口径）。 */
function deriveMatchState(status: DoubanStatus | BangumiStatus): SourceMatchState {
  if (status === 'matched') return 'matched'
  if (status === 'candidate') return 'candidate'
  return 'absent'
}

function stateText(state: SourceMatchState): string {
  if (state === 'matched') return '已匹配'
  if (state === 'candidate') return '候选'
  return '未匹配'
}

function stateColor(state: SourceMatchState): string {
  if (state === 'matched') return 'var(--state-success-fg)'
  if (state === 'candidate') return 'var(--state-warning-fg)'
  return 'var(--fg-muted)'
}

interface SourceEntry {
  readonly provider: SourceLogoKind
  readonly state: SourceMatchState
  readonly externalId: string | null
  readonly ref: ExternalRefSummary | null
}

function makeEntry(
  provider: SourceLogoKind,
  state: SourceMatchState,
  summaryId: string | number | null,
  refMap: Map<ExternalRefProvider, ExternalRefSummary>,
): SourceEntry {
  const ref = refMap.get(provider) ?? null
  const externalId = ref?.externalId ?? (summaryId != null ? String(summaryId) : null)
  return { provider, state, externalId, ref }
}

function buildEntries(props: ExternalMetaPanelProps): SourceEntry[] {
  const { summary, type, externalRefs } = props
  // 每 provider 取一条 ref：优先 primary，否则首条
  const refMap = new Map<ExternalRefProvider, ExternalRefSummary>()
  for (const r of externalRefs ?? []) {
    const existing = refMap.get(r.provider)
    if (!existing || (r.isPrimary && !existing.isPrimary)) refMap.set(r.provider, r)
  }
  const entries: SourceEntry[] = [
    makeEntry('douban', deriveMatchState(summary.doubanStatus), summary.doubanId, refMap),
  ]
  if (type === 'anime') {
    entries.push(makeEntry('bangumi', deriveMatchState(summary.bangumiStatus), summary.bangumiSubjectId, refMap))
  }
  entries.push(makeEntry('tmdb', summary.tmdbId != null ? 'matched' : 'absent', summary.tmdbId, refMap))
  entries.push(makeEntry('imdb', summary.imdbId != null ? 'matched' : 'absent', summary.imdbId, refMap))
  return entries
}

// ── 子组件 ───────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div style={META_ROW_STYLE}>
      <code style={META_LABEL_STYLE}>{label}</code>
      <span style={META_VALUE_STYLE}>{value}</span>
    </div>
  )
}

function SourceRow({ entry, size }: { entry: SourceEntry; size: SourceLogoSize }): React.ReactElement {
  const { provider, state, externalId, ref } = entry
  const href = state !== 'absent' && externalId ? SOURCE_HREF_BUILDERS[provider](externalId) : undefined
  const statusText = ref ? MATCH_STATUS_LABEL[ref.matchStatus] : stateText(state)
  const confidencePct = ref?.confidence != null ? ` ${Math.round(ref.confidence * 100)}%` : ''
  return (
    <div style={SOURCE_ROW_STYLE} data-external-source-row data-source={provider} data-state={state}>
      <SourceLogoBadge source={provider} state={state} href={href} size={size} />
      <span style={SOURCE_LABEL_STYLE}>{SOURCE_LABEL[provider]}</span>
      {externalId ? <code style={ID_STYLE}>{externalId}</code> : <span style={MUTED_STYLE}>—</span>}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--font-size-xxs)', color: stateColor(state) }}>
        {statusText}{confidencePct}
      </span>
      {ref?.isPrimary && <span style={PRIMARY_PILL_STYLE}>主源</span>}
    </div>
  )
}

function BangumiBlock({ info }: { info: BangumiEntrySummary }): React.ReactElement {
  return (
    <div data-external-bangumi-block>
      <div style={SECTION_HEADER_STYLE}>Bangumi 条目</div>
      {info.titleJp && <MetaRow label="日文原名" value={info.titleJp} />}
      <MetaRow label="放送日" value={info.airDate ?? '—'} />
      <MetaRow label="排名" value={info.rank != null ? `#${info.rank}` : '—'} />
      <MetaRow label="评分" value={info.rating != null ? info.rating.toFixed(1) : '—'} />
      {info.nsfw && <MetaRow label="分级" value="NSFW" />}
      {info.summary && <p style={SUMMARY_STYLE} data-external-bangumi-summary>{info.summary}</p>}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────

export function ExternalMetaPanel(props: ExternalMetaPanelProps): React.ReactElement {
  const { type, catalogFields, bangumiInfo, enrichedAtLabel, density = 'drawer', testId } = props
  const size: SourceLogoSize = density === 'drawer' ? 'md' : 'sm'
  const entries = buildEntries(props)
  // compact：仅命中源；drawer：全部（未命中灰显，暴露缺口）
  const visibleEntries = density === 'compact' ? entries.filter((e) => e.state !== 'absent') : entries

  const cf = catalogFields
  const hasCatalogFields = !!cf && (
    !!cf.titleOriginal || cf.rating != null
  )

  return (
    <div data-external-meta-panel data-density={density} data-testid={testId} style={ROOT_STYLE}>
      {/* ① 源并集总览 */}
      <div data-external-source-overview>
        <div style={SECTION_HEADER_STYLE}>外部源{enrichedAtLabel ? ` · ${enrichedAtLabel}` : ''}</div>
        {visibleEntries.length > 0
          ? visibleEntries.map((e) => <SourceRow key={e.provider} entry={e} size={size} />)
          : <p style={EMPTY_STYLE}>暂无外部源匹配</p>}
      </div>

      {/* ② 真源字段区 */}
      {hasCatalogFields && cf && (
        <div data-external-catalog-fields>
          <div style={SECTION_HEADER_STYLE}>
            真源字段{cf.metadataSource ? ` · 来源 ${cf.metadataSource}` : ''}
          </div>
          {cf.titleOriginal && <MetaRow label="原名" value={cf.titleOriginal} />}
          {cf.rating != null && (
            <MetaRow
              label="评分"
              value={`${cf.rating.toFixed(1)}${cf.ratingVotes != null ? ` (${cf.ratingVotes} 人)` : ''}`}
            />
          )}
        </div>
      )}

      {/* ③ Bangumi 条目块（anime-only） */}
      {type === 'anime' && bangumiInfo && <BangumiBlock info={bangumiInfo} />}
    </div>
  )
}
