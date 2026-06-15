'use client'

/**
 * MetaSourceEvidence.tsx — 元数据 tab「来源证据」子区（META-35 / ADR-201 §视频编辑抽屉）
 *
 * 作为 `MetadataStatusPanel.sourceEvidence` 注入的 ReactNode，承载**只读富视图**：
 *   ② 真源字段（media_catalog 合并值：原名 / 评分+人数 + metadata_source 标注）
 *   ③ Bangumi 条目块（anime-only：日文原名 / 放送日 / 排名 / 评分 / nsfw / 简介）
 *   ④ 角色 · 声优（anime-only：主角+配角，cap 8）
 *
 * 与退役的 `ExternalMetaPanel` ②③④ 同口径，但**不含① 四源总览**——四源状态/外链/置信度已由
 * `MetadataStatusPanel` 四来源卡承载（避免重复展示）。server-next 自建、不导出 admin-ui 内部块
 * （ExternalMetaPanel 在抽屉退役，D-201-2 / §取代关系）。纯展示零回调，零硬编码颜色（仅 token）。
 */
import React from 'react'
import { Thumb } from '@resovo/admin-ui'
import type { VideoType, BangumiEntrySummary, CatalogCharacterSummary } from '@resovo/types'

// ── styles（零硬编码颜色，镜像 ExternalMetaPanel）────────────────────────

const ROOT_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' }
const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px',
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
const PRIMARY_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex', padding: '1px 6px', fontSize: 'var(--font-size-2xs)',
  borderRadius: 'var(--radius-full)', background: 'var(--state-success-bg)', color: 'var(--state-success-fg)',
}
const CHAR_ROW_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '4px 10px', background: 'var(--bg-surface-raised)',
  borderRadius: 'var(--radius-sm)', marginBottom: '3px',
}
const CHAR_NAME_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)',
  display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0,
}
const RELATION_TAG_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)', flexShrink: 0,
}

// ── 派生（镜像 ExternalMetaPanel 展示契约）──────────────────────────────

/** ADR-161 AMENDMENT 展示契约：仅展示主角 + 配角（客串/闲角降噪）。 */
const DISPLAY_RELATIONS: ReadonlySet<string> = new Set(['主角', '配角'])
const CHARACTERS_CAP = 8

export interface MetaEvidenceCatalogFields {
  readonly titleOriginal?: string | null
  readonly rating?: number | null
  readonly ratingVotes?: number | null
  readonly metadataSource?: string | null
}

export interface MetaSourceEvidenceProps {
  readonly type: VideoType
  readonly catalogFields?: MetaEvidenceCatalogFields
  readonly bangumiInfo?: BangumiEntrySummary
  readonly characters?: readonly CatalogCharacterSummary[]
  readonly testId?: string
}

/** 是否有任意可展示证据（真源字段 / Bangumi 条目 / 角色）；消费方据此决定是否注入 sourceEvidence。 */
export function hasMetaSourceEvidence(props: Omit<MetaSourceEvidenceProps, 'testId'>): boolean {
  const { type, catalogFields, bangumiInfo, characters } = props
  const hasCatalog = !!catalogFields && (!!catalogFields.titleOriginal || catalogFields.rating != null)
  const hasBangumi = type === 'anime' && !!bangumiInfo
  const hasCharacters = type === 'anime'
    && !!characters
    && characters.some((c) => c.relation != null && DISPLAY_RELATIONS.has(c.relation))
  return hasCatalog || hasBangumi || hasCharacters
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

function BangumiBlock({ info }: { info: BangumiEntrySummary }): React.ReactElement {
  return (
    <div data-meta-bangumi-block>
      <div style={SECTION_HEADER_STYLE}>Bangumi 条目</div>
      {info.titleJp && <MetaRow label="日文原名" value={info.titleJp} />}
      <MetaRow label="放送日" value={info.airDate ?? '—'} />
      <MetaRow label="排名" value={info.rank != null ? `#${info.rank}` : '—'} />
      <MetaRow label="评分" value={info.rating != null ? info.rating.toFixed(1) : '—'} />
      {info.nsfw && <MetaRow label="分级" value="NSFW" />}
      {info.summary && <p style={SUMMARY_STYLE} data-meta-bangumi-summary>{info.summary}</p>}
    </div>
  )
}

function CharactersBlock({ characters }: { characters: readonly CatalogCharacterSummary[] }): React.ReactElement | null {
  const shown = characters
    .filter((c) => c.relation != null && DISPLAY_RELATIONS.has(c.relation))
    .slice(0, CHARACTERS_CAP)
  if (shown.length === 0) return null
  return (
    <div data-meta-characters-block>
      <div style={SECTION_HEADER_STYLE}>角色 · 声优</div>
      {shown.map((c, i) => (
        <div key={`${c.name}-${i}`} style={CHAR_ROW_STYLE} data-meta-character-row>
          <Thumb src={c.imageUrl} size="square-sm" decorative={false} alt={c.name} loading="lazy" />
          <span style={CHAR_NAME_STYLE}>
            {c.relation && (
              c.relation === '主角'
                ? <span style={PRIMARY_PILL_STYLE}>{c.relation}</span>
                : <span style={RELATION_TAG_STYLE}>{c.relation}</span>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          </span>
          <span style={{ flex: 1 }} />
          <span style={META_VALUE_STYLE}>
            {c.actors.length > 0 ? c.actors.map((a) => a.name).join(' / ') : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────

export function MetaSourceEvidence({
  type, catalogFields, bangumiInfo, characters, testId,
}: MetaSourceEvidenceProps): React.ReactElement | null {
  if (!hasMetaSourceEvidence({ type, catalogFields, bangumiInfo, characters })) return null
  const cf = catalogFields
  const hasCatalogFields = !!cf && (!!cf.titleOriginal || cf.rating != null)

  return (
    <div data-meta-source-evidence data-testid={testId} style={ROOT_STYLE}>
      {/* ② 真源字段区 */}
      {hasCatalogFields && cf && (
        <div data-meta-catalog-fields>
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

      {/* ④ 角色 · 声优区（anime-only / META-19） */}
      {type === 'anime' && characters && characters.length > 0 && (
        <CharactersBlock characters={characters} />
      )}
    </div>
  )
}
