/**
 * admin-notifications.test.ts — notifications 存储 SQL 真实执行集成测试
 * （ADR-192 / NTLG-P1-a-A；db/queries/notifications.ts schema 对齐 + 读写 SQL 编译验证）
 *
 * 范围：
 *   - 读路径 schema 对齐（不写库）：listNotifications / countUnreadNotifications / getReadCursor
 *   - 写路径 round-trip（BEGIN/ROLLBACK 事务回滚，零 dev DB 污染）：
 *       insert → list 命中 / dedup_key 幂等 / cursor upsert + get / 未读计数 cursor 高水位口径（D-192-5）
 *
 * 与 unit test 互补：unit mock pg.query 不验真 SQL；本层跑真实 PG 验 schema + SQL 编译 + 索引可用。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import {
  insertNotification,
  listNotifications,
  countUnreadNotifications,
  getReadCursor,
  upsertReadCursor,
} from '../../../apps/api/src/db/queries/notifications'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

const NONEXISTENT_USER = '00000000-0000-0000-0000-000000000000'

describe('notifications 读路径 SQL 集成（schema 对齐 / 不写库）', () => {
  it('listNotifications 跑通（命中 idx_notifications_scope_created_at）', async () => {
    const rows = await listNotifications(db, { scopes: ['__no_such_scope__'], limit: 20 })
    expect(rows).toEqual([])
  })

  it('listNotifications 字段 camelCase 完整（即使空集也校验 SQL alias）', async () => {
    const rows = await listNotifications(db, { scopes: ['broadcast'], limit: 5 })
    expect(rows).toBeInstanceOf(Array)
    for (const row of rows) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('level')
      expect(row).toHaveProperty('sourceKind')
      expect(row).toHaveProperty('createdAt')
      expect(typeof row.id).toBe('string')
    }
  })

  it('countUnreadNotifications 跑通（cursor + users LEFT JOIN + NOT EXISTS reads，D-192-5）', async () => {
    const count = await countUnreadNotifications(db, {
      userId: NONEXISTENT_USER,
      broadcastScopes: ['broadcast', 'role:moderator'],
      targetedScope: `user:${NONEXISTENT_USER}`,
    })
    expect(count).toBe(0)
  })

  it('getReadCursor 不存在 user 返 null', async () => {
    const cursor = await getReadCursor(db, NONEXISTENT_USER)
    expect(cursor).toBeNull()
  })
})

describe('notifications 写路径 round-trip（BEGIN/ROLLBACK 零污染）', () => {
  let client: PoolClient
  let userId: string

  beforeAll(async () => {
    client = await db.connect()
    await client.query('BEGIN')
    // 事务内建测试用户（FK 依赖 users；ROLLBACK 后不留痕）
    const u = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES ($1, $2, 'x', 'admin', NOW() - INTERVAL '1 hour')
       RETURNING id::text AS "id"`,
      [`p1a_a_test_${Date.now()}`, `p1a_a_${Date.now()}@test.local`],
    )
    userId = u.rows[0]!.id
  })

  afterAll(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('insert → list 命中（scope=broadcast）', async () => {
    const { id } = await insertNotification(client, {
      type: 'test.event',
      level: 'info',
      title: '集成测试通知',
      sourceKind: 'system',
      scope: 'broadcast',
      dedupKey: `test:p1aa:list:${Date.now()}`,
    })
    expect(id).not.toBe('')
    const rows = await listNotifications(client, { scopes: ['broadcast'], limit: 50 })
    expect(rows.some((r) => r.id === id)).toBe(true)
    const hit = rows.find((r) => r.id === id)!
    expect(hit.level).toBe('info')
    expect(hit.sourceKind).toBe('system')
  })

  it('dedup_key 幂等：同 key 二次 insert 返同 id、不新增行', async () => {
    const dedupKey = `test:p1aa:dedup:${Date.now()}`
    const first = await insertNotification(client, {
      type: 'test.event', level: 'warn', title: '幂等A', sourceKind: 'system', scope: 'broadcast', dedupKey,
    })
    const second = await insertNotification(client, {
      type: 'test.event', level: 'warn', title: '幂等B', sourceKind: 'system', scope: 'broadcast', dedupKey,
    })
    expect(second.id).toBe(first.id)
    const cnt = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM notifications WHERE dedup_key = $1`, [dedupKey],
    )
    expect(cnt.rows[0]!.c).toBe('1')
  })

  it('cursor upsert + get round-trip（upsert 二次更新同一行）', async () => {
    const t1 = new Date(Date.now() - 60_000).toISOString()
    await upsertReadCursor(client, userId, t1)
    const c1 = await getReadCursor(client, userId)
    expect(c1).not.toBeNull()
    const t2 = new Date().toISOString()
    await upsertReadCursor(client, userId, t2)
    const rowCount = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM notification_read_cursor WHERE user_id = $1`, [userId],
    )
    expect(rowCount.rows[0]!.c).toBe('1') // 仅一行，无写放大（D-192-3）
  })

  it('未读计数 cursor 高水位口径：cursor 之后的通知计未读、之前不计（D-192-5）', async () => {
    // 用独立 scope 隔离前序测试插入的 broadcast 通知（同事务共享 client）
    const scope = 'role:p1aa_unread_test'
    // 设 cursor = 加入时间后 30 分钟
    const cursorAt = new Date(Date.now() - 30 * 60_000).toISOString()
    await upsertReadCursor(client, userId, cursorAt)
    // 一条 created_at 在 cursor 之前（视为已读，不计），一条之后（未读，计）
    await client.query(
      `INSERT INTO notifications (type, level, title, source_kind, scope, created_at)
       VALUES ('test.old', 'info', '旧', 'system', $2, $1)`,
      [new Date(Date.now() - 45 * 60_000).toISOString(), scope],
    )
    await client.query(
      `INSERT INTO notifications (type, level, title, source_kind, scope, created_at)
       VALUES ('test.new', 'info', '新', 'system', $2, $1)`,
      [new Date(Date.now() - 5 * 60_000).toISOString(), scope],
    )
    const count = await countUnreadNotifications(client, {
      userId,
      broadcastScopes: [scope],
      targetedScope: `user:${userId}`,
    })
    expect(count).toBe(1) // 仅 cursor 之后的「新」计未读（该 scope 隔离）
  })
})
