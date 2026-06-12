/**
 * videoRescore.ts — 单视频定向重评（BUGFIX-IDENTITY-ENRICH-RESCORE）
 *
 * 与 ingestShadow 的关系：共用底层原语（blockingRecall 双键召回 / buildSides /
 * scoreAndPersistPairs），编排器各自轻薄——本模块无 shadow bind 判定（那是 ingest
 * 时刻「新评分会绑哪个 catalog」的对照语义，重评场景不存在 legacy 绑定对照面）。
 * trigger_source='enrichment'（migration 111），与 ingest / offline-rescore 切片可区分。
 *
 * 触发：enrichment 外部 ID 绑定完成位点 → enqueueVideoRescore → worker
 * 'video-rescore' job。幂等：scoreAndPersistPairs 单事务 upsert（hash noop /
 * supersede / 复活链），重复触发无害。
 */

import type { Pool } from 'pg'
import type pino from 'pino'
import { TITLE_PARSER_VERSION } from '../TitleIdentityParser'
import { recallCoreKeyCounterparts, recallExternalIdCounterparts } from './blockingRecall'
import { scoreAndPersistPairs, buildSides, emptyPairPersistCounters } from './pairScoringPersist'
import type { PairPersistCounters } from './pairScoringPersist'
import { SCORER_VERSION } from './weights'

/** 单视频对侧召回上限（与 ingestShadow MAX_COUNTERPARTS 同值，防同名大桶放大）。 */
const MAX_COUNTERPARTS = 50

export interface VideoRescoreResult extends PairPersistCounters {
  /** 实际重评的视频数（软删/不存在的输入自动跳过） */
  videos: number
  counterparts: number
  durationMs: number
}

export async function runVideoRescore(
  db: Pool,
  log: pino.Logger,
  videoIds: readonly string[],
  // GOV-4：触发来源参数化（缺省 'enrichment' 兼容既有调用方；标题变更传 'title_change'）
  triggerSource: 'enrichment' | 'title_change' = 'enrichment',
): Promise<VideoRescoreResult> {
  const startAt = Date.now()
  const parserVersion = TITLE_PARSER_VERSION
  const scorerVersion = SCORER_VERSION
  const counters = emptyPairPersistCounters()
  let videos = 0
  let counterpartsTotal = 0

  // buildSides 一次拿到 self 的 coreTitleKey + 双源外部 ID（与评分输入同口径）
  const selfSides = await buildSides(db, [...videoIds])

  for (const videoId of videoIds) {
    const self = selfSides.get(videoId)
    if (!self) continue // 软删 / 不存在 → 跳过（job 容错，不抛）
    videos++

    const extBucketKeys = Object.entries(self.externalIds?.exactIds ?? {}).map(
      ([p, id]) => `${p}:${id}`,
    )

    const counterpartIds = new Set<string>()
    if (self.coreTitleKey !== '') {
      for (const vid of await recallCoreKeyCounterparts(
        db, parserVersion, self.coreTitleKey, videoId, MAX_COUNTERPARTS,
      )) {
        counterpartIds.add(vid)
      }
    }
    for (const vid of await recallExternalIdCounterparts(db, extBucketKeys, videoId, MAX_COUNTERPARTS)) {
      counterpartIds.add(vid)
    }
    if (counterpartIds.size === 0) continue

    // 确定性截断（与 ingestShadow 同口径）
    const counterparts = [...counterpartIds].sort().slice(0, MAX_COUNTERPARTS)
    counterpartsTotal += counterparts.length

    const sideMap = await buildSides(db, [videoId, ...counterparts])
    const pairs: [string, string][] = []
    for (const c of counterparts) {
      if (!sideMap.has(c) || !sideMap.has(videoId)) continue
      const [left, right] = [videoId, c].sort()
      pairs.push([left!, right!])
    }

    await scoreAndPersistPairs(
      db, sideMap, pairs,
      { parserVersion, scorerVersion, triggerSource },
      counters,
    )
  }

  const result: VideoRescoreResult = {
    ...counters,
    videos,
    counterparts: counterpartsTotal,
    durationMs: Date.now() - startAt,
  }
  log.info(
    {
      stage: 'video-rescore',
      input_videos: videoIds.length,
      rescored_videos: videos,
      counterparts: counterpartsTotal,
      pairs: counters.pairs,
      created: counters.created,
      superseded: counters.superseded,
      revived: counters.revived,
      noop: counters.noop,
      skipped_low_score: counters.skippedLowScore,
      blocked: counters.blocked,
      duration_ms: result.durationMs,
    },
    'video-rescore: done',
  )
  return result
}
