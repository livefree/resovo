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
  countNotifications,
  countUnreadNotifications,
  getReadCursor,
  getEffectiveReadCursor,
  upsertReadCursor,
  deleteExpiredNotifications,
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

  it('countNotifications 跑通（与 listNotifications 同 WHERE 口径，NTLG-P1-c-C）', async () => {
    const n = await countNotifications(db, { scopes: ['__no_such_scope__'] })
    expect(n).toBe(0)
  })

  it('listNotifications sourceKinds 过滤 SQL 跑通（admin_action allowlist）', async () => {
    const rows = await listNotifications(db, { scopes: ['__no_such_scope__'], limit: 5, sourceKinds: ['admin_action'] })
    expect(rows).toEqual([])
  })

  it('getEffectiveReadCursor 不存在 user 返 null（无 users 行）', async () => {
    const readAt = await getEffectiveReadCursor(db, NONEXISTENT_USER)
    expect(readAt).toBeNull()
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

  it('sourceKind allowlist 过滤：admin_action 命中 / crawler 排除（NTLG-P1-c-C 防重复）', async () => {
    const scope = 'role:p1cc_sourcekind_test'
    const adminNotif = await insertNotification(client, {
      type: 'video.merge', level: 'info', title: 'admin 动作', sourceKind: 'admin_action', scope,
      dedupKey: `test:p1cc:admin:${Date.now()}`,
    })
    await insertNotification(client, {
      type: 'crawler.run.completed', level: 'info', title: 'crawler 完成', sourceKind: 'crawler', scope,
      dedupKey: `test:p1cc:crawler:${Date.now()}`,
    })
    const rows = await listNotifications(client, { scopes: [scope], limit: 50, sourceKinds: ['admin_action'] })
    expect(rows.map((r) => r.id)).toContain(adminNotif.id)
    expect(rows.every((r) => r.sourceKind === 'admin_action')).toBe(true)
    // countNotifications 同口径
    const cnt = await countNotifications(client, { scopes: [scope], sourceKinds: ['admin_action'] })
    expect(cnt).toBe(rows.length)
  })

  it('getEffectiveReadCursor：无 cursor 回落 users.created_at / upsert 后取 cursor.read_at（ISO，D-192-5 同口径）', async () => {
    // 无 cursor 行（前序 cursor 测试与本测试共享 client/userId 时，确保独立 user 隔离）
    const fresh = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES ($1, $2, 'x', 'admin', '2026-01-01T00:00:00Z')
       RETURNING id::text AS "id"`,
      [`p1cc_eff_${Date.now()}`, `p1cc_eff_${Date.now()}@test.local`],
    )
    const freshId = fresh.rows[0]!.id
    const baseline = await getEffectiveReadCursor(client, freshId)
    expect(baseline).toBe(new Date('2026-01-01T00:00:00Z').toISOString())
    // upsert cursor → 取 cursor.read_at
    const cursorAt = new Date('2026-06-01T12:00:00Z').toISOString()
    await upsertReadCursor(client, freshId, cursorAt)
    const afterUpsert = await getEffectiveReadCursor(client, freshId)
    expect(afterUpsert).toBe(cursorAt)
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

  it('deleteExpiredNotifications：过期删 / NULL 永不删 / 未来不删 + FK CASCADE reads（ADR-195 D-195-4）', async () => {
    const scope = 'role:p2da_purge_test'
    const past = new Date(Date.now() - 86400_000).toISOString()    // 1 天前
    const future = new Date(Date.now() + 86400_000).toISOString()  // 1 天后
    const expired = await insertNotification(client, {
      type: 'test.expired', level: 'info', title: '过期', sourceKind: 'admin_action', scope,
      dedupKey: `test:p2da:expired:${Date.now()}`, expiresAt: past,
    })
    const permanent = await insertNotification(client, {
      type: 'test.permanent', level: 'info', title: '永久', sourceKind: 'admin_action', scope,
      dedupKey: `test:p2da:perm:${Date.now()}`,  // expiresAt 不设 → NULL（永不过期）
    })
    const futureNotif = await insertNotification(client, {
      type: 'test.future', level: 'info', title: '未来', sourceKind: 'admin_action', scope,
      dedupKey: `test:p2da:future:${Date.now()}`, expiresAt: future,
    })
    // 为过期通知插一条 reads（验证 FK ON DELETE CASCADE 级联）
    await client.query(
      `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1::bigint, $2)`,
      [expired.id, userId],
    )

    const deleted = await deleteExpiredNotifications(client, new Date().toISOString())
    expect(deleted).toBeGreaterThanOrEqual(1)

    const remaining = await listNotifications(client, { scopes: [scope], limit: 50 })
    const ids = remaining.map((r) => r.id)
    expect(ids).not.toContain(expired.id)   // 过期已删
    expect(ids).toContain(permanent.id)     // NULL 永不删
    expect(ids).toContain(futureNotif.id)   // 未来不删

    // FK ON DELETE CASCADE：reads 行随 notification 删除（migration 100）
    const readsLeft = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM notification_reads WHERE notification_id = $1::bigint`,
      [expired.id],
    )
    expect(readsLeft.rows[0]!.c).toBe('0')
  })
})
