/**
 * SourceProbeService.ts — 单源/批量 inline 诊断动作（probe / render-check）
 *
 * CHG-357 / arch-reviewer (claude-opus-4-7) I1 + R2：从 SourcesMatrixService 抽出
 *   - 解决 file-size BLOCKER（SourcesMatrixService 551 行 + CHG-357 ~80 行 → 超 500 红线）
 *   - 抽 probeOneInternal / renderCheckOneInternal 公共方法供 batch 复用
 *
 * 真源：
 *   - ADR-158（单源 inline probe + render-check 端点协议）
 *   - ADR-158 AMENDMENT 2026-05-27（CHG-356）：BREAKING 同步快探 + UPDATE DB
 *   - ADR-158 AMENDMENT 2 2026-05-27（CHG-357）：视频级 batch 端点 + 抽 internal 方法
 *
 * 关键约束：
 *   - probe 守 freeze / render-check 不守（D-158-5 / diagnostic 可用性优先）
 *   - latency_ms 失败必 NULL（防 aggregate.computeMedian 0 值污染 / I1）
 *   - UPDATE 失败 → throw → audit 不写（D-158-7 / ADR-121 D-121-4）
 *   - source_health_events 必写（R3 / origin=manual_recheck|render_check / processed_at=NOW）
 *   - batch 入口写 1 条 summary audit + internal skipAudit=true（C2 / batch 范式对齐 disable_dead_batch）
 *   - actionType: single=video_source.inline_action / batch=video_source.batch_inline_action（C / 新增 1 项）
 */

import type { Pool } from 'pg'
import {
  findVideoSourceById,
  listVideoSources,
  updateSourceHealthAfterProbe,
  updateSourceHealthAfterRenderCheck,
} from '@/api/db/queries/video_sources'
import { insertHealthEvent } from '@/api/db/queries/sourceHealthEvents'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import type { VideoSourceLine } from '@resovo/types'

// ── 响应类型（公开契约 / ADR-158 AMENDMENT 1+2）─────────────────────

export interface SingleSourceProbeResult {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null
  readonly queued: false
}

export interface SingleSourceRenderCheckResult {
  readonly sourceId: string
  readonly newRenderStatus: 'ok' | 'dead'
  readonly queued: false
}

export interface BatchProbeResultItem {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null
  readonly error?: string
}

export interface BatchProbeResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchProbeResultItem>
  readonly summary: {
    readonly total: number
    readonly ok: number
    readonly dead: number
    readonly failed: number
  }
}

export interface BatchRenderCheckResultItem {
  readonly sourceId: string
  readonly newRenderStatus: 'ok' | 'dead'
  readonly error?: string
}

export interface BatchRenderCheckResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchRenderCheckResultItem>
  readonly summary: {
    readonly total: number
    readonly ok: number
    readonly dead: number
    readonly failed: number
  }
}

// ── 内部常量 ─────────────────────────────────────────────────────────

// I3 已知限制：HEAD + Content-Type 仅 reachability 强化版，不是 playability
const VIDEO_CONTENT_TYPE_RE = /video\/|application\/vnd\.apple\.mpegurl|application\/x-mpegurl/i

// F2 并发分批上限（防大视频 100+ source 打爆 / N+1 outbound HEAD）
const BATCH_CONCURRENCY = 5

// ── Service ─────────────────────────────────────────────────────────

