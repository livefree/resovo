/**
 * scripts/import-bangumi-dump.ts — 将本地 Bangumi subject.jsonlines dump 导入 external_data.bangumi_entries
 *
 * 仅导入 type=2（动画/anime），约 1 万条
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/import-bangumi-dump.ts \
 *     [--file <path>] [--limit N]
 *
 * 默认文件：external-db/bangumi/Bangumi-dump-2025-06-24.210345Z/subject.jsonlines
 * 幂等：ON CONFLICT (bangumi_id) DO UPDATE
 */

import { Pool } from 'pg'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const DEFAULT_FILE = 'external-db/bangumi/Bangumi-dump-2025-06-24.210345Z/subject.jsonlines'
const BATCH_SIZE = 500
const ANIME_TYPE = 2

// ── CLI ────────────────────────────────────────────────────────────

function parseArgs(): { filePath: string; limit: number | null } {
  const args = process.argv.slice(2)
  const getOpt = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] ?? null : null
  }
  const filePath = resolve(getOpt('--file') ?? DEFAULT_FILE)
  const limitRaw = getOpt('--limit')
  return { filePath, limit: limitRaw ? Number.parseInt(limitRaw, 10) : null }
}

// ── 字符串处理 ──────────────────────────────────────────────────────

function normalizeTitle(input: string): string {
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

// ── 流式读取 ────────────────────────────────────────────────────────

async function* streamLines(filePath: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) yield line
}

// ── DB 批量写入 ─────────────────────────────────────────────────────

interface BangumiEntry {
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
}

async function flushBatch(db: Pool, batch: BangumiEntry[]): Promise<void> {
  if (batch.length === 0) return
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const row of batch) {
      await client.query(
        `INSERT INTO external_data.bangumi_entries
           (bangumi_id, title_cn, title_jp, title_normalized, air_date, year,
            rating, episode_count, summary, cover_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (bangumi_id) DO UPDATE SET
           title_cn = EXCLUDED.title_cn, title_jp = EXCLUDED.title_jp,
           title_normalized = EXCLUDED.title_normalized,
           air_date = EXCLUDED.air_date, year = EXCLUDED.year,
           rating = EXCLUDED.rating, episode_count = EXCLUDED.episode_count,
           summary = EXCLUDED.summary, cover_url = EXCLUDED.cover_url,
           updated_at = NOW()`,
        [
          row.bangumiId, row.titleCn, row.titleJp, row.titleNormalized,
          row.airDate, row.year, row.rating, row.episodeCount, row.summary, row.coverUrl,
        ]
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

// ── 主流程 ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    process.stderr.write('❌  DATABASE_URL 未设置\n')
    process.exit(1)
  }

  const { filePath, limit } = parseArgs()
  const db = new Pool({ connectionString: DATABASE_URL })

  process.stdout.write(`导入文件：${filePath}\n`)
  if (limit) process.stdout.write(`限制行数：${limit}\n`)

  let batch: BangumiEntry[] = []
  let total = 0
  let skipped = 0

  try {
    for await (const line of streamLines(filePath)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(trimmed) } catch { continue }

      if (Number(parsed.type) !== ANIME_TYPE) { skipped++; continue }
      if (limit !== null && total >= limit) break

      const titleJp = typeof parsed.name === 'string' ? parsed.name || null : null
      const titleCn = typeof parsed.name_cn === 'string' ? parsed.name_cn || null : null
      const matchTitle = titleCn || titleJp || ''
      if (!matchTitle) { skipped++; continue }

      const airDate = typeof parsed.date === 'string' ? parsed.date || null : null
      const rating = typeof parsed.score === 'number' && parsed.score > 0 ? parsed.score : null

      batch.push({
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
      })
      total++

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(db, batch)
        batch = []
        process.stdout.write(`\r  已写入：${total.toLocaleString()} 行（跳过非动画：${skipped.toLocaleString()}）`)
      }
    }

    if (batch.length > 0) await flushBatch(db, batch)
    process.stdout.write(`\r  已写入：${total.toLocaleString()} 行（跳过非动画：${skipped.toLocaleString()}）✓\n✅ 完成\n`)
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
