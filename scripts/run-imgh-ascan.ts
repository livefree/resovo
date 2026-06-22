/**
 * run-imgh-ascan.ts — IMGH-P4-A「A-SCAN」：部署后一次性真实健康扫描（ADR-213 D-213-5 ③）
 *
 * 把所有 `<kind>_checked_at IS NULL` 行入 health-check 队列 → worker 跑完给 checked_at 落**真值**、
 * 排空 migration 121 后的初始 unknown 桶。**P4-C（unknown 谓词）的硬前置门**：本扫描 + worker 处理完
 * 之前不得上线 C，否则存量 ok 行 checked_at 全 NULL → 全判 unknown 泛滥（Codex round-4）。
 *
 * 运行（worker + redis 在跑时，项目根目录）：
 *   node --env-file=.env.local --import tsx scripts/run-imgh-ascan.ts
 * 幂等：worker 落 checked_at 后行不再命中 → 可重跑收敛 stragglers。
 */

import { db } from '@/api/lib/postgres'
import { imageHealthQueue } from '@/api/lib/queue'
import { ImageHealthService } from '@/api/services/ImageHealthService'

async function main(): Promise<void> {
  const service = new ImageHealthService(db)
  const { enqueued } = await service.enqueueHealthScanForUnchecked(imageHealthQueue)
  console.log(`✅ A-SCAN 已入队 ${enqueued} 个 health-check（worker 跑完后 checked_at 落真值）`)
  console.log('   待队列处理完后复跑 scripts/verify-imgh-121.ts，确认 unknown 桶收敛，再上线 P4-C。')
  await imageHealthQueue.close()
  await db.end()
  process.exit(0)
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('A-SCAN 入队失败:', msg)
  process.exit(1)
})
