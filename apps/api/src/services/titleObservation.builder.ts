/**
 * titleObservation.builder.ts — title_observations 写入入参组装（SEQ-20260602-03 / CHG-VIR-6 / Phase 1b）
 *
 * Service 层 helper：由原始标题确定性组装 `TitleObservationInput`（`parseTitle` facets 快照 +
 * sha256 raw_title_hash），再传纯入参给 DB query 层 `recordTitleObservation`。
 *
 * 分层：解析/哈希属业务组装，留在 Service 层（与 `normalizeMergeKey` 在 Service 算好再传 string 给
 * query 的既有范式一致），使 `db/queries/titleObservations.ts` 保持「仅 DB query、不 import Service」。
 * 独立模块（非 CrawlerService 私有）：供 Phase 2 离线 job 等其他写入方复用，且可直接单测。
 */

import { createHash } from 'node:crypto'
import { parseTitle } from './TitleIdentityParser'
import type { TitleObservationInput } from '@/api/db/queries/titleObservations'

/**
 * 由原始标题构造观测入参。确定性（除 `parseTitle` 解析与 sha256 计算外无副作用）。
 *
 * @param sourceName site 级标题观测默认 null（同一 video.title 对全源一致，不按 source 拆行徒增噪声）
 */
export function buildTitleObservation(
  videoId: string,
  rawTitle: string,
  sourceSiteKey: string | null,
  sourceName: string | null = null,
): TitleObservationInput {
  const parsed = parseTitle(rawTitle)
  return {
    videoId,
    sourceSiteKey,
    sourceName,
    rawTitle,
    rawTitleHash: createHash('sha256').update(rawTitle).digest('hex'),
    parserVersion: parsed.parserVersion,
    parsedFacets: {
      coreTitleKey: parsed.coreTitleKey,
      titleKind: parsed.titleKind,
      confidence: parsed.confidence,
      facets: parsed.facets,
    },
  }
}
