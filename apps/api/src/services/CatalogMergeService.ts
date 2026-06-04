/**
 * CatalogMergeService.ts — catalog-catalog 合并/回滚原语（CHG-VIR-12-F / Phase 5f）
 *
 * 契约真源：ADR-176 D-176-4（_bak_* 全字段快照范式 / R-2 关系边重指向 + 复位）+ D-176-10
 * （原语落 Service 层，运维脚本编排，不起 admin 端点）+ ADR-177 D-177-9 / RR-A（exact ref
 * 重指向「索引① 预检主导」）+ ADR-174 D-174-6 / R11（回滚 = 数据安全网非字节级无损，
 * provenance/locks 只插不删）。实现严格继承 migration 084 / dedup-catalog-084.ts 合并范式
 * （内容子表转移 + 碰撞删除〔快照留痕〕+ 孙表盲点），增量 = catalog_relations 端点重指向
 * + catalog_external_refs RR-A 预检 + survivor 四列 cache 重算（merge_ops 快照复位）。
 *
 * 事务边界：merge / rollback 各自单事务（全成全败）；调用方（脚本）不另管事务。
 * dry-run 由调用方以「BEGIN → merge → ROLLBACK」实现（原语本身不感知 dry-run）。
 */

import type { Pool, PoolClient } from 'pg'

/** 快照表集（R10 前向守卫核验清单 / migration 092） */
const SNAPSHOT_TABLES = [
  '_bak_catalog_merge_ops_092',
  '_bak_media_catalog_092',
  '_bak_catalog_episodes_092',
  '_bak_catalog_characters_092',
  '_bak_catalog_character_actors_092',
  '_bak_video_metadata_provenance_092',
  '_bak_video_metadata_locks_092',
  '_bak_media_catalog_aliases_092',
  '_bak_catalog_relations_092',
  '_bak_catalog_external_refs_092',
  '_bak_videos_catalog_id_092',
] as const

/** provider → media_catalog cache 列（D-177-9 cache 重算） */
const CACHE_COLUMNS = [
  { provider: 'imdb', col: 'imdb_id', castInsert: false },
  { provider: 'tmdb', col: 'tmdb_id', castInsert: true },
  { provider: 'douban', col: 'douban_id', castInsert: false },
  { provider: 'bangumi', col: 'bangumi_subject_id', castInsert: true },
] as const

export interface MergeStats {
  readonly mergeOpId: string
  readonly videosRedirected: number
  readonly relationsDroppedSelfLoop: number
  readonly relationsDroppedDup: number
  readonly relationsRedirected: number
  readonly refsDroppedExactPrecheck: number
  readonly refsDroppedDup: number
  readonly refsRedirected: number
  readonly cacheBackfilled: string[]
}

export class CatalogMergeService {
  constructor(private db: Pool) {}

