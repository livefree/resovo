/**
 * scripts/backfill-source-languages.ts — LANG-DIM-B（ADR-199 D-199-5）：存量播放源语言回填
 *
 * Migration 112 落列后存量 56 万级 video_sources 行语言四列全为 DEFAULT
 * （NULL/unknown）。本脚本按推断链可得信号回填：
 *
 *   - vod_lang 历史未存储**不可得**（D-199-5 如实建模）→ 仅三级信号：
 *     0. source_name 行级 token（行间差异唯一来源）
 *     2. title token——视频原始标题已被 VIDEO-NAMING-STANDARD-B 清洗，
 *        原文在 `video_aliases`（清洗前旧标题 + 采集原文）→ 逐别名重 parse，
 *        取首个产出语音 / 字幕 token 的别名
 *     3. catalog.country 地区推断（仅 audio；ISO/中文双形态经 normalizeCountryCode）
 *   - provenance 如实标 source_name_token / title_token / region_inferred；
 *     后续真实 vod_lang 重爬依 D-199-1 升级规则覆盖 region_inferred。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/backfill-source-languages.ts [--dry-run]
 *
 * 幂等可重入：UPDATE 经 provenance 等级守卫 + IS DISTINCT FROM（重跑同值不写）；
 * 按 video 分组循环（~4.4k 视频 / 行级 UPDATE 按推断结果元组分组批量执行）。
 * 不触 ES（语言列不在搜索索引）/ 不动 updated_at（无触发器，信号列口径同 probe 路径）。
 */

import { Pool } from 'pg'
import { parseTitle } from '@/api/services/TitleIdentityParser'
import {
  resolveSourceLanguages,
  type TitleLanguageFacets,
} from '@/api/services/SourceLanguageResolver'
import { languageSourceRankSql } from '@/api/db/queries/sources.types'

const DRY_RUN = process.argv.includes('--dry-run')

interface VideoRow {
  id: string
  country: string | null
  aliases: string[]
}

interface SourceRow {
  id: string
  source_name: string
}

