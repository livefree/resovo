/**
 * scripts/stop-all-crawls.ts — 立刻停止所有活跃采集任务（止血命令）
 *
 * 用法：
 *   npm run crawler:stop-all
 *   node --env-file=.env.local --import tsx scripts/stop-all-crawls.ts
 */

import { db } from '@/api/lib/postgres'
import Bull from 'bull'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import * as crawlerRunsQueries from '@/api/db/queries/crawlerRuns'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

async function main() {
  await systemSettingsQueries.setSetting(db, 'crawler_global_freeze', 'true')
  const markedRuns = await crawlerRunsQueries.requestCancelAllActiveRuns(db)
  const taskChanges = await crawlerTasksQueries.cancelAllActiveTasks(db)

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const crawlerQueue = new Bull('crawler-queue', redisUrl)
  try {
    const repeatables = await crawlerQueue.getRepeatableJobs()
    for (const repeat of repeatables) {
      if (repeat.id === 'auto-crawl-tick' || repeat.key.includes('auto-crawl-tick')) {
        await crawlerQueue.removeRepeatableByKey(repeat.key)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[stop-all-crawls] remove repeatable failed: ${msg}\n`)
  } finally {
    await crawlerQueue.close()
  }

  process.stdout.write([
    '[stop-all-crawls] done',
    '  freeze=true',
    `  markedRuns=${markedRuns}`,
    `  cancelledPending=${taskChanges.cancelledPending}`,
    `  cancelledPaused=${taskChanges.cancelledPaused}`,
    `  cancelledRunning=${taskChanges.cancelledRunning}`,
  ].join('\n') + '\n')
}

void main()
  .catch((err) => {
    const msg = err instanceof Error
      ? `${err.message}${err.stack ? `\n${err.stack}` : ''}`
      : JSON.stringify(err)
    process.stderr.write(`[stop-all-crawls] failed: ${msg}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await db.end()
    } catch {}
  })
