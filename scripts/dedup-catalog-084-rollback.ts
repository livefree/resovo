/**
 * scripts/dedup-catalog-084-rollback.ts — ADR-174 / META-23-C 阶段 B 回滚预案（R4）
 *
 * 从 _bak_*_084 快照还原 dedup-catalog-084 的不可逆合并（复活冗余 catalog + 还原子表/孙表 + videos 指向）。
 * 应急用：dedup 真跑后发现问题时执行。还原顺序 = 合并逆序（先复活 catalog 目标，再还原引用）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/dedup-catalog-084-rollback.ts [--dry-run]
 *
 * ⚠️ 本回滚是「数据安全网」，**不是字节级逐行无损还原**（Codex stop-time review + Opus 评审 / D-174-6）：
 *   合并是**不可逆操作**（ADR-174 后果栏已自认）。留存行的合并前归并键被阶段 A'（合并后补跑
 *   backfill）**覆盖式 UPDATE 永久丢失、且从未快照** → 无法把库还原到「合并前布局」。
 *   `uq_catalog_title_year_type`（部分唯一索引 / 同 (title_normalized,year,type) 无外部 ID 行仅一行）
 *   在设计上拒绝「复活的冗余行与已收敛留存行同键共存」——这正是合并的目的。
 *   本回滚能做到 / 不能做到：
 *     ✅ 恢复被删 52 行的**全部字段值**（取证 / 人工恢复有据）
 *     ✅ 恢复 52 条 videos 的 catalog_id 指向（回 old_catalog_id）
 *     ✅ 子表（episodes/characters/aliases/actors/provenance/locks）按快照复位（本次均 0 行）
 *     ❌ **不还原留存行被前移的归并键**（旧值已丢）；复活行 title_normalized 带 sentinel 标记，
 *        键不自洽，需人工裁定是否保留/清理。
 *
 * 还原策略：
 *   1. 复活冗余 catalog 行（title_normalized 追加 sentinel 规避 uq 部分索引；见步骤 1 注释）
 *   2. 子表还原（快照即受影响子行的合并前权威副本）：
 *      - PK(id) 子表（episodes/characters/aliases）+ 孙表 actors：DELETE 当前库快照 id 残留 →
 *        INSERT 快照全量（id 主键精确）。
 *      - PK(catalog_id, field_name) 子表（provenance/locks）：删当前库中 field 在快照、
 *        catalog_id 属于(冗余行 ∪ 其留存行) 的残留 → 按快照原 catalog_id 全量复位。
 *   3. videos 指向还原（UPDATE 回 old_catalog_id，条件防覆盖回滚后新写入）
 *   单事务：全成全败。
 *
 * 教训（D-174-6 红线）：任何后续覆盖式重算归并键的迁移，若要求可回滚，**必须在覆盖前快照原始
 *   title_normalized**（本次 A/A' 未做，致留存行旧键不可逆丢失）。
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

  // 1. 复活冗余 catalog 行（数据安全网，非字节级还原 / 见头注释）
  //    被删 52 行全无外部 ID（进 uq_catalog_title_year_type 部分唯一索引 WHERE）。合并后留存行
  //    已收敛到剥标点键、且其合并前旧键已被 A' 覆盖式 UPDATE 永久丢失（未快照）→ 无法让复活行
  //    与留存行在该索引下原样共存（Opus 评审 / D-174-6）。
  //    故复活时给 title_normalized 追加 sentinel 使其退出与留存行的同键冲突；
  //    ON CONFLICT(id) 只兜主键重复（不兜 uq 部分索引——那正是原脚本误以为能兜的真 bug）。
  //    复活行键不自洽（带 sentinel），仅供取证 + 恢复 videos 指向，需人工裁定是否保留/清理。
  const SENTINEL = ' ‹rollback-084›'
  const businessNoNorm = cols.filter((c) => c !== 'title_normalized').map((c) => `"${c}"`).join(', ')
  const revived = await client.query(
    `INSERT INTO media_catalog (${businessNoNorm}, title_normalized)
     SELECT ${businessNoNorm}, title_normalized || $2 FROM _bak_media_catalog_084 WHERE migration_batch = $1
     ON CONFLICT (id) DO NOTHING`,
    [BATCH, SENTINEL],
  )
  process.stdout.write(`  复活 catalog 行: ${revived.rowCount}（title_normalized 带 sentinel '${SENTINEL.trim()}'，键不自洽待人工裁定）\n`)

  // 2. 子表还原（无损策略：快照是受影响子行的合并前权威副本）
  //
  //  PK(id) 子表（episodes/characters/aliases）：快照含原始 (id, catalog_id, …)。
  //    当前库该 id 可能存在（转移走，catalog_id 变了）或不存在（被删碰撞）。
  //    无损还原 = DELETE 当前库这些 id 的残留 → INSERT 快照全量（id 主键精确，无歧义）。
  //
  //  PK(catalog_id, field_name) 子表（provenance/locks）：无独立 id。合并阶段 B 对这两表
  //    **只动 catalog_id ∈ redundantIds 的行**，冗余侧 field 分两类：
  //      A 类（碰撞）：留存行原有该 field + 冗余行也有 → 合并删冗余侧（留存优先）→ 进快照。
  //      B 类（转移）：留存行原本无该 field + 冗余行有 → 合并 `UPDATE SET catalog_id` 整行搬到留存行。
  //    ⚠️ Codex 两轮修正的死结 + 破解：
  //      - 不能删 catalog_id=留存行的「全部」该 field（会删留存行原有 = A 类留存侧，快照无法还原）。
  //      - 但只 INSERT 冗余快照回原 catalog_id 又会把 B 类「转移到留存行的那份」**遗留在留存行**
  //        （transferred survivor metadata left behind）。
  //      破解判据：B 类转移是 `UPDATE SET catalog_id`——**只改 catalog_id，其余列（value/source/
  //        priority/updated_at 等）原封保留冗余行原值**。故留存行上「除 catalog_id 外逐列等于某
  //        冗余快照行」的 = B 类转移来的副本（精确锁定，删它）；留存行原有 field（A 类留存侧）
  //        值是自己的、不会逐列等于冗余快照，**不被误删**。
  //    还原三步：① 删留存行上逐列匹配冗余快照的 B 类转移残留 → ② INSERT 冗余快照回原 catalog_id
  //      （A+B 类冗余副本全复位）。净效果：留存行只剩自己原有 field（A 类留存侧，零误删），
  //      冗余行复活后带回 A+B 全部自己的 field（取证完整，B 类不遗留）。
  //
  //  顺序：characters 在 episodes 后（孙表 actors 依赖 character 先复活，见步骤末）。

  // ── PK(id) 子表 ──
  for (const t of ['catalog_episodes', 'catalog_characters', 'media_catalog_aliases']) {
    const bak = `_bak_${t}_084`
    await client.query(`DELETE FROM ${t} WHERE id IN (SELECT id FROM ${bak})`)
    await client.query(`INSERT INTO ${t} SELECT * FROM ${bak}`)
  }
  // 孙表 catalog_character_actors（PK id）：character 已在上面 DELETE+INSERT 复活，
  //   其 CASCADE 已清掉当前 actors；按快照全量重建该 character 的 actors。
  await client.query(
    `DELETE FROM catalog_character_actors WHERE id IN (SELECT id FROM _bak_catalog_character_actors_084)`,
  )
  await client.query(`INSERT INTO catalog_character_actors SELECT * FROM _bak_catalog_character_actors_084`)

  // ── PK(catalog_id, field_name) 子表（无 id）：删 B 类转移残留 + 复位冗余快照（Codex 两轮修正）──
  //   逐列匹配判据见上方注释。各表「除 catalog_id 外」的列：
  //     provenance: field_name/source_kind/source_ref/source_priority/updated_at
  //     locks:      field_name/lock_mode/locked_by/locked_at/reason
  //   用 IS NOT DISTINCT FROM 处理 nullable 列（source_ref / reason）。
  const otherCols: Record<string, string[]> = {
    video_metadata_provenance: ['field_name', 'source_kind', 'source_ref', 'source_priority', 'updated_at'],
    video_metadata_locks: ['field_name', 'lock_mode', 'locked_by', 'locked_at', 'reason'],
  }
  for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
    const bak = `_bak_${t}_084`
    const colMatch = otherCols[t]
      .map((c) => `cur.${c} IS NOT DISTINCT FROM b.${c}`)
      .join(' AND ')
    // ① 删留存行（cur.catalog_id = b 的 surviving_id）上「除 catalog_id 外逐列等于冗余快照」的 B 类转移残留
    await client.query(
      `DELETE FROM ${t} cur
       USING ${bak} b
       JOIN _bak_media_catalog_084 mc ON mc.id = b.catalog_id
       WHERE cur.catalog_id = mc.surviving_id AND ${colMatch}`,
    )
    // ② 复位冗余快照回原 (冗余 catalog_id, field_name)；冗余 catalog_id ≠ 留存行，不撞留存 PK
    await client.query(
      `INSERT INTO ${t} SELECT * FROM ${bak} ON CONFLICT (catalog_id, field_name) DO NOTHING`,
    )
  }

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
