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
})

/** 播放源验证队列（verify-source / verify-single） */
export const verifyQueue = new Bull('verify-queue', {
  redis: redisOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 10, // 默认优先级（用户举报任务会设更高优先级）
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

export default { crawlerQueue, verifyQueue }
