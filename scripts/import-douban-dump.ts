/**
 * scripts/import-douban-dump.ts — 将本地豆瓣 movies.csv dump 导入 external_data.douban_entries
 * META-01: 补全 ALIAS/IMDB_ID/LANGUAGES/MINS/OFFICIAL_SITE/REGIONS/RELEASE_DATE/TAGS/DOUBAN_VOTES/ACTOR_IDS/DIRECTOR_IDS
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/import-douban-dump.ts \
 *     [--file <path>] [--limit N] [--dry-run]
 *
 * 默认文件：external-db/douban/moviedata-10m/movies.csv
 * 幂等：ON CONFLICT (douban_id) DO UPDATE
 * --dry-run：解析 CSV 并打印前 5 行，不写入 DB
 */

import { Pool } from 'pg'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const DEFAULT_FILE = 'external-db/douban/moviedata-10m/movies.csv'
const BATCH_SIZE = 500

// CSV 第一行标题顺序（21 列）
const HEADERS = [
  'MOVIE_ID', 'NAME', 'ALIAS', 'ACTORS', 'COVER', 'DIRECTORS',
  'DOUBAN_SCORE', 'DOUBAN_VOTES', 'GENRES', 'IMDB_ID', 'LANGUAGES', 'MINS',
  'OFFICIAL_SITE', 'REGIONS', 'RELEASE_DATE', 'SLUG', 'STORYLINE', 'TAGS', 'YEAR',
  'ACTOR_IDS', 'DIRECTOR_IDS',
]

// ── CLI ────────────────────────────────────────────────────────────

function parseArgs(): { filePath: string; limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const getOpt = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] ?? null : null
  }
  const filePath = resolve(getOpt('--file') ?? DEFAULT_FILE)
  const limitRaw = getOpt('--limit')
  const dryRun = args.includes('--dry-run')
  return { filePath, limit: limitRaw ? Number.parseInt(limitRaw, 10) : null, dryRun }
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

/**
 * 从 "姓名:ID|姓名:ID|..." 格式解析出纯数字 person ID 列表
 * 无 ID 的条目（如 "姓名:"）直接跳过
 */
function parsePersonIds(val: string | null): string[] {
  if (!val) return []
  return val
    .split('|')
    .map(s => {
      const parts = s.split(':')
      return parts.length >= 2 ? (parts.at(-1)?.trim() ?? '') : ''
    })
    .filter(id => id !== '' && /^\d+$/.test(id))
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
  // META-01 新增字段
  aliases: string[]
  imdbId: string | null
  languages: string[]
  durationMinutes: number | null
  tags: string[]
  doubanVotes: number | null
  regions: string[]
  releaseDate: string | null
  actorIds: string[]
  directorIds: string[]
  officialSite: string | null
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
            description, cover_url, directors, cast, writers, genres, country,
            aliases, imdb_id, languages, duration_minutes, tags, douban_votes,
            regions, release_date, actor_ids, director_ids, official_site)
         VALUES ($1, $2, $3, $4, 'movie', $5, $6, $7, $8, $9, '{}', $10, $11,
                 $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (douban_id) DO UPDATE SET
           title = EXCLUDED.title, title_normalized = EXCLUDED.title_normalized,
           year = EXCLUDED.year, rating = EXCLUDED.rating,
           description = EXCLUDED.description, cover_url = EXCLUDED.cover_url,
           directors = EXCLUDED.directors, cast = EXCLUDED.cast,
           genres = EXCLUDED.genres, country = EXCLUDED.country,
           aliases = EXCLUDED.aliases, imdb_id = EXCLUDED.imdb_id,
           languages = EXCLUDED.languages, duration_minutes = EXCLUDED.duration_minutes,
           tags = EXCLUDED.tags, douban_votes = EXCLUDED.douban_votes,
           regions = EXCLUDED.regions, release_date = EXCLUDED.release_date,
           actor_ids = EXCLUDED.actor_ids, director_ids = EXCLUDED.director_ids,
           official_site = EXCLUDED.official_site,
           updated_at = NOW()`,
        [
          row.doubanId, row.title, row.titleNormalized, row.year, row.rating,
          row.description, row.coverUrl, row.directors, row.cast, row.genres, row.country,
          row.aliases, row.imdbId, row.languages, row.durationMinutes,
          row.tags, row.doubanVotes, row.regions, row.releaseDate,
          row.actorIds, row.directorIds, row.officialSite,
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
  const { filePath, limit, dryRun } = parseArgs()

  if (!dryRun) {
    const DATABASE_URL = process.env.DATABASE_URL
    if (!DATABASE_URL) {
      process.stderr.write('❌  DATABASE_URL 未设置\n')
      process.exit(1)
    }
  }

  process.stdout.write(`导入文件：${filePath}\n`)
  if (limit) process.stdout.write(`限制行数：${limit}\n`)
  if (dryRun) process.stdout.write('模式：dry-run（仅解析，不写入 DB）\n')

  const db = dryRun ? null : new Pool({ connectionString: process.env.DATABASE_URL! })

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
      const numOrNull = (v: string | null) =>
        (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)

      const doubanId = get('MOVIE_ID')
      const title = get('NAME')
      if (!doubanId || !title) continue

      const entry: DoubanEntry = {
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
        // META-01 新增
        aliases: splitBy(get('ALIAS'), '/'),
        imdbId: get('IMDB_ID'),
        languages: splitBy(get('LANGUAGES'), '/'),
        durationMinutes: numOrNull(get('MINS')) ? Math.floor(numOrNull(get('MINS'))!) : null,
        tags: splitBy(get('TAGS'), '/'),
        doubanVotes: numOrNull(get('DOUBAN_VOTES')) ? Math.floor(numOrNull(get('DOUBAN_VOTES'))!) : null,
        regions: splitBy(get('REGIONS'), '/'),
        releaseDate: get('RELEASE_DATE'),
        actorIds: parsePersonIds(get('ACTOR_IDS')),
        directorIds: parsePersonIds(get('DIRECTOR_IDS')),
        officialSite: get('OFFICIAL_SITE'),
      }

      if (dryRun && total < 5) {
        process.stdout.write(JSON.stringify(entry, null, 2) + '\n')
      }

      batch.push(entry)
      total++

      if (!dryRun && batch.length >= BATCH_SIZE) {
        await flushBatch(db!, batch)
        batch = []
        process.stdout.write(`\r  已写入：${total.toLocaleString()} 行`)
      }
    }

    if (!dryRun) {
      if (batch.length > 0) await flushBatch(db!, batch)
      process.stdout.write(`\r  已写入：${total.toLocaleString()} 行 ✓\n✅ 完成\n`)
    } else {
      process.stdout.write(`\n✅ dry-run 完成，共解析 ${total.toLocaleString()} 行\n`)
    }
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    if (db) await db.end()
  }
}

main()
