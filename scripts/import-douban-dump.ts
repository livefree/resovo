/**
 * scripts/import-douban-dump.ts — 将本地豆瓣 movies.csv dump 导入 external_data.douban_entries
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/import-douban-dump.ts \
 *     [--file <path>] [--limit N]
 *
 * 默认文件：external-db/douban/moviedata-10m/movies.csv
 * 幂等：ON CONFLICT (douban_id) DO UPDATE
 */

import { Pool } from 'pg'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const DEFAULT_FILE = 'external-db/douban/moviedata-10m/movies.csv'
const BATCH_SIZE = 500
const HEADERS = [
  'MOVIE_ID', 'NAME', 'ALIAS', 'ACTORS', 'COVER', 'DIRECTORS',
  'DOUBAN_SCORE', 'DOUBAN_VOTES', 'GENRES', 'IMDB_ID', 'LANGUAGES', 'MINS',
  'OFFICIAL_SITE', 'REGIONS', 'RELEASE_DATE', 'SLUG', 'STORYLINE', 'TAGS', 'YEAR',
]

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

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let field = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(field); field = ''
    } else {
      field += ch
    }
  }
  result.push(field)
  return result
}

function splitBy(val: string | null, sep: string): string[] {
  if (!val) return []
  return val.split(sep).map(s => s.trim()).filter(Boolean)
}

// ── 流式读取 ────────────────────────────────────────────────────────

async function* streamLines(filePath: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) yield line
}

// ── DB 批量写入 ─────────────────────────────────────────────────────

interface DoubanEntry {
  doubanId: string
  title: string
  titleNormalized: string
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  cast: string[]
  genres: string[]
  country: string | null
}

async function flushBatch(db: Pool, batch: DoubanEntry[]): Promise<void> {
  if (batch.length === 0) return
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const row of batch) {
      await client.query(
        `INSERT INTO external_data.douban_entries
           (douban_id, title, title_normalized, year, media_type, rating,
            description, cover_url, directors, cast, writers, genres, country)
         VALUES ($1, $2, $3, $4, 'movie', $5, $6, $7, $8, $9, '{}', $10, $11)
         ON CONFLICT (douban_id) DO UPDATE SET
           title = EXCLUDED.title, title_normalized = EXCLUDED.title_normalized,
           year = EXCLUDED.year, rating = EXCLUDED.rating,
           description = EXCLUDED.description, cover_url = EXCLUDED.cover_url,
           directors = EXCLUDED.directors, cast = EXCLUDED.cast,
           genres = EXCLUDED.genres, country = EXCLUDED.country,
           updated_at = NOW()`,
        [
          row.doubanId, row.title, row.titleNormalized, row.year, row.rating,
          row.description, row.coverUrl, row.directors, row.cast, row.genres, row.country,
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

  let batch: DoubanEntry[] = []
  let total = 0
  let firstLine = true

  try {
    for await (const line of streamLines(filePath)) {
      const trimmed = line.replace(/^\uFEFF/, '').trim()
      if (!trimmed) continue
      if (firstLine) { firstLine = false; continue }

      if (limit !== null && total >= limit) break

      const cols = parseCsvLine(trimmed)
      const get = (name: string) => cols[HEADERS.indexOf(name)]?.trim() || null
      const numOrNull = (v: string | null) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)

      const doubanId = get('MOVIE_ID')
      const title = get('NAME')
      if (!doubanId || !title) continue

      batch.push({
        doubanId,
        title,
        titleNormalized: normalizeTitle(title),
        year: numOrNull(get('YEAR')) ? Math.floor(numOrNull(get('YEAR'))!) : null,
        rating: numOrNull(get('DOUBAN_SCORE')),
        description: get('STORYLINE'),
        coverUrl: get('COVER'),
        directors: splitBy(get('DIRECTORS'), '/'),
        cast: splitBy(get('ACTORS'), '/'),
        genres: splitBy(get('GENRES'), '/'),
        country: splitBy(get('REGIONS'), '/')[0] ?? null,
      })
      total++

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(db, batch)
        batch = []
        process.stdout.write(`\r  已写入：${total.toLocaleString()} 行`)
      }
    }

    if (batch.length > 0) await flushBatch(db, batch)
    process.stdout.write(`\r  已写入：${total.toLocaleString()} 行 ✓\n✅ 完成\n`)
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
