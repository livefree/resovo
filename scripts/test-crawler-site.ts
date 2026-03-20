/**
 * scripts/test-crawler-site.ts
 *
 * 使用已有数据源直接执行一次单站增量采集（不依赖 Redis 队列），并打印关键日志摘要。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/test-crawler-site.ts --site=360zy.com --hours=24
 *   node --env-file=.env.local --import tsx scripts/test-crawler-site.ts
 */

import { db } from '@/api/lib/postgres'
import { es } from '@/api/lib/elasticsearch'
import { CrawlerService, getEnabledSources } from '@/api/services/CrawlerService'
import * as crawlerTasksQueries from '@/api/db/queries/crawlerTasks'
import { createCrawlerTaskLog, listCrawlerTaskLogs } from '@/api/db/queries/crawlerTaskLogs'

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

async function main() {
  const siteKey = readArg('site')
  const hours = Number(readArg('hours') ?? 24)
  const enabled = await getEnabledSources(db)
  if (enabled.length === 0) {
    throw new Error('没有可用源站（crawler_sites.disabled=false）')
  }

  const source = siteKey ? enabled.find((s) => s.name === siteKey) : enabled[0]
  if (!source) {
    throw new Error(`未找到源站: ${siteKey}`)
  }

  const task = await crawlerTasksQueries.createTask(db, {
    type: 'incremental-crawl',
    sourceSite: source.name,
    targetUrl: source.base,
  })
  process.stdout.write(`[test-crawler-site] task=${task.id} source=${source.name} hours=${hours}\n`)

  const crawler = new CrawlerService(db, es)
  const startedAt = Date.now()
  const result = await crawler.crawl(source, {
    hoursAgo: hours,
    taskType: 'incremental-crawl',
    taskId: task.id,
    onLog: async (input) => {
      await createCrawlerTaskLog(db, {
        taskId: task.id,
        sourceSite: source.name,
        level: input.level ?? 'info',
        stage: `script.${input.stage}`,
        message: input.message,
        details: input.details ?? null,
      })
    },
  })

  const logs = await listCrawlerTaskLogs(db, { taskId: task.id, limit: 30 })
  process.stdout.write(
    `[test-crawler-site] done in ${Date.now() - startedAt}ms: videos=${result.videosUpserted}, sources=${result.sourcesUpserted}, errors=${result.errors}\n`
  )
  process.stdout.write('[test-crawler-site] latest logs:\n')
  for (const log of logs.reverse()) {
    process.stdout.write(`- [${log.createdAt}] [${log.level}] ${log.stage} ${log.message}\n`)
  }
}

main()
  .catch((err) => {
    process.stderr.write(`[test-crawler-site] failed: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
  })
