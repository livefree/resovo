/**
 * scripts/audit-cross-season-merge.ts — VIDEO-NAMING-STANDARD-C：跨季误合并存量盘点（只读）
 *
 * 三类问题口径（TS 调 parseTitle 精确解析，含中文数字；纯只读不写库）：
 *
 *   A. 跨季混挂：同一 video 的别名解析出 ≥2 个不同季号——旧三元组匹配期
 *      「某剧 第1季/第2季」复用同一 catalog/video，sources 跨季混挂。
 *   B. 季槽位错位（**新爬重复实体风险**）：video 标题/别名解析出唯一季号 N，
 *      但 catalog.season_number IS NULL——A 卡后采集走四元组匹配，
 *      `season_number IS NOT DISTINCT FROM N` 对 NULL 槽位永不命中 →
 *      同一季再建重复 catalog/video。B 卡刻意未回填 season_number 留下的缺口。
 *   C. 发布形态 normalized 撞键：标题含 剧场版/OVA/SP/番外 但
 *      catalog.title_normalized 不含 marker（旧 normalizeMergeKey 剥括号产物）——
 *      与正篇同 key，正篇出现时误归并。
 *
 * 用法：node --env-file=.env.local --import tsx scripts/audit-cross-season-merge.ts
 */

import { Pool } from 'pg'
import { parseTitle } from '@/api/services/TitleIdentityParser'

interface VideoRow {
  id: string
  title: string
  episode_count: number | null
  catalog_id: string | null
  catalog_season: number | null
  title_normalized: string | null
  catalog_year: number | null
  catalog_type: string | null
  aliases: string[]
  source_rows: string
  source_episodes: string
  max_episode: number | null
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const { rows: videos } = await pool.query<VideoRow>(
      `SELECT v.id, v.title, v.episode_count,
              v.catalog_id, mc.season_number AS catalog_season,
              mc.title_normalized, mc.year AS catalog_year, mc.type AS catalog_type,
              COALESCE(array_agg(DISTINCT va.alias) FILTER (WHERE va.alias IS NOT NULL), '{}') AS aliases,
              (SELECT COUNT(*) FROM video_sources vs WHERE vs.video_id = v.id AND vs.deleted_at IS NULL) AS source_rows,
              (SELECT COUNT(DISTINCT vs.episode_number) FROM video_sources vs WHERE vs.video_id = v.id AND vs.deleted_at IS NULL) AS source_episodes,
              (SELECT MAX(vs.episode_number) FROM video_sources vs WHERE vs.video_id = v.id AND vs.deleted_at IS NULL) AS max_episode
         FROM videos v
         LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
         LEFT JOIN video_aliases va ON va.video_id = v.id
        WHERE v.deleted_at IS NULL
        GROUP BY v.id, mc.season_number, mc.title_normalized, mc.year, mc.type
        ORDER BY v.id`,
    )

    // ── A. 跨季混挂 ──
    const crossSeason: Array<{ v: VideoRow; seasons: number[] }> = []
    // ── B. 季槽位错位（catalog_season NULL 但标题/别名有唯一季号）──
    const slotMismatch: Array<{ v: VideoRow; season: number }> = []
    // ── C. 发布形态撞键 ──
    const markerCollision: Array<{ v: VideoRow; marker: string }> = []

    for (const v of videos) {
      const texts = [v.title, ...v.aliases]
      const seasons = new Set<number>()
      let marker: string | null = null
      for (const t of texts) {
        const { facets } = parseTitle(t)
        if (facets.seasonNumber !== null) seasons.add(facets.seasonNumber)
        if (marker === null && facets.releaseMarker !== null) marker = facets.releaseMarker
      }
      const list = [...seasons].sort((a, b) => a - b)

      if (list.length >= 2) crossSeason.push({ v, seasons: list })
      else if (list.length === 1 && v.catalog_id !== null && v.catalog_season === null) {
        slotMismatch.push({ v, season: list[0]! })
      }

      if (marker !== null && v.title_normalized !== null) {
        // normalized 不含 marker（小写比较，OVA/SP 英文 marker 在 normalized 中为小写）
        if (!v.title_normalized.toLowerCase().includes(marker.toLowerCase())) {
          markerCollision.push({ v, marker })
        }
      }
    }

    console.log('═══ A. 跨季混挂（别名 ≥2 季号，需拆分评估）═══')
    console.log(`计 ${crossSeason.length} 个视频`)
    for (const { v, seasons } of crossSeason) {
      console.log(
        `  ${v.id} 「${v.title}」 季号={${seasons.join(',')}} catalog_season=${v.catalog_season}` +
        ` sources=${v.source_rows}行/${v.source_episodes}集 max_ep=${v.max_episode} episode_count=${v.episode_count}`,
      )
    }

    console.log('\n═══ B. 季槽位错位（catalog.season_number NULL，新爬四元组永不命中 → 重复实体风险）═══')
    console.log(`计 ${slotMismatch.length} 个视频`)
    const bySeason = new Map<number, number>()
    for (const { season } of slotMismatch) bySeason.set(season, (bySeason.get(season) ?? 0) + 1)
    console.log(`  季号分布：${[...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `第${s}季×${n}`).join(' / ')}`)
    for (const { v, season } of slotMismatch.slice(0, 10)) {
      console.log(`  [样本] ${v.id} 「${v.title}」 季=${season} normalized=「${v.title_normalized}」`)
    }

    // B 类潜在撞键预检：回填 season 后是否撞既有四元组唯一槽位
    let backfillConflicts = 0
    for (const { v, season } of slotMismatch) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM media_catalog
          WHERE title_normalized = $1 AND type = $2
            AND year IS NOT DISTINCT FROM $3 AND season_number = $4 AND id <> $5`,
        [v.title_normalized, v.catalog_type, v.catalog_year, season, v.catalog_id],
      )
      if (rows.length > 0) {
        backfillConflicts++
        console.log(`  [回填撞键] ${v.id} 「${v.title}」 季=${season} 与既有 catalog ${rows[0]!.id} 冲突`)
      }
    }
    console.log(`  回填 season_number 撞键预检：${backfillConflicts} 例冲突（0 = 可直接回填）`)

    console.log('\n═══ C. 发布形态 normalized 撞键（剧场版/OVA/SP 与正篇同 key）═══')
    console.log(`计 ${markerCollision.length} 个视频`)
    for (const { v, marker } of markerCollision) {
      const { rows: siblings } = await pool.query<{ id: string; title: string }>(
        `SELECT id, title FROM media_catalog
          WHERE title_normalized = $1 AND type = $2 AND id <> $3 LIMIT 3`,
        [v.title_normalized, v.catalog_type, v.catalog_id],
      )
      console.log(
        `  ${v.id} 「${v.title}」 marker=${marker} normalized=「${v.title_normalized}」` +
        ` 同 key 兄弟 catalog：${siblings.length > 0 ? siblings.map((s) => `「${s.title}」`).join(' ') : '无（暂未撞，正篇入库时触发）'}`,
      )
    }

    console.log('\n═══ 观看进度影响面 ═══')
    const { rows: [wh] } = await pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM watch_history`)
    console.log(`  watch_history 总行数：${wh!.n}（拆分需迁移的进度行数上界）`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[audit-cross-season-merge] 失败：', err)
  process.exitCode = 2
})
