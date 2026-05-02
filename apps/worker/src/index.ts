import cron from 'node-cron'
import { db } from './lib/db'
import { config } from './config'
import { jobLogger, baseLogger } from './observability/logger'
import { runSourceHealthLevel1, runSourceHealthLevel2 } from './jobs/source-health'
import { runFeedbackDrivenRecheck } from './jobs/feedback-driven-recheck'

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

const feedbackTask = cron.schedule(
  config.cron.feedbackDriven,
  () => runWithLogger('feedback-recheck', () => runFeedbackDrivenRecheck(db, jobLogger('feedback-recheck'))),
  { scheduled: false },
)

async function startup(): Promise<void> {
  log.info({ instanceId: config.workerInstanceId }, 'worker starting')

  await db.query('SELECT 1')
  log.info('db connection verified')

  level1Task.start()
  feedbackTask.start()
  log.info(
    { level1_cron: config.cron.level1Probe, feedback_cron: config.cron.feedbackDriven },
    'cron tasks started',
  )

  await runWithLogger('level2-render-boot', () => runSourceHealthLevel2(db, jobLogger('level2-render')))
}

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'worker shutting down')
  level1Task.stop()
  feedbackTask.stop()
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
