/**
 * scripts/import-external-data.ts — 外部数据导入 CLI
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/import-external-data.ts \
 *     --source <douban|tmdb|bangumi|movielens> --file <path>
 *
 * 可选参数：
 *   --build-only          跳过文件导入，直接从已有暂存表构建 media_catalog
 *   --batch-id <uuid>     build-only 时指定 batch_id（不传则处理全部未关联行）
 *
 * 流程：
 *   1. 导入文件 → 暂存表（importDouban/Tmdb/Bangumi/MovieLensLinks）
 *   2. 构建 media_catalog（buildCatalogFromDouban/Tmdb/Bangumi）
 */

import { Pool } from 'pg'
import { statSync } from 'fs'
import { ExternalDataImportService } from '../src/api/services/ExternalDataImportService'

// ── 参数解析 ──────────────────────────────────────────────────────

type Source = 'douban' | 'tmdb' | 'bangumi' | 'movielens'
const VALID_SOURCES: Source[] = ['douban', 'tmdb', 'bangumi', 'movielens']

function parseArgs(): {
  source: Source
  filePath: string | null
  buildOnly: boolean
  batchId: string | null
} {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] ?? null : null
  }
  const has = (flag: string) => args.includes(flag)

  const source = get('--source') as Source | null
  if (!source || !VALID_SOURCES.includes(source)) {
    process.stderr.write(`用法：--source <${VALID_SOURCES.join('|')}>\n`)
    process.exit(1)
  }

  const buildOnly = has('--build-only')
  const filePath = get('--file')
  const batchId = get('--batch-id')

  if (!buildOnly && !filePath) {
    process.stderr.write('请提供 --file <path>，或使用 --build-only\n')
    process.exit(1)
  }

  return { source, filePath, buildOnly, batchId }
}

// ── 进度输出 ──────────────────────────────────────────────────────

function makeProgress(label: string) {
  let last = 0
  return (n: number, _total?: number) => {
    if (n - last >= 1000 || n === 0) {
      process.stdout.write(`\r  ${label}: ${n.toLocaleString()} 行`)
      last = n
    }
  }
}

function done(label: string, n: number) {
  process.stdout.write(`\r  ${label}: ${n.toLocaleString()} 行 ✓\n`)
}

// ── 主流程 ────────────────────────────────────────────────────────

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    process.stderr.write('❌  DATABASE_URL 未设置，请检查 .env.local\n')
    process.exit(1)
  }

  const { source, filePath, buildOnly, batchId: argBatchId } = parseArgs()

  const db = new Pool({ connectionString: DATABASE_URL })
  const service = new ExternalDataImportService(db)

  try {
    let batchId = argBatchId

    // ── Step 1: 文件导入 ────────────────────────────────────────────
    if (!buildOnly && filePath) {
      const fileSizeBytes = statSync(filePath).size
      const fileName = filePath.split('/').pop() ?? filePath

      if (source !== 'movielens') {
        batchId = await service.createBatch(source, fileName, fileSizeBytes)
        process.stdout.write(`\n[1/2] 导入文件 → 暂存表（batch: ${batchId}）\n`)
      } else {
        process.stdout.write('\n[1/2] 导入 MovieLens 桥接表\n')
      }

      const onProgress = makeProgress('已读取')

      if (source === 'douban') {
        await service.importDouban(batchId!, filePath, onProgress)
        done('已导入', 0)
      } else if (source === 'tmdb') {
        await service.importTmdb(batchId!, filePath, onProgress)
        done('已导入', 0)
      } else if (source === 'bangumi') {
        await service.importBangumi(batchId!, filePath, onProgress)
        done('已导入', 0)
      } else {
        await service.importMovieLensLinks(filePath, onProgress)
        process.stdout.write('\n  MovieLens 桥接表导入完成 ✓\n')
      }
    } else {
      process.stdout.write('\n[--build-only] 跳过文件导入\n')
    }

    // ── Step 2: 构建 media_catalog ──────────────────────────────────
    if (source === 'movielens') {
      process.stdout.write('[2/2] movielens 为纯桥接表，无需构建 catalog，完成。\n\n')
      return
    }

    process.stdout.write('[2/2] 构建 media_catalog 条目\n')
    const onBuild = makeProgress('已构建')
    let built = 0

    if (source === 'douban') {
      built = await service.buildCatalogFromDouban(batchId, onBuild)
    } else if (source === 'tmdb') {
      built = await service.buildCatalogFromTmdb(batchId, onBuild)
    } else if (source === 'bangumi') {
      built = await service.buildCatalogFromBangumi(batchId, onBuild)
    }

    done('已构建', built)
    process.stdout.write('\n✅ 完成\n\n')
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
