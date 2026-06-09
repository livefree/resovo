/**
 * NavCountsService.ts — 侧边栏 5 模块"待处理积压"计数聚合（ADR-190 / NTLG-P0-1）
 *
 * 设计（ADR-190 §决策要点）：
 *   - 逐模块容错（§11 D8）：每计数独立 try/catch，失败/无权 → 进 omitted，不拖垮整包。
 *   - 角色门控（D-190-4，真源=各模块主读路由 preHandler，2026-06-09 快照）：
 *       moderation / sources / userSubmissions → admin + moderator
 *       imageHealth / merge                   → admin only
 *   - SQL 落 queries 层（db-rules）：Service 只编排，调既有/新增 query 函数，不直写 SQL。
 *   - 计数口径=各模块待处理积压：
 *       moderation      → pending 审核（countPendingModeration）
 *       sources         → 失效线路 all_dead（getVideoGroupStats().dead）
 *       imageHealth     → 近 7 天未解决损坏图片（getImageHealthStats().brokenLast7Days）
 *       userSubmissions → pending 投稿（countPendingSubmissions）
 *       merge           → pending 合并候选 total（VideoMergesService.listCandidates，行为保真）
 */

import type { Pool } from 'pg'
import type { AdminNavCountKey, AdminNavCounts } from '@resovo/types'
import { baseLogger } from '@/api/lib/logger'
import { countPendingModeration } from '@/api/db/queries/moderation'
import { getVideoGroupStats } from '@/api/db/queries/sources-matrix'
import { getImageHealthStats } from '@/api/db/queries/imageHealth'
import { countPendingSubmissions } from '@/api/db/queries/userSubmissions'
import { VideoMergesService } from '@/api/services/VideoMergesService'
import { ListCandidatesSchema } from '@/api/services/VideoMergesService.schemas'

export type NavCountRole = 'admin' | 'moderator'

/** 角色 → 可见模块（真源：各模块主读路由 preHandler，YL3 快照 2026-06-09） */
const MODULE_ROLES: Record<AdminNavCountKey, ReadonlyArray<NavCountRole>> = {
  moderation: ['admin', 'moderator'],
  sources: ['admin', 'moderator'],
  imageHealth: ['admin'],
  userSubmissions: ['admin', 'moderator'],
  merge: ['admin'],
}

const MODULE_KEYS: ReadonlyArray<AdminNavCountKey> = [
  'moderation',
  'sources',
  'imageHealth',
  'userSubmissions',
  'merge',
]

export interface NavCountsResult {
  counts: AdminNavCounts
  partial: boolean
  omitted: AdminNavCountKey[]
}

export class NavCountsService {
  constructor(private readonly db: Pool) {}

  /** 按调用方角色聚合可见模块计数；逐模块容错（失败/无权 → omitted）。 */
  async getCounts(role: NavCountRole): Promise<NavCountsResult> {
    const counts: Record<string, number> = {}
    const omitted: AdminNavCountKey[] = []

    await Promise.all(
      MODULE_KEYS.map(async (key) => {
        if (!MODULE_ROLES[key].includes(role)) {
          omitted.push(key)
          return
        }
        try {
          counts[key] = await this.fetchOne(key)
        } catch (err) {
          omitted.push(key)
          baseLogger.warn({ err, module: key }, '[NavCountsService] module count failed (degraded)')
        }
      }),
    )

    return { counts, partial: omitted.length > 0, omitted }
  }

  private async fetchOne(key: AdminNavCountKey): Promise<number> {
    switch (key) {
      case 'moderation':
        return countPendingModeration(this.db)
      case 'sources':
        return (await getVideoGroupStats(this.db)).dead
      case 'imageHealth':
        return (await getImageHealthStats(this.db)).brokenLast7Days
      case 'userSubmissions':
        return countPendingSubmissions(this.db)
      case 'merge': {
        // 复用 candidates 路径（identity 优先，空表降级 legacy；minScore 不影响 total）——行为保真。
        const params = ListCandidatesSchema.parse({ source: 'identity', minScore: 0, limit: 1, page: 1 })
        const result = await new VideoMergesService(this.db).listCandidates(params)
        return result.total
      }
    }
  }
}
