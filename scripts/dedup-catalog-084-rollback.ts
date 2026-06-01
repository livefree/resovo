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
  //  PK(catalog_id, field_name) 子表（provenance/locks）：无独立 id。合并冗余侧 field 两类：
  //      A 类（留存行原有）：合并未碰（删的是冗余侧）→ 留存行保留自己的值。
  //      B 类（冗余转移）：留存行原无、冗余行 `UPDATE SET catalog_id` 搬来 → 留存行多一份。
  //    ⚠️ 信息论不可达（Codex 三轮 + Opus 裁定 acb02c256adb21e56 / D-174-6）：
  //      合并擦除了留存行 field 的来源(A/B)标记（无 id、无来源列、A 类留存侧从未快照）。
  //      回滚侧任何事后判据都无法精确区分 A/B —— 同作品两 catalog 的同 field 其
  //      source_kind/source_priority/updated_at 常完全重合（同源同批 backfill），值空间真实重合。
  //      故「逐列相等删 B 类」会误删 A 类（曾在轮3 误用，已撤回）。
  //    **终局（数据安全，宁留勿误删）：只 INSERT 冗余快照回原 catalog_id，绝不 DELETE 留存行任何行。**
  //      B 类转移副本遗留在留存行 = 已知不可逆损失（接受）；误删 A 类 = 不可逆且静默（禁止）。
  //      遗留不静默：跑完用逐列判据**报告**疑似 B 类残留候选（仅 REPORT 不删，交人工裁定）。
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

  // ── PK(catalog_id, field_name) 子表（无 id）：只插不删 + 残留报告（Opus 裁定终局）──
  //   逐列「除 catalog_id 外」列（用于 REPORT 候选判据，非 DELETE）：
  //     provenance: source_kind/source_ref/source_priority/updated_at（+field_name）
  //     locks:      lock_mode/locked_by/locked_at/reason（+field_name）
  //   IS NOT DISTINCT FROM 处理 nullable（source_ref / reason）。
  const reportCols: Record<string, string[]> = {
    video_metadata_provenance: ['field_name', 'source_kind', 'source_ref', 'source_priority', 'updated_at'],
    video_metadata_locks: ['field_name', 'lock_mode', 'locked_by', 'locked_at', 'reason'],
  }
  for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
    const bak = `_bak_${t}_084`
    // 唯一执行动作：复位冗余快照回原 (冗余 catalog_id, field_name)。冗余 catalog_id ≠ 留存行，
    // 不撞留存 PK。**绝不 DELETE 留存行任何行**（删 = 不可逆误删 A 类 / R11）。
    await client.query(
      `INSERT INTO ${t} SELECT * FROM ${bak} ON CONFLICT (catalog_id, field_name) DO NOTHING`,
    )
    // 残留报告（非执行路径 / 不删）：逐列判据报告留存行上疑似 B 类转移残留，交人工裁定。
    // 判据不精确（A 类同源同批可能逐列等于冗余快照 → 误报），仅 REPORT 不 DELETE。
    const colMatch = reportCols[t].map((c) => `cur.${c} IS NOT DISTINCT FROM b.${c}`).join(' AND ')
    if (t === 'video_metadata_locks') {
      // locks 有运行时语义（字段冻结影响后续富集覆盖）→ 残留报告必须**可操作明细**（catalog_id+field_name），
      // 仅计数无法人工解锁（Codex）。落 _residual_locks_084 表（回滚产物，脚本内建）+ 逐条打印 + 解锁 SQL 提示。
      await client.query(
        `CREATE TABLE IF NOT EXISTS _residual_locks_084 (
           catalog_id UUID NOT NULL, field_name TEXT NOT NULL, lock_mode TEXT, locked_by TEXT,
           locked_at TIMESTAMPTZ, reason TEXT, reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (catalog_id, field_name)
         )`,
      )
      const residual = await client.query<{
        catalog_id: string; field_name: string; lock_mode: string; locked_by: string
      }>(
        `SELECT cur.catalog_id, cur.field_name, cur.lock_mode, cur.locked_by
         FROM ${t} cur
         JOIN _bak_media_catalog_084 mc ON cur.catalog_id = mc.surviving_id
         JOIN ${bak} b ON b.catalog_id = mc.id AND ${colMatch}`,
      )
      // 落明细表（幂等：ON CONFLICT 更新 reported_at）
      await client.query(
        `INSERT INTO _residual_locks_084 (catalog_id, field_name, lock_mode, locked_by, locked_at, reason)
         SELECT cur.catalog_id, cur.field_name, cur.lock_mode, cur.locked_by, cur.locked_at, cur.reason
         FROM ${t} cur
         JOIN _bak_media_catalog_084 mc ON cur.catalog_id = mc.surviving_id
         JOIN ${bak} b ON b.catalog_id = mc.id AND ${colMatch}
         ON CONFLICT (catalog_id, field_name) DO UPDATE SET reported_at = NOW()`,
      )
      if (residual.rows.length === 0) {
        process.stdout.write('  locks 疑似 B 类转移残留候选: 0（无须人工处理）\n')
      } else {
        // ⚠️ Codex（三轮）：本脚本**纯诊断，不删、不生成删除 SQL、不指向任何"安全删除通道"**。
        //   两类风险对**任何**按 (catalog_id, field_name) 的事后删除都无解，无"安全通道"可言：
        //   ① 误报（信息论不可达）：候选含 A 类合法锁（同源同批逐列等于冗余快照），无法区分。
        //   ② TOCTOU：报告时刻 vs 处理时刻之间，该 PK 位置可能已被重新锁定为全新合法锁。
        //   既有 removeFieldLock(metadataProvenance.ts:182) **内部就是裸 PK DELETE、无任何状态校验**，
        //   与单删 SQL 同样不安全 —— 故**不再标榜它为安全通道**（曾误称"可带状态校验规避 TOCTOU"，错误，已撤回）。
        //   处理责任完全在人工：必须先 SELECT 当前 (catalog_id, field_name) 的锁，逐列比对是否仍等于
        //   下方报告快照（locked_by/locked_at 未变 = 仍是同一把锁、未被替换），确认无误 + 确属误转移，
        //   才自行删除；TOCTOU 核对与误报判定的责任在操作者，本脚本不代为生成可盲执行的语句。
        process.stdout.write(
          `  ⚠️ locks 疑似 B 类转移残留候选 ${residual.rows.length} 条（运行时后果：留存行可能多一个本不该有的字段冻结）。\n` +
            `     **疑似清单（判据含误报）。本脚本不删、不生成删除语句、无"安全删除通道"。**\n` +
            `     处理前操作者须逐条：① SELECT 当前该 (catalog_id, field_name) 锁，比对 locked_by/locked_at\n` +
            `     是否仍等于下方快照（防 TOCTOU：变了说明已被替换为新锁，禁止删）；② 业务核查确属误转移；\n` +
            `     ③ 二者皆满足才自行删除（removeFieldLock 等工具均为裸 PK 删、无状态校验，安全责任在操作者）：\n`,
        )
        for (const r of residual.rows) {
          process.stdout.write(`    · catalog=${r.catalog_id} field=${r.field_name} mode=${r.lock_mode} by=${r.locked_by}\n`)
        }
        process.stdout.write(
          `  明细已落 _residual_locks_084（纯诊断台账，供人工 TOCTOU 比对核对；本脚本不据其删除任何锁）。\n`,
        )
      }
    } else {
      // provenance 纯审计血缘，残留=噪声无害 → 计数信息级即可（无运行时后果，无须逐条解锁）
      const cnt = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM ${t} cur
         JOIN _bak_media_catalog_084 mc ON cur.catalog_id = mc.surviving_id
         JOIN ${bak} b ON b.catalog_id = mc.id AND ${colMatch}`,
      )
      process.stdout.write(`  provenance 疑似 B 类转移残留候选: ${Number(cnt.rows[0]?.n ?? 0)}（审计噪声，无运行时后果，遗留可接受）\n`)
    }
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
