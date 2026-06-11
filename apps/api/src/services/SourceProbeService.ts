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
 *   - SRCHEALTH-P1-3 2026-06-10：试播升级 manifest 真解析（@resovo/media-probe 与
 *     worker level2 同源判定），newRenderStatus 三态 +'partial'，写质量字段；
 *     消除原 I3 已知限制（HEAD + Content-Type 仅 reachability）
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
  listActiveProbeStatuses,
  updateSourceHealthAfterProbe,
  updateSourceHealthAfterRenderCheck,
  recordAdminPlaybackVerifySuccess,
} from '@/api/db/queries/video_sources'
import { heightToQuality } from '@resovo/media-probe'
import { insertHealthEvent } from '@/api/db/queries/sourceHealthEvents'
import { updateVideoSourceCheckStatus } from '@/api/db/queries/videos.status'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import { computeCheckStatus, type ProbeStatus } from '@/api/lib/source-check-status'
import { baseLogger } from '@/api/lib/logger'
import { renderCheckManifest } from '@/api/lib/render-check-manifest'
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
  readonly newRenderStatus: 'ok' | 'partial' | 'dead'
  readonly queued: false
}

// ── ADR-198：admin 真实播放反馈契约 ─────────────────────────────────
export interface PlaybackVerifyInput {
  readonly success: boolean
  readonly resolutionWidth?: number | null
  readonly resolutionHeight?: number | null
  readonly bufferingCount?: number | null
  readonly errorCode?: string | null
}

export interface PlaybackVerifyResult {
  readonly sourceId: string
  readonly newProbeStatus: 'pending' | 'ok' | 'partial' | 'dead'
  readonly newRenderStatus: 'pending' | 'ok' | 'partial' | 'dead'
  readonly verified: true
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
  readonly newRenderStatus: 'ok' | 'partial' | 'dead'
  readonly error?: string
}

export interface BatchRenderCheckResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchRenderCheckResultItem>
  readonly summary: {
    readonly total: number
    readonly ok: number
    readonly partial: number
    readonly dead: number
    readonly failed: number
  }
}

