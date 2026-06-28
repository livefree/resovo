/**
 * enrich-status-guard.ts — enrich 写列一致性守卫（ADR-216 D-216-3 / META-57）
 *
 * 根因封堵：60/60 douban 漂移行满足 `ref.linked_at ≤ enriched_at`——identity 子系统先写 applied
 * ref，enrich 重跑按自身判据判 unmatched 覆写 `videos.{douban,bangumi}_status` 列。本守卫在
 * enrich/bangumi 写列前拦截「已有 applied ref 仍降 unmatched」：computed='unmatched' 且该 video
 * 已有 applied <provider> primary ref → 返回 'matched'（反映 ref 真相）。
 *
 * **仅守 unmatched 降级**（matched/candidate/pending 原样返回）——不完全停写、列仍随 refs 演进
 * （ADR-216 D-216-3 / Codex r1 B-2：完全停写 + 列冻结留 META-60，读路径全迁后）。
 *
 * applied 判据与 DC-216-1 `videoRefAppliedSql` **同源**（共享 `VIDEO_REF_APPLIED_MATCH_STATUSES`
 * + 强制 is_primary），不再造第四套判据。
 */

import type { Pool, PoolClient } from 'pg'
import type { ExternalRefProvider } from '@/types'
import { findPrimaryVideoExternalRef } from '@/api/db/queries/externalData'
import { isVideoRefApplied } from '@/api/db/queries/video-ref-applied'

/** enrich/bangumi 写列态域（与 DoubanStatus / BangumiStatus 同构 4 态）。 */
type EnrichMatchStatus = 'pending' | 'matched' | 'candidate' | 'unmatched'

/**
 * 该 video 是否已有 applied `<provider>` primary ref。
 * 复用既有 `findPrimaryVideoExternalRef`（primary ref）+ DC-216-1 `isVideoRefApplied`（applied 判定，
 * 单一真源 `VIDEO_REF_APPLIED_MATCH_STATUSES` + is_primary），不再造判据/查询。
 * 接受 `Pool | PoolClient`：供 BangumiService 事务内（PoolClient）与 enrich 无事务（Pool）共用。
 */
export async function hasAppliedVideoRef(
  db: Pool | PoolClient,
  videoId: string,
  provider: ExternalRefProvider,
): Promise<boolean> {
  const ref = await findPrimaryVideoExternalRef(db, videoId, provider)
  return ref != null && isVideoRefApplied(ref.matchStatus, ref.isPrimary)
}

/**
 * enrich 写列一致性守卫：computed='unmatched' 但已有 applied `<provider>` ref → 返回 'matched'，
 * 否则原样返回。仅守 unmatched 降级（消除 ref↔列覆写竞态）。
 */
export async function guardEnrichStatusAgainstAppliedRef<S extends EnrichMatchStatus>(
  db: Pool | PoolClient,
  videoId: string,
  provider: ExternalRefProvider,
  computed: S,
): Promise<S | 'matched'> {
  if (computed !== 'unmatched') return computed
  return (await hasAppliedVideoRef(db, videoId, provider)) ? 'matched' : computed
}
