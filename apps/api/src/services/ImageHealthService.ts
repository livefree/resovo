/**
 * ImageHealthService.ts — 图片健康巡检业务层
 * 封装 imageHealthWorker / imageBlurhashWorker 的调用与协调。
 * 单次运行不超过 batchSize 张，worker 并发 + domain 限速由各 worker 内部控制。
 */

import type { Pool } from 'pg'
import type { ImageHealthQueue } from '@/api/workers/imageHealthWorker'
import {
  listPendingImageUrls,
  listUncheckedImageUrls,
  listStaleOkImageUrls,
  listMissingBlurhashUrls,
  updateCatalogImageStatus,
  getImageHealthStats,
  resolveImageEvents,
  getCatalogIdsByVideoIds,
  rescanPostersByCatalogIds,
  getProblemImages,
  getProblemImageCounts,
  type ImageHealthStats,
  type ProblemImageKind,
  type ProblemImageScope,
  type ProblemImageRow,
  type ProblemImageCounts,
} from '@/api/db/queries/imageHealth'
import { STALE_CHECK_DAYS } from '@/api/db/queries/imageHealth.scan'
import type { ImageKind } from '@/types'

export type { ImageHealthStats }

export class ImageHealthService {
  constructor(private db: Pool) {}

  /** 将待检图 URL 批量入 imageHealthQueue */
  async enqueueHealthChecks(
    queue: ImageHealthQueue,
    batchSize = 200
  ): Promise<{ enqueued: number }> {
    const rows = await listPendingImageUrls(this.db, batchSize)
    if (rows.length === 0) return { enqueued: 0 }

    await Promise.all(
      rows.map(row =>
        queue.add(
          'health-check',
          { type: 'health-check', ...row },
          { jobId: `health-check-${row.catalogId}-${row.kind}`, removeOnComplete: 50 }
        )
      )
    )
    return { enqueued: rows.length }
  }

  /**
   * ADR-213 D-213-5 ③：A-SCAN——部署后一次性扫描所有 `<kind>_checked_at IS NULL` 行入 health-check，
   * worker 跑完给 checked_at 落真值、排空 migration 121 后的初始 unknown 桶（C 硬前置门）。
   * 分页遍历 unchecked 快照（worker 异步处理，入队窗口内集合基本稳定）；dedup jobId 保证重跑/重叠不重复 add。
   */
  async enqueueHealthScanForUnchecked(
    queue: ImageHealthQueue,
    pageSize = 500,
  ): Promise<{ enqueued: number }> {
    let offset = 0
    let total = 0
    for (;;) {
      const rows = await listUncheckedImageUrls(this.db, pageSize, offset)
      if (rows.length === 0) break
      await Promise.all(
        rows.map(row =>
          queue.add(
            'health-check',
            { type: 'health-check', ...row },
            { jobId: `health-check-${row.catalogId}-${row.kind}`, removeOnComplete: 50 },
          ),
        ),
      )
      total += rows.length
      if (rows.length < pageSize) break
      offset += pageSize
    }
    return { enqueued: total }
  }

  /**
   * ADR-213 D-213-9①（P4-S 周期巡检）：分页扫所有「stale-ok」行（`status='ok'` 但 `checked_at`
   * 早于 STALE_CHECK_DAYS 或 NULL）入 health-check → worker 复检落新 checked_at，自动消化 D-213-7
   * 的 `unknown` 桶、根治 stale-ok 假阴性。dedup jobId 保证与 A-SCAN/重叠周期不重复 add。
   * 阈值取单一常量 STALE_CHECK_DAYS（与 D-213-7 读端 unknown 谓词同源，禁散落硬编码）。
   * A-SCAN ≠ P4-S：前者部署后一次性初始排空（checked_at IS NULL），后者上线后周期维护（checked_at 陈旧）。
   */
  async enqueueStaleHealthRecheck(
    queue: ImageHealthQueue,
    pageSize = 500,
  ): Promise<{ enqueued: number }> {
    // 周期巡检 jobId 必须按「巡检周期」唯一，**不能复用一次性扫描的固定 jobId**：Bull 对已存在的
    // jobId（含 removeOnComplete:50 保留的已完成 job）会静默忽略 add → 同一 (catalog,kind) 行复检过一次后，
    // 其保留的已完成 job 会让后续周期的重入被**永久静默跳过**，彻底丧失「周期」语义（Codex stop-gate）。
    // 以本次调用时间戳为周期戳：单次调用内（分页/数据漂移致同行重现）仍 dedup，跨周期 jobId 不同、不被旧 job 阻塞。
    const cycleStamp = Date.now()
    let offset = 0
    let total = 0
    for (;;) {
      const rows = await listStaleOkImageUrls(this.db, STALE_CHECK_DAYS, pageSize, offset)
      if (rows.length === 0) break
      await Promise.all(
        rows.map(row =>
          queue.add(
            'health-check',
            { type: 'health-check', ...row },
            { jobId: `health-check-${row.catalogId}-${row.kind}-${cycleStamp}`, removeOnComplete: 50 },
          ),
        ),
      )
      total += rows.length
      if (rows.length < pageSize) break
      offset += pageSize
    }
    return { enqueued: total }
  }

