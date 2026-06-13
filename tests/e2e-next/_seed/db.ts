/**
 * tests/e2e-next/_seed/db.ts — CHORE-E2E-WATCH-SSR-SEED
 *
 * e2e watch 页 seed 的 DB 落库/清理工具（直连 pg，不经 api / 不 import production 代码）。
 * DATABASE_URL 来源：process.env 优先 → 否则解析仓库根 `.env.local`（零依赖，dotenv 不可用）。
 */
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { E2E_SEED_VIDEOS, E2E_SEED_SHORT_IDS } from './fixtures'

/** process.env.DATABASE_URL 优先；否则从仓库根 .env.local 解析 */
export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = resolve(process.cwd(), '.env.local')
  let content: string
  try {
    content = readFileSync(envPath, 'utf8')
  } catch {
    throw new Error(
      `[e2e-seed] DATABASE_URL 未设置且无法读取 ${envPath}；e2e seed 需要可达的 Postgres`,
    )
  }
  const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m)
  if (!match) {
    throw new Error(`[e2e-seed] ${envPath} 中未找到 DATABASE_URL`)
  }
  // 去除可选包裹引号
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: resolveDatabaseUrl() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/**
 * 幂等落库（事务）：删旧（short_id 唯一 + video_id CASCADE 清旧源）→ 插视频 → 插源 → 发布。
 *
 * 状态机触发器（trg_videos_state_machine）约束：approved 态下 is_published 必须已有 active source、
 * 且 public 必须 published。故合法路径为先以 `approved|internal|0`（未发布）建行 → 插源 →
 * UPDATE 到 `approved|public|1`（白名单 transition，此时已有源 → 发布检查通过）。
 * 复用现有 media_catalog（catalog_id NOT NULL）。
 */
export async function seedE2eWatchVideos(): Promise<void> {
  await withClient(async (client) => {
    const catRes = await client.query<{ id: string }>('SELECT id FROM media_catalog LIMIT 1')
    const catalogId = catRes.rows[0]?.id
    if (!catalogId) {
      throw new Error('[e2e-seed] media_catalog 为空，无法满足 videos.catalog_id NOT NULL')
    }

    await client.query('BEGIN')
    try {
      for (const v of E2E_SEED_VIDEOS) {
        // 删旧（CASCADE 清源/依赖）保证幂等
        await client.query('DELETE FROM videos WHERE short_id = $1', [v.shortId])

        // 先建未发布行（approved|internal|0）——此时无源，避开"发布须有 active source"检查
        const insertVideo = await client.query<{ id: string }>(
          `INSERT INTO videos
             (short_id, slug, title, type, episode_count, content_format, episode_pattern,
              catalog_id, is_published, visibility_status, review_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'internal', 'approved')
           RETURNING id`,
          [
            v.shortId,
            v.slug,
            v.title,
            v.type,
            v.episodeCount,
            v.contentFormat,
            v.episodePattern,
            catalogId,
          ],
        )
        const videoId = insertVideo.rows[0]!.id

        for (const s of v.sources) {
          await client.query(
            `INSERT INTO video_sources
               (video_id, source_url, source_name, episode_number, type, quality, is_active)
             VALUES ($1, $2, $3, $4, 'hls', '1080P', true)`,
            [videoId, s.sourceUrl, s.sourceName, s.episodeNumber],
          )
        }

        // 发布：internal|0 → public|1（白名单 transition + 此时已有 active source）
        await client.query(
          `UPDATE videos SET visibility_status = 'public', is_published = true WHERE id = $1`,
          [videoId],
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })
}

/** 级联清理 seed 视频（video_sources / danmaku / source_health_events 等均 CASCADE） */
export async function teardownE2eWatchVideos(): Promise<void> {
  await withClient(async (client) => {
    await client.query('DELETE FROM videos WHERE short_id = ANY($1)', [E2E_SEED_SHORT_IDS])
  })
}
