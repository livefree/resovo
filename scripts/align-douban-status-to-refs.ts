/**
 * scripts/align-douban-status-to-refs.ts — DROP-prep 对齐：applied douban ref 但 douban_status 欠计
 * ADR-216 META-56 / SEQ-20260627-01
 *
 * 背景：identity 子系统先写 applied douban ref（auto_matched/manual_confirmed primary），
 *   MetadataEnrichService 重跑按自身判据覆写 douban_status='unmatched' → 存量漂移
 *   （有 applied ref 但列欠计 matched，立案 60 行）。META-57 守卫已止新漂移；本卡 DROP 前
 *   一次性对齐存量列值 = DROP 卫生（消除 B-1 遗留的过滤-投影不一致，至 META-60 投影迁移前窗口）。
 *
 * 方向与 fix-douban-status-consistency.ts 相反：那脚本修「matched 虚标无 catalog」（虚高 → 降级），
 *   本卡修「applied-ref 但列非 matched」（欠计 → 升 matched）。判据 = videoRefAppliedSql
 *   （DC-216-1 单一真源：is_primary + match_status IN auto_matched/manual_confirmed），禁再造判据。
 *
 * 用法：node --env-file=.env.local --import tsx scripts/align-douban-status-to-refs.ts [--limit N] [--dry-run]
 *   --dry-run：仅圈定 + 打印拟变更（不写 DB）
 *
 * 幂等：UPDATE 自带谓词 + `douban_status IS DISTINCT FROM 'matched'`，对齐后再跑 0 行。
 * 仅 douban（bangumi 退役另起 META-61）。不触软删（deleted_at IS NULL）、不触已一致行。
 */

import { Pool } from 'pg'
import { videoRefAppliedSql } from '@/api/db/queries/video-ref-applied'

export interface AlignArgs {
  readonly limit: number | null
  readonly dryRun: boolean
}

export function parseArgs(argv: readonly string[]): AlignArgs {
  const idx = argv.indexOf('--limit')
  const limitRaw = idx !== -1 ? argv[idx + 1] ?? null : null
  return {
    limit: limitRaw ? Number.parseInt(limitRaw, 10) : null,
    dryRun: argv.includes('--dry-run'),
  }
}

/** 圈定 SELECT：有 applied douban ref（videoRefAppliedSql）但 douban_status != matched 的 live video。 */
export function buildUndercountedSelectSql(limit: number | null): string {
  return `SELECT v.id, v.douban_status
       FROM videos v
      WHERE ${videoRefAppliedSql('douban', 'v')}
        AND v.douban_status IS DISTINCT FROM 'matched'
        AND v.deleted_at IS NULL
      ORDER BY v.created_at DESC
      ${limit !== null ? `LIMIT ${limit}` : ''}`
}

/** 对齐 UPDATE：自带谓词 + 列过滤（幂等 + TOCTOU 安全），仅升 matched。 */
export function buildAlignUpdateSql(): string {
  return `UPDATE videos AS v SET douban_status = 'matched', updated_at = NOW()
           WHERE v.id = ANY($1::uuid[])
             AND ${videoRefAppliedSql('douban', 'v')}
             AND v.douban_status IS DISTINCT FROM 'matched'
             AND v.deleted_at IS NULL`
}

interface DriftRow {
  readonly id: string
  readonly douban_status: string
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs(process.argv.slice(2))
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    process.stderr.write('❌  DATABASE_URL 未设置\n')
    process.exit(1)
  }

  process.stdout.write('对齐：applied douban ref 但 douban_status 欠计 → matched（ADR-216 META-56 DROP-prep）\n')
  if (limit) process.stdout.write(`限制行数：${limit}\n`)
  if (dryRun) process.stdout.write('模式：dry-run（仅圈定，不写 DB）\n')

  const db = new Pool({ connectionString: DATABASE_URL })
  try {
    const rows = (await db.query<DriftRow>(buildUndercountedSelectSql(limit))).rows
    process.stdout.write(`\n圈定 ${rows.length} 个 video（applied douban ref 但 douban_status != matched）\n`)

    if (dryRun) {
      for (const row of rows) process.stdout.write(`  ${row.id}  ${row.douban_status} → matched\n`)
      process.stdout.write(`\n✅ dry-run 完成：拟对齐 ${rows.length} 行 → matched\n`)
      return
    }
    if (rows.length === 0) {
      process.stdout.write('✅ 无欠计行，已一致\n')
      return
    }

    const ids = rows.map((r) => r.id)
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const res = await client.query(buildAlignUpdateSql(), [ids])
      await client.query('COMMIT')
      process.stdout.write(`✅ 完成：对齐 ${res.rowCount ?? 0} 行 → matched\n`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    await db.end()
  }
}

// VITEST 下不执行 main（仅导出纯函数供单测），避免 import 触发 db。
if (!process.env.VITEST) {
  void main().catch((err) => {
    process.stderr.write(`[align-douban-status-to-refs] failed: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  })
}
