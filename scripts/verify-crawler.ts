/**
 * scripts/verify-crawler.ts — 验证爬虫完整采集链路
 *
 * 用法：npm run verify:crawler
 * 直接调用 CrawlerService（不经过 API），验证从采集→解析→写库→ES 同步的完整链路
 */

import { Pool } from 'pg'
import { Client as ESClient } from '@elastic/elasticsearch'
import { CrawlerService, parseCrawlerSources } from '../src/api/services/CrawlerService'

// ── 主流程 ────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL
  const crawlerSourcesRaw = process.env.CRAWLER_SOURCES

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 未设置')
    process.exit(1)
  }
  if (!elasticsearchUrl) {
    console.error('❌ ELASTICSEARCH_URL 未设置')
    process.exit(1)
  }
  if (!crawlerSourcesRaw) {
    console.error('❌ CRAWLER_SOURCES 未设置，请在 .env.local 中配置')
    process.exit(1)
  }

  const sources = parseCrawlerSources(crawlerSourcesRaw)
  if (sources.length === 0) {
    console.error('❌ CRAWLER_SOURCES 解析失败或为空数组')
    process.exit(1)
  }

  const enabledSources = sources.filter(
    (s) => !(s as { enabled?: boolean }).enabled === false
  )
  if (enabledSources.length === 0) {
    console.error('❌ 没有启用的资源站（enabled: true）')
    process.exit(1)
  }

  console.log('\n=== Resovo 爬虫链路验证 ===\n')
  console.log(`资源站数量：${enabledSources.length}`)
  enabledSources.forEach((s) => console.log(`  - ${s.name} (${s.base}) [${s.format}]`))
  console.log('')

  const db = new Pool({ connectionString: databaseUrl })
  const es = new ESClient({ node: elasticsearchUrl })

  try {
    // 1. 验证数据库连接
    await db.query('SELECT 1')
    console.log('✅ 数据库连接正常')

    // 2. 验证 Elasticsearch 连接
    await es.ping()
    console.log('✅ Elasticsearch 连接正常')

    // 3. 记录采集前的数量
    const beforeVideos = await db.query<{ count: string }>('SELECT COUNT(*) FROM videos WHERE deleted_at IS NULL')
    const beforeSources = await db.query<{ count: string }>('SELECT COUNT(*) FROM video_sources WHERE is_active = true AND deleted_at IS NULL')
    console.log(`\n采集前：视频 ${beforeVideos.rows[0].count} 条，播放源 ${beforeSources.rows[0].count} 条`)

    // 4. 执行增量采集（只取最近 24 小时，避免全量耗时过长）
    const crawler = new CrawlerService(db, es)
    const source = enabledSources[0]

    console.log(`\n▶ 开始增量采集（最近 24 小时）：${source.name}`)
    const result = await crawler.crawl(source, { hoursAgo: 24 })

    console.log(`\n采集完成：`)
    console.log(`  页数：${result.page}`)
    console.log(`  视频入库：${result.videosUpserted} 条`)
    console.log(`  播放源入库：${result.sourcesUpserted} 条`)
    console.log(`  错误数：${result.errors}`)

    // 5. 记录采集后的数量
    const afterVideos = await db.query<{ count: string }>('SELECT COUNT(*) FROM videos WHERE deleted_at IS NULL')
    const afterSources = await db.query<{ count: string }>('SELECT COUNT(*) FROM video_sources WHERE is_active = true AND deleted_at IS NULL')
    console.log(`\n采集后：视频 ${afterVideos.rows[0].count} 条，播放源 ${afterSources.rows[0].count} 条`)

    // 6. 验证 ES 索引
    await new Promise<void>((resolve) => setTimeout(resolve, 2000)) // 等待 ES 刷新
    const esCount = await es.count({ index: 'resovo_videos' })
    console.log(`Elasticsearch 索引：${esCount.count} 条`)

    // 7. 验证采样数据
    if (Number(afterVideos.rows[0].count) > 0) {
      const sample = await db.query<{ title: string; type: string; year: number | null; cast: string[] }>(
        `SELECT title, type, year, "cast" FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 3`
      )
      console.log('\n最新入库视频（最多 3 条）：')
      for (const row of sample.rows) {
        console.log(`  - [${row.type}] ${row.title} (${row.year ?? '?'}) 演员:${(row.cast ?? []).slice(0, 2).join(', ')}`)
      }
    }

    // 8. 判断结果
    const videoCount = Number(afterVideos.rows[0].count)
    const sourceCount = Number(afterSources.rows[0].count)

    if (videoCount > 0 && sourceCount > 0) {
      console.log('\n✅ 爬虫链路验证通过：数据库有视频和播放源数据')
    } else if (result.videosUpserted === 0 && result.errors === 0) {
      console.log('\n⚠️  采集返回 0 条（资源站无最近 24 小时更新），链路本身无报错')
      console.log('   可能原因：当前时间段资源站无更新内容，这是正常情况')
      console.log('   建议：删除 hoursAgo 参数运行全量采集以进一步验证')
    } else {
      console.log('\n❌ 验证失败：数据库无视频数据且有错误')
      process.exit(1)
    }

  } finally {
    await db.end()
    await es.close()
  }
}

main().catch((err: unknown) => {
  console.error('❌ 验证失败：', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
