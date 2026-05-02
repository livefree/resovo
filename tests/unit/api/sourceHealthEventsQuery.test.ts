/**
 * tests/unit/api/sourceHealthEventsQuery.test.ts
 * CHG-SN-4-05: sourceHealthEvents query — listLineHealthEvents / insertHealthEvent
 */

import { describe, it, expect, vi } from 'vitest'
import { listLineHealthEvents, insertHealthEvent } from '@/api/db/queries/sourceHealthEvents'

describe('listLineHealthEvents', () => {
  it('返回分页数据和 total', async () => {
    const rows = [{ id: 'ev-1', source_id: 'src-1', origin: 'feedback_driven', created_at: '2026-05-02T00:00:00Z' }]
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    } as unknown as import('pg').Pool
    const result = await listLineHealthEvents(db, { sourceId: 'src-1' })
    expect(result.rows).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('分页参数正确传递', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    } as unknown as import('pg').Pool
    await listLineHealthEvents(db, { sourceId: 's1', page: 2, limit: 10 })
    const mainCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(mainCall[1]).toContain(10)  // limit
    expect(mainCall[1]).toContain(10)  // offset = (2-1)*10 = 10
  })
})

describe('insertHealthEvent', () => {
  it('插入健康事件并返回 id', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'ev-new' }] }),
    } as unknown as import('pg').Pool
    const id = await insertHealthEvent(db, {
      videoId: 'vid-1',
      sourceId: 'src-1',
      origin: 'feedback_driven',
      processedAt: null,
    })
    expect(id).toBe('ev-new')
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO source_health_events'),
      expect.arrayContaining(['vid-1', 'src-1', 'feedback_driven']),
    )
  })
})
