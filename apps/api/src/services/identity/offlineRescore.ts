/**
 * offlineRescore.ts — 离线候选重算 job pipeline（ADR-105a D-105a-10 / CHG-VIR-8 Phase 2b）
 *
 * Blocking 多 key 并集召回（core_title_key 分桶，禁 pairwise 全量）→ 候选集收敛去重
 * （MAX_BUCKET 护栏）→ 批量拉详情+facets+externalIds → scorePair 评分 → 单事务幂等 upsert。
 * advisory lock 单实例（参 auto-retire-line 范式）。cursor keyset 分批（防漂移）。
 *
 * blocking 数据源（蓝图裁定 D）：title_observations.parsed_facets_jsonb->>'coreTitleKey'
 * （migration 085 已 shadow 写入，086 加表达式索引）。
 */

import type { Pool, PoolClient } from 'pg'
import type pino from 'pino'
import type { PairScore } from '@resovo/types'
import type { PairFieldSnapshot } from './evidenceHash'
import { parseTitle, TITLE_PARSER_VERSION } from '../TitleIdentityParser'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { scorePair, type PairSideInput } from './scorePair' // 直接用 scorePair 避免 ./index 循环依赖
import { computeEvidenceHash } from './evidenceHash'
import { upsertIdentityCandidate } from './candidateUpsert'
import { loadExternalIdSummaries } from './externalIdLoader'
import { SCORER_VERSION, THRESHOLD_CONFIG_VERSION, CANDIDATE_MIN_THRESHOLD } from './weights'

const ADVISORY_LOCK_KEY = 'worker:identity-rescore'

export interface IdentityRescoreOptions {
  readonly batchSize?: number // 单批桶数（cursor 分批 / 默认 500）
  readonly maxBucket?: number // 单桶 video 数护栏（防 C(N,2) 爆炸 / 默认 50）
  readonly parserVersion?: string
  readonly scorerVersion?: string
}

export interface IdentityRescoreResult {
  buckets: number
  pairs: number
  created: number
  superseded: number
  noop: number
  revived: number
  skippedRejected: number
  skippedLowScore: number
  bucketsSkippedOversize: number
  blocked: number
  durationMs: number
  lockSkipped?: boolean
}

interface BlockingBucket {
  readonly coreKey: string
  readonly videoIds: string[]
}

/** 段 1：core_title_key 分桶召回（keyset 分页，HAVING >1）。 */
async function fetchBlockingBuckets(
  db: Pool,
  parserVersion: string,
  cursor: string,
  batchSize: number,
): Promise<BlockingBucket[]> {
  const r = await db.query<{ core_key: string; video_ids: string[] }>(
    `SELECT t.parsed_facets_jsonb->>'coreTitleKey' AS core_key,
            ARRAY_AGG(DISTINCT t.video_id) AS video_ids
     FROM title_observations t
     JOIN videos v ON v.id = t.video_id AND v.deleted_at IS NULL
     WHERE t.parser_version = $1
       AND COALESCE(t.parsed_facets_jsonb->>'coreTitleKey', '') <> ''
       AND t.parsed_facets_jsonb->>'coreTitleKey' > $2
     GROUP BY core_key
     HAVING COUNT(DISTINCT t.video_id) > 1
     ORDER BY core_key ASC
     LIMIT $3`,
    [parserVersion, cursor, batchSize],
  )
  return r.rows.map((row) => ({ coreKey: row.core_key, videoIds: row.video_ids }))
}