  /**
   * 合并：loser 的全部内容/指向转移到 survivor，删 loser 行。单事务（D-176-4 / 全成全败）。
   * @returns 合并统计（mergeOpId 供回滚）
   */
  async merge(loserId: string, survivorId: string, performedBy: string): Promise<MergeStats> {
    if (loserId === survivorId) throw new Error('CatalogMerge: loser 与 survivor 不得相同')
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const stats = await this.mergeInTx(client, loserId, survivorId, performedBy)
      await client.query('COMMIT')
      return stats
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /** 事务内合并主体（dry-run 编排可直接调用本方法后 ROLLBACK） */
  async mergeInTx(
    client: PoolClient,
    loserId: string,
    survivorId: string,
    performedBy: string
  ): Promise<MergeStats> {
    // (0) R10 前向守卫：快照表齐全 + 两行存在
    await this.assertSnapshotTables(client)
    const pair = await client.query<{ id: string }>(
      `SELECT id FROM media_catalog WHERE id = ANY($1::uuid[])`,
      [[loserId, survivorId]]
    )
    if (pair.rowCount !== 2) {
      throw new Error(`CatalogMerge: loser/survivor 行缺失（命中 ${pair.rowCount}/2）`)
    }

    // (1) 注册 merge_op + survivor 四列 cache 合并前快照（D-177-9 回滚复位源）
    const op = await client.query<{ id: string }>(
      `INSERT INTO _bak_catalog_merge_ops_092
         (loser_catalog_id, survivor_catalog_id, performed_by, survivor_cache_snapshot)
       SELECT $1, $2, $3,
              jsonb_build_object('imdb_id', imdb_id, 'tmdb_id', tmdb_id,
                                 'douban_id', douban_id, 'bangumi_subject_id', bangumi_subject_id)
         FROM media_catalog WHERE id = $2
       RETURNING id`,
      [loserId, survivorId, performedBy]
    )
    const mergeOpId = op.rows[0]!.id

    // (2) 快照（删行/转移之前 / 084 范式 + relations/refs 增量）。
    //     relations/refs 须含**双方端点**命中的行（重指向会改动命中 loser 的行；
    //     survivor 侧行可能因碰撞预检被删 loser 行替代——快照双方保完整复位面）。
    await client.query(
      `INSERT INTO _bak_media_catalog_092
       SELECT mc.*, $2, NOW() FROM media_catalog mc WHERE mc.id = $1`,
      [loserId, mergeOpId]
    )
    for (const t of ['catalog_episodes', 'catalog_characters', 'video_metadata_provenance', 'video_metadata_locks', 'media_catalog_aliases']) {
      await client.query(
        `INSERT INTO _bak_${t}_092 SELECT s.*, $2, NOW() FROM ${t} s WHERE s.catalog_id = $1`,
        [loserId, mergeOpId]
      )
    }
    await client.query(
      `INSERT INTO _bak_catalog_character_actors_092
       SELECT cca.*, $2, NOW() FROM catalog_character_actors cca
       JOIN catalog_characters cc ON cc.id = cca.character_id
       WHERE cc.catalog_id = $1`,
      [loserId, mergeOpId]
    )
    await client.query(
      `INSERT INTO _bak_catalog_relations_092
       SELECT r.*, $2, NOW() FROM catalog_relations r
       WHERE r.from_catalog_id = ANY($1::uuid[]) OR r.to_catalog_id = ANY($1::uuid[])`,
      [[loserId, survivorId], mergeOpId]
    )
    await client.query(
      `INSERT INTO _bak_catalog_external_refs_092
       SELECT r.*, $2, NOW() FROM catalog_external_refs r WHERE r.catalog_id = ANY($1::uuid[])`,
      [[loserId, survivorId], mergeOpId]
    )
    await client.query(
      `INSERT INTO _bak_videos_catalog_id_092 (video_id, old_catalog_id, new_catalog_id, merge_op_id)
       SELECT id, catalog_id, $2, $3 FROM videos WHERE catalog_id = $1`,
      [loserId, survivorId, mergeOpId]
    )

    // (3) videos 重指向（先于删 catalog；含软删行 / 084 范式）
    const videos = await client.query(
      `UPDATE videos SET catalog_id = $2, updated_at = NOW() WHERE catalog_id = $1`,
      [loserId, survivorId]
    )

    // (4) PK(catalog_id, field_name) 子表：先删 loser 侧与 survivor 撞 field 的行，再转移
    for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
      await client.query(
        `DELETE FROM ${t} p
         WHERE p.catalog_id = $1
           AND EXISTS (SELECT 1 FROM ${t} s WHERE s.catalog_id = $2 AND s.field_name = p.field_name)`,
        [loserId, survivorId]
      )
      await client.query(`UPDATE ${t} SET catalog_id = $2 WHERE catalog_id = $1`, [loserId, survivorId])
    }

    // (5) 内容子表转移（碰撞删除〔已快照〕+ UPDATE / 084 范式；characters 碰撞 CASCADE 删孙表已快照）
    await client.query(
      `DELETE FROM catalog_episodes e
       WHERE e.catalog_id = $1
         AND EXISTS (SELECT 1 FROM catalog_episodes s
                     WHERE s.catalog_id = $2 AND s.source = e.source
                       AND s.external_episode_id IS NOT DISTINCT FROM e.external_episode_id)`,
      [loserId, survivorId]
    )
    await client.query(`UPDATE catalog_episodes SET catalog_id = $2 WHERE catalog_id = $1`, [loserId, survivorId])
    await client.query(
      `DELETE FROM catalog_characters c
       WHERE c.catalog_id = $1
         AND EXISTS (SELECT 1 FROM catalog_characters s
                     WHERE s.catalog_id = $2 AND s.source = c.source
                       AND s.external_character_id IS NOT DISTINCT FROM c.external_character_id)`,
      [loserId, survivorId]
    )
    await client.query(`UPDATE catalog_characters SET catalog_id = $2 WHERE catalog_id = $1`, [loserId, survivorId])
    await client.query(
      `DELETE FROM media_catalog_aliases a
       WHERE a.catalog_id = $1
         AND EXISTS (SELECT 1 FROM media_catalog_aliases s
                     WHERE s.catalog_id = $2 AND s.alias IS NOT DISTINCT FROM a.alias)`,
      [loserId, survivorId]
    )
    await client.query(`UPDATE media_catalog_aliases SET catalog_id = $2 WHERE catalog_id = $1`, [loserId, survivorId])

    // (6) catalog_relations 端点重指向（D-176-4 R-2）
    //   6a 双方之间的边：重指向后必自环（from=to 违 CHECK）→ 删（快照留痕复位）
    const selfLoop = await client.query(
      `DELETE FROM catalog_relations
        WHERE (from_catalog_id = $1 AND to_catalog_id = $2)
           OR (from_catalog_id = $2 AND to_catalog_id = $1)`,
      [loserId, survivorId]
    )
    //   6b 重指向后撞 UNIQUE(from,to,relation) 的边 → 删（survivor 已有等价边；快照留痕）
    const dupRel = await client.query(
      `DELETE FROM catalog_relations r
        WHERE (r.from_catalog_id = $1 OR r.to_catalog_id = $1)
          AND EXISTS (
            SELECT 1 FROM catalog_relations s
            WHERE s.relation = r.relation
              AND s.from_catalog_id = (CASE WHEN r.from_catalog_id = $1 THEN $2::uuid ELSE r.from_catalog_id END)
              AND s.to_catalog_id   = (CASE WHEN r.to_catalog_id   = $1 THEN $2::uuid ELSE r.to_catalog_id END)
          )`,
      [loserId, survivorId]
    )
    //   6c 剩余命中边重指向；same_work_candidate 重指向后须保持有序对 CHECK（LEAST/GREATEST 规范化）
    const redirRel = await client.query(
      `UPDATE catalog_relations r
          SET from_catalog_id = CASE
                WHEN r.relation = 'same_work_candidate'
                THEN LEAST(
                  (CASE WHEN r.from_catalog_id = $1 THEN $2::uuid ELSE r.from_catalog_id END)::text,
                  (CASE WHEN r.to_catalog_id   = $1 THEN $2::uuid ELSE r.to_catalog_id   END)::text
                )::uuid
                ELSE (CASE WHEN r.from_catalog_id = $1 THEN $2::uuid ELSE r.from_catalog_id END)
              END,
              to_catalog_id = CASE
                WHEN r.relation = 'same_work_candidate'
                THEN GREATEST(
                  (CASE WHEN r.from_catalog_id = $1 THEN $2::uuid ELSE r.from_catalog_id END)::text,
                  (CASE WHEN r.to_catalog_id   = $1 THEN $2::uuid ELSE r.to_catalog_id   END)::text
                )::uuid
                ELSE (CASE WHEN r.to_catalog_id = $1 THEN $2::uuid ELSE r.to_catalog_id END)
              END,
              updated_at = NOW()
        WHERE r.from_catalog_id = $1 OR r.to_catalog_id = $1`,
      [loserId, survivorId]
    )

    // (7) catalog_external_refs 重指向（D-177-9 / RR-A 预检主导）
    //   7a exact：survivor 已持同 (provider, external_id, external_kind) 的 exact →
    //      丢弃 loser 行（快照留痕，不 UPDATE —— catalog 合并即外部身份归并）
    const exactDrop = await client.query(
      `DELETE FROM catalog_external_refs r
        WHERE r.catalog_id = $1 AND r.relation = 'exact'
          AND EXISTS (
            SELECT 1 FROM catalog_external_refs s
            WHERE s.relation = 'exact' AND s.provider = r.provider
              AND s.external_id = r.external_id AND s.external_kind = r.external_kind
              AND s.catalog_id = $2
          )`,
      [loserId, survivorId]
    )
    //   7b 重指向后撞索引②（同 catalog 同关系同哨兵槽位）的行 → 删（快照留痕；
    //      含 candidate/rejected 的同值噪声行一并去重）
    const dupRef = await client.query(
      `DELETE FROM catalog_external_refs r
        WHERE r.catalog_id = $1
          AND EXISTS (
            SELECT 1 FROM catalog_external_refs s
            WHERE s.catalog_id = $2 AND s.provider = r.provider
              AND s.external_id = r.external_id AND s.external_kind = r.external_kind
              AND s.relation = r.relation
              AND COALESCE(s.season_number, 0) = COALESCE(r.season_number, 0)
          )`,
      [loserId, survivorId]
    )
    //   7c-pre（Codex FIX：exact↔cache 一致性）：survivor 同 provider 的 cache 列**非 NULL
    //      且异值**时，loser 的 exact 转移后会与 cache 单值冲突（HARD 不一致）——cache 异值
    //      即身份冲突信号，按 D-177-4「冲突只产 candidate」降级（快照已留原值可复位）
    await client.query(
      `UPDATE catalog_external_refs r
          SET relation = 'candidate', is_primary = false, updated_at = NOW(),
              notes = COALESCE(r.notes || ' | ', '') || 'demoted: survivor cache conflict (merge)'
         FROM media_catalog s
        WHERE r.catalog_id = $1 AND r.relation = 'exact' AND s.id = $2
          AND (
               (r.provider = 'imdb'    AND s.imdb_id            IS NOT NULL AND s.imdb_id            <> r.external_id)
            OR (r.provider = 'tmdb'    AND s.tmdb_id            IS NOT NULL AND s.tmdb_id::text      <> r.external_id)
            OR (r.provider = 'douban'  AND s.douban_id          IS NOT NULL AND s.douban_id          <> r.external_id)
            OR (r.provider = 'bangumi' AND s.bangumi_subject_id IS NOT NULL AND s.bangumi_subject_id::text <> r.external_id)
          )`,
      [loserId, survivorId]
    )
    //   7c-pre 降级后的 candidate 若与 survivor 既有同值 candidate 重复 → 补一轮 7b 口径去重
    await client.query(
      `DELETE FROM catalog_external_refs r
        WHERE r.catalog_id = $1 AND r.relation = 'candidate'
          AND EXISTS (
            SELECT 1 FROM catalog_external_refs s
            WHERE s.catalog_id = $2 AND s.provider = r.provider
              AND s.external_id = r.external_id AND s.external_kind = r.external_kind
              AND s.relation = 'candidate'
          )`,
      [loserId, survivorId]
    )
    //   7c 剩余 ref 重指向 survivor；survivor 同 provider 已有任何 exact 时，转移来的 exact
    //      is_primary 置 false（主绑定唯一性保持，cache 槽位属 survivor 原 exact）
    const redirRef = await client.query(
      `UPDATE catalog_external_refs r
          SET catalog_id = $2,
              is_primary = CASE
                WHEN r.relation = 'exact' AND r.is_primary AND EXISTS (
                  SELECT 1 FROM catalog_external_refs s
                  WHERE s.catalog_id = $2 AND s.provider = r.provider AND s.relation = 'exact'
                ) THEN false
                ELSE r.is_primary
              END,
              updated_at = NOW()
        WHERE r.catalog_id = $1`,
      [loserId, survivorId]
    )

    // (8) 删 loser 主表行（引用已转移/快照）
    await client.query(`DELETE FROM media_catalog WHERE id = $1`, [loserId])

    // (9) cache 重算（D-177-9 / 保守口径）：survivor 某 provider cache 为 NULL 且转移获得
    //     is_primary exact → 回填该列；已有 cache 值不覆盖（一致性由报表口径管）
    const cacheBackfilled: string[] = []
    for (const c of CACHE_COLUMNS) {
      const r = await client.query(
        `UPDATE media_catalog mc
            SET ${c.col} = ${c.castInsert ? 'sub.external_id::int' : 'sub.external_id'}, updated_at = NOW()
           FROM (
             SELECT external_id FROM catalog_external_refs
              WHERE catalog_id = $1 AND provider = $2 AND relation = 'exact' AND is_primary
              LIMIT 1
           ) sub
          WHERE mc.id = $1 AND mc.${c.col} IS NULL`,
        [survivorId, c.provider]
      )
      if ((r.rowCount ?? 0) > 0) cacheBackfilled.push(c.col)
    }

    // (10) dangling 断言（084 (8) + relations/refs 扩展）
    const dangling = await client.query<{ n: string }>(
      `SELECT (
          (SELECT COUNT(*) FROM catalog_episodes          WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM catalog_characters        WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM video_metadata_provenance WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM video_metadata_locks      WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM media_catalog_aliases     WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM catalog_relations         WHERE from_catalog_id = $1 OR to_catalog_id = $1)
        + (SELECT COUNT(*) FROM catalog_external_refs     WHERE catalog_id = $1)
        + (SELECT COUNT(*) FROM videos                    WHERE catalog_id = $1)
      )::text AS n`,
      [loserId]
    )
    if (dangling.rows[0]!.n !== '0') {
      throw new Error(`CatalogMerge: loser ${loserId} 残留引用 ${dangling.rows[0]!.n} 行（断言失败，事务回滚）`)
    }

    return {
      mergeOpId,
      videosRedirected: videos.rowCount ?? 0,
      relationsDroppedSelfLoop: selfLoop.rowCount ?? 0,
      relationsDroppedDup: dupRel.rowCount ?? 0,
      relationsRedirected: redirRel.rowCount ?? 0,
      refsDroppedExactPrecheck: exactDrop.rowCount ?? 0,
      refsDroppedDup: dupRef.rowCount ?? 0,
      refsRedirected: redirRef.rowCount ?? 0,
      cacheBackfilled,
    }
  }

