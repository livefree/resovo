/**
 * identity-compare-report.ts — shadow 候选 vs 旧 group-by 候选对比报表
 * （SEQ-20260602-03 / CHG-VIR-8 Phase 2b §6 / 不切 UI、不加 admin 端点）
 *
 * 三桶口径（§6.1）：一致（同旧 group）/ 新增召回（跨 group）/ 强负拦截。
 * 运行：node --env-file=.env.local --import tsx scripts/identity-compare-report.ts
 */

import { db } from '@/api/lib/postgres'
import { countCompareBuckets, listForCompareReport } from '@/api/db/queries/identity-candidate'
import { SCORER_VERSION } from '@/api/services/identity'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'

async function main(): Promise<void> {
  const versions = { scorerVersion: SCORER_VERSION, parserVersion: TITLE_PARSER_VERSION }

  const buckets = await countCompareBuckets(db, versions)
  console.log('=== identity_candidate 对比报表（status=pending）===')
  console.log(`scorer_version=${SCORER_VERSION} / parser_version=${TITLE_PARSER_VERSION}`)
  console.log(`总候选数        : ${buckets.pendingTotal}`)
  console.log(`跨 group 新增召回: ${buckets.crossGroupTotal}（旧 group-by 漏召回，缺陷①治理成效）`)
  console.log(`强负拦截        : ${buckets.blockedTotal}（误合并拦截，缺陷②治理成效）`)

  const sample = await listForCompareReport(db, { ...versions, limit: 30, offset: 0 })
  console.log(`\n=== 抽样 ${sample.length} 条（按身份分降序）===`)
  for (const r of sample) {
    const tag = r.same_legacy_group ? '一致    ' : '新增召回'
    const blocked = r.strong_negative_reasons.length > 0 ? ` [拦截:${r.strong_negative_reasons.join(',')}]` : ''
    const score = (Number(r.identity_score) * 100).toFixed(1)
    console.log(`[${tag}]${blocked} 身份分 ${score}%  ${r.left_title} ↔ ${r.right_title}`)
  }

  await db.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('报表生成失败:', err)
  process.exit(1)
})