/** 段 2：桶内生成 canonical unordered pair（left<right），全局去重。 */
function buildBucketPairs(videoIds: string[], seen: Set<string>): [string, string][] {
  const pairs: [string, string][] = []
  for (let i = 0; i < videoIds.length; i++) {
    for (let j = i + 1; j < videoIds.length; j++) {
      const [left, right] = [videoIds[i]!, videoIds[j]!].sort()
      const key = `${left}|${right}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push([left, right])
    }
  }
  return pairs
}

/** 段 3：拉 video 详情 + externalIds + parseTitle → PairSideInput[]。 */
async function buildSides(db: Pool, videoIds: string[]): Promise<Map<string, PairSideInput>> {
  const [details, extMap] = await Promise.all([
    fetchVideoDetailsForCandidates(db, videoIds),
    loadExternalIdSummaries(db, videoIds),
  ])
  const map = new Map<string, PairSideInput>()
  for (const d of details) {
    const parsed = parseTitle(d.title)
    map.set(d.id, {
      videoId: d.id,
      coreTitleKey: parsed.coreTitleKey,
      facets: parsed.facets,
      year: d.year,
      type: d.type,
      sourceSiteKeys: d.site_keys,
      externalIds: extMap.get(d.id),
    })
  }
  return map
}

function snapshot(s: PairSideInput): PairFieldSnapshot {
  return {
    coreTitleKey: s.coreTitleKey,
    year: s.year,
    type: s.type,
    seasonNumber: s.facets.seasonNumber,
    releaseMarker: s.facets.releaseMarker,
    episodeStructureDigest: '', // Phase 2b 占位（episode 证据细化时填 + bump SCORER_VERSION）
    metadataDigest: '',
  }
}

/** 外部引用摘要（确定性，canonical 顺序 / D-105a-8 ⑥）。 */
function externalRefSummary(left: PairSideInput, right: PairSideInput): string[] {
  const out: string[] = []
  for (const [p, id] of Object.entries(left.externalIds?.exactIds ?? {})) out.push(`L:${p}:${id}`)
  for (const [p, id] of Object.entries(right.externalIds?.exactIds ?? {})) out.push(`R:${p}:${id}`)
  return out
}

/** 段 4+5：评分 + 过滤 + 单事务 upsert（逐 pair 独立小事务，幂等保证重试安全）。 */
async function persistPairs(
  db: Pool,
  sideMap: Map<string, PairSideInput>,
  pairs: [string, string][],
  versions: { parserVersion: string; scorerVersion: string },
  result: IdentityRescoreResult,
): Promise<void> {
  const pairScores: PairScore[] = []
  for (const [a, b] of pairs) {
    const sa = sideMap.get(a)
    const sb = sideMap.get(b)
    if (sa && sb) pairScores.push(scorePair(sa, sb))
  }

  for (const ps of pairScores) {
    result.pairs++
    const blocked = ps.strongNegativeReasons.length > 0
    if (blocked) result.blocked++
    // D-105a-4：identityScore < 0.75 且无强负 → 'none'，不生成候选
    if (ps.identityScore < CANDIDATE_MIN_THRESHOLD && !blocked) {
      result.skippedLowScore++
      continue
    }
    const left = sideMap.get(ps.leftVideoId)
    const right = sideMap.get(ps.rightVideoId)
    if (!left || !right) continue
    const canonicalPairKey = `${ps.leftVideoId}|${ps.rightVideoId}`
    const evidenceHash = computeEvidenceHash({
      canonicalPairKey,
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [left.coreTitleKey, right.coreTitleKey],
      fieldSnapshot: { left: snapshot(left), right: snapshot(right) },
      externalRefSummary: externalRefSummary(left, right),
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    const outcome = await upsertIdentityCandidate(db, {
      leftVideoId: ps.leftVideoId,
      rightVideoId: ps.rightVideoId,
      canonicalPairKey,
      parserVersion: versions.parserVersion,
      scorerVersion: versions.scorerVersion,
      evidenceJsonb: ps.evidence,
      evidenceHash,
      legacyScore: null, // 跨 group 召回无对应 legacy group（D-105a schema nullable）
      identityScore: ps.identityScore,
      strongNegativeReasons: ps.strongNegativeReasons,
      triggerSource: 'offline-rescore',
      groupKey: null,
      evidenceItems: ps.evidence,
    })
    switch (outcome.kind) {
      case 'created': result.created++; break
      case 'superseded': result.superseded++; break
      case 'noop': result.noop++; break
      case 'revived': result.revived++; break
      case 'skipped-rejected': result.skippedRejected++; break
    }
  }
}

/** 离线重算编排（advisory lock + cursor 循环全量）。 */
export async function runIdentityRescore(
  db: Pool,
  log: pino.Logger,
  opts: IdentityRescoreOptions = {},
): Promise<IdentityRescoreResult> {
  const startAt = Date.now()
  const result: IdentityRescoreResult = {
    buckets: 0, pairs: 0, created: 0, superseded: 0, noop: 0, revived: 0,
    skippedRejected: 0, skippedLowScore: 0, bucketsSkippedOversize: 0, blocked: 0, durationMs: 0,
  }
  const parserVersion = opts.parserVersion ?? TITLE_PARSER_VERSION
  const scorerVersion = opts.scorerVersion ?? SCORER_VERSION
  const batchSize = opts.batchSize ?? 500
  const maxBucket = opts.maxBucket ?? 50

  const lockClient: PoolClient = await db.connect()
  let acquired = false
  let unlockFailed = false
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [ADVISORY_LOCK_KEY],
    )
    acquired = lock.rows[0]?.acquired === true
    if (!acquired) {
      log.info({ lock_key: ADVISORY_LOCK_KEY }, 'identity-rescore: another instance holds lock, skipping')
      result.durationMs = Date.now() - startAt
      result.lockSkipped = true
      return result
    }

    const seen = new Set<string>()
    let cursor = ''
    for (;;) {
      const buckets = await fetchBlockingBuckets(db, parserVersion, cursor, batchSize)
      if (buckets.length === 0) break
      for (const bucket of buckets) {
        result.buckets++
        if (bucket.videoIds.length > maxBucket) {
          result.bucketsSkippedOversize++
          log.warn({ core_key: bucket.coreKey, size: bucket.videoIds.length, max: maxBucket },
            'identity-rescore: bucket exceeds MAX_BUCKET, skipping (防 C(N,2) 爆炸)')
          continue
        }
        const pairs = buildBucketPairs(bucket.videoIds, seen)
        if (pairs.length === 0) continue
        const videoIds = [...new Set(pairs.flat())]
        const sideMap = await buildSides(db, videoIds)
        await persistPairs(db, sideMap, pairs, { parserVersion, scorerVersion }, result)
      }
      cursor = buckets[buckets.length - 1]!.coreKey
    }
  } finally {
    if (acquired) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [ADVISORY_LOCK_KEY])
      } catch (err) {
        unlockFailed = true
        log.warn({ err, lock_key: ADVISORY_LOCK_KEY }, 'identity-rescore: advisory_unlock failed; destroying connection')
      }
    }
    lockClient.release(unlockFailed ? new Error('identity-rescore: unlock failed; connection destroyed') : undefined)
  }

  result.durationMs = Date.now() - startAt
  // 对比聚合 metric（D-105a-10 / §6.2；consistent/new-recall 口径留报表脚本 countCompareBuckets）
  log.info({ stage: 'identity-rescore', ...result }, 'identity-rescore: done')
  return result
}
