/**
 * tests/unit/api/externalData.test.ts
 * META-03: upsertVideoExternalRef / findPrimaryVideoExternalRef 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  upsertVideoExternalRef,
  findPrimaryVideoExternalRef,
} from '@/api/db/queries/externalData'
import type { Pool } from 'pg'

// ── helpers ────────────────────────────────────────────────────────

const BASE_ROW = {
  id: 'ref-uuid-1',
  video_id: 'vid-uuid-1',
  provider: 'douban',
  external_id: '12345678',
  match_status: 'auto_matched',
  match_method: 'title_year_type',
  confidence: '0.90',
  is_primary: true,
  linked_by: 'auto',
  linked_at: '2026-04-14T00:00:00.000Z',
  notes: null,
}

function makeDb(rows: unknown[] = [BASE_ROW]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Pool
}

// ── upsertVideoExternalRef ─────────────────────────────────────────

describe('upsertVideoExternalRef', () => {
  beforeEach(() => vi.clearAllMocks())

  it('正常写入：返回映射后的 VideoExternalRef 对象', async () => {
    const db = makeDb()
    const result = await upsertVideoExternalRef(db, {
      videoId: 'vid-uuid-1',
      provider: 'douban',
      externalId: '12345678',
      matchStatus: 'auto_matched',
      matchMethod: 'title_year_type',
      confidence: 0.9,
      isPrimary: true,
      linkedBy: 'auto',
    })

    expect(result.id).toBe('ref-uuid-1')
    expect(result.videoId).toBe('vid-uuid-1')
    expect(result.provider).toBe('douban')
    expect(result.externalId).toBe('12345678')
    expect(result.matchStatus).toBe('auto_matched')
    expect(result.confidence).toBe(0.9)
    expect(result.isPrimary).toBe(true)
    expect(result.linkedBy).toBe('auto')
  })

  it('confidence 字段从字符串正确转为 number', async () => {
    const db = makeDb([{ ...BASE_ROW, confidence: '0.75' }])
    const result = await upsertVideoExternalRef(db, {
      videoId: 'vid-1', provider: 'douban', externalId: '999', matchStatus: 'candidate',
    })
    expect(result.confidence).toBe(0.75)
  })

  it('confidence 为 null 时返回 null', async () => {
    const db = makeDb([{ ...BASE_ROW, confidence: null }])
    const result = await upsertVideoExternalRef(db, {
      videoId: 'vid-1', provider: 'tmdb', externalId: '42', matchStatus: 'candidate',
    })
    expect(result.confidence).toBeNull()
  })

  it('可选字段未传时默认值正确（isPrimary=false, linkedBy=null）', async () => {
    const db = makeDb([{ ...BASE_ROW, is_primary: false, linked_by: null, confidence: null }])
    const result = await upsertVideoExternalRef(db, {
      videoId: 'vid-1', provider: 'bangumi', externalId: '555', matchStatus: 'candidate',
    })
    expect(result.isPrimary).toBe(false)
    expect(result.linkedBy).toBeNull()

    const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    // isPrimary 参数位为 $7，应传 false
    expect(call[1][6]).toBe(false)
    // linkedBy 参数位为 $8，应传 null
    expect(call[1][7]).toBeNull()
  })

  it('调用时 SQL 包含 ON CONFLICT DO UPDATE', async () => {
    const db = makeDb()
    await upsertVideoExternalRef(db, {
      videoId: 'v', provider: 'douban', externalId: 'e', matchStatus: 'rejected',
    })
    const sql = (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain('DO UPDATE SET')
    expect(sql).toContain('RETURNING')
  })
})

// ── findPrimaryVideoExternalRef ────────────────────────────────────

describe('findPrimaryVideoExternalRef', () => {
  beforeEach(() => vi.clearAllMocks())

  it('有 primary 记录时正确返回', async () => {
    const db = makeDb()
    const result = await findPrimaryVideoExternalRef(db, 'vid-uuid-1', 'douban')

    expect(result).not.toBeNull()
    expect(result!.externalId).toBe('12345678')
    expect(result!.isPrimary).toBe(true)
  })

  it('无记录时返回 null', async () => {
    const db = makeDb([])
    const result = await findPrimaryVideoExternalRef(db, 'vid-no-ref', 'douban')
    expect(result).toBeNull()
  })

  it('查询 SQL 包含 is_primary = true 过滤', async () => {
    const db = makeDb([])
    await findPrimaryVideoExternalRef(db, 'vid-1', 'tmdb')
    const sql = (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sql).toContain('is_primary = true')
  })

  it('传入的 videoId 和 provider 正确绑定到查询参数', async () => {
    const db = makeDb([])
    await findPrimaryVideoExternalRef(db, 'my-vid', 'bangumi')
    const params = (db.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[]
    expect(params[0]).toBe('my-vid')
    expect(params[1]).toBe('bangumi')
  })
})
