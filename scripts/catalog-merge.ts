/**
 * catalog-merge.ts — catalog-catalog 合并运维脚本（CHG-VIR-12-F / ADR-176 D-176-10）
 *
 * 编排 CatalogMergeService.merge（原语落 Service 层；本脚本仅参数解析 + dry-run 控制）。
 * **不起 admin 端点**（D-176-10：脚本先行；端点 + UI 待候选量实证后另起 ADR）。
 *
 * dry-run（默认）：单事务执行完整合并 → 打印统计 → ROLLBACK（零落库，真实路径预演）。
 * --apply：单事务执行 → COMMIT。
 *
 * 运行：
 *   node --env-file=.env.local --import tsx scripts/catalog-merge.ts \
 *     --loser=<uuid> --survivor=<uuid> [--by=<operator>] [--apply]
 *
 * 合并后核验：scripts/report-catalog-identity-consistency.ts；
 * 回滚：scripts/catalog-merge-rollback.ts --op=<mergeOpId> --apply
 */

import { db } from '@/api/lib/postgres'
import { CatalogMergeService } from '@/api/services/CatalogMergeService'

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

async function main(): Promise<void> {
  const loser = arg('loser')
  const survivor = arg('survivor')
  const by = arg('by') ?? 'ops-script'
  const apply = process.argv.includes('--apply')
  if (!loser || !survivor) {
    console.error('用法: catalog-merge.ts --loser=<uuid> --survivor=<uuid> [--by=<operator>] [--apply]')
    process.exit(1)
  }

  // 操作前置信息（人工核对面）
  const info = await db.query<{ id: string; title: string; type: string; year: number | null }>(
    `SELECT id, title, type, year FROM media_catalog WHERE id = ANY($1::uuid[])`,
    [[loser, survivor]]
  )
  for (const row of info.rows) {
    const role = row.id === loser ? 'LOSER（删行）' : 'SURVIVOR（留存）'
    console.log(`${role}: ${row.id} "${row.title}" [${row.type}/${row.year ?? '?'}]`)
  }

  const svc = new CatalogMergeService(db)
  console.log(`mode=${apply ? 'APPLY' : 'dry-run（完整路径预演 + ROLLBACK）'}`)

  if (apply) {
    const stats = await svc.merge(loser, survivor, by)
    console.log('✓ 合并完成:', JSON.stringify(stats))
    console.log(`回滚口令: scripts/catalog-merge-rollback.ts --op=${stats.mergeOpId} --apply`)
  } else {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const stats = await svc.mergeInTx(client, loser, survivor, by)
      console.log('dry-run 统计:', JSON.stringify(stats))
    } finally {
      await client.query('ROLLBACK')
      client.release()
      console.log('dry-run ROLLBACK（零落库）')
    }
  }
  await db.end()
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
