/**
 * image-health-url-change-trigger.test.ts — media_catalog URL 变更清信号触发器（ADR-213 D-213-10 / migration 122+123）
 *
 * 验证 trg_media_catalog_clear_image_signals：<kind>_url 变更即重置该 kind 所有 **url 派生列**——
 *  ① 时间戳信号 <kind>_client_error_at + <kind>_checked_at（122）
 *  ② <kind>_status（123，旧 URL status 失效；**尊重显式写**：调用方未改 status 才重置 pending_review/missing）
 *  ③ 渲染占位 <kind>_blurhash 等（123，旧图派生 stale）
 * 全程单连接事务 + ROLLBACK，非破坏性（不污染集成库）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('media_catalog URL 变更触发器清健康信号（ADR-213 D-213-10）', () => {
  it('cover_url 变更（未显式改 status）→ 时间戳/blurhash 清空 + status 重置 pending_review；非 url 变更 → 保留', async () => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ id: string }>('SELECT id FROM media_catalog LIMIT 1')
      if (rows.length === 0) return // 空库跳过
      const id = rows[0].id

      // 预置 url 派生信号：UPDATE 不动 url → 触发器不清，全部留存（含 status='ok' 模拟旧图已验证 + blurhash）
      await client.query(
        `UPDATE media_catalog
            SET poster_client_error_at = NOW(), poster_checked_at = NOW(),
                poster_blurhash = 'LEHV6nWB2yk8', poster_status = 'ok'
          WHERE id = $1`,
        [id],
      )
      const seeded = await client.query(
        `SELECT poster_client_error_at, poster_checked_at, poster_blurhash, poster_status FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(seeded.rows[0].poster_client_error_at).not.toBeNull()
      expect(seeded.rows[0].poster_blurhash).toBe('LEHV6nWB2yk8')
      expect(seeded.rows[0].poster_status).toBe('ok')

      // 负向：非 url 变更（status 自赋值）→ 信号保留（worker/beacon 写不被误清）
      await client.query(`UPDATE media_catalog SET poster_status = poster_status WHERE id = $1`, [id])
      const afterStatus = await client.query(
        `SELECT poster_client_error_at, poster_blurhash, poster_status FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(afterStatus.rows[0].poster_client_error_at).not.toBeNull()
      expect(afterStatus.rows[0].poster_blurhash).toBe('LEHV6nWB2yk8')
      expect(afterStatus.rows[0].poster_status).toBe('ok')

      // 正向：cover_url 变更（未在同 UPDATE 改 status）→ 全 url 派生列重置
      await client.query(
        `UPDATE media_catalog SET cover_url = COALESCE(cover_url, '') || '?imgh123rehearsal' WHERE id = $1`,
        [id],
      )
      const afterUrl = await client.query(
        `SELECT poster_client_error_at, poster_checked_at, poster_blurhash, poster_status FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(afterUrl.rows[0].poster_client_error_at).toBeNull()
      expect(afterUrl.rows[0].poster_checked_at).toBeNull()
      expect(afterUrl.rows[0].poster_blurhash).toBeNull()       // 渲染占位重生（123）
      expect(afterUrl.rows[0].poster_status).toBe('pending_review') // 旧 status 失效 → 待重验（123）
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })

  it('cover_url 变更 + 同 UPDATE 显式改 status → 尊重显式写（不被重置为 pending_review）', async () => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ id: string }>('SELECT id FROM media_catalog LIMIT 1')
      if (rows.length === 0) return
      const id = rows[0].id

      await client.query(`UPDATE media_catalog SET poster_status = 'ok' WHERE id = $1`, [id])
      // 同一 UPDATE 既改 url 又显式改 status='broken' → status 是调用方意图，触发器不覆盖
      await client.query(
        `UPDATE media_catalog SET cover_url = COALESCE(cover_url, '') || '?explicit', poster_status = 'broken' WHERE id = $1`,
        [id],
      )
      const after = await client.query(
        `SELECT poster_status, poster_checked_at FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(after.rows[0].poster_status).toBe('broken')        // 显式写被尊重
      expect(after.rows[0].poster_checked_at).toBeNull()        // 时间戳仍清（url 变更）
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
