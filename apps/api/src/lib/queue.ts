import Bull from 'bull'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

// ── 重试配置（指数退避）────────────────────────────────────────────

const RETRY_ATTEMPTS = 3
const RETRY_BACKOFF: Bull.BackoffOptions = {
  type: 'exponential',
  delay: 60000, // 初始 1 分钟，后续 5 分钟、30 分钟
}

const defaultJobOptions: Bull.JobOptions = {
  attempts: RETRY_ATTEMPTS,
  backoff: RETRY_BACKOFF,
  removeOnComplete: 100, // 只保留最近 100 条完成记录
  removeOnFail: 50,
}

const redisOptions: Bull.QueueOptions['redis'] = REDIS_URL as string

// ── 队列定义 ──────────────────────────────────────────────────────

/** 爬虫采集队列（full-crawl / incremental-crawl） */
export const crawlerQueue = new Bull('crawler-queue', {
  redis: redisOptions,
  defaultJobOptions,
  settings: {
    // worker 进程崩溃后 60s 内将 stalled job 重新入队或标记失败，
    // 避免等待心跳 watchdog（默认 15 分钟）才能恢复
    stalledInterval: 60_000,
    // stalled 次数达到上限后标记为 failed，而不是无限重排队
    maxStalledCount: 1,
  },
})

/** 播放源验证队列（verify-source / verify-single） */
export const verifyQueue = new Bull('verify-queue', {
  redis: redisOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 10, // 默认优先级（用户举报任务会设更高优先级）
  },
})

/** 元数据丰富队列（metadata-enrich：本地豆瓣匹配 + 网络搜索 + 源检验 + meta_score） */
export const enrichmentQueue = new Bull('enrichment-queue', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: RETRY_BACKOFF,
    removeOnComplete: 200,
    removeOnFail: 50,
  },
})

/** 图片健康巡检队列（image-health-check / blurhash-extract / backfill） */
export const imageHealthQueue = new Bull('image-health-queue', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: RETRY_BACKOFF,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

/** 维护任务队列（auto-publish-staging / verify-published-sources 等低频后台任务） */
export const maintenanceQueue = new Bull('maintenance-queue', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30_000 },
    removeOnComplete: 20,
    removeOnFail: 10,
  },
})

// ── 队列事件日志 ──────────────────────────────────────────────────

function attachQueueLogger(queue: Bull.Queue, name: string) {
  queue.on('error', (err) => {
    process.stderr.write(`[${name}] queue error: ${err.message}\n`)
  })
  queue.on('failed', (job, err) => {
    process.stderr.write(`[${name}] job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}\n`)
  })
}

attachQueueLogger(crawlerQueue, 'crawler-queue')
attachQueueLogger(verifyQueue, 'verify-queue')
attachQueueLogger(maintenanceQueue, 'maintenance-queue')
attachQueueLogger(enrichmentQueue, 'enrichment-queue')
attachQueueLogger(imageHealthQueue, 'image-health-queue')

const queues = { crawlerQueue, verifyQueue, maintenanceQueue, enrichmentQueue, imageHealthQueue }
export default queues

/** 确认 crawler 队列可用，避免创建任务后因入队失败留下 pending 脏状态 */
export async function ensureCrawlerQueueReady(timeoutMs = 1500): Promise<void> {
  let timer: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`crawler queue readiness timeout (${timeoutMs}ms)`))
    }, timeoutMs)
  })

  try {
    await Promise.race([crawlerQueue.isReady(), timeoutPromise])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`crawler queue unavailable: ${message}`)
  } finally {
    if (timer) clearTimeout(timer)
  }
}
