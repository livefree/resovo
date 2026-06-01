/**
 * scripts/dedup-catalog-084-rollback.ts — ADR-174 / META-23-C 阶段 B 回滚预案（R4）
 *
 * 从 _bak_*_084 快照还原 dedup-catalog-084 的不可逆合并（复活冗余 catalog + 还原子表/孙表 + videos 指向）。
 * 应急用：dedup 真跑后发现问题时执行。还原顺序 = 合并逆序（先复活 catalog 目标，再还原引用）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/dedup-catalog-084-rollback.ts [--dry-run]
 *
 * 还原策略（§6）：
 *   1. 复活冗余 catalog 行（从主表快照，排除迁移元数据列）
 *   2. 子表还原（信任快照为权威）：
 *      - 转移走的子行（id 在快照、当前 catalog_id=留存行）→ UPDATE 回快照中的原 catalog_id
 *      - 被删碰撞的子行（id 在快照、当前已不存在）→ INSERT 回来
 *      - 孙表 actors 随 character 复活后补 INSERT 不存在的 id
 *   3. videos 指向还原（UPDATE 回 old_catalog_id，条件防覆盖回滚后新写入）
 *   单事务：全成全败。
 */

import { Pool, type PoolClient } from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = '084'

/** media_catalog 业务列（排除快照表附加的 migration_batch/surviving_id/snapshot_at）。
 *  用 information_schema 动态取，避免硬编码 30+ 列漂移。 */
async function catalogBusinessColumns(client: PoolClient): Promise<string[]> {
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'media_catalog' AND table_schema = 'public'
     ORDER BY ordinal_position`,
  )
  return res.rows.map((r) => r.column_name)
}

async function rollback(client: PoolClient): Promise<void> {
  const cols = await catalogBusinessColumns(client)
  const colList = cols.map((c) => `"${c}"`).join(', ')

  // 1. 复活冗余 catalog 行（仅业务列；ON CONFLICT(id) DO NOTHING 防与未删行重复）
  const revived = await client.query(
    `INSERT INTO media_catalog (${colList})
     SELECT ${colList} FROM _bak_media_catalog_084 WHERE migration_batch = $1
     ON CONFLICT (id) DO NOTHING`,
    [BATCH],
  )
  process.stdout.write(`  复活 catalog 行: ${revived.rowCount}\n`)

  // 2. 子表还原（每表：先 UPDATE 转移走的回原 catalog_id，再 INSERT 被删的）
  //    顺序：先 characters（孙表依赖）→ 其余
  for (const t of ['catalog_episodes', 'catalog_characters', 'video_metadata_provenance', 'video_metadata_locks', 'media_catalog_aliases']) {
    const bak = `_bak_${t}_084`
    // 转移走的：id 在快照、当前行 catalog_id 已变 → 改回快照中的 catalog_id
    if (t === 'video_metadata_provenance' || t === 'video_metadata_locks') {
      // PK(catalog_id, field_name)：转移走的行键已变，按 (原 catalog_id, field_name) 还原
      // 这两表无独立 id，UPDATE 需按 field_name 匹配——但转移后留存行可能已有同 field，
      // 故被转移行还原用 INSERT ON CONFLICT DO NOTHING（留存行优先，与合并语义一致）
      await client.query(
        `INSERT INTO ${t} SELECT * FROM ${bak}
         ON CONFLICT (catalog_id, field_name) DO NOTHING`,
      )
    } else {
      // PK(id) 子表：转移走的（id 当前存在但 catalog_id 不在快照原值）→ UPDATE 回
      await client.query(
        `UPDATE ${t} c SET catalog_id = b.catalog_id
         FROM ${bak} b WHERE c.id = b.id AND c.catalog_id IS DISTINCT FROM b.catalog_id`,
      )
      // 被删的（id 不在当前表）→ INSERT 回
      await client.query(
        `INSERT INTO ${t} SELECT * FROM ${bak} b
         WHERE NOT EXISTS (SELECT 1 FROM ${t} c WHERE c.id = b.id)`,
      )
    }
  }
  // 孙表 catalog_character_actors（PK id）：character 复活后补回不存在的
  await client.query(
    `INSERT INTO catalog_character_actors SELECT * FROM _bak_catalog_character_actors_084 b
     WHERE NOT EXISTS (SELECT 1 FROM catalog_character_actors c WHERE c.id = b.id)`,
  )

  // 3. videos 指向还原（回 old_catalog_id；条件防覆盖回滚后新写入）
  const vid = await client.query(
    `UPDATE videos v SET catalog_id = b.old_catalog_id, updated_at = NOW()
     FROM _bak_videos_catalog_id_084 b
     WHERE v.id = b.video_id AND b.migration_batch = $1
       AND v.catalog_id IS NOT DISTINCT FROM b.new_catalog_id`,
    [BATCH],
  )
  process.stdout.write(`  还原 videos 指向: ${vid.rowCount}\n`)
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await rollback(client)
      if (DRY_RUN) {
        await client.query('ROLLBACK')
        process.stdout.write('[rollback-084] dry-run 完成（已 ROLLBACK，未落库）。\n')
      } else {
        await client.query('COMMIT')
        process.stdout.write('[rollback-084] 回滚完成（已 COMMIT）。建议跑 verify 确认 catalog/子表/videos 复原。\n')
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : JSON.stringify(err)
  process.stderr.write(`[rollback-084] failed: ${msg}\n`)
  process.exit(1)
})
