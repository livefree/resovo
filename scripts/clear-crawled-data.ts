/**
 * scripts/clear-crawled-data.ts — 一键清空已抓取数据（用于测试回归）
 *
 * 用法：
 *   npm run clear:crawled-data
 *   # 或直接运行：
 *   node --env-file=.env.local --import tsx scripts/clear-crawled-data.ts
 *
 * 说明：
 *   - 清空采集写入的视频主数据与采集任务数据
 *   - 保留用户账号、站点配置（crawler_sites）与系统配置（system_settings）
 *   - 会重置 crawler_sites 的最近采集状态字段
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write('❌  DATABASE_URL 未设置，请检查 .env.local\n')
  process.exit(1)
}

const db = new Pool({ connectionString: DATABASE_URL })

async function countRows(client: { query: (sql: string) => Promise<{ rows: Array<{ count: string }> }> }, table: string) {
  const res = await client.query(`SELECT COUNT(*)::text AS count FROM ${table}`)
  return parseInt(res.rows[0]?.count ?? '0', 10) || 0
}

async function main() {
  const client = await db.connect()
  try {
    const before = {
      videos: await countRows(client, 'videos'),
      videoSources: await countRows(client, 'video_sources'),
      crawlerRuns: await countRows(client, 'crawler_runs'),
      crawlerTasks: await countRows(client, 'crawler_tasks'),
      crawlerTaskLogs: await countRows(client, 'crawler_task_logs'),
    }

    process.stdout.write('⚠️  即将清空已抓取视频数据与采集任务数据...\n')
    process.stdout.write(
      `   当前数据量：videos=${before.videos}, video_sources=${before.videoSources}, crawler_runs=${before.crawlerRuns}, crawler_tasks=${before.crawlerTasks}, crawler_task_logs=${before.crawlerTaskLogs}\n`,
    )

    await client.query('BEGIN')

    // 采集任务链路：日志 -> task -> run
    await client.query('TRUNCATE TABLE crawler_task_logs, crawler_tasks, crawler_runs RESTART IDENTITY CASCADE')
    // 视频主数据：通过 CASCADE 清理关联表（播放源、字幕、评论、历史、收藏、别名等）
    await client.query('TRUNCATE TABLE videos RESTART IDENTITY CASCADE')
    // 站点保留，但采集状态回到未采集
    await client.query('UPDATE crawler_sites SET last_crawled_at = NULL, last_crawl_status = NULL')

    await client.query('COMMIT')

    const after = {
      videos: await countRows(client, 'videos'),
      videoSources: await countRows(client, 'video_sources'),
      crawlerRuns: await countRows(client, 'crawler_runs'),
      crawlerTasks: await countRows(client, 'crawler_tasks'),
      crawlerTaskLogs: await countRows(client, 'crawler_task_logs'),
    }

    process.stdout.write('✅ 清理完成。\n')
    process.stdout.write(
      `   清理结果：videos ${before.videos}->${after.videos}, video_sources ${before.videoSources}->${after.videoSources}, crawler_runs ${before.crawlerRuns}->${after.crawlerRuns}, crawler_tasks ${before.crawlerTasks}->${after.crawlerTasks}, crawler_task_logs ${before.crawlerTaskLogs}->${after.crawlerTaskLogs}\n`,
    )
  } catch (err) {
    await client.query('ROLLBACK')
    process.stderr.write(`❌ 清理失败：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    client.release()
    await db.end()
  }
}

void main()
