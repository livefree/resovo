/**
 * knownNames.ts — 作品「已知名」集合共享原语（ADR-206 D-206-1 / META-50-1A）
 *
 * 把 media_catalog 四标题字段（title/title_en/title_original）∪ media_catalog_aliases 结构化别名
 * 合成为单一 `KnownName[]`，供 TMDB/bangumi/identity/enrich 四方**消费同一真源不同投影**：
 *   - `filterForMatchScore`：M2 打分极性过滤（仅 title/official/original/localized + 排 crawler 别名）
 *   - `filterForSearchQueries`：M5 外部搜索优先级序 [title_original, title_en, official/romanization alias, title]
 *
 * 只读原语：仅 query 编排（Service 层调 Queries），不写路径、不接线消费方（接线归 1B/2A）。
 * 与 reconcile.canonical.ts 同层（services/metadata/）。
 */

import type { Pool, PoolClient } from 'pg'
import { findCatalogById, type MediaCatalogRow } from '@/api/db/queries/mediaCatalog'
import { listCatalogAliases } from '@/api/db/queries/catalogAliases'
import { normalizeForExternalMatch } from '../TitleNormalizer'

/**
 * KnownName 的 kind：ALIAS_KINDS ∪ 合成 `'title'`。
 * **`'title'` 为合成值（MUST-1A-6）**——对应 media_catalog.title 主标题字段，DB 别名表永不出现此 kind。
 */
export type KnownNameKind =
  | 'title'
  | 'official'
  | 'localized'
  | 'romanization'
  | 'abbreviation'
  | 'aka'
  | 'original'

/**
 * 作品的一个「已知名」（投影 DTO，非持久化）。
 */
export interface KnownName {
  readonly value: string
  readonly kind: KnownNameKind
  /**
   * 名称来源（MUST-1A-6）。取值域 = `CatalogMetadataSource ∪ {'catalog'}`：
   *   - `'catalog'` = 哨兵，来自 media_catalog 的 canonical 标题字段（title/title_en/title_original），
   *     非原始别名抓取。**不继承 catalog 行级 metadata_source**（MUST-1A-1）——canonical 真值不应被
   *     2A 桶门槛「crawler 一律不进桶」误伤。
   *   - 其余（manual/tmdb/bangumi/douban/crawler）= media_catalog_aliases 行的 source。
   */
  readonly source: string
  /** BCP47 language subtag（NULL=未知） */
  readonly lang: string | null
  /** 置信度 [0,1]（NULL=无来源置信；canonical 标题字段恒 1.0） */
  readonly confidence: number | null
}

/** canonical 标题字段哨兵 source（MUST-1A-1）。 */
export const CATALOG_FIELD_SOURCE = 'catalog'

/**
 * kind 极性优先级（数值越小极性越强，dedup tiebreak 用，MUST-1A-3）：
 * canonical-title > official > original > localized > romanization > abbreviation/aka。
 * 同名归一冲突时保留极性更强的 kind，防一个本应进 matchScore/searchQueries 的 value
 * 因去重保留弱极性 kind（如 aka）而被投影函数误排除。
 */
const KIND_POLARITY_RANK: Record<KnownNameKind, number> = {
  title: 0,
  official: 1,
  original: 2,
  localized: 3,
  romanization: 4,
  abbreviation: 5,
  aka: 5,
}

/** filterForMatchScore 极性白名单（M2 / D-206-3 / ADR-175 D-175-4）。 */
const MATCH_SCORE_KINDS: ReadonlySet<KnownNameKind> = new Set<KnownNameKind>([
  'title', 'official', 'original', 'localized',
])

/** 非空白校验。 */
function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 三 canonical 标题字段 → KnownName（哨兵 source='catalog' / confidence=1.0，仅非空字段）。
 */
function buildCatalogFieldNames(row: MediaCatalogRow): KnownName[] {
  const out: KnownName[] = []
  if (isNonBlank(row.title)) {
    out.push({ value: row.title, kind: 'title', source: CATALOG_FIELD_SOURCE, lang: null, confidence: 1.0 })
  }
  if (isNonBlank(row.titleEn)) {
    out.push({ value: row.titleEn, kind: 'official', source: CATALOG_FIELD_SOURCE, lang: 'en', confidence: 1.0 })
  }
  if (isNonBlank(row.titleOriginal)) {
    out.push({
      value: row.titleOriginal,
      kind: 'original',
      source: CATALOG_FIELD_SOURCE,
      lang: row.originalLanguage,
      confidence: 1.0,
    })
  }
  return out
}

