/**
 * ContentService.ts — 播放源、投稿、字幕管理业务逻辑
 * CHG-15: 封装 admin/content.ts 的业务逻辑，替换内联 SQL
 */

import type { Pool } from 'pg'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as subtitleQueries from '@/api/db/queries/subtitles'
import { checkUrl } from '@/api/workers/verifyWorker'

const BATCH_VERIFY_CONCURRENCY = 5

export type SourceBatchVerifyScope = 'video' | 'site' | 'video_site'

export interface BatchVerifySourcesInput {
  scope: SourceBatchVerifyScope
  videoId?: string
  siteKey?: string
  activeOnly?: boolean
  limit?: number
}

export class ContentService {
  constructor(private db: Pool) {}

  // ── 播放源管理 ──────────────────────────────────────────────────

  async listSources(filters: sourcesQueries.AdminSourceListFilters): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const { rows, total } = await sourcesQueries.listAdminSources(this.db, filters)
    return { data: rows, total, page: filters.page, limit: filters.limit }
  }

  async deleteSource(id: string): Promise<boolean> {
    return sourcesQueries.deleteSource(this.db, id)
  }

  async batchDeleteSources(ids: string[]): Promise<number> {
    return sourcesQueries.batchDeleteSources(this.db, ids)
  }

  async verifySource(sourceId: string): Promise<{
    isActive: boolean
    responseMs: number
    statusCode: number | null
  } | null> {
    const source = await sourcesQueries.findSourceById(this.db, sourceId)
    if (!source) return null

    const start = Date.now()
    const { isActive, statusCode } = await checkUrl(source.sourceUrl)
    const responseMs = Date.now() - start

    await sourcesQueries.updateSourceActiveStatus(this.db, sourceId, isActive)

    return { isActive, responseMs, statusCode }
  }

  async batchVerifySources(input: BatchVerifySourcesInput): Promise<{
    scope: SourceBatchVerifyScope
    videoId: string | null
    siteKey: string | null
    activeOnly: boolean
    totalMatched: number
    processed: number
    activated: number
    inactivated: number
    timeout: number
    failed: number
    durationMs: number
  }> {
    const startedAt = Date.now()
    const activeOnly = input.activeOnly ?? true
    const limit = Math.max(1, Math.min(input.limit ?? 200, 500))
    const candidates = await sourcesQueries.listSourcesForBatchVerify(this.db, {
      scope: input.scope,
      videoId: input.videoId,
      siteKey: input.siteKey,
      activeOnly,
      limit,
    })

    let processed = 0
    let activated = 0
    let inactivated = 0
    let timeout = 0
    let failed = 0

    for (let i = 0; i < candidates.length; i += BATCH_VERIFY_CONCURRENCY) {
      const batch = candidates.slice(i, i + BATCH_VERIFY_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (source) => {
          try {
            const { isActive, statusCode } = await checkUrl(source.source_url)
            await sourcesQueries.updateSourceActiveStatus(this.db, source.id, isActive)
            return { ok: true as const, isActive, statusCode }
          } catch {
            return { ok: false as const }
          }
        }),
      )

      for (const result of results) {
        if (!result.ok) {
          failed += 1
          continue
        }

        processed += 1
        if (result.isActive) {
          activated += 1
        } else {
          inactivated += 1
        }
        if (result.statusCode === null) {
          timeout += 1
        }
      }
    }

    return {
      scope: input.scope,
      videoId: input.videoId ?? null,
      siteKey: input.siteKey ?? null,
      activeOnly,
      totalMatched: candidates.length,
      processed,
      activated,
      inactivated,
      timeout,
      failed,
      durationMs: Date.now() - startedAt,
    }
  }

  async updateSourceUrl(
    sourceId: string,
    newUrl: string
  ): Promise<{ id: string; source_url: string; is_active: boolean } | null> {
    return sourcesQueries.updateSourceUrl(this.db, sourceId, newUrl)
  }

  async getShellVideoCount(): Promise<{ count: number; videoIds: string[] }> {
    return sourcesQueries.countShellVideos(this.db)
  }

  // ── 投稿队列 ────────────────────────────────────────────────────

  async listSubmissions(
    page: number,
    limit: number,
    sortField?: string,
    sortDir?: 'asc' | 'desc'
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const { rows, total } = await sourcesQueries.listSubmissions(this.db, page, limit, sortField, sortDir)
    return { data: rows, total, page, limit }
  }

  async approveSubmission(id: string): Promise<boolean> {
    return sourcesQueries.approveSubmission(this.db, id)
  }

  async rejectSubmission(id: string, reason?: string): Promise<boolean> {
    return sourcesQueries.rejectSubmission(this.db, id, reason)
  }

  // ── 字幕审核 ────────────────────────────────────────────────────

  async listSubtitles(
    page: number,
    limit: number,
    sortField?: string,
    sortDir?: 'asc' | 'desc'
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const { rows, total } = await subtitleQueries.listAdminSubtitles(this.db, page, limit, sortField, sortDir)
    return { data: rows, total, page, limit }
  }

  async approveSubtitle(id: string): Promise<boolean> {
    return subtitleQueries.approveSubtitle(this.db, id)
  }

  async rejectSubtitle(id: string, reason?: string): Promise<boolean> {
    return subtitleQueries.rejectSubtitle(this.db, id, reason)
  }
}
