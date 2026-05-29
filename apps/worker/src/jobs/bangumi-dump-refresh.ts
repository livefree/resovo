/**
 * bangumi-dump-refresh.ts — 定时从本地 dump 文件重导 external_data.bangumi_entries（CHG-BNG-09 / ADR-161 C4）
 *
 * 用户决策「本地 dump 定时重导」：不自动下载 GitHub 归档（ZIP 解压需引入新依赖，撞 CLAUDE.md 禁令），
 * 改由 ops 维护本地 dump 路径（BANGUMI_DUMP_PATH），cron 定时读取重导。文件缺失则优雅跳过（不崩 cron）。
 *
 * 自包含：worker 与 scripts/ 分属独立部署包，跨包运行时 import 在 prod 部署易断，故内联 parse+upsert。
 * ⚠️ 列/规则须与 scripts/import-bangumi-dump.ts 保持同步（同 ADR-161 字段映射 + migration 077 schema）：
 *    仅 type=2（动画）；episode_count/cover_url 留 null（dump 无 eps/images，REST getSubject 匹配时写入）。
 */

import { existsSync, createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve as resolvePath } from 'node:path'
import type { Pool } from 'pg'
import type pino from 'pino'

const ANIME_TYPE = 2
const BATCH_SIZE = 500

export interface BangumiDumpEntry {
  bangumiId: number
  titleCn: string | null
  titleJp: string | null
  titleNormalized: string
  airDate: string | null
  year: number | null
  rating: number | null
  episodeCount: number | null
  summary: string | null
  coverUrl: string | null
  rank: number | null
  nsfw: boolean
}

/** 标题归一化（与 scripts/import-bangumi-dump.ts 同规则） */
export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const match = dateStr.match(/^(\d{4})/)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  return Number.isFinite(year) ? year : null
}

/**
 * 解析一行 jsonlines → dump 条目；非 JSON / 非动画 / 无标题 → null（跳过）。纯函数，供单测。
 */
export function parseBangumiLine(line: string): BangumiDumpEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (Number(parsed.type) !== ANIME_TYPE) return null

  const titleJp = typeof parsed.name === 'string' ? parsed.name || null : null
  const titleCn = typeof parsed.name_cn === 'string' ? parsed.name_cn || null : null
  const matchTitle = titleCn || titleJp || ''
  if (!matchTitle) return null

  const airDate = typeof parsed.date === 'string' ? parsed.date || null : null
  const rating = typeof parsed.score === 'number' && parsed.score > 0 ? parsed.score : null
  const rank = typeof parsed.rank === 'number' && parsed.rank > 0 ? parsed.rank : null

  return {
    bangumiId: Number(parsed.id),
    titleCn,
    titleJp,
    titleNormalized: normalizeTitle(matchTitle),
    airDate,
    year: extractYear(airDate),
    rating,
    episodeCount: null,
    summary: typeof parsed.summary === 'string' ? parsed.summary || null : null,
    coverUrl: null,
    rank,
    nsfw: parsed.nsfw === true,
  }
}

async function upsertBatch(pool: Pool, batch: BangumiDumpEntry[]): Promise<void> {
  if (batch.length === 0) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const row of batch) {
      await client.query(
        `INSERT INTO external_data.bangumi_entries
           (bangumi_id, title_cn, title_jp, title_normalized, air_date, year,
            rating, episode_count, summary, cover_url, rank, nsfw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (bangumi_id) DO UPDATE SET
           title_cn = EXCLUDED.title_cn, title_jp = EXCLUDED.title_jp,
           title_normalized = EXCLUDED.title_normalized,
           air_date = EXCLUDED.air_date, year = EXCLUDED.year,
           rating = EXCLUDED.rating, episode_count = EXCLUDED.episode_count,
           summary = EXCLUDED.summary, cover_url = EXCLUDED.cover_url,
           rank = EXCLUDED.rank, nsfw = EXCLUDED.nsfw,
           updated_at = NOW()`,
        [
          row.bangumiId, row.titleCn, row.titleJp, row.titleNormalized,
          row.airDate, row.year, row.rating, row.episodeCount, row.summary, row.coverUrl,
          row.rank, row.nsfw,
        ],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 定时重导入口（cron 调用）。
 * - filePath 未配置（BANGUMI_DUMP_PATH 缺省）→ info + 返回（dump 由 ops provision，未配即不跑，预期态）。
 * - 文件不存在 → warn（含解析后的绝对路径，便于排查）+ 返回（不抛，不崩 cron）。
 * 路径解析为绝对：worker CWD=apps/worker，相对路径会按该目录解析，故 log 绝对路径使误配可见。
 */
export async function runBangumiDumpRefresh(pool: Pool, log: pino.Logger, filePath: string | null): Promise<void> {
  if (!filePath) {
    log.info('BANGUMI_DUMP_PATH not configured; skipping bangumi dump refresh')
    return
  }

  const resolved = resolvePath(filePath)
  if (!existsSync(resolved)) {
    log.warn({ filePath: resolved }, 'bangumi dump file not found; skipping refresh')
    return
  }

  log.info({ filePath: resolved }, 'bangumi dump refresh started')
  const rl = createInterface({ input: createReadStream(resolved, { encoding: 'utf8' }), crlfDelay: Infinity })

  let batch: BangumiDumpEntry[] = []
  let upserted = 0
  let skipped = 0
  for await (const line of rl) {
    const entry = parseBangumiLine(line)
    if (!entry) {
      skipped++
      continue
    }
    batch.push(entry)
    upserted++
    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(pool, batch)
      batch = []
    }
  }
  if (batch.length > 0) await upsertBatch(pool, batch)

  log.info({ upserted, skipped }, 'bangumi dump refresh completed')
}