  /**
   * 回滚（数据安全网非字节级无损 / ADR-174 D-174-6 + R11 继承）：
   * - loser 主表行 + PK(id) 子表精确还原（DELETE by 快照 id + INSERT 全量 / 084 rollback 范式）
   * - provenance/locks **只插不删**（值空间重合不可逆，残留 REPORT 交人工）
   * - relations/refs 按快照 id 复位（被 UPDATE 的行复原值 / 被 DELETE 的行 INSERT 回）
   * - videos.catalog_id 按 old 快照复位；survivor 四列 cache 按 merge_ops 快照复位
   */
  async rollback(mergeOpId: string): Promise<{ revived: boolean; provenanceResidualReport: number }> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const op = await client.query<{
        loser_catalog_id: string
        survivor_catalog_id: string
        survivor_cache_snapshot: Record<string, unknown>
        rolled_back_at: string | null
      }>(
        `SELECT loser_catalog_id, survivor_catalog_id, survivor_cache_snapshot, rolled_back_at
           FROM _bak_catalog_merge_ops_092 WHERE id = $1`,
        [mergeOpId]
      )
      if (op.rowCount === 0) throw new Error(`CatalogMergeRollback: merge_op ${mergeOpId} 不存在`)
      if (op.rows[0]!.rolled_back_at !== null) {
        throw new Error(`CatalogMergeRollback: merge_op ${mergeOpId} 已于 ${op.rows[0]!.rolled_back_at} 回滚`)
      }
      const { loser_catalog_id: loserId, survivor_catalog_id: survivorId } = op.rows[0]!

