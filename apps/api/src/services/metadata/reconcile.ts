/**
 * reconcile.ts — 多源元数据逐字段裁决编排（gather → reconcile → write）
 *
 * META-49-B2（ADR-205 D-205-1/D-205-3/D-205-4 / 方案 X）：取代 B1 过渡期的"立即 safeUpdate"。
 * 各源（bangumi/tmdb）剥离上抛的内容标量 proposedFields 在此统一裁决：
 *   1. gather：各源 proposedFields 二次拆分（reconcileFields ∩ 白名单 / passthroughFields ∖）。
 *   2. reconcile：逐白名单组 canonical 比较 + trust 加权裁决 winner；≥2 源归一后不一致 → 非 winner 标 conflict。
 *   3. write：新事务按 winner.source 优先级升序分组 safeUpdate（winner content + 该源 passthrough），
 *      M1 方案 A 据 safeUpdate skippedFields 回填 applied（winner 被优先级闸门拦 → applied=false=proposal-only）；
 *      batchUpsertFieldProposals 落表（含 is_winner/applied/conflict_state，49-C derive 消费）。
 *
 * 身份副作用（ref/cache/redirect/episodes/characters/type）已在各源自有事务写（B1 方案 X），不到本层。
 * douban Step1/2 仍直接 safeUpdate（不进 gather，留 49-D cutover）；其已写内容由本层 winner 经优先级闸门覆盖。
 */

import type { Pool } from 'pg'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import { batchUpsertFieldProposals, type FieldProposalInput } from '@/api/db/queries/metadata-field-proposals'
import { baseLogger } from '@/api/lib/logger'
import { MediaCatalogService, CATALOG_SOURCE_PRIORITY, type CatalogMetadataSource } from '../MediaCatalogService'
import { RECONCILE_GROUPS, splitReconcilePassthrough, canonicalizeValue, type ReconcileGroup } from './reconcile.canonical'

/** reconcile 字段级冲突标记（partial index `WHERE conflict_state IS NOT NULL`，49-C derive 消费）。 */
const CONFLICT_STATE = 'conflict'

/** trust 与 confidence 均相等时的 tie-break 源序：anime bangumi 优先（ADR-161 决策要点 2）。 */
const SOURCE_TIE_RANK: Record<string, number> = { bangumi: 0, tmdb: 1, douban: 2 }

// ── 输入 ──────────────────────────────────────────────────────────

export interface ReconcileSource {
  source: CatalogMetadataSource
  /** 该源外部引用（safeUpdate provenance / proposals source_ref）。 */
  sourceRef: string
  /** 该源整体匹配置信度（reconcile winner tie-break + proposals confidence）。 */
  confidence: number
  /** B1 剥离上抛的内容标量 proposedFields（含白名单内容 + 非白名单 passthrough）。 */
  fields: CatalogUpdateData
}

// ── 内部结构 ──────────────────────────────────────────────────────

interface PreparedSource {
  source: CatalogMetadataSource
  sourceRef: string
  confidence: number
  reconcileFields: CatalogUpdateData
  passthroughFields: CatalogUpdateData
}

interface Candidate {
  source: CatalogMetadataSource
  sourceRef: string
  confidence: number
  /** 组主字段值（canonical 比较 + proposals proposed_value）。 */
  mainValue: unknown
  /** 该源在本组实际提供的字段子集（winner 时整组写入）。 */
  groupFields: CatalogUpdateData
}

interface GroupDecision {
  /** = group.main（proposals field_name）。 */
  field: string
  candidates: Candidate[]
  winner: Candidate
  /** ≥2 源归一后主字段不一致。 */
  conflict: boolean
}

// ── 裁决 ──────────────────────────────────────────────────────────

/** winner 优先级：trust 降序 → confidence 降序 → 固定源序（bangumi 优先）。 */
function compareCandidate(a: Candidate, b: Candidate): number {
  const ta = CATALOG_SOURCE_PRIORITY[a.source] ?? 0
  const tb = CATALOG_SOURCE_PRIORITY[b.source] ?? 0
  if (ta !== tb) return tb - ta
  if (a.confidence !== b.confidence) return b.confidence - a.confidence
  return (SOURCE_TIE_RANK[a.source] ?? 9) - (SOURCE_TIE_RANK[b.source] ?? 9)
}