  /** 将缺 blurhash 的图片批量入 imageHealthQueue */
  async enqueueBlurhashExtract(
    queue: ImageHealthQueue,
    batchSize = 200
  ): Promise<{ enqueued: number }> {
    const rows = await listMissingBlurhashUrls(this.db, batchSize)
    if (rows.length === 0) return { enqueued: 0 }

    await Promise.all(
      rows.map(row =>
        queue.add(
          'blurhash-extract',
          { type: 'blurhash-extract', ...row },
          { jobId: `blurhash-${row.catalogId}-${row.kind}`, removeOnComplete: 50 }
        )
      )
    )
    return { enqueued: rows.length }
  }

  /** 批量标记图片状态（由 worker 回调时调用） */
  async applyStatusUpdates(
    updates: Array<{ catalogId: string; kind: ImageKind; status: string }>
  ): Promise<void> {
    const filtered = updates.filter(u =>
      ['poster', 'backdrop', 'logo', 'banner_backdrop'].includes(u.kind)
    )
    await updateCatalogImageStatus(
      this.db,
      filtered.map(u => ({
        catalogId: u.catalogId,
        kind: u.kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop',
        status: u.status as import('@/types').ImageStatus,
      }))
    )
  }

  async getStats(): Promise<ImageHealthStats> {
    return getImageHealthStats(this.db)
  }

  /**
   * ADR-211：问题图片可视化治理板数据源（按 kind/scope 返回「有非空 URL 但可能失效」的图）。
   * 只读，无审计；supersede ADR-210 破损样本区。
   */
  async getProblemImages(
    kind: ProblemImageKind,
    scope: ProblemImageScope,
    offset = 0,
    limit = 48,
  ): Promise<ProblemImageRow[]> {
    return getProblemImages(this.db, kind, scope, offset, limit)
  }

  /** ADR-211 D-211-4：4 类问题图片计数（tab badge + 当前 kind 的 total）。 */
  async getProblemImageCounts(scope: ProblemImageScope): Promise<ProblemImageCounts> {
    return getProblemImageCounts(this.db, scope)
  }

  /**
   * ADR-209 D-209-2：批量标记破损事件已解决（route → service → query 守分层）。
   * 返回实际更新行数；resolvedCount=0（不存在/已解决）由 route 幂等处理、不报 404。
   */
  async resolveEvents(
    eventIds: string[],
    note?: string,
  ): Promise<{ resolvedCount: number }> {
    const resolvedCount = await resolveImageEvents(this.db, eventIds, note)
    return { resolvedCount }
  }

  /**
   * ADR-209 D-209-3：对选中视频精确重扫封面——scoped 闭环，禁全局副作用。
   * ① videoIds→distinct catalogIds ② scoped 重置 poster_status=pending_review（cover_url 守卫）
   * ③ 仅入队选中 catalog 的 pending 行（复用 worker dedup jobId）。
   * 纯 missing（无 cover_url）行被守卫跳过、不计 updatedCount。
   */
  async rescanSelectedVideos(
    queue: ImageHealthQueue,
    videoIds: string[],
  ): Promise<{ updatedCount: number; enqueuedCount: number; catalogIds: string[] }> {
    const catalogIds = await getCatalogIdsByVideoIds(this.db, videoIds)
    if (catalogIds.length === 0) {
      return { updatedCount: 0, enqueuedCount: 0, catalogIds: [] }
    }

    const { updatedCount } = await rescanPostersByCatalogIds(this.db, catalogIds)

    // 选中集 pending 行上界 = catalog 数 × 4 图种，limit 取上界保证不截断
    const rows = await listPendingImageUrls(this.db, catalogIds.length * 4, 0, catalogIds)
    await Promise.all(
      rows.map(row =>
        queue.add(
          'health-check',
          { type: 'health-check', ...row },
          { jobId: `health-check-${row.catalogId}-${row.kind}`, removeOnComplete: 50 },
        ),
      ),
    )

    return { updatedCount, enqueuedCount: rows.length, catalogIds }
  }
}
