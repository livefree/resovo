/**
 * tests/unit/api/metadataReconcile.test.ts — META-49-B2 reconcile 裁决核心
 *
 * 覆盖：splitReconcilePassthrough（P1-b passthrough 防回归）/ canonicalizeValue（归一规则）/
 *   reconcileMetadata（单源 winner / 双源一致 tie-break / 冲突 conflict_state / passthrough 直写不进
 *   proposals / M1 方案 A applied 回填 / 事务边界 / 空 sources noop）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

const { safeUpdateMock, batchUpsertMock, deleteMock } = vi.hoisted(() => ({
  safeUpdateMock: vi.fn(),
  batchUpsertMock: vi.fn(),
  deleteMock: vi.fn(),
}))

// MediaCatalogService 类 mock；保留真 CATALOG_SOURCE_PRIORITY（reconcile trust 派生真源，禁另立硬编码）
vi.mock('@/api/services/MediaCatalogService', async (orig) => {
  const actual = await orig<typeof import('@/api/services/MediaCatalogService')>()
  return { ...actual, MediaCatalogService: vi.fn().mockImplementation(() => ({ safeUpdate: safeUpdateMock })) }
})
vi.mock('@/api/db/queries/metadata-field-proposals', () => ({
  batchUpsertFieldProposals: batchUpsertMock,
  deleteFieldProposalsByFields: deleteMock,
}))

import { reconcileMetadata, type ReconcileSource } from '@/api/services/metadata/reconcile'
import { splitReconcilePassthrough, canonicalizeValue } from '@/api/services/metadata/reconcile.canonical'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'
import type { FieldProposalInput } from '@/api/db/queries/metadata-field-proposals'

function makePool(): { pool: Pool; client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } } {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  return { pool, client }
}

function lastProposals(): FieldProposalInput[] {
  return (batchUpsertMock.mock.calls.at(-1)?.[2] ?? []) as FieldProposalInput[]
}

beforeEach(() => {
  vi.clearAllMocks()
  safeUpdateMock.mockResolvedValue({ updated: {}, skippedFields: [] })
})

// ── splitReconcilePassthrough（P1-b passthrough 防回归）─────────────

describe('splitReconcilePassthrough', () => {
  it('bangumi 字段集 → 白名单内容进 reconcileFields，非白名单（releaseDate/year/ratingVotes/director/writers/tags）进 passthroughFields 不丢', () => {
    const fields = {
      title: 'T', titleOriginal: 'TO', description: 'D', coverUrl: 'c', rating: 8.1,
      genres: ['a'], genresRaw: ['x'], country: 'JP',
      ratingVotes: 100, releaseDate: '2020-01-01', year: 2020,
      director: ['d'], writers: ['w'], tags: ['t'],
    } as CatalogUpdateData
    const { reconcileFields, passthroughFields } = splitReconcilePassthrough(fields)
    expect(Object.keys(reconcileFields).sort()).toEqual(
      ['country', 'coverUrl', 'description', 'genres', 'genresRaw', 'rating', 'title', 'titleOriginal'],
    )
    expect(Object.keys(passthroughFields).sort()).toEqual(
      ['director', 'ratingVotes', 'releaseDate', 'tags', 'writers', 'year'],
    )
  })

  it('图片辅字段（posterStatus/尺寸/backdropStatus）属白名单组 → reconcileFields', () => {
    const fields = { coverUrl: 'c', posterStatus: 'ok', posterWidth: 500, backdropUrl: 'b', backdropStatus: 'ok' } as CatalogUpdateData
    const { reconcileFields, passthroughFields } = splitReconcilePassthrough(fields)
    expect(Object.keys(passthroughFields)).toEqual([])
    expect(Object.keys(reconcileFields).sort()).toEqual(['backdropStatus', 'backdropUrl', 'coverUrl', 'posterStatus', 'posterWidth'])
  })
})

// ── canonicalizeValue ─────────────────────────────────────────────

describe('canonicalizeValue', () => {
  it('数组排序集合相等（genres 顺序差异不算冲突）', () => {
    expect(canonicalizeValue('genres', ['a', 'b'])).toBe(canonicalizeValue('genres', ['b', 'a']))
  })
  it('字符串 trim + 大小写归一（title）', () => {
    expect(canonicalizeValue('title', ' Hello ')).toBe(canonicalizeValue('title', 'hello'))
  })
  it('description 仅 trim、大小写敏感', () => {
    expect(canonicalizeValue('description', ' Hi ')).toBe('Hi')
    expect(canonicalizeValue('description', 'Hi')).not.toBe(canonicalizeValue('description', 'hi'))
  })
  it('rating round 0.1 容差近似', () => {
    expect(canonicalizeValue('rating', 7.64)).toBe(canonicalizeValue('rating', 7.6))
    expect(canonicalizeValue('rating', 7.0)).not.toBe(canonicalizeValue('rating', 7.8))
  })
})

// ── reconcileMetadata ─────────────────────────────────────────────

describe('reconcileMetadata', () => {
  it('空 sources → 不连接 db、不写', async () => {
    const { pool } = makePool()
    await reconcileMetadata(pool, 'cat', [])
    expect(pool.connect).not.toHaveBeenCalled()
    expect(safeUpdateMock).not.toHaveBeenCalled()
  })

  it('单源 tmdb → winner 自动胜出 + safeUpdate(内容, tmdb, {db:client}) + proposal applied', async () => {
    const { pool, client } = makePool()
    const sources: ReconcileSource[] = [{ source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X', description: 'D' } }]
    await reconcileMetadata(pool, 'cat', sources)
    expect(safeUpdateMock).toHaveBeenCalledWith(
      'cat', { title: 'X', description: 'D' }, 'tmdb', expect.objectContaining({ sourceRef: '5', db: client }),
    )
    const titleP = lastProposals().find((p) => p.fieldName === 'title' && p.sourceKind === 'tmdb')
    expect(titleP).toMatchObject({ isWinner: true, applied: true, conflictState: null })
  })

  it('双源 canonical 一致（title 大小写归一相等）+ 同 trust/confidence → tie-break bangumi 优先，无 conflict', async () => {
    const { pool } = makePool()
    const sources: ReconcileSource[] = [
      { source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X' } },
      { source: 'bangumi', sourceRef: '9', confidence: 0.9, fields: { title: 'x' } },
    ]
    await reconcileMetadata(pool, 'cat', sources)
    const titleProposals = lastProposals().filter((p) => p.fieldName === 'title')
    expect(titleProposals).toHaveLength(2)
    expect(titleProposals.find((p) => p.isWinner)?.sourceKind).toBe('bangumi') // 同 trust(4)+confidence → bangumi 优先
    expect(titleProposals.every((p) => p.conflictState === null)).toBe(true) // 归一一致 → 无冲突
  })

  it('双源冲突（title 不一致）→ winner 最高 trust/tie-break，非 winner 标 conflict_state + winner 值写入', async () => {
    const { pool } = makePool()
    const sources: ReconcileSource[] = [
      { source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'B' } },
      { source: 'bangumi', sourceRef: '9', confidence: 0.9, fields: { title: 'A' } },
    ]
    await reconcileMetadata(pool, 'cat', sources)
    const titleProposals = lastProposals().filter((p) => p.fieldName === 'title')
    const winner = titleProposals.find((p) => p.isWinner)
    const loser = titleProposals.find((p) => !p.isWinner)
    expect(winner?.sourceKind).toBe('bangumi')
    expect(winner?.conflictState).toBeNull()
    expect(loser?.sourceKind).toBe('tmdb')
    expect(loser?.conflictState).toBe('conflict')
    expect(safeUpdateMock).toHaveBeenCalledWith('cat', expect.objectContaining({ title: 'A' }), 'bangumi', expect.anything())
  })

  it('trust 不等（douban<bangumi）→ 高 trust bangumi winner（即便 douban confidence 更高）', async () => {
    const { pool } = makePool()
    const sources: ReconcileSource[] = [
      { source: 'douban', sourceRef: 'd1', confidence: 0.99, fields: { title: 'A' } },
      { source: 'bangumi', sourceRef: '9', confidence: 0.5, fields: { title: 'B' } },
    ]
    await reconcileMetadata(pool, 'cat', sources)
    const winner = lastProposals().find((p) => p.fieldName === 'title' && p.isWinner)
    expect(winner?.sourceKind).toBe('bangumi') // trust 4 > douban 3，trust 优先于 confidence
  })

  it('passthrough 字段经源 safeUpdate 直写（P1-b 不丢）+ 不进 proposals', async () => {
    const { pool } = makePool()
    const sources: ReconcileSource[] = [{
      source: 'bangumi', sourceRef: '9', confidence: 0.9,
      fields: { title: 'A', releaseDate: '2020-01-01', year: 2020, ratingVotes: 100, director: ['d'], writers: ['w'], tags: ['t'] },
    }]
    await reconcileMetadata(pool, 'cat', sources)
    const call = safeUpdateMock.mock.calls.find((c) => c[2] === 'bangumi')
    const written = call?.[1] as Record<string, unknown>
    expect(written.title).toBe('A') // winner content
    expect(written.releaseDate).toBe('2020-01-01') // passthrough 不丢
    expect(written.year).toBe(2020)
    expect(written.ratingVotes).toBe(100)
    expect(written.director).toEqual(['d'])
    expect(written.writers).toEqual(['w'])
    expect(written.tags).toEqual(['t'])
    // passthrough 不进 proposals（仅白名单字段落表）
    const proposals = lastProposals()
    expect(proposals.some((p) => p.fieldName === 'releaseDate')).toBe(false)
    expect(proposals.some((p) => p.fieldName === 'year')).toBe(false)
    expect(proposals.some((p) => p.fieldName === 'title')).toBe(true)
  })

  it('M1 方案 A：winner 主字段被优先级闸门 skip（skippedFields 含主字段）→ proposal applied=false（proposal-only）', async () => {
    safeUpdateMock.mockResolvedValue({ updated: {}, skippedFields: ['title'] })
    const { pool } = makePool()
    const sources: ReconcileSource[] = [{ source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X' } }]
    await reconcileMetadata(pool, 'cat', sources)
    const titleP = lastProposals().find((p) => p.fieldName === 'title')
    expect(titleP).toMatchObject({ isWinner: true, applied: false }) // winner 但未落 catalog
  })

  it('Codex FIX stale 清除：决出字段先 deleteFieldProposalsByFields（同事务）再 batchUpsert（杜绝跨 run 残留）', async () => {
    const { pool } = makePool()
    await reconcileMetadata(pool, 'cat', [
      { source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X', description: 'D', releaseDate: '2020' } },
    ])
    // 决出字段（白名单）先删旧 proposal——title/description（releaseDate 是 passthrough 不进 proposals）
    expect(deleteMock).toHaveBeenCalledTimes(1)
    const [, catalogArg, fieldsArg] = deleteMock.mock.calls[0]
    expect(catalogArg).toBe('cat')
    expect([...(fieldsArg as string[])].sort()).toEqual(['description', 'title'])
    expect(fieldsArg).not.toContain('releaseDate') // passthrough 不落 proposals → 不需清
    expect(batchUpsertMock).toHaveBeenCalled()
    // 顺序：delete 在 upsert 之前（先删后插同事务）
    expect(deleteMock.mock.invocationCallOrder[0]).toBeLessThan(batchUpsertMock.mock.invocationCallOrder[0])
  })

  it('事务边界：BEGIN → safeUpdate → batchUpsert → COMMIT + release', async () => {
    const { pool, client } = makePool()
    await reconcileMetadata(pool, 'cat', [{ source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X' } }])
    const queries = client.query.mock.calls.map((c) => c[0])
    expect(queries[0]).toBe('BEGIN')
    expect(queries.at(-1)).toBe('COMMIT')
    expect(batchUpsertMock).toHaveBeenCalled()
    expect(client.release).toHaveBeenCalled()
  })

  it('safeUpdate 抛错 → ROLLBACK + 上抛 + release', async () => {
    safeUpdateMock.mockRejectedValue(new Error('boom'))
    const { pool, client } = makePool()
    await expect(
      reconcileMetadata(pool, 'cat', [{ source: 'tmdb', sourceRef: '5', confidence: 0.9, fields: { title: 'X' } }]),
    ).rejects.toThrow('boom')
    expect(client.query.mock.calls.map((c) => c[0])).toContain('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
  })
})
