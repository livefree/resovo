/**
 * catalog-external-refs-queries.test.ts — catalog_external_refs 写侧原语
 * （CHG-VIR-12-D / ADR-177 R10 守卫 + RR-A 预检主导 + D-177-4 冲突降级）
 * mock PoolClient，断言分支语义 + 关键 SQL 片段（仿 identity-decision-queries.test.ts 范式）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveAndWriteExactRef,
  insertCandidateRef,
  demoteExactRef,
  EXTERNAL_KIND_BY_PROVIDER,
  PRECISE_KINDS,
} from '@/api/db/queries/catalogExternalRefs'

const mockQuery = vi.fn()
const mockClient = { query: mockQuery } as unknown as import('pg').PoolClient

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
})

const BASE = {
  catalogId: 'cat-a',
  provider: 'douban' as const,
  externalId: '88001',
  externalKind: 'subject' as const,
  source: 'auto' as const,
  linkedBy: 'test',
}

function sqlCalls(): string[] {
  return mockQuery.mock.calls.map((c) => String(c[0]))
}

describe('EXTERNAL_KIND_BY_PROVIDER（D-177-11 映射真源）', () => {
  it('bangumi/douban → subject；imdb/tmdb 不提供默认（写入时判定，防误用）', () => {
    expect(EXTERNAL_KIND_BY_PROVIDER.bangumi).toBe('subject')
    expect(EXTERNAL_KIND_BY_PROVIDER.douban).toBe('subject')
    expect(EXTERNAL_KIND_BY_PROVIDER.imdb).toBeUndefined()
    expect(EXTERNAL_KIND_BY_PROVIDER.tmdb).toBeUndefined()
  })

  it('PRECISE_KINDS = subject/season/movie（show 属 parent 域 / R10）', () => {
    expect(PRECISE_KINDS).toEqual(['subject', 'season', 'movie'])
    expect(PRECISE_KINDS).not.toContain('show')
  })
})

describe('resolveAndWriteExactRef', () => {
  it('show kind → throw（调用方契约错误：show 只可 parent，走上卷路径）', async () => {
    await expect(
      resolveAndWriteExactRef(mockClient, { ...BASE, externalKind: 'show' as never })
    ).rejects.toThrow(/非精确级/)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('R10 守卫：同 (provider, external_id) 既有 kind 不一致 → kind_conflict 拒写', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ external_kind: 'movie' }], rowCount: 1 })
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'kind_conflict', existingKind: 'movie' })
    expect(mockQuery).toHaveBeenCalledTimes(1) // 守卫即返回，不预检不写入
  })

  it('索引① 预检命中自身 → already_exact（幂等，不 INSERT）', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ external_kind: 'subject' }], rowCount: 1 }) // kind 一致
      .mockResolvedValueOnce({ rows: [{ catalog_id: 'cat-a' }], rowCount: 1 }) // holder=自身
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'already_exact' })
    expect(sqlCalls().some((s) => s.includes('INSERT'))).toBe(false)
  })

  it('索引① 预检命中他 catalog → 降级 candidate（D-177-4 归并信号，不靠唯一索引兜底）', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // kind 查询无既有行
      .mockResolvedValueOnce({ rows: [{ catalog_id: 'cat-other' }], rowCount: 1 }) // holder=他者
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // insertCandidateRef
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'conflict_candidate', holderCatalogId: 'cat-other' })
    const candidateSql = sqlCalls()[2]!
    expect(candidateSql).toContain(`'candidate'`)
    expect(candidateSql).toContain('NOT EXISTS')
  })

  it('未占用 → INSERT exact（is_primary=true + ON CONFLICT DO NOTHING 仅并发保险）', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // kind
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // 预检无 holder
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT 成功
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'exact_written' })
    const insertSql = sqlCalls()[2]!
    expect(insertSql).toContain(`'exact'`)
    expect(insertSql).toContain('ON CONFLICT DO NOTHING')
    expect(mockQuery.mock.calls[2]![1]).toEqual([
      'cat-a', 'douban', '88001', 'subject', null, 'auto', 'test',
    ])
  })

  it('并发保险：INSERT rowCount=0 → 重查他者占用 → 降级 candidate', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // kind
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // 预检无 holder
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT 被 ON CONFLICT 吞（并发）
      .mockResolvedValueOnce({ rows: [{ catalog_id: 'cat-racer' }], rowCount: 1 }) // recheck
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // candidate
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'conflict_candidate', holderCatalogId: 'cat-racer' })
  })

  it('并发保险：rowCount=0 但 recheck 归属自身 → already_exact 收敛', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ catalog_id: 'cat-a' }], rowCount: 1 })
    const r = await resolveAndWriteExactRef(mockClient, BASE)
    expect(r).toEqual({ outcome: 'already_exact' })
  })
})

describe('insertCandidateRef', () => {
  it('新插入 → true；幂等 NOT EXISTS（candidate 不进 partial unique 不能靠 ON CONFLICT）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const r = await insertCandidateRef(mockClient, BASE)
    expect(r).toBe(true)
    const sql = sqlCalls()[0]!
    expect(sql).toContain('NOT EXISTS')
    expect(sql).not.toContain('ON CONFLICT')
    expect(mockQuery.mock.calls[0]![1]).toEqual([
      'cat-a', 'douban', '88001', 'subject', null, 'auto', 'test',
    ])
  })

  it('已存在同 candidate → false（幂等跳过）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    expect(await insertCandidateRef(mockClient, BASE)).toBe(false)
  })
})

describe('demoteExactRef（D-177-5 清 cache 联动降级）', () => {
  it('exact → candidate（UPDATE 保留审计痕迹不 DELETE）+ 返回降级行数', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const n = await demoteExactRef(mockClient, 'cat-a', 'douban')
    expect(n).toBe(1)
    const sql = sqlCalls()[0]!
    expect(sql).toContain(`SET relation = 'candidate'`)
    expect(sql).toContain(`relation = 'exact'`)
    expect(sql).not.toContain('DELETE')
    expect(mockQuery.mock.calls[0]![1]).toEqual(['cat-a', 'douban'])
  })

  it('本无 exact → 0（幂等）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    expect(await demoteExactRef(mockClient, 'cat-a', 'bangumi')).toBe(0)
  })
})
