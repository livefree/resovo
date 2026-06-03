/**
 * enqueue-identity-rescore.ts — 手动触发身份候选离线重算（SEQ-20260602-03 / CHG-VIR-8 Phase 2b）
 *
 * Phase 2b shadow 对照阶段手动触发入口（无自动 scheduler）。
 * 运行：node --env-file=.env.local --import tsx scripts/enqueue-identity-rescore.ts
 */

import { identityCandidateQueue } from '@/api/lib/queue'

async function main(): Promise<void> {
  const job = await identityCandidateQueue.add(
    { type: 'full-rescan' as const },
    { jobId: `identity-rescore-${Date.now()}`, removeOnComplete: 10, removeOnFail: 5 },
  )
  console.log(`✅ 已入队 identity-rescore job: ${job.id}`)
  await identityCandidateQueue.close()
  process.exit(0)
}

main().catch((err) => {
  console.error('入队失败:', err)
  process.exit(1)
})
