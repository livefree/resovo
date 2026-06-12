/**
 * scripts/run-identity-rescore-inline.ts — GOV-1（SEQ-20260612-03）：内联运行身份候选离线重扫
 *
 * 与 `enqueue-identity-rescore.ts`（Bull 队列入队，需 Redis + worker 在线）互补：
 * 直调 `runIdentityRescore` 单进程执行，免基础设施依赖——版本升级止血 / 运维一次性
 * 重扫场景用。并发安全：pipeline 内部 advisory lock（worker:identity-rescore）单实例，
 * 与 worker 消费互斥，重复运行安全退出。
 *
 * 前置：blocking 召回按**当前** parser 版本过滤 title_observations——版本升级后必须先跑
 * `backfill-title-observations.ts` 补当前版本观测，否则召回 0 桶（缺陷 A，2026-06-12 实证）。
 *
 * 用法：node --env-file=.env.local --import tsx scripts/run-identity-rescore-inline.ts
 */

import pino from 'pino'
import { db } from '@/api/lib/postgres'
import { runIdentityRescore } from '@/api/services/identity'

async function main(): Promise<void> {
  const log = pino({ level: 'info' })
  const result = await runIdentityRescore(db, log)
  console.log(
    `[run-identity-rescore-inline] 完成：buckets=${result.buckets}（external_id ${result.externalIdBuckets}）` +
    ` pairs=${result.pairs} created=${result.created}`,
  )
  console.log(JSON.stringify(result))
  await db.end()
}

main().catch((err) => {
  console.error('[run-identity-rescore-inline] 失败：', err)
  process.exitCode = 2
})
