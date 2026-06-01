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
  //    **只动 catalog_id ∈ redundantIds 的行**（先删与留存行碰撞的冗余侧、再把剩余冗余侧
  //    UPDATE 到留存行）；**留存行自身的 field 全程未被触碰**。
  //    ⚠️ Codex 修正：回滚**绝不能 DELETE catalog_id=留存行的行**——那会删掉留存行自己合法的
  //    元数据（其值是合并时按留存优先保留下来的有效数据，快照里没有它，删了无法还原）。
  //    正确还原（只复位「冗余来源」的 field，不碰留存行）：
  //      ① 把「转移到留存行的冗余 field」挪回原冗余 catalog_id —— 这些行 = 当前在留存行名下、
  //         (留存行, field_name) 命中快照 (surviving_id 对应组) 且留存行原本无此 field。
  //         但「留存行原本无此 field」不可判（留存行 field 未快照）→ 改用 id-free 安全策略：
  //         先 INSERT 冗余行快照回原 (冗余 catalog_id, field)（冗余 catalog_id ≠ 留存行，不撞留存行 PK）；
  //         若该冗余 catalog_id+field 当前已存在（理论不会，冗余行已删）则 ON CONFLICT DO NOTHING。
  //      ② 转移到留存行的那份冗余副本：合并后它 catalog_id=留存行，与留存行原有 field 同 PK 已合一，
  //         无法区分来源 → **保留现状不动**（留存行视角该 field 已是单一值，删它反而伤留存）。
  //    净效果：冗余行复活后带回自己的 field（取证完整）；留存行 field 一概不动（零误删）。
  //    代价：若某 field 合并时「冗余转移覆盖式进留存行」（实际不会——UPDATE 不覆盖留存已有键，
  //    碰撞的冗余侧被先删入快照），则该 field 在留存行多留一份，属可接受的非字节级（D-174-6）。
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

  // ── PK(catalog_id, field_name) 子表（无 id）：只复位冗余来源，零触碰留存行（Codex 修正）──
  for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
    const bak = `_bak_${t}_084`
    // 仅 INSERT 冗余行快照回其**原** (冗余 catalog_id, field_name)；冗余 catalog_id ≠ 留存行，
    // 不撞留存行 PK。冗余行已删→其 catalog_id 下无残留，正常插回；ON CONFLICT 仅防理论并发。
    // **不删任何 catalog_id=留存行的行**（留存行 field 是合并保留的有效值、快照里没有、删则丢失）。
    await client.query(
      `INSERT INTO ${t} SELECT * FROM ${bak}
       ON CONFLICT (catalog_id, field_name) DO NOTHING`,
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
