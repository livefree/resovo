/**
 * scripts/dedup-catalog-084.ts — ADR-174 / META-23-C 阶段 B：52 冗余 catalog 合并（不可逆删行）
 *
 * 把「剥标点归并键相同（同 normalizeMergeKey(title)|year|type）」的多 catalog 行合并为留存行：
 * 子表转移指向留存行 → 删冗余行。删行前全字段快照到 _bak_*_084（migration 084 已建表 / R4 回滚）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/dedup-catalog-084.ts [--dry-run] [--force]
 *   --dry-run：全部组在单事务内执行后整体 ROLLBACK，只打印统计（观测，不落库）
 *   --force  ：忽略「快照表已有 084 批次」的防重跑拦截（仅在确认需重跑时用）
 *
 * 前置（严格）：① migration 084 已 apply（_bak_*_084 存在）② 阶段 A backfill-merge-key 已真跑
 *   ③ META-23-B 写入侧已切 normalizeMergeKey（Y1）。
 *
 * 关键修正（arch-reviewer 3 陷阱）：
 *   ① 留存行 ORDER BY 必须 DESC（Postgres false<true，ASC 会选无外部 ID 行 = 删错）
 *   ② UPDATE 不支持 ON CONFLICT → 子表转移用「先删冗余侧碰撞行，再 UPDATE 剩余」+ IS NOT DISTINCT FROM
 *      （catalog_episodes.external_episode_id nullable，= 对 NULL 返 unknown 会漏判）
 *   ③ 删碰撞 catalog_characters 会 CASCADE 删其 catalog_character_actors → 快照含孙表
 *
 * 真跑：每组一独立事务，单组失败 ROLLBACK 该组 + 记失败清单 + 继续下一组（断点续跑靠快照幂等）。
 */

import { Pool, type PoolClient } from 'pg'
import { normalizeMergeKey } from '@/api/services/TitleNormalizer'

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const BATCH = '084'

interface Row {
  id: string
  title: string
  year: number | null
  type: string
}