// ── 内部常量 ─────────────────────────────────────────────────────────

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

  // ── 私有：探测后即时重算视频聚合状态（SRCHEALTH-P1-2 / B2）────────

  /**
   * 重算 videos.source_check_status（probe 维度聚合，与 worker aggregate 同语义）。
   * - 仅 probe 路径调用：render_status 不进 computeCheckStatus 输入，render-check
   *   后聚合值不变，跳过为正确性等价（理由记 SEQ-20260610-02 完成备注）。
   * - 派生状态失败不阻断探测响应（探测 UPDATE + audit 已完成）：catch + warn 日志，
   *   下一轮 worker level1 cron 兜底收敛。
   * - Q1 裁决：Service 内直算，不复用 worker advisory-lock（手动操作低频，
   *   与 worker 并发时双方均从 DB 现状重算，last-write-wins 最终一致）。
   */
  private async recomputeVideoCheckStatus(videoId: string): Promise<void> {
    try {
      const statuses = await listActiveProbeStatuses(this.db, videoId)
      // 无 active 源 → 不写（与 worker aggregateVideoSourceCheckStatus rows=0 行为一致）
      if (statuses.length === 0) return
      await updateVideoSourceCheckStatus(this.db, videoId, computeCheckStatus(statuses as ProbeStatus[]))
    } catch (e) {
      baseLogger.warn(
        { err: e, videoId },
        '[SourceProbeService] source_check_status 重算失败（派生状态，worker cron 兜底）',
      )
    }
  }

  // ── 私有：探测单 URL（probeUrlHead 公共方法 / R2 抽出 / DRY）─────

  /**
   * 探测单个 source URL — R2 公共方法（probe 路径专用；试播已升级 renderCheckManifest）
   * @returns ok=true 时 latencyMs 是测量值；ok=false 时 latencyMs 必为 null（I1 防中位数污染）
   */
  private async probeUrlHead(
    url: string,
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
    const { ok, latencyMs, httpCode } = await this.probeUrlHead(source.sourceUrl)
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
  ): Promise<{ newRenderStatus: 'ok' | 'partial' | 'dead'; httpCode: number | null }> {
    // SRCHEALTH-P1-3（D1/D2）：manifest 真解析（lib/render-check-manifest，与 worker 同源判定）
    const { verdict, httpCode } = await renderCheckManifest(source)
    const newRenderStatus = verdict.status

    await updateSourceHealthAfterRenderCheck(this.db, source.id, {
      renderStatus: newRenderStatus,
      resolutionWidth: verdict.width,
      resolutionHeight: verdict.height,
      qualityDetected: verdict.quality,
    })

    await insertHealthEvent(this.db, {
      videoId: source.videoId,
      sourceId: source.id,
      origin: 'render_check',
      oldStatus: source.renderStatus,
      newStatus: newRenderStatus,
      triggeredBy: actorId,
      errorDetail: verdict.errorDetail,
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

    // SRCHEALTH-P1-2：探测写入完成 → 即时重算视频聚合（B2，不再等 6h cron）
    await this.recomputeVideoCheckStatus(source.videoId)

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

  // ── 公开：admin 真实播放反馈（ADR-198）──────────────────────────────

  /**
   * admin 审核台真实播放反馈直更 source health（成功/失败不对称，ADR-198）。
   * - 校验 source 存在且属于该 video（否则 NOT_FOUND 404）。
   * - **成功** → recordAdminPlaybackVerifySuccess 直更 render='ok'+probe dead→ok 复活+时间戳+
   *   （携分辨率时）quality 无条件覆盖（D-198-2/4/7，**不写 EMA**）；写 origin='admin_playback'
   *   processed_at=NOW() 溯源事件（非 recheck 队列）；重算视频聚合。
   * - **失败** → **不改 render/probe**（D-198-2 红线：浏览器端失败归因不可靠）；写 origin='admin_playback'
   *   new_status='dead' processed_at=NULL 定向 recheck 信号（D-198-8，复用 feedback-driven-recheck worker）；
   *   状态不变 → 不重算聚合。返回当前（未变）状态。
   * 绕众包多 IP 门槛（admin=可信单点，D-198-3）。
   */
  async recordPlaybackVerify(
    videoId: string,
    sourceId: string,
    actorId: string,
    input: PlaybackVerifyInput,
    requestId?: string,
  ): Promise<PlaybackVerifyResult> {
    const source = await findVideoSourceById(this.db, sourceId)
    if (!source || source.videoId !== videoId) {
      throw new AppError('NOT_FOUND', `source ${sourceId} 不存在或不属于 video ${videoId}`, 404)
    }

    if (input.success) {
      const height = input.resolutionHeight ?? null
      const quality = height !== null ? heightToQuality(height) : null
      const updated = await recordAdminPlaybackVerifySuccess(this.db, sourceId, {
        resolutionWidth: input.resolutionWidth ?? null,
        resolutionHeight: height,
        qualityDetected: quality,
      })
      if (!updated) {
        throw new AppError('NOT_FOUND', `source ${sourceId} 不存在`, 404)
      }

      // 溯源事件（processed_at=NOW → 不进 admin_playback 定向 recheck 队列，仅 line-health 历史可见）
      await insertHealthEvent(this.db, {
        videoId,
        sourceId,
        origin: 'admin_playback',
        oldStatus: source.renderStatus,
        newStatus: updated.newRenderStatus,
        triggeredBy: actorId,
        processedAt: new Date().toISOString(),
      })

      this.auditSvc.write({
        actorId,
        actionType: 'video_source.inline_action',
        targetKind: 'video_source',
        targetId: sourceId,
        beforeJsonb: { renderStatus: source.renderStatus, probeStatus: source.probeStatus },
        afterJsonb: {
          action: 'playback_verify',
          success: true,
          newRenderStatus: updated.newRenderStatus,
          newProbeStatus: updated.newProbeStatus,
          sourceId,
        },
        requestId: requestId ?? null,
      })

      // 成功翻转 probe/render → 重算视频聚合（SRCHEALTH-P1-2 同模式）
      await this.recomputeVideoCheckStatus(videoId)

      return {
        sourceId,
        newProbeStatus: updated.newProbeStatus,
        newRenderStatus: updated.newRenderStatus,
        verified: true as const,
      }
    }

    // 失败：不改 render/probe（D-198-2 红线），记 admin_playback 定向 recheck 信号（D-198-8）
    await insertHealthEvent(this.db, {
      videoId,
      sourceId,
      origin: 'admin_playback',
      oldStatus: source.renderStatus,
      newStatus: 'dead',
      triggeredBy: actorId,
      errorDetail: input.errorCode ?? null,
      processedAt: null,
    })

    this.auditSvc.write({
      actorId,
      actionType: 'video_source.inline_action',
      targetKind: 'video_source',
      targetId: sourceId,
      beforeJsonb: { renderStatus: source.renderStatus, probeStatus: source.probeStatus },
      afterJsonb: {
        action: 'playback_verify',
        success: false,
        errorCode: input.errorCode ?? null,
        queuedRecheck: true,
        sourceId,
      },
      requestId: requestId ?? null,
    })

    return {
      sourceId,
      newProbeStatus: source.probeStatus,
      newRenderStatus: source.renderStatus,
      verified: true as const,
    }
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

    // SRCHEALTH-P1-2：batch 全部源写入完成 → 重算一次视频聚合（B2，不再等 6h cron）
    await this.recomputeVideoCheckStatus(videoId)

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
    const partial = results.filter((r) => !r.error && r.newRenderStatus === 'partial').length
    const dead = results.filter((r) => !r.error && r.newRenderStatus === 'dead').length
    const failed = results.filter((r) => r.error).length
    const summary = { total: sources.length, ok, partial, dead, failed }

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
