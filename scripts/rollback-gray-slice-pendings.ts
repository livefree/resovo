/**
 * scripts/rollback-gray-slice-pendings.ts — GRAY-SLICE（D-105a-20）回滚 hygiene（备而不用）
 *
 * 回滚不对称性（arch-reviewer D-GSL-4 裁决，candidateUpsert 已验证）：revert 准入谓词 +
 * bump THRESHOLD_CONFIG_VERSION 后，已灰准入的低分对回到 skip 分支**不触达 upsert** →
 * 不会被自动 supersede，残留 pending。本脚本批量收口。
 *
 * WHERE 口径（与 weights.isGraySliceAdmissible 谓词的 DB 等价表达——准入前 sub-0.75
 * 无强负对从未被持久化〔manual-search 例外被显式排除〕，故本 WHERE 精确捕获灰准入集）：
 *   status='pending' AND identity_score < 0.75
 *   AND trigger_source <> 'manual-search'      —— D-105a-4 none 区合法例外，不得误删
 *   AND 强负为空                                —— 强负审查行是 blocked 路径合法候选，不动
 *
 * 用法：node --env-file=.env.local --import tsx scripts/rollback-gray-slice-pendings.ts [--dry-run]
 * 幂等：supersede 终态，重跑 0 行。
 */

import { Pool } from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

const WHERE = `
  status = 'pending'
  AND identity_score::numeric < 0.75
  AND trigger_source <> 'manual-search'
  AND (strong_negative_reasons IS NULL OR cardinality(strong_negative_reasons) = 0)`

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const { rows: [n] } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM identity_candidate WHERE ${WHERE}`,
    )
    console.log(`[rollback-gray-slice] 灰准入 pending 残留：${n!.count} 行`)
    if (DRY_RUN) {
      console.log('[rollback-gray-slice] --dry-run，不写库')
      return
    }
    const r = await pool.query(`UPDATE identity_candidate SET status = 'superseded' WHERE ${WHERE}`)
    console.log(`[rollback-gray-slice] 已 supersede ${r.rowCount} 行（manual-search 例外与强负审查行未触碰）`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[rollback-gray-slice] 失败：', err)
  process.exitCode = 2
})
