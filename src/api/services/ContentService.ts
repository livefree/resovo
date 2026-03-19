/**
 * ContentService.ts — 播放源、投稿、字幕管理业务逻辑
 * CHG-15: 封装 admin/content.ts 的业务逻辑，替换内联 SQL
 */

import type { Pool } from 'pg'
import * as sourcesQueries from '@/api/db/queries/sources'
import * as subtitleQueries from '@/api/db/queries/subtitles'
import { checkUrl } from '@/api/workers/verifyWorker'

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

  // ── 投稿队列 ────────────────────────────────────────────────────

  async listSubmissions(page: number, limit: number): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const { rows, total } = await sourcesQueries.listSubmissions(this.db, page, limit)
    return { data: rows, total, page, limit }
  }

  async approveSubmission(id: string): Promise<boolean> {
    return sourcesQueries.approveSubmission(this.db, id)
  }

  async rejectSubmission(id: string): Promise<boolean> {
    return sourcesQueries.rejectSubmission(this.db, id)
  }

  // ── 字幕审核 ────────────────────────────────────────────────────

  async listSubtitles(page: number, limit: number): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const { rows, total } = await subtitleQueries.listAdminSubtitles(this.db, page, limit)
    return { data: rows, total, page, limit }
  }

  async approveSubtitle(id: string): Promise<boolean> {
    return subtitleQueries.approveSubtitle(this.db, id)
  }

  async rejectSubtitle(id: string): Promise<boolean> {
    return subtitleQueries.rejectSubtitle(this.db, id)
  }
}
