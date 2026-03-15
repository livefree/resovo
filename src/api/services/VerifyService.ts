/**
 * VerifyService.ts — 播放源 URL 可用性检测服务
 * CRAWLER-03: HEAD 请求检测，维护 is_active 状态
 * 整合 CRAWLER-01 verifyWorker + DB 更新逻辑
 */

import type { Pool } from 'pg'
import { enqueueVerifySource, enqueueVerifySingle } from '@/api/workers/verifyWorker'
import { updateSourceActiveStatus } from '@/api/db/queries/sources'

// ── URL 检测 ──────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000  // 10 秒超时（同 verifyWorker）

export interface VerifyResult {
  sourceId: string
  url: string
  isActive: boolean
  statusCode: number | null
  durationMs: number
}

/**
 * HEAD 请求检测 URL 可达性。
 * HTTP 200 → active=true；4xx/5xx/超时 → active=false
 */
export async function checkSourceUrl(url: string): Promise<{ isActive: boolean; statusCode: number | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Resovo-Verifier/1.0' },
    })
    return { isActive: res.ok, statusCode: res.status }
  } catch {
    return { isActive: false, statusCode: null }
  } finally {
    clearTimeout(timer)
  }
}

// ── VerifyService 类 ──────────────────────────────────────────────

export class VerifyService {
  constructor(private db: Pool) {}

  /**
   * 立即验证单条播放源（同步执行，适合低频调用）
   * 更新 is_active + last_checked
   */
  async verifySourceNow(sourceId: string, url: string): Promise<VerifyResult> {
    const start = Date.now()
    const { isActive, statusCode } = await checkSourceUrl(url)

    await updateSourceActiveStatus(this.db, sourceId, isActive)

    return {
      sourceId,
      url,
      isActive,
      statusCode,
      durationMs: Date.now() - start,
    }
  }

  /**
   * 用户举报触发高优先级验证（写入 verify-queue，异步执行）
   */
  async verifyFromUserReport(sourceId: string, url: string): Promise<void> {
    await enqueueVerifySingle(sourceId, url)
  }

  /**
   * 批量调度验证所有活跃播放源（写入 verify-queue）
   * 每日凌晨 4:00 由定时任务调用
   */
  async scheduleAllActiveVerification(): Promise<{ enqueued: number }> {
    const result = await this.db.query<{ id: string; source_url: string }>(
      `SELECT id, source_url FROM video_sources
       WHERE is_active = true AND deleted_at IS NULL
       ORDER BY last_checked ASC NULLS FIRST
       LIMIT 10000`
    )

    let enqueued = 0
    for (const row of result.rows) {
      await enqueueVerifySource(row.id, row.source_url)
      enqueued++
    }

    process.stderr.write(`[VerifyService] scheduled ${enqueued} sources for verification\n`)
    return { enqueued }
  }
}
