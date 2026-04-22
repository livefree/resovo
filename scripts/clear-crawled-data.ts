/**
 * scripts/clear-crawled-data.ts — 清空采集/入库/外部原始数据（CHORE-05）
 *
 * 用法：
 *   npm run clear:crawled-data -- --dry-run   # 仅输出清单与行数，不执行
 *   npm run clear:crawled-data -- --execute   # 真正执行清空（幂等）
 *   # 缺省传参 → 视为 --dry-run，避免误操作
 *
 * 授权：SEQ-20260422-BUGFIX-01 CHORE-05，用户 2026-04-22 授权清空
 *   数据层 / 外部原始 / 运行记录；保留配置层与部分用户行为表。
 *
 * 说明：
 *   - 因 videos 子表（watch_history / comments / danmaku / user_favorites /
 *     list_items 等）以 `ON DELETE CASCADE` 绑定 videos，清 videos 必然
 *     连带清这些用户行为表。试验期数据本质为测试数据，行为表随 videos
 *     一并清空（与 CHORE-05 文档备注一致）。
 *   - 保留：crawler_sites / crawler_tasks / system_settings / users /
 *     home_banners / brands / lists（列表容器，不含 list_items）/
 *     list_likes 的行若未被 lists 级联删除会保留。
 *   - crawler_sites 的 last_crawled_at / last_crawl_status 重置，使下一轮
 *     采集在干净基线上运行。
 */

import { Pool, type PoolClient } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write('❌ DATABASE_URL 未设置，请检查 .env.local\n')
  process.exit(1)
}

const MODE = process.argv.includes('--execute')
  ? 'execute'
  : 'dry-run'

const db = new Pool({ connectionString: DATABASE_URL })

/**
 * 目标清空表清单（按执行顺序）。
 * 顺序遵循 FK 依赖：先清依赖方，再清被依赖方。
 */
const TARGET_TABLES_ORDER = [
  // 1. 运行观察记录（独立，先清）
  'source_health_events',
  'video_state_watchdog_runs',
  'broken_image_events',

  // 2. 外部原始数据（按 FK 倒序）
  'external_imdb_tmdb_links',
  'external_douban_movies_raw',
  'external_tmdb_movies_raw',
  'external_bangumi_subjects_raw',
  'external_import_batches',

  // 3. 外部画像（独立表，位于 external_data schema）
  'external_data.douban_people',
  'external_data.douban_entries',
  'external_data.bangumi_entries',

  // 4. 采集运行链路（crawler_tasks 是运行实例而非模板，应清）
  'crawler_task_logs',
  'crawler_tasks',
  'crawler_runs',

  // 5. videos 清空（CASCADE 会级联清：video_sources / subtitles /
  //    video_tags / video_aliases / video_episode_images /
  //    video_external_refs / video_metadata_* /
  //    user_favorites / watch_history / comments / danmaku /
  //    list_items 等所有 FK→videos(id) 的表）
  'videos',

  // 6. media_catalog（videos.catalog_id 已在 5 中清空，这里安全清）
  'media_catalog_aliases',
  'media_catalog',
] as const

/**
 * 受 CASCADE 间接清空的表，仅用于报告；脚本不单独清它们。
 */
const CASCADE_INDIRECT_TABLES = [
  'video_sources',
  'subtitles',
  'video_tags',
  'tags',
  'video_aliases',
  'video_episode_images',
  'video_external_refs',
  'video_metadata_locks',
  'video_metadata_provenance',
  'user_favorites',
  'watch_history',
  'comments',
  'danmaku',
  'list_items',
] as const

/**
 * 禁止清空的表（仅用于报告时确认其行数不变）。
 */
const PRESERVE_TABLES = [
  'users',
  'crawler_sites',    // 站点配置表（由管理员维护，保留）
  'system_settings',
  'home_banners',
  'brands',
  'lists',
  'list_likes',
] as const

