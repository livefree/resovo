/**
 * catalogEpisodes.upsertCatalogEpisodes Pool/PoolClient 鉴别器单测
 * (Codex stop-time review FIX-2)
 *
 * 关键断言：pg 真实 PoolClient 继承 ClientBase 同样暴露 connect()。鉴别器必须用 `release`
 * 而非 `connect`，否则把 PoolClient 误判为 Pool → 对已连接 client 再调 connect() 抛
 * `Client has already been connected`，整个 confirmMatch 事务回滚（带 episodes 的 manual
 * confirmation 全部失败）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { upsertCatalogEpisodes } from '@/api/db/queries/catalogEpisodes'
import type { CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'

const CID = 'c1'
const episode = (i: number): CatalogEpisodeInput => ({
  source: 'bangumi',
  externalEpisodeId: String(i),
  epType: 0,
  sort: i,
  ep: i,
  name: `e${i}`,
  nameCn: null,
  airdate: null,
  durationSeconds: null,
  description: null,
})

describe('upsertCatalogEpisodes — Pool/PoolClient 鉴别器', () => {
  it('Pool（无 release）→ 自管 BEGIN/COMMIT + connect/release', async () => {
    const queries: string[] = []
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    const mockPool = {
      connect: vi.fn(async () => mockClient),
    } as unknown as Pool

    const n = await upsertCatalogEpisodes(mockPool, CID, [episode(1), episode(2)])
    expect(n).toBe(2)
    // 必须开自己的事务并释放
    expect(mockPool.connect).toHaveBeenCalledOnce()
    expect(queries[0]).toBe('BEGIN')
    expect(queries[queries.length - 1]).toBe('COMMIT')
    expect(mockClient.release).toHaveBeenCalledOnce()
  })

  it('PoolClient（含 release，即使同样含 connect 继承自 ClientBase）→ 复用调用方事务，不自管 BEGIN/COMMIT', async () => {
    // ── 关键：mockClient 同时含 connect（模拟 pg 真实 PoolClient 继承 ClientBase 行为）──
    //    若鉴别器误用 connect 而非 release，会把这个 client 当 Pool，
    //    然后调用 (client as Pool).connect() 触发 `Client has already been connected`
    const queries: string[] = []
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
      // 这是关键的"陷阱"——pg PoolClient 也有 connect 方法
      connect: vi.fn(() => { throw new Error('Client has already been connected') }),
    } as unknown as PoolClient

    const n = await upsertCatalogEpisodes(mockClient, CID, [episode(1), episode(2)])
    expect(n).toBe(2)
    // 不能开自己的事务（复用调用方 BEGIN）
    expect(queries).not.toContain('BEGIN')
    expect(queries).not.toContain('COMMIT')
    expect(queries).not.toContain('ROLLBACK')
    // 不能调 client.connect()
    expect((mockClient as unknown as { connect: ReturnType<typeof vi.fn> }).connect).not.toHaveBeenCalled()
    // 不能 release（调用方负责）
    expect(mockClient.release).not.toHaveBeenCalled()
    // 但 INSERT SQL 仍然被执行（确认逻辑路径正确）
    expect(mockClient.query).toHaveBeenCalledTimes(2)
  })

  it('Pool 写入抛错 → ROLLBACK + release，错误抛出', async () => {
    const queries: string[] = []
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)
        if (sql.startsWith('INSERT')) throw new Error('insert fail')
        return { rows: [], rowCount: 0 }
      }),
      release: vi.fn(),
    }
    const mockPool = {
      connect: vi.fn(async () => mockClient),
    } as unknown as Pool

    await expect(upsertCatalogEpisodes(mockPool, CID, [episode(1)])).rejects.toThrow('insert fail')
    expect(queries).toContain('BEGIN')
    expect(queries).toContain('ROLLBACK')
    expect(queries).not.toContain('COMMIT')
    expect(mockClient.release).toHaveBeenCalledOnce()
  })

  it('episodes 全无 externalEpisodeId → 直接返回 0，不开连接', async () => {
    const mockPool = { connect: vi.fn() } as unknown as Pool
    const n = await upsertCatalogEpisodes(mockPool, CID, [{ ...episode(1), externalEpisodeId: '' }])
    expect(n).toBe(0)
    expect(mockPool.connect).not.toHaveBeenCalled()
  })
})