function decideGroup(group: ReconcileGroup, sources: PreparedSource[]): GroupDecision | null {
  const candidates: Candidate[] = []
  for (const s of sources) {
    const mainValue = (s.reconcileFields as Record<string, unknown>)[group.main as string]
    if (mainValue === undefined) continue
    const groupFields: CatalogUpdateData = {}
    for (const f of group.fields) {
      const v = (s.reconcileFields as Record<string, unknown>)[f as string]
      if (v !== undefined) (groupFields as Record<string, unknown>)[f as string] = v
    }
    candidates.push({ source: s.source, sourceRef: s.sourceRef, confidence: s.confidence, mainValue, groupFields })
  }
  if (candidates.length === 0) return null

  const keys = candidates.map((c) => canonicalizeValue(group.main as string, c.mainValue))
  const conflict = candidates.length > 1 && keys.some((k) => k !== keys[0])
  const winner = [...candidates].sort(compareCandidate)[0]
  return { field: group.main as string, candidates, winner, conflict }
}

// ── 编排 ──────────────────────────────────────────────────────────

/**
 * reconcile 主入口：裁决各源内容标量 + passthrough 直写 + proposals 落表（单事务）。
 * @param sources 仅传内容标量 proposedFields 非空的源（bangumi/tmdb；douban 不进，留 49-D）。
 */
export async function reconcileMetadata(
  db: Pool,
  catalogId: string,
  sources: ReconcileSource[],
): Promise<void> {
  if (sources.length === 0) return

  const prepared: PreparedSource[] = sources.map((s) => {
    const { reconcileFields, passthroughFields } = splitReconcilePassthrough(s.fields)
    return { source: s.source, sourceRef: s.sourceRef, confidence: s.confidence, reconcileFields, passthroughFields }
  })

  // 逐组裁决
  const decisions: GroupDecision[] = []
  for (const group of RECONCILE_GROUPS) {
    const d = decideGroup(group, prepared)
    if (d) decisions.push(d)
  }

  // 按源归集写入字段：winner content（整组）+ 该源 passthrough（保 B1 行为等价）
  const writesBySource = new Map<CatalogMetadataSource, CatalogUpdateData>()
  const sourceRefBySource = new Map<CatalogMetadataSource, string>()
  for (const s of prepared) {
    writesBySource.set(s.source, {})
    sourceRefBySource.set(s.source, s.sourceRef)
  }
  for (const d of decisions) {
    Object.assign(writesBySource.get(d.winner.source) as CatalogUpdateData, d.winner.groupFields)
  }
  for (const s of prepared) {
    if (Object.keys(s.passthroughFields).length > 0) {
      Object.assign(writesBySource.get(s.source) as CatalogUpdateData, s.passthroughFields)
    }
  }

  const catalogService = new MediaCatalogService(db)
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 优先级升序写入：高优先级 winner 最后定 catalog.metadata_source（last-writer 粗粒度，
    // 字段级真源由 video_metadata_provenance 承载）。winner 用自身 source → 优先级闸门即 M1 方案 A。
    const orderedSources = [...writesBySource.keys()].sort(
      (a, b) =>
        (CATALOG_SOURCE_PRIORITY[a] ?? 0) - (CATALOG_SOURCE_PRIORITY[b] ?? 0) ||
        (SOURCE_TIE_RANK[a] ?? 9) - (SOURCE_TIE_RANK[b] ?? 9),
    )
    const skippedBySource = new Map<CatalogMetadataSource, Set<string>>()
    for (const source of orderedSources) {
      const fields = writesBySource.get(source) as CatalogUpdateData
      if (Object.keys(fields).length === 0) {
        skippedBySource.set(source, new Set())
        continue
      }
      const { skippedFields } = await catalogService.safeUpdate(catalogId, fields, source, {
        sourceRef: sourceRefBySource.get(source),
        db: client,
      })
      skippedBySource.set(source, new Set(skippedFields))
    }

    // proposals：每组每源一行；applied 据 winner.source 的 skippedFields 回填（M1 方案 A proposal-only）
    const proposals: FieldProposalInput[] = []
    for (const d of decisions) {
      const winnerSkipped = skippedBySource.get(d.winner.source) ?? new Set<string>()
      for (const c of d.candidates) {
        const isWinner = c.source === d.winner.source
        proposals.push({
          fieldName: d.field,
          sourceKind: c.source,
          sourceRef: c.sourceRef,
          proposedValue: c.mainValue,
          confidence: c.confidence,
          isWinner,
          applied: isWinner && !winnerSkipped.has(d.field),
          conflictState: d.conflict && !isWinner ? CONFLICT_STATE : null,
        })
      }
    }
    await batchUpsertFieldProposals(client, catalogId, proposals)

    await client.query('COMMIT')

    baseLogger.child({ module: 'metadata-reconcile', catalog_id: catalogId }).info(
      {
        groups: decisions.length,
        conflicts: decisions.filter((d) => d.conflict).length,
        sources: prepared.map((s) => s.source),
      },
      'metadata reconcile complete',
    )
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* connection may already be lost */
    }
    throw err
  } finally {
    client.release()
  }
}
