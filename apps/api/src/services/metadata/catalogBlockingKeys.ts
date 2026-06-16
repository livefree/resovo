/**
 * catalogBlockingKeys.ts — catalog blocking 归一键写键 service（ADR-206 §META-50-2A / M-2A-1/2 / 2A-1）
 *
 * 把 catalog 的 knownNames（1A loadKnownNames 投影）经 D-206-6(b) 进桶阈值过滤 + normalizeForExternalMatch
 * 归一，重算落 `catalog_blocking_alias_keys` 派生表（blocking 召回 + evidence_hash 用，不进评分）。
 *
 * 口径单一真源（M-2A-1）：归一键 = normalizeForExternalMatch（与 knownNames.ts dedupKnownNames 同源），
 * SQL 只读不算键。loadKnownNames 已按归一键去重保最强源 → 过滤后归一键天然唯一（单 catalog 单键单行）。
 */

import type { Pool, PoolClient } from 'pg'
import { loadKnownNames, CATALOG_FIELD_SOURCE, type KnownName } from './knownNames'
import { normalizeForExternalMatch } from '../TitleNormalizer'
import {
  replaceCatalogBlockingAliasKeys,
  type CatalogBlockingAliasKeyRow,
} from '@/api/db/queries/catalogBlockingAliasKeys'

/** D-206-6(b) 非 manual 来源进桶白名单 kind。 */
const BUCKET_NON_MANUAL_KINDS: ReadonlySet<string> = new Set(['official', 'localized', 'aka', 'original'])
/** D-206-6(b) 非 manual 来源进桶置信下限。 */
const BUCKET_MIN_CONFIDENCE = 0.8

/**
 * D-206-6(b) 进桶阈值（M-2A-2，1A↔2A 衔接关键）：
 *   - `source==='catalog'`（1A 哨兵=canonical 标题字段）→ 恒进桶（confidence 视 1.0，**不受 D-206-6(b)
 *     白名单约束**——否则三 canonical 标题字段含主标题 'title' kind 全被拒、海贼王↔航海王主修复失效）；
 *   - `source==='manual'` → 恒进桶（D-206-6(b) manual=1.0）；
 *   - `source==='crawler'` → 一律不进（防泛词爆量召回）；
 *   - `confidence IS NULL` 且非 manual/catalog → 不进；
 *   - `source∈{tmdb,bangumi,douban}` 且 `kind∈{official,localized,aka,original}` 且 `confidence≥0.80` → 进。
 */
export function qualifiesForBlockingBucket(name: KnownName): boolean {
  if (name.source === CATALOG_FIELD_SOURCE || name.source === 'manual') return true
  if (name.source === 'crawler') return false
  if (name.confidence == null) return false
  return BUCKET_NON_MANUAL_KINDS.has(name.kind) && name.confidence >= BUCKET_MIN_CONFIDENCE
}

/**
 * 把 catalog 的 knownNames 投影为合格 blocking 归一键行（纯函数，便于单测）。
 * loadKnownNames 已按归一键去重 → 过滤 + 归一后键唯一；空键剔除。
 */
export function projectBlockingKeyRows(names: readonly KnownName[]): CatalogBlockingAliasKeyRow[] {
  const out: CatalogBlockingAliasKeyRow[] = []
  const seen = new Set<string>()
  for (const name of names) {
    if (!qualifiesForBlockingBucket(name)) continue
    const normalizedKey = normalizeForExternalMatch(name.value)
    if (normalizedKey.length === 0 || seen.has(normalizedKey)) continue
    seen.add(normalizedKey)
    out.push({
      normalizedKey,
      source: name.source,
      kind: name.kind,
      confidence: name.source === CATALOG_FIELD_SOURCE || name.source === 'manual' ? 1.0 : name.confidence,
    })
  }
  return out
}

/**
 * 重算某 catalog 的 blocking 归一键并全量替换落库（写键入口）。
 * 加性调用——在 catalog 标题/别名变更位点（enrich reconcile 后 / 手动编辑）之后追加，
 * 不改既有写语义（D-206-8 不开第二写入方）。catalog 不存在 → loadKnownNames 返 []→清空键。
 */
export async function recomputeCatalogBlockingKeys(
  db: Pool | PoolClient,
  catalogId: string,
): Promise<void> {
  const names = await loadKnownNames(db, catalogId)
  const rows = projectBlockingKeyRows(names)
  await replaceCatalogBlockingAliasKeys(db, catalogId, rows)
}
