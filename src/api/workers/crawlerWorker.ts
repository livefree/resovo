/**
 * crawlerWorker.ts — 爬虫采集队列消费者
 * CHG-36: 从 crawler_sites 表读取源站；支持 siteKey 单站触发；更新采集状态
 */

import type Bull from 'bull'
import { crawlerQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { CrawlerService, type CrawlerSource } from '@/api/services/CrawlerService'
import { CrawlerRefetchService } from '@/api/services/CrawlerRefetchService'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import { createCrawlerTaskLog } from '@/api/db/queries/crawlerTaskLogs'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

// ── 资源站工具函数（从 CrawlerService 迁入，worker 是唯一调用方） ───

/** 从 CRAWLER_SOURCES 环境变量解析资源站配置（降级用） */
export function parseCrawlerSources(env?: string): CrawlerSource[] {
  if (!env) return []
  try {
    return JSON.parse(env) as CrawlerSource[]
  } catch {
    return []
  }
}

/**
 * 获取启用的资源站列表：
 * 优先从 crawler_sites 表读取，若表为空则降级到 CRAWLER_SOURCES 环境变量
 */
export async function getEnabledSources(db: import('pg').Pool): Promise<CrawlerSource[]> {
  const dbSites = await crawlerSitesQueries.listEnabledCrawlerSites(db)
  if (dbSites.length > 0) {
    return dbSites.map((s) => ({
      name:   s.key,
      base:   s.apiUrl,
      format: s.format,
      ingestPolicy: {
        allow_auto_publish: s.ingestPolicy.allow_auto_publish,
        source_update: s.ingestPolicy.source_update,
      },
    }))
  }
  return parseCrawlerSources(process.env.CRAWLER_SOURCES)
}

// ── 任务类型 ──────────────────────────────────────────────────────

export type CrawlJobType = 'full-crawl' | 'incremental-crawl'

/** CRAWLER-01: 采集模式（batch=批量/定时，keyword=关键词搜索，source-refetch=单视频补源） */
export type CrawlJobMode = 'batch' | 'keyword' | 'source-refetch'

export interface CrawlJobData {
  type: CrawlJobType
  /** 单站任务对应的源站 key（run/task 模型下必填） */
  siteKey: string
  /** 已创建的任务 ID（run/task 模型下必填） */
  taskId: string
  /** 批次 ID（run/task 模型下必填） */
  runId: string
  /** 增量模式：只采集最近 N 小时更新的内容 */
  hoursAgo?: number
  /** CRAWLER-01: 采集模式 */
  crawlMode?: CrawlJobMode
  /** CRAWLER-01: 关键词搜索采集的搜索词（crawlMode='keyword' 时使用） */
  keyword?: string
  /** CRAWLER-01: 单视频补源目标视频 ID（crawlMode='source-refetch' 时使用） */
  targetVideoId?: string
  /** CRAWLER-01: 是否预览模式（不写库，只返回结果） */
  previewOnly?: boolean
  /** CRAWLER-01: 限定采集的站点 key 列表（为空时采集所有启用站点） */
  targetSiteKeys?: string[]
}

export interface CrawlJobResult {
  type: CrawlJobType
  sites: string[]
  videosUpserted: number
  sourcesUpserted: number
  errors: number
  durationMs: number
}

// ── Worker 处理函数 ───────────────────────────────────────────────

async function processCrawlJob(job: Bull.Job<CrawlJobData>): Promise<CrawlJobResult> {
  const { type, siteKey, taskId, runId, hoursAgo, crawlMode, keyword, targetVideoId } = job.data
  const start = Date.now()
  const crawlerService = new CrawlerService(db, es)
  let freezeCache: { value: boolean; checkedAt: number } = { value: false, checkedAt: 0 }
  let lastHeartbeatTouchAt = 0
  let heartbeatTimer: NodeJS.Timeout | null = null
  let controlCheckTimer: NodeJS.Timeout | null = null
  const abortController = new AbortController()

  const isGlobalFreezeEnabled = async () => {
    const now = Date.now()
    if (now - freezeCache.checkedAt < 3000) return freezeCache.value
    const freeze = await systemSettingsQueries.getSetting(db, 'crawler_global_freeze')
    freezeCache = {
      value: freeze === 'true',
      checkedAt: now,
    }
    return freezeCache.value
  }

  const logTask = async (
    level: 'info' | 'warn' | 'error',
    stage: string,
    message: string,
    details?: Record<string, unknown>,
  ) => {
    try {
      await createCrawlerTaskLog(db, {
        taskId: taskId ?? null,
        sourceSite: siteKey ?? null,
        level,
        stage,
        message,
        details: {
          ...(details ?? {}),
          jobId: String(job.id),
          mode: type,
          runId: runId ?? null,
        },
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[crawler-worker] failed to persist task log: ${reason}\n`)
    }
  }

  const touchHeartbeat = async () => {
    if (!taskId) return
    const now = Date.now()
    if (now - lastHeartbeatTouchAt < 5000) return
    lastHeartbeatTouchAt = now
    await crawlerTasksQueries.touchTaskHeartbeat(db, taskId)
  }

  if (!runId || !taskId) {
    await createCrawlerTaskLog(db, {
      taskId: taskId ?? null,
      sourceSite: siteKey ?? null,
      level: 'error',
      stage: 'worker.job.rejected.no_contract',
      message: '拒绝执行缺少 runId/taskId 的采集任务',
      details: {
        jobId: String(job.id),
        mode: type,
        runId: runId ?? null,
        taskId: taskId ?? null,
        siteKey: siteKey ?? null,
      },
    })
    throw new Error('CRAWL_JOB_CONTRACT_INVALID: runId/taskId required')
  }

  await logTask('info', 'worker.job.received', 'Worker 接收到采集任务', {
    siteKey: siteKey ?? null,
    hoursAgo: hoursAgo ?? null,
  })

  if (await isGlobalFreezeEnabled()) {
    if (taskId) {
      await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', { reason: 'GLOBAL_FREEZE' })
    }
    await logTask('warn', 'worker.global.freeze', '全局采集冻结已开启，跳过任务执行')
    if (runId) await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    return { type, sites: siteKey ? [siteKey] : [], videosUpserted: 0, sourcesUpserted: 0, errors: 0, durationMs: 0 }
  }

  if (runId) {
    const run = await crawlerRunsQueries.getRunById(db, runId)
    if (run?.controlStatus === 'cancelling' || run?.controlStatus === 'cancelled') {
      if (taskId) {
        await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', { reason: 'RUN_CANCELLED' })
      }
      await logTask('warn', 'worker.run.cancelled', '批次已取消，跳过任务执行')
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
      return { type, sites: siteKey ? [siteKey] : [], videosUpserted: 0, sourcesUpserted: 0, errors: 0, durationMs: 0 }
    }

    if (run?.controlStatus === 'pausing' || run?.controlStatus === 'paused') {
      if (taskId) {
        await crawlerTasksQueries.updateTaskStatus(db, taskId, 'paused', { reason: 'RUN_PAUSED_REQUEUE' })
      }
      await crawlerQueue.add(job.data, { delay: 30_000 })
      await logTask('info', 'worker.run.paused', '批次已暂停，任务已延迟重排队', { delayMs: 30_000 })
      return { type, sites: siteKey ? [siteKey] : [], videosUpserted: 0, sourcesUpserted: 0, errors: 0, durationMs: 0 }
    }
  }

  if (taskId) {
    const task = await crawlerTasksQueries.getTaskById(db, taskId)
    if (task?.cancelRequested) {
      await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', {
        reason: 'CANCEL_REQUESTED',
      })
      if (runId) await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
      await logTask('warn', 'worker.task.cancelled_before_start', '任务在启动前被取消')
      return { type, sites: siteKey ? [siteKey] : [], videosUpserted: 0, sourcesUpserted: 0, errors: 0, durationMs: 0 }
    }

    await crawlerTasksQueries.updateTaskStatus(db, taskId, 'running', {
      queueJobId: String(job.id),
    })
    await touchHeartbeat()
    // 独立心跳定时器：作为 onLog 触发之外的保底机制，防止无日志输出时被 watchdog 误杀
    heartbeatTimer = setInterval(() => {
      void touchHeartbeat()
    }, 3 * 60 * 1000)

    // 独立控制检查定时器：每 15s 主动检测 cancel/pause/timeout，
    // 即使 crawlerService 正阻塞在 HTTP 请求中也能及时中断，
    // 将控制响应延迟从"迭代周期"收紧到 ≤15s
    controlCheckTimer = setInterval(() => {
      void (async () => {
        try {
          if (abortController.signal.aborted) return
          if (await isGlobalFreezeEnabled()) {
            abortController.abort('TASK_CANCELLED')
            return
          }
          const taskRow = await db.query<{ cancel_requested: boolean; timeout_at: string | null; status: string }>(
            `SELECT cancel_requested, timeout_at, status FROM crawler_tasks WHERE id = $1`,
            [taskId],
          )
          const row = taskRow.rows[0]
          if (!row) return
          if (row.status === 'cancelled' || row.cancel_requested) {
            abortController.abort('TASK_CANCELLED')
            return
          }
          if (row.timeout_at && new Date(row.timeout_at).getTime() < Date.now()) {
            abortController.abort('TASK_TIMEOUT')
            return
          }
          if (runId) {
            const run = await crawlerRunsQueries.getRunById(db, runId)
            if (run?.controlStatus === 'paused' || run?.controlStatus === 'pausing') {
              abortController.abort('TASK_PAUSED')
              return
            }
            if (run?.controlStatus === 'cancelling' || run?.controlStatus === 'cancelled') {
              abortController.abort('TASK_CANCELLED')
            }
          }
        } catch {
          // 控制检查失败不阻断采集主流程
        }
      })()
    }, 15_000)

    await logTask('info', 'worker.task.running', '任务状态切换为 running')
  }

  const clearHeartbeatTimer = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const clearControlCheckTimer = () => {
    if (controlCheckTimer) {
      clearInterval(controlCheckTimer)
      controlCheckTimer = null
    }
  }

  try {
    // 获取待采集源站列表
    let allSources = await getEnabledSources(db)
    if (siteKey) {
      allSources = allSources.filter((s) => s.name === siteKey)
      if (allSources.length === 0) {
        await logTask('error', 'worker.source.not_found', '指定源站不存在或已禁用', { siteKey })
        throw new Error(`源站 "${siteKey}" 不存在或已禁用`)
      }
    }

    if (allSources.length === 0) {
      await logTask('error', 'worker.source.empty', '没有可用采集源站')
      throw new Error('没有可用的采集源站，请在"视频源配置"中添加并启用源站')
    }

    await job.progress(0)

    let videosUpserted = 0
    let sourcesUpserted = 0
    let errors = 0
    const siteNames: string[] = []

    for (let i = 0; i < allSources.length; i++) {
      const source = allSources[i]
      siteNames.push(source.name)

      // 标记为运行中
      await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'running')
      await logTask('info', 'worker.source.start', '开始采集源站', { source: source.name, base: source.base })

      try {
        process.stderr.write(
          `[crawler-worker] crawling ${source.name} (${source.base}, mode=${crawlMode ?? 'batch'}${keyword ? `, kw=${keyword}` : ''}${targetVideoId ? `, vid=${targetVideoId}` : ''})\n`
        )

        // ── source-refetch 模式：调用 CrawlerRefetchService ─────────
        if (crawlMode === 'source-refetch' && targetVideoId) {
          const refetchService = new CrawlerRefetchService(db, es)
          const refetchResult = await refetchService.refetchSourcesForVideo(targetVideoId, [source.name])
          sourcesUpserted += refetchResult.sourcesAdded
          if (refetchResult.notFound.length > 0) errors++
          await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'ok')
          await logTask('info', 'worker.source.done', '补源采集完成', {
            source: source.name,
            sourcesAdded: refetchResult.sourcesAdded,
            notFound: refetchResult.notFound,
          })
          continue
        }

        // ── keyword / batch 模式：调用 CrawlerService.crawl ─────────
        const result = await crawlerService.crawl(source, {
          taskType: type,
          taskId,
          signal: abortController.signal,
          keyword: crawlMode === 'keyword' ? (keyword ?? undefined) : undefined,
          hoursAgo: type === 'incremental-crawl' ? (hoursAgo ?? 24) : undefined,
          shouldStop: async () => {
            try {
              await touchHeartbeat()
            } catch {
              // 心跳刷新失败不阻断采集主流程
            }
            if (await isGlobalFreezeEnabled()) return 'cancel'
            if (!taskId) return false
            const taskRow = await db.query<{ cancel_requested: boolean; timeout_at: string | null; status: string }>(
              `SELECT cancel_requested, timeout_at, status FROM crawler_tasks WHERE id = $1`,
              [taskId],
            )
            const row = taskRow.rows[0]
            if (!row) return false
            if (row.status === 'cancelled' || row.cancel_requested) return 'cancel'
            if (row.timeout_at && new Date(row.timeout_at).getTime() < Date.now()) return 'timeout'
            if (runId) {
              const run = await crawlerRunsQueries.getRunById(db, runId)
              if (run?.controlStatus === 'paused' || run?.controlStatus === 'pausing') return 'pause'
              if (run?.controlStatus === 'cancelling' || run?.controlStatus === 'cancelled') return 'cancel'
            }
            return false
          },
          onLog: async (input) => {
            await logTask(input.level ?? 'info', input.stage, input.message, {
              source: source.name,
              ...(input.details ?? {}),
            })
            try {
              await touchHeartbeat()
            } catch {
              // 心跳刷新失败不阻断采集主流程
            }
          },
        })
        videosUpserted += result.videosUpserted
        sourcesUpserted += result.sourcesUpserted
        if (result.errors > 0) errors += result.errors

        await crawlerSitesQueries.updateCrawlStatus(db, source.name, result.errors > 0 ? 'failed' : 'ok')
        await logTask('info', 'worker.source.done', '源站采集完成', {
          source: source.name,
          videosUpserted: result.videosUpserted,
          sourcesUpserted: result.sourcesUpserted,
          errors: result.errors,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('TASK_PAUSED')) {
          if (taskId) {
            await crawlerTasksQueries.updateTaskStatus(db, taskId, 'paused', { reason: 'RUN_PAUSED' })
          }
          if (runId) {
            await crawlerRunsQueries.updateRunControlStatus(db, runId, 'paused')
            await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
          }
          await crawlerQueue.add(job.data, { delay: 30_000 })
          await logTask('info', 'worker.task.paused', '任务已暂停，延迟重排队', { delayMs: 30000, source: source.name })
          return {
            type,
            sites: siteNames,
            videosUpserted,
            sourcesUpserted,
            errors,
            durationMs: Date.now() - start,
          }
        }
        if (message.includes('TASK_CANCELLED')) {
          if (taskId) {
            await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', { reason: 'RUN_CANCELLED' })
          }
          await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'failed')
          await logTask('warn', 'worker.task.cancelled', '任务已取消并停止后续采集', { source: source.name })
          return {
            type,
            sites: siteNames,
            videosUpserted,
            sourcesUpserted,
            errors,
            durationMs: Date.now() - start,
          }
        }
        if (message.includes('TASK_TIMEOUT')) {
          if (taskId) {
            await crawlerTasksQueries.updateTaskStatus(db, taskId, 'timeout', { reason: 'TASK_TIMEOUT' })
          }
          await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'failed')
          await logTask('error', 'worker.task.timeout', '任务超时并停止后续采集', { source: source.name })
          return {
            type,
            sites: siteNames,
            videosUpserted,
            sourcesUpserted,
            errors: errors + 1,
            durationMs: Date.now() - start,
          }
        }
        errors++
        process.stderr.write(`[crawler-worker] error crawling ${source.name}: ${message}\n`)
        await crawlerSitesQueries.updateCrawlStatus(db, source.name, 'failed')
        await logTask('error', 'worker.source.failed', '源站采集失败', {
          source: source.name,
          error: message,
        })
      }

      await job.progress(Math.round(((i + 1) / allSources.length) * 100))
    }

    return {
      type,
      sites: siteNames,
      videosUpserted,
      sourcesUpserted,
      errors,
      durationMs: Date.now() - start,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const cancelled = message.includes('TASK_CANCELLED')
    const timedOut = message.includes('TASK_TIMEOUT')
    await logTask('error', 'worker.job.failed', '采集任务执行失败', { error: message })
    if (taskId) {
      if (cancelled) {
        await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', { error: message })
      } else if (timedOut) {
        await crawlerTasksQueries.updateTaskStatus(db, taskId, 'timeout', { error: message })
      } else {
        await crawlerTasksQueries.updateTaskStatus(db, taskId, 'failed', { error: message })
      }
    }
    if (runId) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
    throw err
  } finally {
    clearHeartbeatTimer()
    clearControlCheckTimer()
    // 确保 signal 已中止，释放可能持有该 signal 的资源
    if (!abortController.signal.aborted) abortController.abort('JOB_DONE')
    if (runId) {
      await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
    }
  }
}

// ── Worker 注册 ───────────────────────────────────────────────────

export function registerCrawlerWorker(concurrency = 1): void {
  crawlerQueue.process(concurrency, processCrawlJob)

  crawlerQueue.on('completed', (job: Bull.Job<CrawlJobData>, result: CrawlJobResult) => {
    process.stderr.write(
      `[crawler-worker] job ${job.id} completed: ` +
        `${result.videosUpserted} videos, ${result.sourcesUpserted} sources, ` +
        `${result.errors} errors, ${result.durationMs}ms\n`
    )
  })
}

// ── 便捷入队函数 ──────────────────────────────────────────────────

// Bull job 超时上界：单个采集任务最长允许运行 30 分钟。
// 超时后 Bull 将 job 标记为 failed，worker 可在 failed 事件中更新 DB 状态。
// 这是硬性保障层，与 crawler_tasks.timeout_at 的软性 watchdog 互补。
const CRAWLER_JOB_TIMEOUT_MS = 30 * 60 * 1000

interface EnqueueExtras {
  crawlMode?: CrawlJobMode
  keyword?: string | null
  targetVideoId?: string | null
}

/** 添加全量采集任务到队列（可选指定单站 key） */
export async function enqueueFullCrawl(
  siteKey: string,
  taskId: string,
  runId: string,
  extras?: EnqueueExtras,
): Promise<Bull.Job<CrawlJobData>> {
  if (!siteKey || !taskId || !runId) {
    throw new Error('CRAWL_JOB_CONTRACT_INVALID: enqueueFullCrawl requires siteKey/taskId/runId')
  }
  const data: CrawlJobData = { type: 'full-crawl', siteKey, taskId, runId }
  if (extras?.crawlMode) data.crawlMode = extras.crawlMode
  if (extras?.keyword) data.keyword = extras.keyword
  if (extras?.targetVideoId) data.targetVideoId = extras.targetVideoId
  return crawlerQueue.add(data, { timeout: CRAWLER_JOB_TIMEOUT_MS })
}

/** 添加增量采集任务到队列（默认最近 24 小时，可选指定单站 key） */
export async function enqueueIncrementalCrawl(
  siteKey: string,
  hoursAgo = 24,
  taskId: string,
  runId: string,
  extras?: EnqueueExtras,
): Promise<Bull.Job<CrawlJobData>> {
  if (!siteKey || !taskId || !runId) {
    throw new Error('CRAWL_JOB_CONTRACT_INVALID: enqueueIncrementalCrawl requires siteKey/taskId/runId')
  }
  const data: CrawlJobData = { type: 'incremental-crawl', siteKey, taskId, runId, hoursAgo }
  if (extras?.crawlMode) data.crawlMode = extras.crawlMode
  if (extras?.keyword) data.keyword = extras.keyword
  if (extras?.targetVideoId) data.targetVideoId = extras.targetVideoId
  return crawlerQueue.add(data, { timeout: CRAWLER_JOB_TIMEOUT_MS })
}
