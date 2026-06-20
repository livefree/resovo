/**
 * tests/unit/api/metadataFieldProposalsQueries.test.ts — META-49-A
 *
 * 验证 metadata_field_proposals 写侧/读侧原语 SQL 形状（mock pg，对齐
 *   metadataProvenanceQueries.test.ts 范式）。真库可执行性由 `npm run migrate` 验证。
 *
 * 关键守护（ADR-205 D-205-2）：
 *   - INSERT 9 列（proposed_at 走 DB DEFAULT，对齐 provenance updated_at 范式）；
 *   - proposed_value 经 JSON.stringify + `$N::jsonb` cast（防 node-pg 数组误转 PG array）；
 *   - ON CONFLICT (catalog_id, field_name, source_kind)（M6 同源同字段单 proposal）proposed_at=NOW()；
 *   - is_winner/applied/conflict_state 默认 false/false/null；M1 降级 is_winner=true+applied=false 可表达。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  batchUpsertFieldProposals,
  deleteFieldProposalsByFields,
  getConflictFieldsByCatalogIds,
  getFieldProposalsByCatalogId,
  getFieldProposalsByCatalogIdAndField,
} from '@/api/db/queries/metadata-field-proposals'

const CID = 'cat-uuid-1'

function makeMockDb() {
  let capturedSql = ''
  let capturedParams: unknown[] = []
  const db = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      capturedSql = sql
      capturedParams = params ?? []
      return { rows: [], rowCount: 0 }
    }),
  } as unknown as Pool
  return {
    db,
    get sql() {
      return capturedSql
    },
    get params() {
      return capturedParams
    },
  }
}

describe('batchUpsertFieldProposals — INSERT 形状 / jsonb cast / ON CONFLICT', () => {
  it('单 proposal：INSERT 9 列 + $5::jsonb + proposed_at 不在 INSERT 列 + ON CONFLICT proposed_at=NOW()', async () => {
    const m = makeMockDb()
    await batchUpsertFieldProposals(m.db, CID, [
      { fieldName: 'description', sourceKind: 'tmdb', sourceRef: '12345', proposedValue: '简介文本', confidence: 0.92 },
    ])

    // 9 列（不含 proposed_at；INSERT 列段精确锁定 → proposed_at 走 DB DEFAULT NOW()）
    const insertColumns = m.sql.slice(m.sql.indexOf('(catalog_id'), m.sql.indexOf('VALUES'))
    expect(insertColumns).toContain(
      '(catalog_id, field_name, source_kind, source_ref, proposed_value, confidence, is_winner, applied, conflict_state)',
    )
    expect(insertColumns).not.toContain('proposed_at')
    // 占位符：9 个，第 5 个 jsonb cast
    expect(m.sql).toContain('($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)')
    // ON CONFLICT 三列 PK + proposed_at=NOW()
    expect(m.sql).toContain('ON CONFLICT (catalog_id, field_name, source_kind) DO UPDATE SET')
    expect(m.sql).toContain('proposed_at = NOW()')

    // proposed_value 经 JSON.stringify
    expect(m.params).toHaveLength(9)
    expect(m.params).toEqual([CID, 'description', 'tmdb', '12345', JSON.stringify('简介文本'), 0.92, false, false, null])
  })

  it('数组 proposedValue：JSON.stringify 序列化（防 PG array 误转）', async () => {
    const m = makeMockDb()
    const genres = ['动作', '科幻']
    await batchUpsertFieldProposals(m.db, CID, [
      { fieldName: 'genres', sourceKind: 'douban', proposedValue: genres },
    ])
    // 第 5 参数（proposed_value）= JSON 字符串，非原始数组
    expect(m.params[4]).toBe(JSON.stringify(genres))
    expect(typeof m.params[4]).toBe('string')
  })

  it('多 proposal N=2：占位符 2×9=18，逐源一行', async () => {
    const m = makeMockDb()
    await batchUpsertFieldProposals(m.db, CID, [
      { fieldName: 'rating', sourceKind: 'douban', proposedValue: 8.5 },
      { fieldName: 'rating', sourceKind: 'tmdb', proposedValue: 8.6 },
    ])
    expect(m.sql).toContain('($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)')
    expect(m.sql).toContain('($10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18)')
    expect(m.params).toHaveLength(18)
  })

  it('M1 降级场景：is_winner=true + applied=false + conflict_state 可显式落 params', async () => {
    const m = makeMockDb()
    await batchUpsertFieldProposals(m.db, CID, [
      { fieldName: 'cover', sourceKind: 'douban', proposedValue: 'http://x', isWinner: true, applied: false, conflictState: 'conflict' },
    ])
    expect(m.params.slice(6)).toEqual([true, false, 'conflict'])
  })

  it('空数组：不调用 db.query', async () => {
    const m = makeMockDb()
    await batchUpsertFieldProposals(m.db, CID, [])
    expect((m.db.query as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

describe('deleteFieldProposalsByFields — 决出字段清旧（Codex FIX stale）', () => {
  it('DELETE WHERE catalog_id + field_name = ANY($2::text[])', async () => {
    const m = makeMockDb()
    await deleteFieldProposalsByFields(m.db, CID, ['title', 'description'])
    expect(m.sql).toContain('DELETE FROM metadata_field_proposals')
    expect(m.sql).toContain('WHERE catalog_id = $1 AND field_name = ANY($2::text[])')
    expect(m.params).toEqual([CID, ['title', 'description']])
  })

  it('空字段数组：不调用 db.query', async () => {
    const m = makeMockDb()
    await deleteFieldProposalsByFields(m.db, CID, [])
    expect((m.db.query as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

describe('getConflictFieldsByCatalogIds — 批量冲突字段（ADR-205 M3，partial index）', () => {
  it('DISTINCT catalog_id/field_name WHERE conflict_state IS NOT NULL → Map<catalogId, fields[]>', async () => {
    const db = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        expect(sql).toContain('WHERE catalog_id = ANY($1::uuid[]) AND conflict_state IS NOT NULL')
        expect(params).toEqual([['c1', 'c2']])
        return {
          rows: [
            { catalog_id: 'c1', field_name: 'rating' },
            { catalog_id: 'c1', field_name: 'title' },
            { catalog_id: 'c2', field_name: 'description' },
          ],
        }
      }),
    } as unknown as Pool
    const map = await getConflictFieldsByCatalogIds(db, ['c1', 'c2'])
    expect(map.get('c1')).toEqual(['rating', 'title'])
    expect(map.get('c2')).toEqual(['description'])
    expect(map.has('c3')).toBe(false)
  })

  it('空 catalogIds：不调用 db.query', async () => {
    const db = { query: vi.fn() } as unknown as Pool
    const map = await getConflictFieldsByCatalogIds(db, [])
    expect(map.size).toBe(0)
    expect((db.query as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

describe('getFieldProposalsByCatalogId — SELECT + mapper', () => {
  it('映射 snake→camel + confidence NUMERIC string→number + proposed_value 透传', async () => {
    const dbRow = {
      catalog_id: CID,
      field_name: 'genres',
      source_kind: 'tmdb',
      source_ref: '999',
      proposed_value: ['动作', '科幻'],
      confidence: '0.85', // NUMERIC 经 node-pg 默认返回 string
      is_winner: true,
      applied: true,
      conflict_state: null,
      proposed_at: '2026-06-15T00:00:00.000Z',
    }
    const db = {
      query: vi.fn(async () => ({ rows: [dbRow], rowCount: 1 })),
    } as unknown as Pool

    const rows = await getFieldProposalsByCatalogId(db, CID)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      catalogId: CID,
      fieldName: 'genres',
      sourceKind: 'tmdb',
      sourceRef: '999',
      proposedValue: ['动作', '科幻'],
      confidence: 0.85, // 收口为 number
      isWinner: true,
      applied: true,
      conflictState: null,
      proposedAt: '2026-06-15T00:00:00.000Z',
    })
  })

  it('confidence NULL → null（不误转 0）', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            catalog_id: CID,
            field_name: 'country',
            source_kind: 'douban',
            source_ref: null,
            proposed_value: 'CN',
            confidence: null,
            is_winner: false,
            applied: false,
            conflict_state: null,
            proposed_at: '2026-06-15T00:00:00.000Z',
          },
        ],
        rowCount: 1,
      })),
    } as unknown as Pool
    const rows = await getFieldProposalsByCatalogId(db, CID)
    expect(rows[0].confidence).toBeNull()
  })
})

describe('getFieldProposalsByCatalogIdAndField — 字段过滤 SELECT（IMGH-P2-1A / ADR-208 D-208-2）', () => {
  it('WHERE catalog_id=$1 AND field_name=$2 + ORDER BY confidence DESC NULLS LAST + 参数透传', async () => {
    const m = makeMockDb()
    await getFieldProposalsByCatalogIdAndField(m.db, CID, 'coverUrl')
    expect(m.sql).toContain('WHERE catalog_id = $1 AND field_name = $2')
    expect(m.sql).toContain('ORDER BY confidence DESC NULLS LAST, source_kind')
    expect(m.params).toEqual([CID, 'coverUrl'])
  })

  it('复用 mapProposal：snake→camel + confidence string→number', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            catalog_id: CID,
            field_name: 'coverUrl',
            source_kind: 'tmdb',
            source_ref: 'tmdb-1',
            proposed_value: 'https://img.example/x.jpg',
            confidence: '0.7',
            is_winner: true,
            applied: false,
            conflict_state: null,
            proposed_at: '2026-06-20T00:00:00.000Z',
          },
        ],
        rowCount: 1,
      })),
    } as unknown as Pool
    const rows = await getFieldProposalsByCatalogIdAndField(db, CID, 'coverUrl')
    expect(rows[0]).toMatchObject({
      sourceKind: 'tmdb',
      proposedValue: 'https://img.example/x.jpg',
      confidence: 0.7,
      isWinner: true,
    })
  })
})