/** 在事务内合并一个冗余组（survivingId 已定）。dry-run 由调用方控制 COMMIT/ROLLBACK。 */
async function mergeGroup(client: PoolClient, memberIds: string[]): Promise<{ survivingId: string; redundantIds: string[] }> {
  // (1) 选留存行（R2 确定性，陷阱① DESC）
  const survRes = await client.query<{ id: string }>(
    `SELECT id FROM media_catalog
     WHERE id = ANY($1::uuid[])
     ORDER BY (bangumi_subject_id IS NOT NULL) DESC,
              (douban_id IS NOT NULL) DESC,
              (imdb_id IS NOT NULL) DESC,
              (tmdb_id IS NOT NULL) DESC,
              created_at ASC, id ASC
     LIMIT 1`,
    [memberIds],
  )
  const survivingId = survRes.rows[0].id
  const redundantIds = memberIds.filter((id) => id !== survivingId)
  if (redundantIds.length === 0) return { survivingId, redundantIds }

  // (2) 写快照（删行/转移之前，R4 + 陷阱③ 孙表）
  await client.query(
    `INSERT INTO _bak_media_catalog_084
     SELECT mc.*, $2, $3, NOW() FROM media_catalog mc WHERE mc.id = ANY($1::uuid[])`,
    [redundantIds, BATCH, survivingId],
  )
  await client.query(`INSERT INTO _bak_catalog_episodes_084          SELECT * FROM catalog_episodes          WHERE catalog_id = ANY($1::uuid[])`, [redundantIds])
  await client.query(`INSERT INTO _bak_catalog_characters_084        SELECT * FROM catalog_characters        WHERE catalog_id = ANY($1::uuid[])`, [redundantIds])
  await client.query(
    `INSERT INTO _bak_catalog_character_actors_084
     SELECT cca.* FROM catalog_character_actors cca
     JOIN catalog_characters cc ON cc.id = cca.character_id
     WHERE cc.catalog_id = ANY($1::uuid[])`,
    [redundantIds],
  )
  await client.query(`INSERT INTO _bak_video_metadata_provenance_084 SELECT * FROM video_metadata_provenance WHERE catalog_id = ANY($1::uuid[])`, [redundantIds])
  await client.query(`INSERT INTO _bak_video_metadata_locks_084      SELECT * FROM video_metadata_locks      WHERE catalog_id = ANY($1::uuid[])`, [redundantIds])
  await client.query(`INSERT INTO _bak_media_catalog_aliases_084     SELECT * FROM media_catalog_aliases     WHERE catalog_id = ANY($1::uuid[])`, [redundantIds])
  await client.query(
    `INSERT INTO _bak_videos_catalog_id_084 (video_id, old_catalog_id, new_catalog_id, migration_batch)
     SELECT id, catalog_id, $2, $3 FROM videos WHERE catalog_id = ANY($1::uuid[])`,
    [redundantIds, survivingId, BATCH],
  )

  // (3) videos 重指向（先于删 catalog，否则 ON DELETE SET NULL 孤立 video；含软删行不过滤 deleted_at）
  await client.query(
    `UPDATE videos SET catalog_id = $2, updated_at = NOW() WHERE catalog_id = ANY($1::uuid[])`,
    [redundantIds, survivingId],
  )

  // (4) PK(catalog_id, field_name) 子表：先删冗余侧已在留存行存在的 field，再 UPDATE 剩余
  for (const t of ['video_metadata_provenance', 'video_metadata_locks']) {
    await client.query(
      `DELETE FROM ${t} p
       WHERE p.catalog_id = ANY($1::uuid[])
         AND EXISTS (SELECT 1 FROM ${t} s WHERE s.catalog_id = $2 AND s.field_name = p.field_name)`,
      [redundantIds, survivingId],
    )
    await client.query(`UPDATE ${t} SET catalog_id = $2 WHERE catalog_id = ANY($1::uuid[])`, [redundantIds, survivingId])
  }

  // (5) UNIQUE(catalog_id, source, ext) 子表：陷阱② UPDATE 不能 ON CONFLICT → 先删碰撞再 UPDATE
  //     external_episode_id nullable → IS NOT DISTINCT FROM（NULL 安全）
  await client.query(
    `DELETE FROM catalog_episodes e
     WHERE e.catalog_id = ANY($1::uuid[])
       AND EXISTS (SELECT 1 FROM catalog_episodes s
                   WHERE s.catalog_id = $2 AND s.source = e.source
                     AND s.external_episode_id IS NOT DISTINCT FROM e.external_episode_id)`,
    [redundantIds, survivingId],
  )
  await client.query(`UPDATE catalog_episodes SET catalog_id = $2 WHERE catalog_id = ANY($1::uuid[])`, [redundantIds, survivingId])

  // catalog_characters：删碰撞 character 会 CASCADE 删其 actors（已快照孙表 / 陷阱③）
  await client.query(
    `DELETE FROM catalog_characters c
     WHERE c.catalog_id = ANY($1::uuid[])
       AND EXISTS (SELECT 1 FROM catalog_characters s
                   WHERE s.catalog_id = $2 AND s.source = c.source
                     AND s.external_character_id IS NOT DISTINCT FROM c.external_character_id)`,
    [redundantIds, survivingId],
  )
  await client.query(`UPDATE catalog_characters SET catalog_id = $2 WHERE catalog_id = ANY($1::uuid[])`, [redundantIds, survivingId])

  // (6) PK(id)+UNIQUE(catalog_id, alias) 子表：同形（alias NOT NULL，= 即可，仍统一 IS NOT DISTINCT FROM）
  await client.query(
    `DELETE FROM media_catalog_aliases a
     WHERE a.catalog_id = ANY($1::uuid[])
       AND EXISTS (SELECT 1 FROM media_catalog_aliases s
                   WHERE s.catalog_id = $2 AND s.alias IS NOT DISTINCT FROM a.alias)`,
    [redundantIds, survivingId],
  )
  await client.query(`UPDATE media_catalog_aliases SET catalog_id = $2 WHERE catalog_id = ANY($1::uuid[])`, [redundantIds, survivingId])

  // (7) 删冗余 catalog 行（引用已转移/快照；external_*_raw 实测 0 行不阻塞）
  await client.query(`DELETE FROM media_catalog WHERE id = ANY($1::uuid[])`, [redundantIds])

  // (8) 组内断言：冗余行下不应再有残留子行/video（dangling 应为 0）
  const dangling = await client.query<{ n: string }>(
    `SELECT (
        (SELECT COUNT(*) FROM catalog_episodes          WHERE catalog_id = ANY($1::uuid[]))
      + (SELECT COUNT(*) FROM catalog_characters        WHERE catalog_id = ANY($1::uuid[]))
      + (SELECT COUNT(*) FROM video_metadata_provenance WHERE catalog_id = ANY($1::uuid[]))
      + (SELECT COUNT(*) FROM video_metadata_locks      WHERE catalog_id = ANY($1::uuid[]))
      + (SELECT COUNT(*) FROM media_catalog_aliases     WHERE catalog_id = ANY($1::uuid[]))
      + (SELECT COUNT(*) FROM videos                    WHERE catalog_id = ANY($1::uuid[]))
      )::text AS n`,
    [redundantIds],
  )
  if (Number(dangling.rows[0].n) !== 0) {
    throw new Error(`组合并后仍有 ${dangling.rows[0].n} 条悬挂引用（redundantIds=${redundantIds.join(',')}）`)
  }
  return { survivingId, redundantIds }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // 前向守卫①：migration 084 已 apply（8 张快照表齐全），否则给清晰错误而非中途 SQL 报错
    const REQUIRED_BAK = [
      '_bak_media_catalog_084', '_bak_catalog_episodes_084', '_bak_catalog_characters_084',
      '_bak_catalog_character_actors_084', '_bak_video_metadata_provenance_084',
      '_bak_video_metadata_locks_084', '_bak_media_catalog_aliases_084', '_bak_videos_catalog_id_084',
    ]
    const bakExist = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1::text[])`,
      [REQUIRED_BAK],
    )
    const missing = REQUIRED_BAK.filter((t) => !bakExist.rows.some((r) => r.tablename === t))
    if (missing.length > 0) {
      throw new Error(`快照表缺失（migration 084 未 apply？）：${missing.join(', ')}。请先 npm run migrate。`)
    }

    // 前向守卫②（Y1 部署顺序）：阶段 A backfill 应已跑——抽查「单行组键已是 normalizeMergeKey」。
    // 若发现大量单行组键仍带标点（未重算），警示阶段 A 未跑（dedup 仍可跑因分组走内存键，但
    // 合并后单行组键不自洽，需补跑 backfill / A'）。仅警告不阻断（dedup 内存分组不依赖落库键）。
    {
      const sample = await pool.query<{ id: string; title: string; title_normalized: string }>(
        `SELECT id, title, title_normalized FROM media_catalog LIMIT 500`,
      )
      let staleSingle = 0
      for (const r of sample.rows) if (r.title_normalized !== normalizeMergeKey(r.title)) staleSingle++
      if (staleSingle > 50) {
        process.stdout.write(
          `[dedup-084] ⚠️ 抽样 500 行有 ${staleSingle} 行 title_normalized 与 normalizeMergeKey 不一致 —— ` +
            `阶段 A backfill 可能未跑。dedup 仍会用内存键正确分组合并，但完成后须跑 backfill（A'）补齐键自洽。\n`,
        )
      }
    }

    // 防重跑：快照表已有 084 批次 → 除非 --force 否则拒绝
    if (!DRY_RUN && !FORCE) {
      const bak = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM _bak_media_catalog_084 WHERE migration_batch = $1`,
        [BATCH],
      )
      if (Number(bak.rows[0].n) > 0) {
        throw new Error(`_bak_media_catalog_084 已有 ${bak.rows[0].n} 行 084 批次（疑似已执行）。如确需重跑请加 --force。`)
      }
    }

    // 内存分组（与阶段 A 同函数同结果）
    const { rows } = await pool.query<Row>(`SELECT id, title, year, type FROM media_catalog`)
    const groups = new Map<string, string[]>()
    for (const row of rows) {
      const gk = `${normalizeMergeKey(row.title)}|${row.year ?? ''}|${row.type}`
      const arr = groups.get(gk)
      if (arr) arr.push(row.id)
      else groups.set(gk, [row.id])
    }
    const colliding = [...groups.values()].filter((ids) => ids.length >= 2)
    const totalRedundant = colliding.reduce((s, ids) => s + ids.length - 1, 0)
    process.stdout.write(
      `[dedup-084] catalog ${rows.length} / 合并组 ${colliding.length} / 冗余行 ${totalRedundant} / dryRun=${DRY_RUN} force=${FORCE}\n`,
    )
    if (colliding.length === 0) {
      process.stdout.write('[dedup-084] 无冗余组（库已干净或已合并）→ 无操作。\n')
      return
    }

    if (DRY_RUN) {
      // dry-run：全部组在单事务内顺序执行后整体 ROLLBACK（观测全链路不抛错 + 统计）
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        let merged = 0
        let removed = 0
        for (const memberIds of colliding) {
          const r = await mergeGroup(client, memberIds)
          merged += 1
          removed += r.redundantIds.length
        }
        await client.query('ROLLBACK')
        process.stdout.write(`[dedup-084] dry-run 完成（已 ROLLBACK）：可合并 ${merged} 组 / 将删 ${removed} 行，全链路无抛错。\n`)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
      return
    }

    // 真跑：每组一独立事务，失败该组 ROLLBACK + 记清单 + 继续
    let merged = 0
    let removed = 0
    const failures: string[] = []
    for (const memberIds of colliding) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const r = await mergeGroup(client, memberIds)
        await client.query('COMMIT')
        merged += 1
        removed += r.redundantIds.length
      } catch (e) {
        await client.query('ROLLBACK')
        const msg = e instanceof Error ? e.message : String(e)
        failures.push(`[${memberIds.join(',')}] ${msg}`)
      } finally {
        client.release()
      }
    }
    process.stdout.write(`[dedup-084] 完成。合并 ${merged} 组 / 删 ${removed} 行 / 失败 ${failures.length} 组。\n`)
    if (failures.length > 0) {
      process.stdout.write('[dedup-084] 失败组（已各自 ROLLBACK，可修因后带 --force 重跑剩余）：\n')
      for (const f of failures) process.stdout.write(`  - ${f}\n`)
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : JSON.stringify(err)
  process.stderr.write(`[dedup-084] failed: ${msg}\n`)
  process.exit(1)
})