export class SourceProbeService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  // ── 私有：freeze 守卫（与 SourcesMatrixService 同模式） ──────────

  private async assertNotFrozen(): Promise<void> {
    const freeze = await systemSettingsQueries.getSetting(this.db, 'crawler_global_freeze')
    if (freeze === 'true') {
      throw new AppError('STATE_CONFLICT', '采集已冻结，不可执行线路操作', 409)
    }
  }

  // ── 私有：探测单 URL（probeUrlHead 公共方法 / R2 抽出 / DRY）─────

  /**
   * 探测单个 source URL — R2 公共方法
   * @returns ok=true 时 latencyMs 是测量值；ok=false 时 latencyMs 必为 null（I1 防中位数污染）
   */
  private async probeUrlHead(
    url: string,
    contentTypeCheck: boolean,
  ): Promise<{ ok: boolean; latencyMs: number | null; httpCode: number | null }> {
    const start = performance.now()
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })
      const httpStatusOk = res.ok && res.status < 400
      if (!httpStatusOk) {
        return { ok: false, latencyMs: null, httpCode: res.status }
      }
      if (contentTypeCheck) {
        const contentType = res.headers.get('content-type') ?? ''
        if (!VIDEO_CONTENT_TYPE_RE.test(contentType)) {
          return { ok: false, latencyMs: null, httpCode: res.status }
        }
      }
      return { ok: true, latencyMs: Math.round(performance.now() - start), httpCode: res.status }
    } catch {
      // timeout / 网络错误 / 405 / 403 (CDN 防盗链) → dead (Y3 已知限制)
      return { ok: false, latencyMs: null, httpCode: null }
    }
  }

  // ── 私有：probeOneInternal — R2 接收已查 source / 避免 N 次 findVideoSourceById ──

  /**
   * 接收已查 source / 跳过 freeze + audit（batch 复用 / R2 + A2）
   * source_health_events 仍写（每源 1 条 / I3 数据完整性 / batch audit 是 summary）
   */
  private async probeOneInternal(
    source: VideoSourceLine,
    actorId: string,
    opts: { skipAudit: boolean; requestId?: string | null },
  ): Promise<{ newProbeStatus: 'ok' | 'dead'; latencyMs: number | null; httpCode: number | null }> {
    const { ok, latencyMs, httpCode } = await this.probeUrlHead(source.sourceUrl, false)
    const newProbeStatus: 'ok' | 'dead' = ok ? 'ok' : 'dead'

    await updateSourceHealthAfterProbe(this.db, source.id, { probeStatus: newProbeStatus, latencyMs })

    await insertHealthEvent(this.db, {
      videoId: source.videoId,
      sourceId: source.id,
      origin: 'manual_recheck',
      oldStatus: source.probeStatus,
      newStatus: newProbeStatus,
      triggeredBy: actorId,
      httpCode,
      latencyMs,
      processedAt: new Date().toISOString(),
    })

    if (!opts.skipAudit) {
      this.auditSvc.write({
        actorId,
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: source.id,
        beforeJsonb: { probeStatus: source.probeStatus, latencyMs: source.latencyMs },
        afterJsonb: { action: 'probe', newProbeStatus, latencyMs, sourceId: source.id },
        requestId: opts.requestId ?? null,
      })
    }

    return { newProbeStatus, latencyMs, httpCode }
  }

  private async renderCheckOneInternal(
    source: VideoSourceLine,
    actorId: string,
    opts: { skipAudit: boolean; requestId?: string | null },
  ): Promise<{ newRenderStatus: 'ok' | 'dead'; httpCode: number | null }> {
    const { ok, httpCode } = await this.probeUrlHead(source.sourceUrl, true)
    const newRenderStatus: 'ok' | 'dead' = ok ? 'ok' : 'dead'

    await updateSourceHealthAfterRenderCheck(this.db, source.id, { renderStatus: newRenderStatus })

    await insertHealthEvent(this.db, {
      videoId: source.videoId,
      sourceId: source.id,
      origin: 'render_check',
      oldStatus: source.renderStatus,
      newStatus: newRenderStatus,
      triggeredBy: actorId,
      httpCode,
      processedAt: new Date().toISOString(),
    })

    if (!opts.skipAudit) {
      this.auditSvc.write({
        actorId,
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: source.id,
        beforeJsonb: { renderStatus: source.renderStatus },
        afterJsonb: { action: 'render_check', newRenderStatus, sourceId: source.id },
        requestId: opts.requestId ?? null,
      })
    }

    return { newRenderStatus, httpCode }
  }

  // ── 公开：单源 probe + render-check（既有 ADR-158 + AMENDMENT 1 契约） ──

  async probeOne(
    sourceId: string,
    actorId: string,
    requestId?: string,
  ): Promise<SingleSourceProbeResult> {
    await this.assertNotFrozen()

    const source = await findVideoSourceById(this.db, sourceId)
    if (!source) {
      throw new AppError('NOT_FOUND', `source ${sourceId} 不存在`, 404)
    }

    const { newProbeStatus, latencyMs } = await this.probeOneInternal(source, actorId, {
      skipAudit: false,
      requestId,
    })

    return { sourceId, newProbeStatus, latencyMs, queued: false as const }
  }

  async renderCheckOne(
    sourceId: string,
    actorId: string,
    requestId?: string,
  ): Promise<SingleSourceRenderCheckResult> {
    const source = await findVideoSourceById(this.db, sourceId)
    if (!source) {
      throw new AppError('NOT_FOUND', `source ${sourceId} 不存在`, 404)
    }

    const { newRenderStatus } = await this.renderCheckOneInternal(source, actorId, {
      skipAudit: false,
      requestId,
    })

    return { sourceId, newRenderStatus, queued: false as const }
  }

  // ── 公开：视频级 batch（CHG-357 / ADR-158 AMENDMENT 2）──

  /**
   * 视频全 active source 批量探测
   * - freeze 守卫：入口 1 次（J / B2 / 避免 N 次 systemSettings 查询）
   * - freeze=true → 整体 409（不部分执行 / J）
   * - listVideoSources 1 次 → Promise.allSettled 分批 5 并发（F2 / 防 100+ outbound）
   * - 子调用 skipAudit=true → batch 入口写 1 条 summary audit（C2 / 范式对齐 disable_dead_batch）
   * - audit targetKind='video'（batch 对象是 video 而非单源 / C2）
   */
  async batchProbe(
    videoId: string,
    actorId: string,
    requestId?: string,
  ): Promise<BatchProbeResult> {
    await this.assertNotFrozen()

    const sources = await listVideoSources(this.db, videoId)
    if (sources.length === 0) {
      throw new AppError('NOT_FOUND', `video ${videoId} 无活跃 source`, 404)
    }

    const results = await runInBatches(sources, BATCH_CONCURRENCY, async (source) => {
      try {
        const r = await this.probeOneInternal(source, actorId, { skipAudit: true, requestId })
        return {
          sourceId: source.id,
          newProbeStatus: r.newProbeStatus,
          latencyMs: r.latencyMs,
        } satisfies BatchProbeResultItem
      } catch (e) {
        return {
          sourceId: source.id,
          newProbeStatus: 'dead' as const,
          latencyMs: null,
          error: e instanceof Error ? e.message : String(e),
        } satisfies BatchProbeResultItem
      }
    })

    const ok = results.filter((r) => !r.error && r.newProbeStatus === 'ok').length
    const dead = results.filter((r) => !r.error && r.newProbeStatus === 'dead').length
    const failed = results.filter((r) => r.error).length
    const summary = { total: sources.length, ok, dead, failed }

    this.auditSvc.write({
      actorId,
      actionType: 'video_source.batch_inline_action',
      targetKind: 'video',
      targetId: videoId,
      beforeJsonb: null,
      afterJsonb: {
        action: 'batch_probe',
        summary,
        sourceIds: sources.map((s) => s.id),
      },
      requestId: requestId ?? null,
    })

    return { videoId, results, summary }
  }

  /**
   * 视频全 active source 批量试播
   * - 不守 freeze（继承 D-158-5 / render-check 不守 / batch 同模式）
   */
  async batchRenderCheck(
    videoId: string,
    actorId: string,
    requestId?: string,
  ): Promise<BatchRenderCheckResult> {
    const sources = await listVideoSources(this.db, videoId)
    if (sources.length === 0) {
      throw new AppError('NOT_FOUND', `video ${videoId} 无活跃 source`, 404)
    }

    const results = await runInBatches(sources, BATCH_CONCURRENCY, async (source) => {
      try {
        const r = await this.renderCheckOneInternal(source, actorId, { skipAudit: true, requestId })
        return {
          sourceId: source.id,
          newRenderStatus: r.newRenderStatus,
        } satisfies BatchRenderCheckResultItem
      } catch (e) {
        return {
          sourceId: source.id,
          newRenderStatus: 'dead' as const,
          error: e instanceof Error ? e.message : String(e),
        } satisfies BatchRenderCheckResultItem
      }
    })

    const ok = results.filter((r) => !r.error && r.newRenderStatus === 'ok').length
    const dead = results.filter((r) => !r.error && r.newRenderStatus === 'dead').length
    const failed = results.filter((r) => r.error).length
    const summary = { total: sources.length, ok, dead, failed }

    this.auditSvc.write({
      actorId,
      actionType: 'video_source.batch_inline_action',
      targetKind: 'video',
      targetId: videoId,
      beforeJsonb: null,
      afterJsonb: {
        action: 'batch_render_check',
        summary,
        sourceIds: sources.map((s) => s.id),
      },
      requestId: requestId ?? null,
    })

    return { videoId, results, summary }
  }
}

// ── 工具：分批并发（F2 / 防 N+1 outbound 风暴 / 无新依赖）────────────

async function runInBatches<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}