/** 逐别名重 parse，取首个产出语音 / 字幕 token 的 facets（两维度独立取首）。 */
function deriveTitleFacetsFromAliases(aliases: string[]): TitleLanguageFacets | null {
  let audioLanguage: string | null = null
  let subtitleMarker: string | null = null
  let subtitleLanguages: string[] = []
  for (const alias of aliases) {
    const { facets } = parseTitle(alias)
    if (audioLanguage === null && facets.audioLanguage !== null) {
      audioLanguage = facets.audioLanguage
    }
    if (subtitleMarker === null && facets.subtitleMarker !== null) {
      subtitleMarker = facets.subtitleMarker
      subtitleLanguages = facets.subtitleLanguages
    }
    if (audioLanguage !== null && subtitleMarker !== null) break
  }
  if (audioLanguage === null && subtitleMarker === null) return null
  return { audioLanguage, subtitleMarker, subtitleLanguages }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })

  const newAudioRank = languageSourceRankSql('$2::text')
  const oldAudioRank = languageSourceRankSql('audio_language_source')
  const newSubRank = languageSourceRankSql('$4::text')
  const oldSubRank = languageSourceRankSql('subtitle_language_source')

  try {
    const { rows: videos } = await pool.query<VideoRow>(
      `SELECT v.id, mc.country,
              COALESCE(array_agg(va.alias) FILTER (WHERE va.alias IS NOT NULL), '{}') AS aliases
         FROM videos v
         LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
         LEFT JOIN video_aliases va ON va.video_id = v.id
        WHERE v.deleted_at IS NULL
        GROUP BY v.id, mc.country
        ORDER BY v.id`,
    )
    console.log(`[backfill-source-languages] 视频 ${videos.length} 个`)

    let rowsUpdated = 0
    const byProvenance = new Map<string, number>()
    const samples: string[] = []

    for (const video of videos) {
      const titleFacets = deriveTitleFacetsFromAliases(video.aliases)
      const { rows: sources } = await pool.query<SourceRow>(
        `SELECT id, source_name FROM video_sources WHERE video_id = $1 AND deleted_at IS NULL`,
        [video.id],
      )
      if (sources.length === 0) continue

      // 按 source_name 缓存推断结果（同名行同结果），再按结果元组分组批量 UPDATE
      const groups = new Map<string, { ids: string[]; resolved: ReturnType<typeof resolveSourceLanguages> }>()
      const byName = new Map<string, ReturnType<typeof resolveSourceLanguages>>()
      for (const s of sources) {
        let resolved = byName.get(s.source_name)
        if (!resolved) {
          resolved = resolveSourceLanguages({
            sourceName: s.source_name,
            vodLang: null, // 历史未存储不可得（D-199-5）
            titleFacets,
            country: video.country,
          })
          byName.set(s.source_name, resolved)
        }
        if (resolved.audioLanguageSource === 'unknown' && resolved.subtitleLanguageSource === 'unknown') continue
        const key = JSON.stringify([
          resolved.audioLanguage, resolved.audioLanguageSource,
          resolved.subtitleLanguages, resolved.subtitleLanguageSource,
        ])
        const group = groups.get(key)
        if (group) group.ids.push(s.id)
        else groups.set(key, { ids: [s.id], resolved })
      }

      for (const { ids, resolved } of groups.values()) {
        const provKey = `audio=${resolved.audioLanguageSource}/sub=${resolved.subtitleLanguageSource}`
        if (DRY_RUN) {
          rowsUpdated += ids.length
          byProvenance.set(provKey, (byProvenance.get(provKey) ?? 0) + ids.length)
          if (samples.length < 20) {
            samples.push(
              `video=${video.id} rows=${ids.length} audio=${resolved.audioLanguage}(${resolved.audioLanguageSource})` +
              ` sub=${JSON.stringify(resolved.subtitleLanguages)}(${resolved.subtitleLanguageSource})`,
            )
          }
          continue
        }
        const result = await pool.query(
          `UPDATE video_sources SET
             audio_language = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN $1::text ELSE audio_language END,
             audio_language_source = CASE WHEN ${newAudioRank} >= ${oldAudioRank} THEN $2::text ELSE audio_language_source END,
             subtitle_languages = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN $3::text[] ELSE subtitle_languages END,
             subtitle_language_source = CASE WHEN ${newSubRank} >= ${oldSubRank} THEN $4::text ELSE subtitle_language_source END
           WHERE id = ANY($5::uuid[])
             AND (${newAudioRank} > ${oldAudioRank}
               OR (${newAudioRank} = ${oldAudioRank} AND ${newAudioRank} > 0 AND $1::text IS DISTINCT FROM audio_language)
               OR ${newSubRank} > ${oldSubRank}
               OR (${newSubRank} = ${oldSubRank} AND ${newSubRank} > 0 AND $3::text[] IS DISTINCT FROM subtitle_languages))`,
          [
            resolved.audioLanguage, resolved.audioLanguageSource,
            resolved.subtitleLanguages, resolved.subtitleLanguageSource,
            ids,
          ],
        )
        rowsUpdated += result.rowCount ?? 0
        byProvenance.set(provKey, (byProvenance.get(provKey) ?? 0) + (result.rowCount ?? 0))
      }
    }

    console.log(`[backfill-source-languages] ${DRY_RUN ? '[dry-run] 待回填' : '已回填'}行数：${rowsUpdated}`)
    for (const [prov, n] of [...byProvenance.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${prov}: ${n}`)
    }
    if (DRY_RUN) {
      for (const line of samples) console.log(`  [样本] ${line}`)
      console.log('[backfill-source-languages] --dry-run，不写库')
      return
    }

    // 收敛观测：audio 维度覆盖率（非 unknown 占比）
    const { rows: [coverage] } = await pool.query<{ total: string; covered: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE audio_language_source <> 'unknown') AS covered
         FROM video_sources WHERE deleted_at IS NULL`,
    )
    console.log(
      `[backfill-source-languages] audio 覆盖率：${coverage.covered}/${coverage.total}` +
      `（${(Number(coverage.covered) / Number(coverage.total) * 100).toFixed(1)}%）`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[backfill-source-languages] 失败：', err)
  process.exitCode = 2
})
