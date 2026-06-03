/**
 * identity-compare-report.ts — shadow 候选 vs 旧 group-by 候选对比报表
 * （SEQ-20260602-03 / CHG-VIR-8 Phase 2b §6 + CHG-VIR-10 Phase 3 / 不切 UI、不加 admin 端点）
 *
 * 三桶口径（§6.1）：一致（同旧 group）/ 新增召回（跨 group）/ 强负拦截。
 * CHG-VIR-10：增加 trigger_source 切片（ingest 旁路 vs offline-rescore），支撑 shadow
 * precision/recall 验收；agree/disagree bind 分布由 ingest-shadow 结构化日志聚合（形态 C），
 * 本报表只读 identity_candidate。
 * 运行：node --env-file=.env.local --import tsx scripts/identity-compare-report.ts [--source=ingest]
 */

import { db } from '@/api/lib/postgres'
import {
  countCompareBuckets,
  countCompareBucketsBySource,
  listForCompareReport,
} from '@/api/db/queries/identity-candidate'
import { SCORER_VERSION } from '@/api/services/identity'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'

const TRIGGER_SOURCES = ['ingest', 'offline-rescore', 'manual-search'] as const
type TriggerSource = (typeof TRIGGER_SOURCES)[number]

function parseSourceArg(): TriggerSource | undefined {
  const arg = process.argv.find((a) => a.startsWith('--source='))
  if (!arg) return undefined
  const v = arg.slice('--source='.length)
  if ((TRIGGER_SOURCES as readonly string[]).includes(v)) return v as TriggerSource
  console.error(`无效 --source=${v}（可选：${TRIGGER_SOURCES.join(' / ')}）`)
  process.exit(1)
}

async function main(): Promise<void> {
  const versions = { scorerVersion: SCORER_VERSION, parserVersion: TITLE_PARSER_VERSION }
  const sourceFilter = parseSourceArg()

  const buckets = await countCompareBuckets(db, versions)
  console.log('=== identity_candidate 对比报表（status=pending）===')
  console.log(`scorer_version=${SCORER_VERSION} / parser_version=${TITLE_PARSER_VERSION}`)
  console.log(`总候选数        : ${buckets.pendingTotal}`)
  console.log(`跨 group 新增召回: ${buckets.crossGroupTotal}（旧 group-by 漏召回，缺陷①治理成效）`)
  console.log(`强负拦截        : ${buckets.blockedTotal}（误合并拦截，缺陷②治理成效）`)

  // CHG-VIR-10：trigger_source 切片（ingest 旁路 vs offline job）
  const bySource = await countCompareBucketsBySource(db, versions)
  console.log('\n=== trigger_source 切片 ===')
  for (const row of bySource) {
    console.log(
      `[${row.triggerSource.padEnd(15)}] 候选 ${row.pendingTotal} / 跨 group ${row.crossGroupTotal} / 拦截 ${row.blockedTotal}`,
    )
  }

  const sample = await listForCompareReport(db, {
    ...versions, limit: 30, offset: 0, triggerSource: sourceFilter,
  })
  const sampleTitle = sourceFilter ? `（trigger_source=${sourceFilter}）` : ''
  console.log(`\n=== 抽样 ${sample.length} 条${sampleTitle}（按身份分降序）===`)
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
