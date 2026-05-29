/**
 * catalogEpisodes.ts — catalog_episodes 逐集元数据查询（ADR-161 / Migration 077）
 * 按 catalog_id + source 设计，唯一键 (catalog_id, source, external_episode_id)
 */

import type { Pool } from 'pg'

export interface CatalogEpisodeInput {
  source: string
  externalEpisodeId: string
  epType: number // 0 本篇 / 1 SP / 2 OP / 3 ED
  sort: number | null
  ep: number | null
  name: string | null
  nameCn: string | null
  airdate: string | null // 'YYYY-MM-DD'
  durationSeconds: number | null
  description: string | null
}

/**
 * 批量 upsert 逐集元数据（单事务）。externalEpisodeId 必填（保证唯一键命中、幂等）。
 * 返回写入条数。
 */
export async function upsertCatalogEpisodes(
  db: Pool,
  catalogId: string,
  episodes: CatalogEpisodeInput[],
): Promise<number> {
  const valid = episodes.filter((e) => e.externalEpisodeId)
  if (valid.length === 0) return 0
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const e of valid) {
      await client.query(
        `INSERT INTO catalog_episodes
           (catalog_id, source, external_episode_id, ep_type, sort, ep,
            name, name_cn, airdate, duration_seconds, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (catalog_id, source, external_episode_id) DO UPDATE SET
           ep_type = EXCLUDED.ep_type, sort = EXCLUDED.sort, ep = EXCLUDED.ep,
           name = EXCLUDED.name, name_cn = EXCLUDED.name_cn, airdate = EXCLUDED.airdate,
           duration_seconds = EXCLUDED.duration_seconds, description = EXCLUDED.description,
           updated_at = NOW()`,
        [
          catalogId, e.source, e.externalEpisodeId, e.epType, e.sort, e.ep,
          e.name, e.nameCn, e.airdate || null, e.durationSeconds, e.description,
        ],
      )
    }
    await client.query('COMMIT')
    return valid.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
