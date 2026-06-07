/**
 * tests/unit/api/audit-rollback.test.ts —
 * ADR-138 / CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 通用回滚端点 + Service 单测
 *
 * 覆盖（ADR-138 §9 测试 surface，19 用例）：
 *   ─ happy path (3)：
 *     #1 video.staff_note → before 写回 + rollback audit 写入
 *     #2 user.email_change → email 恢复 + rollback audit 写入
 *     #3 home_module.update → 多字段恢复
 *   ─ UNSUPPORTED (4)：
 *     #4 system.cache_clear → 422 UNSUPPORTED
 *     #5 system.audit_rollback 二次回滚 → 422 UNSUPPORTED
 *     #6 target_id NULL (batch) → 422 UNSUPPORTED
 *     #7 before_jsonb NULL (CREATE 类) → 422 UNSUPPORTED
 *   ─ STALE (2)：
 *     #8 after_jsonb 与当前 DB 值不一致 → 409 STALE
 *     #9 UNIQUE 违反 23505 → 409 STALE
 *   ─ SCHEMA_DRIFT (2)：
 *     #10 字段全被白名单过滤 → 422 SCHEMA_DRIFT
 *     #11 部分白名单过滤 → 200 + warnings
 *   ─ 边界 (4)：
 *     #12 audit_log 不存在 → 404
 *     #13 目标业务行不存在 → 404
 *     #14 目标 soft-deleted → 404（rollbackAuditLogTarget 返 0 affected）
 *     #15 PG 42703 字段在 schema 不存在 → 422 SCHEMA_DRIFT
 *   ─ audit 写入 (2)：
 *     #16 R-MID-1 payload 内容断言：system.audit_rollback before/after jsonb 正确
 *     #17 事务原子性：UPDATE 成功但 INSERT audit 失败 → ROLLBACK 全部撤销
 *   ─ 权限 (2)：
 *     #18 白名单过滤：password_hash 被过滤不回滚
 *     #19 非 admin → 403（端点层）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbConnectMock = vi.fn()
const dbQueryMock = vi.fn()
vi.mock('@/api/lib/postgres', () => ({
  db: {
    query: (...args: unknown[]) => dbQueryMock(...args),
    connect: () => dbConnectMock(),
  },
}))

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

const getAdminAuditLogByIdMock = vi.fn()
const rollbackAuditLogTargetMock = vi.fn()
const selectCurrentRowForRollbackMock = vi.fn()
const insertAuditLogInTransactionMock = vi.fn()
vi.mock('@/api/db/queries/auditLog', () => ({
  getAdminAuditLogById: (...args: unknown[]) => getAdminAuditLogByIdMock(...args),
  rollbackAuditLogTarget: (...args: unknown[]) => rollbackAuditLogTargetMock(...args),
  selectCurrentRowForRollback: (...args: unknown[]) => selectCurrentRowForRollbackMock(...args),
  insertAuditLogInTransaction: (...args: unknown[]) => insertAuditLogInTransactionMock(...args),
  insertAuditLog: vi.fn(),
  listAuditLogByTarget: vi.fn(),
  listAdminAuditLog: vi.fn(),
}))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

interface MockClient {
  query: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
}

function buildMockClient(): MockClient {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getAdminAuditLogByIdMock.mockReset()
  rollbackAuditLogTargetMock.mockReset()
  selectCurrentRowForRollbackMock.mockReset()
  insertAuditLogInTransactionMock.mockReset().mockResolvedValue('99999')  // 默认 rollback audit log id
  dbConnectMock.mockReset()
})

async function buildApp() {
  const { adminAuditRoutes } = await import('@/api/routes/admin/audit')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminAuditRoutes)
  await app.ready()
  return app
}

function adminAuth() {
  mockVerify.mockReturnValue({ userId: 'admin-1', role: 'admin', iat: Math.floor(Date.now() / 1000) })
  return { Authorization: 'Bearer t' }
}

// ── happy path (3) ──────────────────────────────────────────────────

describe('POST /admin/audit/logs/:id/rollback - happy path (ADR-138 D-138-1)', () => {
  it('#1 video.staff_note → 写回 + rollback audit', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '101', actorId: 'a-1', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧备注' },
      afterJsonb: { staff_note: '新备注' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ staff_note: '新备注' })  // stale 检查通过
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/101/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rolledBack).toBe(true)
    expect(res.json().data.rollbackAuditLogId).toBe('99999')
    expect(rollbackAuditLogTargetMock).toHaveBeenCalledWith(
      client, 'videos', 'id', 'v-1', { staff_note: '旧备注' }, 'deleted_at',
    )
    await app.close()
  })

  it('#2 user.email_change → email 恢复', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '102', actorId: 'a-1', actionType: 'user.email_change', targetKind: 'user', targetId: 'u-1',
      beforeJsonb: { email: 'old@x.com' },
      afterJsonb: { email: 'new@x.com' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ email: 'new@x.com' })
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/102/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('#3 home_module.update → 多字段恢复', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '103', actorId: 'a-1', actionType: 'home_module.update', targetKind: 'home_module', targetId: 'h-1',
      beforeJsonb: { title: '旧', is_published: false },
      afterJsonb: { title: '新', is_published: true },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ title: '新', is_published: true })
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/103/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    // CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 顺手修：home_modules schema 无 deleted_at（hard delete）
    expect(rollbackAuditLogTargetMock).toHaveBeenCalledWith(
      client, 'home_modules', 'id', 'h-1', { title: '旧', is_published: false }, null,
    )
    await app.close()
  })
})

// ── UNSUPPORTED (4) ─────────────────────────────────────────────────

describe('POST rollback - UNSUPPORTED actionType (ADR-138 D-138-4 F-1/F-4/F-6/F-7)', () => {
  it('#4 system.cache_clear → 422 UNSUPPORTED', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '201', actionType: 'system.cache_clear', targetKind: 'system', targetId: null,
      beforeJsonb: null, afterJsonb: null,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/201/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
    await app.close()
  })

  it('#5 system.audit_rollback 二次回滚 → 422 UNSUPPORTED', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '202', actionType: 'system.audit_rollback', targetKind: 'system', targetId: null,
      beforeJsonb: { sourceAuditLogId: '99' }, afterJsonb: { sourceAuditLogId: '99' },
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/202/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
    await app.close()
  })

  // CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-3.4（MEDIUM-2 吸收）：home_page.* 显式防御守卫——
  // 整页版本回滚走专用端点（POST /admin/home/versions/:n/rollback），不经本行级链；
  // 不依赖「TARGET_KIND_TABLE_MAP 缺 home_page」隐式兜底（未来加表映射会破防）
  it.each(['home_page.publish', 'home_page.rollback'] as const)(
    '#4b %s → 422 UNSUPPORTED（D-185-3.4 显式防御，与 ADR-138 行级回滚语义区分）',
    async (actionType) => {
      getAdminAuditLogByIdMock.mockResolvedValue({
        id: '205', actionType, targetKind: 'home_page', targetId: 'ver-uuid-1',
        beforeJsonb: null, afterJsonb: { versionNo: 3, sectionsChanged: [] },
      })
      const app = await buildApp()
      const res = await app.inject({
        method: 'POST', url: '/admin/audit/logs/205/rollback', headers: adminAuth(),
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
      await app.close()
    },
  )

  it('#4c UNSUPPORTED Set 直接成员守卫：home_page 2 项在档（防御回归删除）', async () => {
    const { UNSUPPORTED_ACTION_TYPES } = await import('@/api/services/AuditRollbackService')
    expect(UNSUPPORTED_ACTION_TYPES.has('home_page.publish')).toBe(true)
    expect(UNSUPPORTED_ACTION_TYPES.has('home_page.rollback')).toBe(true)
  })

  it('#6 target_id NULL (batch action) → 422 UNSUPPORTED', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      // 用一个不在 UNSUPPORTED Set 的 actionType（确保走到 target_id NULL 检查）
      id: '203', actionType: 'video.staff_note', targetKind: 'video', targetId: null,
      beforeJsonb: { staff_note: 'x' }, afterJsonb: null,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/203/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
    expect(res.json().error.message).toContain('target_id')
    await app.close()
  })

  it('#7 before_jsonb NULL (CREATE 类) → 422 UNSUPPORTED', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '204', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: null, afterJsonb: { staff_note: 'x' },
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/204/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
    expect(res.json().error.message).toContain('before')
    await app.close()
  })
})

// ── STALE (2) ────────────────────────────────────────────────────────

describe('POST rollback - STALE detection (ADR-138 D-138-4 F-2)', () => {
  it('#8 after_jsonb 与当前 DB 值不一致 → 409 STALE', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '301', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: { staff_note: '新' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ staff_note: '另一个值' })  // != after

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/301/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_STALE')
    expect(rollbackAuditLogTargetMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('#9 PG UNIQUE 违反 23505 → 409 STALE', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '302', actionType: 'user.email_change', targetKind: 'user', targetId: 'u-1',
      beforeJsonb: { email: 'old@x.com' },
      afterJsonb: { email: 'new@x.com' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ email: 'new@x.com' })
    const pgErr: Error & { code?: string } = new Error('duplicate key value')
    pgErr.code = '23505'
    rollbackAuditLogTargetMock.mockRejectedValue(pgErr)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/302/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_STALE')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    await app.close()
  })
})

// ── SCHEMA_DRIFT (2) ────────────────────────────────────────────────

describe('POST rollback - SCHEMA_DRIFT (ADR-138 D-138-4 F-3)', () => {
  it('#10 字段全被白名单过滤 → 422 SCHEMA_DRIFT', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '401', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      // 'year' / 'country' 都不在 video 字段白名单中
      beforeJsonb: { year: 2020, country: 'JP' },
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/401/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_SCHEMA_DRIFT')
    await app.close()
  })

  it('#11 部分白名单过滤 → 200 + warnings', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '402', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      // staff_note 在白名单内；year 不在
      beforeJsonb: { staff_note: '旧', year: 2020 },
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/402/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.warnings).toBeDefined()
    expect(res.json().data.warnings.some((w: string) => w.includes('year'))).toBe(true)
    // 仅 staff_note 被回滚
    expect(rollbackAuditLogTargetMock).toHaveBeenCalledWith(
      client, 'videos', 'id', 'v-1', { staff_note: '旧' }, 'deleted_at',
    )
    await app.close()
  })
})

// ── 边界 (4) ─────────────────────────────────────────────────────────

describe('POST rollback - boundary (ADR-138 D-138-4 F-5/F-8 + SCHEMA_DRIFT)', () => {
  it('#12 audit_log 不存在 → 404', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/999/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('#13 目标业务行不存在 (UPDATE 0 affected) → 404', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '501', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-x',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 0 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/501/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('#14 目标 soft-deleted (after 检测时 selectCurrent 返 null) → 404', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '502', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-deleted',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: { staff_note: '新' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue(null)  // soft-deleted

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/502/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('#15 PG 42703 字段在 schema 不存在 → 422 SCHEMA_DRIFT', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '503', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧' },  // 白名单 OK 但 schema 已删除
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    const pgErr: Error & { code?: string } = new Error('column "staff_note" does not exist')
    pgErr.code = '42703'
    rollbackAuditLogTargetMock.mockRejectedValue(pgErr)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/503/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_SCHEMA_DRIFT')
    await app.close()
  })
})

// ── audit 写入 (2) ───────────────────────────────────────────────────

describe('POST rollback - audit 写入 (ADR-138 D-138-3 R-MID-1)', () => {
  it('#16 R-MID-1 payload 内容断言：actionType system.audit_rollback + before/after jsonb 正确', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '601', actorId: 'a-1', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: { staff_note: '新' },
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    selectCurrentRowForRollbackMock.mockResolvedValue({ staff_note: '新' })
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/admin/audit/logs/601/rollback', headers: adminAuth(),
    })

    expect(insertAuditLogInTransactionMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        actorId: 'admin-1',
        actionType: 'system.audit_rollback',
        targetKind: 'system',
        targetId: null,
        beforeJsonb: expect.objectContaining({
          sourceAuditLogId: '601',
          sourceActionType: 'video.staff_note',
          sourceTargetKind: 'video',
          sourceTargetId: 'v-1',
          rolledBackFields: { staff_note: '新' },
        }),
        afterJsonb: expect.objectContaining({
          sourceAuditLogId: '601',
          sourceActionType: 'video.staff_note',
          sourceTargetKind: 'video',
          sourceTargetId: 'v-1',
          restoredFields: { staff_note: '旧' },
        }),
      }),
    )
    await app.close()
  })

  it('#17 事务原子性：INSERT audit 失败 → ROLLBACK 全部撤销', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '602', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })
    insertAuditLogInTransactionMock.mockRejectedValue(new Error('audit insert failed'))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/602/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(500)
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
    await app.close()
  })
})

// ── 权限 + 白名单 (2) ───────────────────────────────────────────────

describe('POST rollback - 权限 + 白名单 (ADR-138 D-138-2/5)', () => {
  it('#18 白名单过滤：password_hash 被过滤不回滚', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '701', actionType: 'user.email_change', targetKind: 'user', targetId: 'u-1',
      // 模拟意外 audit log 中混入 password_hash
      beforeJsonb: { email: 'old@x.com', password_hash: '$2b$10$evil' },
      afterJsonb: null,
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/701/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    // password_hash 被白名单过滤 — UPDATE 只含 email
    expect(rollbackAuditLogTargetMock).toHaveBeenCalledWith(
      client, 'users', 'id', 'u-1', { email: 'old@x.com' }, 'deleted_at',
    )
    // warnings 含 password_hash 被跳过
    expect(res.json().data.warnings.some((w: string) => w.includes('password_hash'))).toBe(true)
    await app.close()
  })

  it('#19 非 admin → 403', async () => {
    mockVerify.mockReturnValue({ userId: 'mod-1', role: 'moderator', iat: Math.floor(Date.now() / 1000) })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/702/rollback',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})

// ── ADR-138 N1-138-2 / CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE ──────────

describe('POST rollback - force 参数跳过 stale (ADR-138 N1-138-2)', () => {
  it('#20 force=true 跳过 stale 检测 + 仍执行 UPDATE + audit 写入 force flag', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '801', actorId: 'a-1', actionType: 'video.staff_note', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { staff_note: '旧' },
      afterJsonb: { staff_note: '新' },  // 当前 DB 应是 '另一个值' 但 force 跳过检测
    })
    const client = buildMockClient()
    dbConnectMock.mockResolvedValue(client)
    // 即使 mock selectCurrentRowForRollback 返回不一致值，force=true 也应跳过比对
    selectCurrentRowForRollbackMock.mockResolvedValue({ staff_note: '另一个值' })
    rollbackAuditLogTargetMock.mockResolvedValue({ affectedRows: 1 })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/801/rollback', headers: adminAuth(),
      payload: { force: true },
    })
    expect(res.statusCode).toBe(200)
    expect(rollbackAuditLogTargetMock).toHaveBeenCalled()
    // force=true 时不应调 selectCurrentRowForRollback（stale 检测被跳过）
    expect(selectCurrentRowForRollbackMock).not.toHaveBeenCalled()

    // audit payload 含 force flag
    expect(insertAuditLogInTransactionMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        actionType: 'system.audit_rollback',
        beforeJsonb: expect.objectContaining({ force: true }),
        afterJsonb: expect.objectContaining({ force: true }),
      }),
    )
    await app.close()
  })

  it('#21 force=true 不绕过 UNSUPPORTED 守卫 → 仍 422', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '802', actionType: 'system.cache_clear', targetKind: 'system', targetId: null,
      beforeJsonb: null, afterJsonb: null,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/802/rollback', headers: adminAuth(),
      payload: { force: true },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('AUDIT_ROLLBACK_UNSUPPORTED')
    expect(rollbackAuditLogTargetMock).not.toHaveBeenCalled()
    await app.close()
  })
})

// ── ADR-138 N1-138-1 P1 / CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS ───

describe('POST rollback - registered handlers (ADR-138 N1-138-1 P1)', () => {
  it('#22 video.approve handler → UPDATE videos SET review_status = pending_review', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '901', actorId: 'a-1', actionType: 'video.approve', targetKind: 'video', targetId: 'v-1',
      beforeJsonb: { review_status: 'pending_review' },
      afterJsonb: { review_status: 'approved' },
    })
    const client = buildMockClient()
    // handler 内 UPDATE 返 1 rowCount
    client.query.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes("review_status = 'pending_review'") && !sql.includes('review_label_id')) {
        return Promise.resolve({ rows: [{ id: 'v-1' }], rowCount: 1 })
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })
    dbConnectMock.mockResolvedValue(client)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/901/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rolledBack).toBe(true)
    // 验证调用了 handler 的 UPDATE SQL（含 pending_review 关键字）
    const updateCall = client.query.mock.calls.find((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0] as string).includes("review_status = 'pending_review'") && !(args[0] as string).includes('review_label_id'),
    )
    expect(updateCall).toBeDefined()
    expect(updateCall![1]).toEqual(['v-1'])
    // 不走通用路径 rollbackAuditLogTarget
    expect(rollbackAuditLogTargetMock).not.toHaveBeenCalled()
    await app.close()
  })

  it('#23 video.reject_labeled handler → UPDATE review_status + 清 review_label_id', async () => {
    getAdminAuditLogByIdMock.mockResolvedValue({
      id: '902', actorId: 'a-1', actionType: 'video.reject_labeled', targetKind: 'video', targetId: 'v-2',
      beforeJsonb: { review_status: 'pending_review', review_label_id: null },
      afterJsonb: { review_status: 'rejected', review_label_id: 'lbl-1' },
    })
    const client = buildMockClient()
    client.query.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('review_label_id = NULL')) {
        return Promise.resolve({ rows: [{ id: 'v-2' }], rowCount: 1 })
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })
    dbConnectMock.mockResolvedValue(client)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/audit/logs/902/rollback', headers: adminAuth(),
    })
    expect(res.statusCode).toBe(200)
    // 验证 SQL 含 pending_review + review_label_id = NULL
    const updateCall = client.query.mock.calls.find((args: unknown[]) =>
      typeof args[0] === 'string' && (args[0] as string).includes('review_label_id = NULL'),
    )
    expect(updateCall).toBeDefined()
    expect(updateCall![1]).toEqual(['v-2'])
    expect(rollbackAuditLogTargetMock).not.toHaveBeenCalled()
    await app.close()
  })
})
