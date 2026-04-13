/**
 * enrichmentWorker.ts — 元数据丰富队列消费者
 * CHG-385 Phase 3：处理 enrichment-queue 中的 metadata-enrich 任务
 */

import type Bull from 'bull'
import { enrichmentQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { MetadataEnrichService, type EnrichJobData } from '@/api/services/MetadataEnrichService'

// ── 任务处理 ──────────────────────────────────────────────────────

async function processEnrichJob(job: Bull.Job<EnrichJobData>): Promise<void> {
  const { videoId, catalogId, title, year, type } = job.data
  const service = new MetadataEnrichService(db)

  process.stderr.write(
    `[enrich-worker] job ${job.id}: video ${videoId} "${title}" (${year ?? '?'}/${type})\n`
  )

  await service.enrich({ videoId, catalogId, title, year, type })

  process.stderr.write(`[enrich-worker] job ${job.id} completed: video ${videoId}\n`)
}

// ── Worker 注册 ───────────────────────────────────────────────────

/**
 * 注册 MetadataEnrich Worker 到 enrichmentQueue。
 * 在 Fastify 服务启动后调用一次。
 * @param concurrency 并发数（默认 2，控制豆瓣网络请求频率）
 */
export function registerEnrichmentWorker(concurrency = 2): void {
  enrichmentQueue.process(concurrency, processEnrichJob)

  enrichmentQueue.on('failed', (job: Bull.Job<EnrichJobData>, err: Error) => {
    process.stderr.write(
      `[enrich-worker] job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}\n`
    )
  })
}

// ── 便捷入队函数 ──────────────────────────────────────────────────

/**
 * 将视频丰富任务加入队列（延迟 5 分钟，等待爬虫写库稳定）
 * delay: 300000ms — 在 CrawlerService.upsertVideo 完成后调用
 */
export async function enqueueEnrichJob(data: EnrichJobData): Promise<void> {
  await enrichmentQueue.add(data, {
    delay: 300_000,
    jobId: `enrich-${data.videoId}`,  // 同一视频去重（已在队列中时跳过）
  })
}
