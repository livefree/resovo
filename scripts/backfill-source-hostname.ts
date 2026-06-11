/**
 * scripts/backfill-source-hostname.ts — SRCHEALTH-P3-3-A：video_sources.source_hostname 存量回填
 *
 * Migration 107 只加列不回填（arch-reviewer claude-opus-4-8 裁决 D 双重否决 SQL 回填）：
 *   1. 语义：hostname 真源 = @resovo/media-probe extractHostname（new URL().hostname，
 *      IDN→punycode），SQL regex 无法复制——SQL 回填会让 IDN 主机产生与写路径永久错配的第二 key。
 *   2. 锁：migrate.ts 单事务包裹，55.7 万行 UPDATE = 长事务写锁阻塞爬虫 upsert。
 *      本脚本游标分批（每批独立提交），锁窗口毫秒级，回填期间无需停写。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/backfill-source-hostname.ts [--dry-run]
 *
 * 行为约定：
 *   - 回填范围 = 全表（含软删行；裁决 D——软删行可被 replaceSourcesForSite ON CONFLICT
 *     恢复，回填全表 + 写路径恢复分支 SET 双防线消除 NULL 复活）。
 *   - extractHostname 返回 null 的行保持 NULL（无有效 hostname，不参与 P3-3-B 降权），
 *     统计计数 + 抽样日志输出，作为数据质量信号登记给 P3-3-B。
 *   - 幂等可重入：WHERE source_hostname IS NULL 谓词只碰未填行；与运行期写路径
 *     （新行自带 hostname）不竞争同一行。重跑 updated=0（仅 null 行被重扫再跳过）。
 *   - 末尾 ANALYZE video_sources（裁决 H-3：planner 需要 source_hostname 统计直方图，
 *     否则 P3-3-B hostname JOIN 可能走错 plan）。
 */

import { Pool } from 'pg'
import { extractHostname } from '@resovo/media-probe'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 2000
const NULL_SAMPLE_LIMIT = 20

interface SourceRow {
  id: string
  source_url: string
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })

  let scanned = 0
  let updated = 0
  let unparsable = 0
  const nullSamples: string[] = []
  let cursor = '00000000-0000-0000-0000-000000000000'

  try {
    for (;;) {
      const { rows } = await pool.query<SourceRow>(
        `SELECT id, source_url FROM video_sources
         WHERE source_hostname IS NULL AND id > $1
         ORDER BY id
         LIMIT $2`,
        [cursor, BATCH_SIZE],
      )
      if (rows.length === 0) break
      cursor = rows[rows.length - 1].id
      scanned += rows.length

      const ids: string[] = []
      const hostnames: string[] = []
      for (const row of rows) {
        const hostname = extractHostname(row.source_url)
        if (hostname === null) {
          unparsable++
          if (nullSamples.length < NULL_SAMPLE_LIMIT) nullSamples.push(row.source_url.slice(0, 120))
          continue
        }
        ids.push(row.id)
        hostnames.push(hostname)
      }

      if (ids.length > 0 && !DRY_RUN) {
        // 每批独立隐式事务提交，锁窗口毫秒级（裁决 D）
        const result = await pool.query(
          `UPDATE video_sources AS v
           SET source_hostname = u.hostname
           FROM UNNEST($1::uuid[], $2::text[]) AS u(id, hostname)
           WHERE v.id = u.id`,
          [ids, hostnames],
        )
        updated += result.rowCount ?? 0
      } else if (DRY_RUN) {
        updated += ids.length
      }

      process.stdout.write(`  batch done: scanned=${scanned} updated=${updated} unparsable=${unparsable}\n`)
    }

    if (!DRY_RUN) {
      await pool.query('ANALYZE video_sources')
    }

    process.stdout.write(
      `\n${DRY_RUN ? '[dry-run] ' : ''}回填完成：scanned=${scanned} updated=${updated} unparsable(保持 NULL)=${unparsable}\n`,
    )
    if (nullSamples.length > 0) {
      process.stdout.write(`无法解析样本（数据质量信号，登记 P3-3-B 评估「无 hostname 源占比」）：\n`)
      for (const sample of nullSamples) process.stdout.write(`  - ${sample}\n`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  process.stderr.write(`❌ 回填失败：${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
