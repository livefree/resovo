/**
 * video-matrix.ts — /admin/sources/video-groups/:id/matrix 单视频线路×集数矩阵查询
 * （ADR-117 / CHG-VSR-3 拆分自 sources-matrix.ts，D-117-VSR3-7）
 *
 * 关注点：单视频展开为 (line × episode) 矩阵；别名 LEFT JOIN 合并 display_name。
 */

import type { Pool } from 'pg'
import type { DualSignalState, EpisodeCell, LineMatrixRow } from '@resovo/types'

// re-export 共享类型，保持向后兼容（apps/api 内部消费方）
export type { EpisodeCell, LineMatrixRow }

interface DbEpisodeCellRow {
  episode_number: number
  source_id: string
  source_url: string
  probe_status: string
  render_status: string
  is_active: boolean
  source_site_key: string | null
  source_name: string
  display_name: string | null
}

// ── 查询：单视频线路×集数矩阵 ─────────────────────────────────────

export async function getVideoMatrix(
  db: Pool,
  videoId: string,
): Promise<LineMatrixRow[]> {
  const rows = await db.query<DbEpisodeCellRow>(
    `SELECT
       vs.episode_number,
       vs.id AS source_id,
       vs.source_url,
       vs.probe_status,
       vs.render_status,
       vs.is_active,
       COALESCE(vs.source_site_key, v.site_key) AS source_site_key,
       vs.source_name,
       sla.display_name
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN source_line_aliases sla
       ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
      AND sla.source_name = vs.source_name
     WHERE vs.video_id = $1
       AND vs.deleted_at IS NULL
     ORDER BY vs.source_name, vs.episode_number`,
    [videoId],
  )

  // 中间形态：episodes 为 mutable 数组便于 push，最后通过 readonly cast 返回符合共享类型
  type LineMatrixRowMutable = {
    sourceSiteKey: string
    sourceName: string
    displayName: string | null
    episodes: EpisodeCell[]
  }
  const linesMap = new Map<string, LineMatrixRowMutable>()
  for (const row of rows.rows) {
    const key = `${row.source_site_key ?? ''}::${row.source_name}`
    let line = linesMap.get(key)
    if (!line) {
      line = {
        sourceSiteKey: row.source_site_key ?? '',
        sourceName: row.source_name,
        displayName: row.display_name,
        episodes: [],
      }
      linesMap.set(key, line)
    } else if (row.display_name !== null && line.displayName === null) {
      // 取第一个非 null 别名（LEFT JOIN 同线路各行应相同，但防御性取最新非空值）
      line.displayName = row.display_name
    }
    line.episodes.push({
      episodeNumber: row.episode_number,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      probeStatus: row.probe_status as DualSignalState,
      renderStatus: row.render_status as DualSignalState,
      isActive: row.is_active,
    })
  }

  return Array.from(linesMap.values())
}
