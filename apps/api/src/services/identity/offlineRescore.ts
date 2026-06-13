/**
 * offlineRescore.ts — 离线候选重算 job pipeline（ADR-105a D-105a-10 + D-105a-17 / CHG-VIR-8 + CHG-VIR-10）
 *
 * Blocking 多 key 并集召回（段 ① core_title_key 分桶 + 段 ② external_id 分桶，禁 pairwise 全量）
 * → 候选集收敛去重（全局 seen + MAX_BUCKET 护栏）→ 批量拉详情+facets+externalIds
 * → scorePair 评分 → 单事务幂等 upsert（pairScoringPersist 共享层，与 ingest shadow 同口径）。
 * advisory lock 单实例（参 auto-retire-line 范式）。cursor keyset 分批（防漂移）。
 *
 * blocking 数据源：① title_observations.parsed_facets_jsonb->>'coreTitleKey'（migration 085
 * shadow 写入 + 086 表达式索引）；② media_catalog 外部 ID 列 ∪ video_external_refs
 * manual_confirmed（Y-105a-4 双源 / blockingRecall.ts 真源）。
 */

import type { Pool, PoolClient } from 'pg'
import type pino from 'pino'
import { TITLE_PARSER_VERSION } from '../TitleIdentityParser'
import { fetchCoreKeyBuckets, fetchExternalIdBuckets, type BlockingBucket } from './blockingRecall'
import { scoreAndPersistPairs, buildSides } from './pairScoringPersist'
import { SCORER_VERSION } from './weights'

const ADVISORY_LOCK_KEY = 'worker:identity-rescore'

export interface IdentityRescoreOptions {
  readonly batchSize?: number // 单批桶数（cursor 分批 / 默认 500）
  readonly maxBucket?: number // 单桶 video 数护栏（防 C(N,2) 爆炸 / 默认 50）
  readonly parserVersion?: string
  readonly scorerVersion?: string
}

export interface IdentityRescoreResult {
  buckets: number
  /** 段 ② external_id 桶数（D-105a-17；含在 buckets 总数内） */
  externalIdBuckets: number
  pairs: number
  created: number
  superseded: number
  noop: number
  revived: number
  skippedRejected: number
  skippedLowScore: number
  bucketsSkippedOversize: number
  blocked: number
  /** D-105a-20：灰区窄切片准入数 */
  grayAdmitted: number
  durationMs: number
  lockSkipped?: boolean
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

/** 离线重算编排（advisory lock + 双段 cursor 循环全量）。 */
export async function runIdentityRescore(
  db: Pool,
  log: pino.Logger,
  opts: IdentityRescoreOptions = {},
): Promise<IdentityRescoreResult> {
  const startAt = Date.now()
  const result: IdentityRescoreResult = {
    buckets: 0, externalIdBuckets: 0, pairs: 0, created: 0, superseded: 0, noop: 0, revived: 0,
    skippedRejected: 0, skippedLowScore: 0, bucketsSkippedOversize: 0, blocked: 0, grayAdmitted: 0, durationMs: 0,
  }
  const parserVersion = opts.parserVersion ?? TITLE_PARSER_VERSION
  const scorerVersion = opts.scorerVersion ?? SCORER_VERSION
  const batchSize = opts.batchSize ?? 500
  const maxBucket = opts.maxBucket ?? 50
  const persistOpts = { parserVersion, scorerVersion, triggerSource: 'offline-rescore' as const }

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

    const processBuckets = async (buckets: BlockingBucket[], external: boolean): Promise<void> => {
      for (const bucket of buckets) {
        result.buckets++
        if (external) result.externalIdBuckets++
        if (bucket.videoIds.length > maxBucket) {
          result.bucketsSkippedOversize++
          log.warn({ bucket_key: bucket.bucketKey, size: bucket.videoIds.length, max: maxBucket },
            'identity-rescore: bucket exceeds MAX_BUCKET, skipping (防 C(N,2) 爆炸)')
          continue
        }
        const pairs = buildBucketPairs(bucket.videoIds, seen)
        if (pairs.length === 0) continue
        const videoIds = [...new Set(pairs.flat())]
        const sideMap = await buildSides(db, videoIds)
        await scoreAndPersistPairs(db, sideMap, pairs, persistOpts, result)
      }
    }

    // 段 ①：core_title_key 桶
    let cursor = ''
    for (;;) {
      const buckets = await fetchCoreKeyBuckets(db, parserVersion, cursor, batchSize)
      if (buckets.length === 0) break
      await processBuckets(buckets, false)
      cursor = buckets[buckets.length - 1]!.bucketKey
    }

    // 段 ②（D-105a-17）：external_id 桶并集（seen 全局去重 → 与段 ① 重复 pair 自动跳过）
    let extCursor = ''
    for (;;) {
      const buckets = await fetchExternalIdBuckets(db, extCursor, batchSize)
      if (buckets.length === 0) break
      await processBuckets(buckets, true)
      extCursor = buckets[buckets.length - 1]!.bucketKey
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
