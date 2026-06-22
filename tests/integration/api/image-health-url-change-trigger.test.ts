/**
 * image-health-url-change-trigger.test.ts — media_catalog URL 变更清信号触发器（ADR-213 D-213-10 / migration 122）
 *
 * 验证 trg_media_catalog_clear_image_signals：<kind>_url 变更即 NULL 掉该 kind 的
 * <kind>_client_error_at + <kind>_checked_at（消「信号/checked_at 残留旧 URL → 已替换图被误判」）。
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
  it('cover_url 变更 → poster 两信号清空；非 url 变更 → 保留', async () => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ id: string }>('SELECT id FROM media_catalog LIMIT 1')
      if (rows.length === 0) return // 空库跳过（无可操作行）
      const id = rows[0].id

      // 预置信号：UPDATE 不动 url → 触发器不清，信号留存
      await client.query(
        `UPDATE media_catalog SET poster_client_error_at = NOW(), poster_checked_at = NOW() WHERE id = $1`,
        [id],
      )
      const seeded = await client.query(
        `SELECT poster_client_error_at, poster_checked_at FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(seeded.rows[0].poster_client_error_at).not.toBeNull()
      expect(seeded.rows[0].poster_checked_at).not.toBeNull()

      // 负向：非 url 变更（status 自赋值）→ 信号保留（worker/beacon 写不被误清）
      await client.query(`UPDATE media_catalog SET poster_status = poster_status WHERE id = $1`, [id])
      const afterStatus = await client.query(
        `SELECT poster_client_error_at, poster_checked_at FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(afterStatus.rows[0].poster_client_error_at).not.toBeNull()
      expect(afterStatus.rows[0].poster_checked_at).not.toBeNull()

      // 正向：cover_url 变更 → poster_client_error_at + poster_checked_at 双清空
      await client.query(
        `UPDATE media_catalog SET cover_url = COALESCE(cover_url, '') || '?imgh122rehearsal' WHERE id = $1`,
        [id],
      )
      const afterUrl = await client.query(
        `SELECT poster_client_error_at, poster_checked_at FROM media_catalog WHERE id = $1`,
        [id],
      )
      expect(afterUrl.rows[0].poster_client_error_at).toBeNull()
      expect(afterUrl.rows[0].poster_checked_at).toBeNull()
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
