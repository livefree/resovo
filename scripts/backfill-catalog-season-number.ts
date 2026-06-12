/**
 * scripts/backfill-catalog-season-number.ts — VIDEO-NAMING-STANDARD-D：
 * B 类季槽位错位回填（cross-season-merge-audit-20260612 §B）
 *
 * 问题：355 个视频标题/别名解析出**唯一**季号 N，但 `media_catalog.season_number IS NULL`。
 * A 卡后采集四元组匹配 `season_number IS NOT DISTINCT FROM N` 对 NULL 槽位永不命中
 * → 这批视频每次重爬都会新建重复 catalog/video（活跃风险，非单纯历史遗留）。
 *
 * 回填规则（保守三重守卫）：
 *   1. 仅「标题+别名解析出且仅出 1 个季号」的 video（A 类 ≥2 季混挂行不碰，归 E 卡）；
 *   2. 同 catalog 下多视频季号分歧 → 整 catalog 跳过 + 报告（归 E 卡人工）；
 *   3. 执行时再做四元组撞键预检（审计已 0 冲突，防数据漂移）+ 批内同四元组互撞
 *      跳过 + 逐行 try/catch（唯一索引兜底）。
 *
 * 不动 title_normalized / videos 行 / ES（season_number 不在搜索索引）。
 * media_catalog.updated_at 经既有触发器 bump（内容确变，语义成立——B 卡同口径）。
 *
 * 用法：node --env-file=.env.local --import tsx scripts/backfill-catalog-season-number.ts [--dry-run]
 * 幂等：UPDATE ... WHERE season_number IS NULL；重跑 updated=0。
 */

import { Pool } from 'pg'
import { parseTitle } from '@/api/services/TitleIdentityParser'

const DRY_RUN = process.argv.includes('--dry-run')

interface VideoRow {
  id: string
  title: string
  catalog_id: string
  title_normalized: string | null
  catalog_year: number | null
  catalog_type: string | null
  catalog_title: string
  aliases: string[]
}

function uniqueSeasonOf(texts: string[]): number | null {
  const seasons = new Set<number>()
  for (const t of texts) {
    const { facets } = parseTitle(t)
    if (facets.seasonNumber !== null) seasons.add(facets.seasonNumber)
  }
  return seasons.size === 1 ? [...seasons][0]! : null
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const { rows: videos } = await pool.query<VideoRow>(
      `SELECT v.id, v.title, v.catalog_id,
              mc.title_normalized, mc.year AS catalog_year, mc.type AS catalog_type, mc.title AS catalog_title,
              COALESCE(array_agg(DISTINCT va.alias) FILTER (WHERE va.alias IS NOT NULL), '{}') AS aliases
         FROM videos v
         JOIN media_catalog mc ON mc.id = v.catalog_id AND mc.season_number IS NULL
         LEFT JOIN video_aliases va ON va.video_id = v.id
        WHERE v.deleted_at IS NULL
        GROUP BY v.id, mc.id
        ORDER BY v.id`,
    )

    // 守卫 1+2：按 catalog 聚合，catalog 内所有 video 的唯一季号必须一致
    const byCatalog = new Map<string, { season: number | null; conflicted: boolean; sample: VideoRow }>()
    for (const v of videos) {
      const season = uniqueSeasonOf([v.title, ...v.aliases])
      const entry = byCatalog.get(v.catalog_id)
      if (!entry) {
        byCatalog.set(v.catalog_id, { season, conflicted: false, sample: v })
      } else if (entry.season !== season) {
        entry.conflicted = true
      }
    }

    const candidates: Array<{ catalogId: string; season: number; sample: VideoRow }> = []
    let skippedConflicted = 0
    for (const [catalogId, { season, conflicted, sample }] of byCatalog) {
      if (conflicted) {
        skippedConflicted++
        console.warn(`  [跳过/catalog 内分歧] ${catalogId} 「${sample.catalog_title}」（归 E 卡）`)
        continue
      }
      if (season !== null) candidates.push({ catalogId, season, sample })
    }

    // 守卫 3a：批内同四元组互撞（两个 NULL catalog 回填到同一槽位）
    const tupleSeen = new Map<string, string>()
    const intraConflicts = new Set<string>()
    for (const c of candidates) {
      const key = JSON.stringify([c.sample.title_normalized, c.sample.catalog_type, c.sample.catalog_year, c.season])
      const prior = tupleSeen.get(key)
      if (prior) {
        intraConflicts.add(prior)
        intraConflicts.add(c.catalogId)
      } else {
        tupleSeen.set(key, c.catalogId)
      }
    }

    let updated = 0
    let skippedExisting = 0
    const failures: Array<{ id: string; error: string }> = []

    for (const { catalogId, season, sample } of candidates) {
      if (intraConflicts.has(catalogId)) {
        console.warn(`  [跳过/批内同槽位] ${catalogId} 「${sample.catalog_title}」 季=${season}（归 E 卡）`)
        continue
      }
      // 守卫 3b：执行时四元组既有占位复检（防审计后数据漂移）
      const { rows: occupied } = await pool.query<{ id: string }>(
        `SELECT id FROM media_catalog
          WHERE title_normalized = $1 AND type = $2
            AND year IS NOT DISTINCT FROM $3 AND season_number = $4 AND id <> $5 LIMIT 1`,
        [sample.title_normalized, sample.catalog_type, sample.catalog_year, season, catalogId],
      )
      if (occupied[0]) {
        skippedExisting++
        console.warn(`  [跳过/槽位已占] ${catalogId} 「${sample.catalog_title}」 季=${season} ↔ ${occupied[0].id}`)
        continue
      }

      if (DRY_RUN) {
        updated++
        continue
      }
      try {
        const result = await pool.query(
          `UPDATE media_catalog SET season_number = $2 WHERE id = $1 AND season_number IS NULL`,
          [catalogId, season],
        )
        updated += result.rowCount ?? 0
      } catch (err) {
        failures.push({ id: catalogId, error: err instanceof Error ? err.message : String(err) })
      }
    }

    console.log(
      `[backfill-catalog-season-number] ${DRY_RUN ? '[dry-run] 待回填' : '已回填'} catalog ${updated}` +
      ` / catalog 内分歧跳过 ${skippedConflicted} / 批内互撞跳过 ${intraConflicts.size} / 槽位已占跳过 ${skippedExisting}` +
      ` / 失败 ${failures.length}`,
    )
    for (const f of failures) console.error(`  [失败] ${f.id}: ${f.error}`)
    if (failures.length > 0) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[backfill-catalog-season-number] 失败：', err)
  process.exitCode = 2
})
