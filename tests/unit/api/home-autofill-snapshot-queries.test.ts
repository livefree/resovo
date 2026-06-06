/**
 * home-autofill-snapshot-queries.test.ts — home_autofill_snapshots queries
 * （CHG-HOME-AUTOFILL-CORE-B / ADR-183 D-183-2）
 *
 * 影响面 #8 测试义务：快照写入 + 超龄清理**同事务**断言（BEGIN→INSERT→DELETE→COMMIT
 * 同 client；失败 ROLLBACK 不留半写态）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  insertHomeAutofillSnapshot,
  findLatestHomeAutofillSnapshot,
  listLatestSnapshotSummaries,
  SNAPSHOT_RETENTION_PER_SECTION,
  type InsertSnapshotInput,
} from '@/api/db/queries/home-autofill-snapshots'

const DB_ROW = {
  id: 'snap-1',
  section: 'hot_movies',
  generated_at: '2026-06-06T10:00:00Z',
  trigger: 'scheduled',
  policy_version: 'hp-v1',
  settings_snapshot: { displayCount: 10 },
  candidates: [{ id: 'c1' }],
  gaps: [],
  created_at: '2026-06-06T10:00:00Z',
}

function makeClient() {
  return {
    query: vi.fn(async (sql: string, _params?: readonly unknown[]) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO home_autofill_snapshots')) {
        return { rows: [DB_ROW], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }
}

function makePool(client: ReturnType<typeof makeClient>) {
  return {
    connect: vi.fn(async () => client),
    query: vi.fn(),
  } as unknown as Pool
}

const INPUT: InsertSnapshotInput = {
  section: 'hot_movies',
  trigger: 'scheduled',
  policyVersion: 'hp-v1',
  settingsSnapshot: { displayCount: 10 },
  candidates: [{
    id: 'c1', videoId: 'v1',
    videoSummary: { title: 't', slug: 's', coverUrl: null, type: 'movie', year: 2026, rating: 8, sourceCount: 1 },
    score: 0.8, rank: 1, origin: 'douban', filtered: false,
  }],
  gaps: [],
}

describe('insertHomeAutofillSnapshot（写入 + 清理同事务，D-183-2）', () => {
  let client: ReturnType<typeof makeClient>
  let pool: Pool

  beforeEach(() => {
    client = makeClient()
    pool = makePool(client)
  })

  it('BEGIN → INSERT → DELETE 清理 → COMMIT 全部在同一 client 上执行', async () => {
    const result = await insertHomeAutofillSnapshot(pool, INPUT)

    const sqls = client.query.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : ''))
    expect(sqls[0]).toBe('BEGIN')
    expect(sqls[1]).toContain('INSERT INTO home_autofill_snapshots')
    expect(sqls[2]).toContain('DELETE FROM home_autofill_snapshots')
    expect(sqls[3]).toBe('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
    expect(result.id).toBe('snap-1')
    expect(result.policyVersion).toBe('hp-v1')
  })

  it('INSERT 参数化：JSONB 字段序列化 + trigger/policy_version 透传', async () => {
    await insertHomeAutofillSnapshot(pool, INPUT)
    const insertCall = client.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO'),
    )!
    expect(insertCall[1]).toEqual([
      'hot_movies', 'scheduled', 'hp-v1',
      JSON.stringify(INPUT.settingsSnapshot),
      JSON.stringify(INPUT.candidates),
      JSON.stringify(INPUT.gaps),
    ])
  })

  it('清理保留最近 N 份（参数 = section + SNAPSHOT_RETENTION_PER_SECTION）', async () => {
    await insertHomeAutofillSnapshot(pool, INPUT)
    const deleteCall = client.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM'),
    )!
    expect(deleteCall[0]).toContain('ORDER BY generated_at DESC')
    expect(deleteCall[1]).toEqual(['hot_movies', SNAPSHOT_RETENTION_PER_SECTION])
  })

  it('中途失败 → ROLLBACK + release + 异常上抛（不留半写态）', async () => {
    client.query.mockImplementation(async (sql: string, _params?: readonly unknown[]) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO')) throw new Error('boom')
      return { rows: [], rowCount: 0 }
    })
    await expect(insertHomeAutofillSnapshot(pool, INPUT)).rejects.toThrow('boom')
    const sqls = client.query.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : ''))
    expect(sqls).toContain('ROLLBACK')
    expect(sqls).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })
})

describe('findLatestHomeAutofillSnapshot', () => {
  it('按 generated_at DESC 取最新一份并映射 camelCase', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [DB_ROW] })) } as unknown as Pool
    const snap = await findLatestHomeAutofillSnapshot(pool, 'hot_movies')
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toContain('ORDER BY generated_at DESC')
    expect(sql).toContain('LIMIT 1')
    expect(params).toEqual(['hot_movies'])
    expect(snap).toMatchObject({
      id: 'snap-1', section: 'hot_movies',
      generatedAt: '2026-06-06T10:00:00Z', policyVersion: 'hp-v1',
      settingsSnapshot: { displayCount: 10 },
    })
  })

  it('无快照 → null（端点 #4 未生成语义）', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool
    expect(await findLatestHomeAutofillSnapshot(pool, 'featured')).toBeNull()
  })
})

describe('listLatestSnapshotSummaries', () => {
  it('DISTINCT ON 每 section 最新份 → Record 摘要（候选数含 filtered 条目）', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          { section: 'hot_movies', generated_at: '2026-06-06T10:00:00Z', cnt: 12 },
          { section: 'top10', generated_at: '2026-06-06T09:00:00Z', cnt: 5 },
        ],
      })),
    } as unknown as Pool
    const summaries = await listLatestSnapshotSummaries(pool)
    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sql).toContain('DISTINCT ON (section)')
    expect(sql).toContain('jsonb_array_length(candidates)')
    expect(summaries).toEqual({
      hot_movies: { generatedAt: '2026-06-06T10:00:00Z', candidateCount: 12 },
      top10: { generatedAt: '2026-06-06T09:00:00Z', candidateCount: 5 },
    })
  })
})