async function countRows(
  client: PoolClient,
  table: string,
): Promise<number | null> {
  try {
    // 支持 schema.table 形式
    const qualified = table.includes('.')
      ? table.split('.').map((p) => `"${p}"`).join('.')
      : `"${table}"`
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${qualified}`,
    )
    return parseInt(res.rows[0]?.count ?? '0', 10) || 0
  } catch {
    return null
  }
}

async function reportRows(
  client: PoolClient,
  label: string,
  tables: readonly string[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  process.stdout.write(`\n=== ${label} ===\n`)
  for (const t of tables) {
    const c = await countRows(client, t)
    result.set(t, c)
    const status = c === null ? '(N/A)' : String(c)
    process.stdout.write(`  ${t.padEnd(38)} ${status.padStart(10)}\n`)
  }
  return result
}

async function main() {
  const client = await db.connect()
  try {
    process.stdout.write(
      `\n🔧 clear-crawled-data.ts — CHORE-05\n`,
    )
    process.stdout.write(
      `   模式：${MODE === 'execute' ? '⚠️  EXECUTE（实际清空）' : '📋 DRY-RUN（仅输出行数）'}\n`,
    )
    process.stdout.write(`   时间：${new Date().toISOString()}\n`)

    // 1. before 报告
    const before = await reportRows(client, 'BEFORE · 目标清空表', TARGET_TABLES_ORDER)
    await reportRows(client, 'BEFORE · CASCADE 级联表（将随 videos 清空）', CASCADE_INDIRECT_TABLES)
    await reportRows(client, 'BEFORE · 保留表（不应变）', PRESERVE_TABLES)

    if (MODE === 'dry-run') {
      process.stdout.write(
        `\n💡 DRY-RUN 完成，未改动数据。\n` +
          `   确认清单后，重新运行：npm run clear:crawled-data -- --execute\n\n`,
      )
      return
    }

    // 2. execute：按顺序 DELETE（而非 TRUNCATE，保留 sequence 便于审计）
    process.stdout.write(`\n⚠️  开始执行清空...\n`)
    await client.query('BEGIN')

    for (const t of TARGET_TABLES_ORDER) {
      const c = before.get(t)
      if (c === null) {
        process.stdout.write(`  跳过 ${t}（表不存在）\n`)
        continue
      }
      if (c === 0) {
        process.stdout.write(`  跳过 ${t}（已为空）\n`)
        continue
      }
      const qualified = t.includes('.')
        ? t.split('.').map((p) => `"${p}"`).join('.')
        : `"${t}"`
      process.stdout.write(`  DELETE FROM ${qualified} ... `)
      const r = await client.query(`DELETE FROM ${qualified}`)
      process.stdout.write(`${r.rowCount} rows\n`)
    }

    // 3. 重置 crawler_sites 状态
    process.stdout.write(`  UPDATE crawler_sites SET last_crawled_at=NULL ... `)
    const up = await client.query(
      `UPDATE crawler_sites SET last_crawled_at = NULL, last_crawl_status = NULL`,
    )
    process.stdout.write(`${up.rowCount} rows\n`)

    await client.query('COMMIT')
    process.stdout.write(`\n✅ 清空完成（事务已提交）\n`)

    // 4. after 报告
    await reportRows(client, 'AFTER · 目标清空表', TARGET_TABLES_ORDER)
    await reportRows(client, 'AFTER · CASCADE 级联表', CASCADE_INDIRECT_TABLES)
    await reportRows(client, 'AFTER · 保留表', PRESERVE_TABLES)

    process.stdout.write(
      `\n📝 请手动同步 docs/crawl_data_reset_20260422.md 的执行前/后 count 表\n\n`,
    )
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    process.stderr.write(
      `❌ 失败（已回滚）：${err instanceof Error ? err.message : String(err)}\n`,
    )
    process.exit(1)
  } finally {
    client.release()
    await db.end()
  }
}

void main()