/**
 * 归一去重（MUST-1A-3）：normalizeForExternalMatch(value) 相同视为同名，
 * 保留极性更强（KIND_POLARITY_RANK 小）者；rank 相同保留 confidence 高者（NULL 视最低）。
 * normalizeForExternalMatch **不转简繁**（ADR-175 R1），「海贼王/航海王」归一后不同 → 不误并。
 */
function dedupKnownNames(names: readonly KnownName[]): KnownName[] {
  const best = new Map<string, KnownName>()
  for (const name of names) {
    const key = normalizeForExternalMatch(name.value)
    if (key.length === 0) continue
    const existing = best.get(key)
    if (!existing || isStrongerName(name, existing)) {
      best.set(key, name)
    }
  }
  return [...best.values()]
}

/** candidate 是否比 incumbent 极性更强（rank 小优先；rank 同则 confidence 高优先）。 */
function isStrongerName(candidate: KnownName, incumbent: KnownName): boolean {
  const rc = KIND_POLARITY_RANK[candidate.kind]
  const ri = KIND_POLARITY_RANK[incumbent.kind]
  if (rc !== ri) return rc < ri
  return (candidate.confidence ?? -1) > (incumbent.confidence ?? -1)
}

/**
 * 加载某 catalog 的全部已知名（四标题字段 + 全量结构化别名，去重后）。
 * catalog 不存在 → 返 []。别名 kind 为 NULL → 兜底 `'aka'`（MUST-1A-6 不传 kinds 取全量）。
 */
export async function loadKnownNames(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<KnownName[]> {
  const catalog = await findCatalogById(db, catalogId)
  if (!catalog) return []

  const aliasRows = await listCatalogAliases(db, catalogId)
  const aliasNames: KnownName[] = aliasRows
    .filter((row) => isNonBlank(row.alias))
    .map((row) => ({
      value: row.alias,
      kind: (row.kind ?? 'aka') as KnownNameKind,
      source: row.source,
      lang: row.lang,
      confidence: row.confidence,
    }))

  return dedupKnownNames([...buildCatalogFieldNames(catalog), ...aliasNames])
}

/**
 * M2 打分极性投影（D-206-3 / ADR-175 D-175-4）：保留参与「相似度拉分」的 kind
 * `{title, official, original, localized}`，**额外排除 `source='crawler'` 别名**（MUST-1A-2，
 * crawler 可能写非-aka kind，泛词不进打分集）；canonical 标题字段（source='catalog'）不受此排除。
 *
 * romanization 仅参与召回不参与拉分（防拼音/罗马音误拉无关候选）；abbreviation/aka 不进打分集。
 * **max 相似度语义下（target 取 max 比对 candidate）localized 仅可能抬分不可能误压分**（MUST-1A-7）。
 * 不二次归一 value——归一/截断留消费方。
 */
export function filterForMatchScore(names: readonly KnownName[]): KnownName[] {
  return names.filter((n) => MATCH_SCORE_KINDS.has(n.kind) && n.source !== 'crawler')
}

/** filterForSearchQueries 优先级档位（数值越小越先发，MUST-1A-4）。返回 null = 不进搜索词集。 */
function searchTier(name: KnownName): number | null {
  if (name.kind === 'original') return 0
  if (name.kind === 'official') return name.lang === 'en' ? 1 : 2
  if (name.kind === 'romanization') return 3
  if (name.kind === 'title') return 4
  return null // abbreviation/aka/localized 不进搜索词集
}

/**
 * M5 外部搜索优先级序投影（D-206-2）：返回去重后**有序**列表，优先级
 * `[title_original(original), title_en(official+en), official-alias(其余), romanization, title]`；
 * 同档内 `confidence DESC NULLS LAST, value ASC`（确定性 + 高置信优先，MUST-1A-4）。
 *
 * abbreviation/aka/localized 不进搜索词集。**不截断、不早停、不去重发词**——N≤3 配额 / 逐词早停 /
 * 跨档去重发词在 1B（autoMatch）实现；本函数只产全量有序列表。不二次归一 value。
 */
export function filterForSearchQueries(names: readonly KnownName[]): KnownName[] {
  return names
    .map((name) => ({ name, tier: searchTier(name) }))
    .filter((x): x is { name: KnownName; tier: number } => x.tier !== null)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      const ca = a.name.confidence ?? -1
      const cb = b.name.confidence ?? -1
      if (ca !== cb) return cb - ca
      return a.name.value.localeCompare(b.name.value)
    })
    .map((x) => x.name)
}
