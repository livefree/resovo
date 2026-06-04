/**
 * catalog-merge-rollback.ts — catalog 合并回滚（CHG-VIR-12-F / ADR-176 D-176-4 + ADR-174 R11）
 *
 * 编排 CatalogMergeService.rollback：按 merge_op_id 复活 loser + 复位指向/关系/ref/cache。
 * **数据安全网非字节级无损**（D-174-6 继承）：provenance/locks 只插不删，疑似转移残留仅
 * REPORT 交人工裁定；合并后产生的运行期新写入可能被 cache 复位覆盖（运维窗口警示）。
 *
 * 运行：
 *   node --env-file=.env.local --import tsx scripts/catalog-merge-rollback.ts            # 列出可回滚 op
 *   node --env-file=.env.local --import tsx scripts/catalog-merge-rollback.ts --op=<id> [--apply]
 */

import { db } from '@/api/lib/postgres'
import { CatalogMergeService } from '@/api/services/CatalogMergeService'

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

async function main(): Promise<void> {
  const opId = arg('op')
  const apply = process.argv.includes('--apply')

  if (!opId) {
    const ops = await db.query(
      `SELECT id, loser_catalog_id, survivor_catalog_id, performed_by, performed_at, rolled_back_at
         FROM _bak_catalog_merge_ops_092 ORDER BY performed_at DESC LIMIT 20`
    )
    console.log(`近 20 次合并操作（rolled_back_at 非空 = 已回滚）：`)
    for (const r of ops.rows) console.log(' ', JSON.stringify(r))
    await db.end()
    return
  }

  // 预览：op 信息 + 快照行数
  const op = await db.query(
    `SELECT * FROM _bak_catalog_merge_ops_092 WHERE id = $1`, [opId]
  )
  if (op.rowCount === 0) {
    console.error(`merge_op ${opId} 不存在`)
    process.exit(1)
  }
  console.log('op:', JSON.stringify(op.rows[0]))
  for (const t of ['media_catalog', 'catalog_episodes', 'catalog_characters', 'catalog_character_actors',
                   'video_metadata_provenance', 'video_metadata_locks', 'media_catalog_aliases',
                   'catalog_relations', 'catalog_external_refs', 'videos_catalog_id']) {
    const n = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM _bak_${t}_092 WHERE merge_op_id = $1`, [opId]
    )
    if (n.rows[0]!.n !== '0') console.log(`  快照 ${t}: ${n.rows[0]!.n} 行`)
  }

  if (!apply) {
    console.log('dry-run（仅预览）。执行回滚加 --apply')
    await db.end()
    return
  }

  const svc = new CatalogMergeService(db)
  const result = await svc.rollback(opId)
  console.log(`✓ 回滚完成: revived=${result.revived}`)
  if (result.provenanceResidualReport > 0) {
    console.warn(
      `⚠ provenance/locks 疑似转移残留 ${result.provenanceResidualReport} 行（只插不删 R11，` +
        `survivor 侧可能含 loser 转移副本）—— 仅报告，人工裁定是否清理`
    )
  }
  console.log('建议跑核验: scripts/report-catalog-identity-consistency.ts')
  await db.end()
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
