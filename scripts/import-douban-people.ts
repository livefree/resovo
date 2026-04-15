/**
 * scripts/import-douban-people.ts — 将本地豆瓣 person.csv dump 导入 external_data.douban_people
 * META-02
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/import-douban-people.ts \
 *     [--file <path>] [--limit N] [--dry-run]
 *
 * 默认文件：external-db/douban/moviedata-10m/person.csv
 * 幂等：ON CONFLICT (person_id) DO UPDATE
 * --dry-run：解析 CSV 并打印前 5 行，不写入 DB
 */

import { Pool } from 'pg'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const DEFAULT_FILE = 'external-db/douban/moviedata-10m/person.csv'
const BATCH_SIZE = 500

// CSV 第一行标题顺序（10 列）
const HEADERS = [
  'PERSON_ID', 'NAME', 'SEX', 'NAME_EN', 'NAME_ZH',
  'BIRTH', 'BIRTHPLACE', 'CONSTELLATORY', 'PROFESSION', 'BIOGRAPHY',
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
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) yield line
}

// ── DB 批量写入 ─────────────────────────────────────────────────────

interface DoubanPerson {
  personId: string
  name: string
  nameEn: string | null
  nameZh: string | null
  sex: string | null
  birth: string | null
  birthplace: string | null
  constellation: string | null
  profession: string[]
  biography: string | null
}

async function flushBatch(db: Pool, batch: DoubanPerson[]): Promise<void> {
  if (batch.length === 0) return
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const row of batch) {
      await client.query(
        `INSERT INTO external_data.douban_people
           (person_id, name, name_en, name_zh, sex, birth, birthplace,
            constellation, profession, biography)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (person_id) DO UPDATE SET
           name          = EXCLUDED.name,
           name_en       = EXCLUDED.name_en,
           name_zh       = EXCLUDED.name_zh,
           sex           = EXCLUDED.sex,
           birth         = EXCLUDED.birth,
           birthplace    = EXCLUDED.birthplace,
           constellation = EXCLUDED.constellation,
           profession    = EXCLUDED.profession,
           biography     = EXCLUDED.biography,
           updated_at    = NOW()`,
        [
          row.personId, row.name, row.nameEn, row.nameZh, row.sex,
          row.birth, row.birthplace, row.constellation, row.profession, row.biography,
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

  let batch: DoubanPerson[] = []
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

      const personId = get('PERSON_ID')
      const name = get('NAME')
      if (!personId || !name) continue

      const entry: DoubanPerson = {
        personId,
        name,
        nameEn: get('NAME_EN'),
        nameZh: get('NAME_ZH'),
        sex: get('SEX'),
        birth: get('BIRTH'),
        birthplace: get('BIRTHPLACE'),
        constellation: get('CONSTELLATORY'),
        profession: splitBy(get('PROFESSION'), '/'),
        biography: get('BIOGRAPHY'),
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
