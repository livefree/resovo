import cron from 'node-cron'
import { db } from './lib/db'
import { config } from './config'
import { jobLogger, baseLogger } from './observability/logger'
import { runSourceHealthLevel1, runSourceHealthLevel2 } from './jobs/source-health'
import { runFeedbackDrivenRecheck } from './jobs/feedback-driven-recheck'
import { runAutoRetireLine } from './jobs/auto-retire-line'

const log = baseLogger

async function runWithLogger(jobName: string, fn: () => Promise<void>): Promise<void> {
  const jobLog = jobLogger(jobName)
  jobLog.info('job started')
  const start = Date.now()
  try {
    await fn()
    jobLog.info({ duration_ms: Date.now() - start }, 'job completed')
  } catch (err) {
    jobLog.error({ err, duration_ms: Date.now() - start }, 'job failed')
  }
}

const level1Task = cron.schedule(
  config.cron.level1Probe,
  () => runWithLogger('level1-probe', () => runSourceHealthLevel1(db, jobLogger('level1-probe'))),
  { scheduled: false },
)

const level2Task = cron.schedule(
  config.cron.level2Render,
  () => runWithLogger('level2-render', () => runSourceHealthLevel2(db, jobLogger('level2-render'))),
  { scheduled: false },
)

const feedbackTask = cron.schedule(
  config.cron.feedbackDriven,
  () => runWithLogger('feedback-recheck', () => runFeedbackDrivenRecheck(db, jobLogger('feedback-recheck'))),
  { scheduled: false },
)

// CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B / ADR-164 D-164-8
// 每日 03:30 UTC 跑 alias 全 dead 持续 180 天检测 + 自动退役
// 不写 admin audit / 不触发 R-MID-1 / 仅结构化 worker 日志
const autoRetireLineTask = cron.schedule(
  config.cron.autoRetireLine,
  () => runWithLogger('auto-retire-line', () => runAutoRetireLine(db, jobLogger('auto-retire-line'))),
  { scheduled: false },
)

async function startup(): Promise<void> {
  log.info({ instanceId: config.workerInstanceId }, 'worker starting')

  await db.query('SELECT 1')
  log.info('db connection verified')

  level1Task.start()
  level2Task.start()
  feedbackTask.start()
  autoRetireLineTask.start()
  log.info(
    {
      level1_cron: config.cron.level1Probe,
      level2_cron: config.cron.level2Render,
      feedback_cron: config.cron.feedbackDriven,
      auto_retire_line_cron: config.cron.autoRetireLine,
    },
    'cron tasks started',
  )

  runWithLogger('level2-render-boot', () => runSourceHealthLevel2(db, jobLogger('level2-render'))).catch(
    (err) => log.error({ err }, 'level2-render boot failed'),
  )
}

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'worker shutting down')
  level1Task.stop()
  level2Task.stop()
  feedbackTask.stop()
  autoRetireLineTask.stop()
  await db.end()
  log.info('worker stopped')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaughtException')
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'unhandledRejection')
  process.exit(1)
})

startup().catch((err) => {
  log.fatal({ err }, 'startup failed')
  process.exit(1)
})
