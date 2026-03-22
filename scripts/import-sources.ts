/**
 * scripts/import-sources.ts — 从 JSON 文件直接导入爬虫源站到 crawler_sites 表
 *
 * 用法：
 *   npm run import:sources -- /path/to/sources.json
 *   # 或
 *   node --env-file=.env.local --import tsx scripts/import-sources.ts /path/to/sources.json
 *
 * 支持格式：
 *   { "api_site": { "key": { "name": "...", "api": "...", ... } } }   ← LunaTV 格式
 *   { "crawler_sites": { "key": { ... } } }                           ← Resovo 格式
 */

import { readFile } from 'fs/promises'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write('❌  DATABASE_URL 未设置，请检查 .env.local\n')
  process.exit(1)
}

const filePath = process.argv[2]
if (!filePath) {
  process.stderr.write('❌  请提供 JSON 文件路径，例如：npm run import:sources -- /path/to/sources.json\n')
  process.exit(1)
}

interface SourceEntry {
  name?: string
  api?: string
  detail?: string
  type?: 'vod' | 'shortdrama'
  format?: 'json' | 'xml'
  weight?: number
  is_adult?: boolean
  disabled?: boolean
}

const db = new Pool({ connectionString: DATABASE_URL })

async function main() {
  const raw = await readFile(filePath, 'utf-8')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    process.stderr.write('❌  JSON 解析失败，请检查文件格式\n')
    process.exit(1)
  }

  // 兼容两种字段名
  const sitesMap = (parsed.crawler_sites ?? parsed.api_site ?? {}) as Record<string, SourceEntry>
  const entries = Object.entries(sitesMap)

  if (entries.length === 0) {
    process.stderr.write('⚠️   未找到源站数据（期望字段：crawler_sites 或 api_site）\n')
    process.exit(1)
  }

  process.stdout.write(`📋  共读取 ${entries.length} 个源站，开始导入…\n\n`)

  let ok = 0
  let skip = 0
  let fail = 0

  for (const [key, site] of entries) {
    if (!site.name || !site.api) {
      process.stdout.write(`   ⚠️  跳过 ${key}（缺少 name 或 api 字段）\n`)
      skip++
      continue
    }

    try {
      await db.query(
        `INSERT INTO crawler_sites
           (key, name, api_url, detail, source_type, format, weight, is_adult, from_config, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
         ON CONFLICT (key) DO UPDATE SET
           name        = EXCLUDED.name,
           api_url     = EXCLUDED.api_url,
           detail      = EXCLUDED.detail,
           source_type = EXCLUDED.source_type,
           format      = EXCLUDED.format,
           weight      = EXCLUDED.weight,
           is_adult    = EXCLUDED.is_adult,
           from_config = true,
           updated_at  = NOW()`,
        [
          key,
          site.name,
          site.api,
          site.detail ?? null,
          site.type ?? 'vod',
          site.format ?? 'json',
          Math.min(100, Math.max(0, site.weight ?? 50)),
          site.is_adult ?? false,
        ],
      )
      process.stdout.write(`   ✅  ${key}  →  ${site.name}\n`)
      ok++
    } catch (err) {
      process.stderr.write(`   ❌  ${key} 失败：${err instanceof Error ? err.message : String(err)}\n`)
      fail++
    }
  }

  // 同时把原始文件内容存入 system_settings.config_file
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('config_file', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [raw],
  )

  process.stdout.write(`\n🎉  导入完成：成功 ${ok}，跳过 ${skip}，失败 ${fail}\n`)
  await db.end()
}

main().catch((err) => {
  process.stderr.write(`❌  ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
