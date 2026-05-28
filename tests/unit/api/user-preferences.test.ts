/**
 * user-preferences.test.ts — CHG-SN-9-ROUTE-LABEL-D-A1 / ADR-165
 *
 * 覆盖 userPreferences queries + UserPreferencesService 核心 contract：
 *   getUserPreferences:
 *     #1 用户存在 → SELECT preferences / 仅 1 列（R-165-1）
 *     #2 用户不存在 → null
 *   updateUserPreferences:
 *     #3 patch 含值 → JSONB merge SQL `preferences || $1::jsonb`（R-165-3）
 *     #4 patch 含 null → 删除顶层 key `preferences - $1::text`
 *     #5 空 patch → 直接 SELECT 返回（幂等）
 *     #6 多 key（值 + null 混合）→ 事务内顺序执行
 *   UserPreferencesService.update:
 *     #7 zod passthrough：未知字段保留（R-165-4）
 *     #8 zod strict 校验失败 → throw VALIDATION_ERROR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { getUserPreferences, updateUserPreferences } from '@/api/db/queries/userPreferences'
import { UserPreferencesService } from '@/api/services/UserPreferencesService'

function makePool(queryResults: unknown[] = []): {
  pool: Pool
  queryMock: ReturnType<typeof vi.fn>
  clientQueryMock: ReturnType<typeof vi.fn>
} {
  const queryMock = vi.fn()
  const clientQueryMock = vi.fn()

  // 默认依次返回提供的 result（不指定时返回空）
  for (const r of queryResults) {
    queryMock.mockResolvedValueOnce({ rows: Array.isArray(r) ? r : [r] })
  }
  queryMock.mockResolvedValue({ rows: [] })
  clientQueryMock.mockResolvedValue({ rows: [] })

  const client = {
    query: clientQueryMock,
    release: vi.fn(),
  } as unknown as PoolClient

  const pool = {
    query: queryMock,
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool

  return { pool, queryMock, clientQueryMock }
}

describe('userPreferences queries — ADR-165 R-165-1 + R-165-3', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('#1 getUserPreferences：SELECT preferences 单列（不 SELECT *）+ WHERE id + deleted_at IS NULL', async () => {
    const { pool, queryMock } = makePool([{ preferences: { routeTheme: { themeId: 'nato' } } }])
    const result = await getUserPreferences(pool, 'user-1')
    expect(result).toEqual({ routeTheme: { themeId: 'nato' } })
    const sql = queryMock.mock.calls[0][0] as string
    expect(sql).toMatch(/SELECT preferences\s+FROM users/)
    expect(sql).not.toContain('SELECT *')
    expect(sql).toContain('WHERE id = $1')
    expect(sql).toContain('deleted_at IS NULL')
  })

  it('#2 getUserPreferences：用户不存在 → null', async () => {
    const { pool } = makePool([[]])
    expect(await getUserPreferences(pool, 'missing')).toBeNull()
  })

  it('#3 updateUserPreferences：值 patch → JSONB merge SQL（R-165-3）', async () => {
    const { pool, clientQueryMock } = makePool()
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE merge
      .mockResolvedValueOnce({ rows: [{ preferences: { routeTheme: { themeId: 'nato' } } }] })  // SELECT
      .mockResolvedValueOnce({ rows: [] })  // COMMIT

    const result = await updateUserPreferences(pool, 'user-1', {
      routeTheme: { themeId: 'nato' },
    })
    expect(result).toEqual({ routeTheme: { themeId: 'nato' } })
    const mergeSql = clientQueryMock.mock.calls.find((c) =>
      (c[0] as string).includes('preferences = preferences || '),
    )?.[0] as string
    expect(mergeSql).toMatch(/preferences = preferences \|\| \$1::jsonb/)
    expect(mergeSql).toContain('WHERE id = $2')
  })

  it('#4 updateUserPreferences：null patch → 删除顶层 key（preferences - $1::text）', async () => {
    const { pool, clientQueryMock } = makePool()
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE delete
      .mockResolvedValueOnce({ rows: [{ preferences: {} }] })  // SELECT
      .mockResolvedValueOnce({ rows: [] })  // COMMIT

    await updateUserPreferences(pool, 'user-1', { routeTheme: null })
    const deleteSql = clientQueryMock.mock.calls.find((c) =>
      (c[0] as string).includes('preferences - '),
    )?.[0] as string
    expect(deleteSql).toMatch(/preferences = preferences - \$1::text/)
    const deleteParams = clientQueryMock.mock.calls.find((c) =>
      (c[0] as string).includes('preferences - '),
    )?.[1] as unknown[]
    expect(deleteParams).toEqual(['routeTheme', 'user-1'])
  })

  it('#5 updateUserPreferences：空 patch → 直接 SELECT 返回（幂等 / 不开事务）', async () => {
    const { pool, queryMock, clientQueryMock } = makePool([{ preferences: { routeTheme: { themeId: 'jie_qi' } } }])
    const result = await updateUserPreferences(pool, 'user-1', {})
    expect(result).toEqual({ routeTheme: { themeId: 'jie_qi' } })
    // 走的是 getUserPreferences 路径（pool.query）/ 没有进事务（client.query 未调用）
    expect(queryMock).toHaveBeenCalled()
    expect(clientQueryMock).not.toHaveBeenCalled()
  })

  it('#6 updateUserPreferences：值 + null 混合 → 一次事务内 merge + 多 delete', async () => {
    const { pool, clientQueryMock } = makePool()
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE merge
      .mockResolvedValueOnce({ rows: [] })  // UPDATE delete key1
      .mockResolvedValueOnce({ rows: [] })  // UPDATE delete key2
      .mockResolvedValueOnce({ rows: [{ preferences: { routeTheme: { themeId: 'nato' } } }] })
      .mockResolvedValueOnce({ rows: [] })  // COMMIT

    await updateUserPreferences(pool, 'user-1', {
      routeTheme: { themeId: 'nato' },
      playerSettings: null,
      homeLayout: null,
    } as Record<string, unknown>)

    const beginCall = clientQueryMock.mock.calls.find((c) => c[0] === 'BEGIN')
    const commitCall = clientQueryMock.mock.calls.find((c) => c[0] === 'COMMIT')
    expect(beginCall).toBeDefined()
    expect(commitCall).toBeDefined()

    const deleteCalls = clientQueryMock.mock.calls.filter((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('preferences - '),
    )
    expect(deleteCalls).toHaveLength(2)
  })
})

describe('UserPreferencesService — ADR-165 R-165-4 双 schema', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('#7 update：未知顶层字段 passthrough 保留（防演进期误删 server 字段）', async () => {
    const { pool, clientQueryMock } = makePool()
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // UPDATE merge
      .mockResolvedValueOnce({ rows: [{ preferences: { unknownFutureField: { x: 1 } } }] })
      .mockResolvedValueOnce({ rows: [] })  // COMMIT

    const service = new UserPreferencesService(pool)
    // unknownFutureField 是 v2 加的字段 / 当前 v1 server 不识别但 passthrough 保留
    await service.update('user-1', { unknownFutureField: { x: 1 } })
    const mergeCall = clientQueryMock.mock.calls.find((c) =>
      (c[0] as string).includes('preferences = preferences || '),
    )
    const mergeParams = mergeCall?.[1] as unknown[]
    expect(mergeParams[0]).toBe(JSON.stringify({ unknownFutureField: { x: 1 } }))
  })

  it('#8 update：routeTheme 含非法字段 → VALIDATION_ERROR throw', async () => {
    const { pool } = makePool()
    const service = new UserPreferencesService(pool)
    await expect(
      service.update('user-1', { routeTheme: { themeId: '' } }),  // empty string fails min(1)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