      // 1. 复活 loser 主表行（092 无键覆盖问题：合并前共存 → 原值恢复不撞唯一键；
      //    ON CONFLICT (id) DO NOTHING 仅兜重复回滚）
      const cols = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'media_catalog' AND table_schema = 'public'
          ORDER BY ordinal_position`
      )
      const colList = cols.rows.map((r) => `"${r.column_name}"`).join(', ')
      await client.query(
        `INSERT INTO media_catalog (${colList})
         SELECT ${colList} FROM _bak_media_catalog_092 WHERE merge_op_id = $1
         ON CONFLICT (id) DO NOTHING`,
        [mergeOpId]
      )

      // 2. videos.catalog_id 复位（old 快照）
      await client.query(
        `UPDATE videos v SET catalog_id = b.old_catalog_id, updated_at = NOW()
           FROM _bak_videos_catalog_id_092 b
          WHERE b.merge_op_id = $1 AND v.id = b.video_id`,
        [mergeOpId]
      )

      // 3. PK(id) 内容子表精确还原（DELETE by 快照 id → INSERT 全量；孙表在 characters 后）
      for (const t of ['catalog_episodes', 'catalog_characters', 'media_catalog_aliases', 'catalog_relations', 'catalog_external_refs']) {
        const bak = `_bak_${t}_092`
        const bcols = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
          [t]
        )
        const bcolList = bcols.rows.map((r) => `"${r.column_name}"`).join(', ')
        await client.query(`DELETE FROM ${t} WHERE id IN (SELECT id FROM ${bak} WHERE merge_op_id = $1)`, [mergeOpId])
        await client.query(
          `INSERT INTO ${t} (${bcolList}) SELECT ${bcolList} FROM ${bak} WHERE merge_op_id = $1`,
          [mergeOpId]
        )
      }
      await client.query(
        `DELETE FROM catalog_character_actors
          WHERE id IN (SELECT id FROM _bak_catalog_character_actors_092 WHERE merge_op_id = $1)`,
        [mergeOpId]
      )
      const actorCols = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'catalog_character_actors' AND table_schema = 'public' ORDER BY ordinal_position`
      )
      const actorColList = actorCols.rows.map((r) => `"${r.column_name}"`).join(', ')
      await client.query(
        `INSERT INTO catalog_character_actors (${actorColList})
         SELECT ${actorColList} FROM _bak_catalog_character_actors_092 WHERE merge_op_id = $1`,
        [mergeOpId]
      )

      // 4. provenance/locks 只插不删（R11：值空间重合，删=不可逆误删；残留仅 REPORT）
      let residual = 0
      for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
        await client.query(
          `INSERT INTO ${t} SELECT ${await this.businessCols(client, t)} FROM _bak_${t}_092
            WHERE merge_op_id = $1
           ON CONFLICT (catalog_id, field_name) DO NOTHING`,
          [mergeOpId]
        )
        const rep = await client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM ${t} p
            WHERE p.catalog_id = $2
              AND EXISTS (SELECT 1 FROM _bak_${t}_092 b
                          WHERE b.merge_op_id = $1 AND b.field_name = p.field_name)`,
          [mergeOpId, survivorId]
        )
        residual += Number(rep.rows[0]!.n)
      }

      // 5. survivor 四列 cache 复位（merge_ops 快照 / D-177-9 回滚边界）
      await client.query(
        `UPDATE media_catalog SET
           imdb_id            = (b.survivor_cache_snapshot->>'imdb_id'),
           tmdb_id            = (b.survivor_cache_snapshot->>'tmdb_id')::int,
           douban_id          = (b.survivor_cache_snapshot->>'douban_id'),
           bangumi_subject_id = (b.survivor_cache_snapshot->>'bangumi_subject_id')::int,
           updated_at = NOW()
         FROM _bak_catalog_merge_ops_092 b
        WHERE b.id = $1 AND media_catalog.id = b.survivor_catalog_id`,
        [mergeOpId]
      )

      // 6. 标记已回滚（防重复回滚）
      await client.query(
        `UPDATE _bak_catalog_merge_ops_092 SET rolled_back_at = NOW() WHERE id = $1`,
        [mergeOpId]
      )

      // 7. 复活断言：loser 行存在
      const alive = await client.query(`SELECT 1 FROM media_catalog WHERE id = $1`, [loserId])
      if (alive.rowCount !== 1) {
        throw new Error(`CatalogMergeRollback: loser ${loserId} 复活失败（事务回滚）`)
      }

      await client.query('COMMIT')
      return { revived: true, provenanceResidualReport: residual }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /** R10 前向守卫：快照表齐全核验（缺表 = 阻断，绝不带病合并） */
  private async assertSnapshotTables(client: PoolClient): Promise<void> {
    const r = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [[...SNAPSHOT_TABLES]]
    )
    if (Number(r.rows[0]!.n) !== SNAPSHOT_TABLES.length) {
      throw new Error(
        `CatalogMerge: 快照表缺失（${r.rows[0]!.n}/${SNAPSHOT_TABLES.length}），先应用 migration 092（R10 前向守卫）`
      )
    }
  }

  /** 业务列清单（排除快照表附加列 merge_op_id/snapshot_at；动态取防硬编码漂移 / 084 范式） */
  private async businessCols(client: PoolClient, table: string): Promise<string> {
    const r = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
      [table]
    )
    return r.rows.map((x) => `"${x.column_name}"`).join(', ')
  }
}
