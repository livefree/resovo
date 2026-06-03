/**
 * backfill-title-observations.ts — 为现有 video 回填 title_observations（blocking 召回数据源）
 *
 * 背景：identity 离线候选（CHG-VIR-8）的 blocking 召回依赖 title_observations.coreTitleKey 分桶
 * （蓝图风险点 7 / changelog 注意事项③）。采集链路 fire-and-forget shadow 写入覆盖度低
 * （dev/历史 video），导致离线 job 召回 0 桶 → 0 候选。本脚本为现有 video 补 site 级观测，
 * 使 blocking 有数据、shadow 验证可行。
 *
 * **真幂等**：用 `ON CONFLICT DO NOTHING`（已存在则跳过，**不累加 observed_count**）。
 * 回填语义 = 补历史观测，与采集链路 `recordTitleObservation`（每次 +1，观测频次信号）刻意不同
 * —— 故本脚本**不复用** recordTitleObservation（其 DO UPDATE +1 会让重跑虚增 observed_count），
 * 改用本地 DO NOTHING SQL（复述 migration 085 去重唯一键 COALESCE 表达式）。
 *
 * 运行：node --env-file=.env.local --import tsx scripts/backfill-title-observations.ts
 */

import { db } from '@/api/lib/postgres'
import { buildTitleObservation } from '@/api/services/titleObservation.builder'
import type { TitleObservationInput } from '@/api/db/queries/titleObservations'

/** 回填专用：已存在则跳过（DO NOTHING），不累加 observed_count → 重跑真幂等。 */
async function insertObservationIfAbsent(input: TitleObservationInput): Promise<void> {
  await db.query(
    `INSERT INTO title_observations
       (video_id, source_site_key, source_name, raw_title, raw_title_hash, parser_version, parsed_facets_jsonb)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (
       video_id,
       COALESCE(source_site_key, ''),
       COALESCE(source_name, ''),
       raw_title_hash,
       parser_version
     )
     DO NOTHING`,
    [
      input.videoId,
      input.sourceSiteKey,
      input.sourceName,
      input.rawTitle,
      input.rawTitleHash,
      input.parserVersion,
      JSON.stringify(input.parsedFacets),
    ],
  )
}

async function main(): Promise<void> {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let total = 0
  for (;;) {
    const r = await db.query<{ id: string; title: string }>(
      `SELECT id, title FROM videos
       WHERE deleted_at IS NULL AND title IS NOT NULL AND id > $1
       ORDER BY id ASC LIMIT 500`,
      [cursor],
    )
    if (r.rows.length === 0) break
    for (const v of r.rows) {
      // site 级观测（source_site_key=null）：同一 video.title 对全源一致（CHG-VIR-6 范式）
      await insertObservationIfAbsent(buildTitleObservation(v.id, v.title, null))
      total++
    }
    cursor = r.rows[r.rows.length - 1]!.id
    if (total % 2000 === 0) console.log(`  ...已处理 ${total}`)
  }
  console.log(`✅ 回填完成：处理 ${total} 个 video（DO NOTHING 真幂等，已存在跳过不累加 observed_count）`)
  await db.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('回填失败:', err)
  process.exit(1)
})
