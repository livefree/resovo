/**
 * content-sort.test.ts — CHG-258
 * listSubmissions + listAdminSubtitles 服务端排序参数测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listSubmissions } from '@/api/db/queries/sources'
import { listAdminSubtitles } from '@/api/db/queries/subtitles'

describe('listSubmissions — server-side sort (CHG-258)', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ rows: [], rowCount: 0 })
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] })
  })

  it('uses default created_at DESC when no sortField given', async () => {
    await listSubmissions(db, 1, 20)
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.created_at DESC')
  })

  it('uses valid sortField when whitelisted', async () => {
    await listSubmissions(db, 1, 20, 'source_url', 'asc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.source_url ASC')
  })

  it('maps video sortField to v.title', async () => {
    await listSubmissions(db, 1, 20, 'video', 'desc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('v.title DESC')
  })

  it('falls back to created_at DESC for invalid sortField', async () => {
    await listSubmissions(db, 1, 20, 'invalid_column', 'asc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.created_at DESC')
    expect(sql).not.toContain('invalid_column')
  })

  it('maps submitted_by to u.username', async () => {
    await listSubmissions(db, 1, 20, 'submitted_by', 'asc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('u.username ASC')
  })
})

describe('listAdminSubtitles — server-side sort (CHG-258)', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] })
  })

  it('uses default created_at DESC when no sortField given', async () => {
    await listAdminSubtitles(db, 1, 20)
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.created_at DESC')
  })

  it('uses valid sortField when whitelisted', async () => {
    await listAdminSubtitles(db, 1, 20, 'language', 'asc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.language ASC')
  })

  it('maps video sortField to v.title', async () => {
    await listAdminSubtitles(db, 1, 20, 'video', 'desc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('v.title DESC')
  })

  it('falls back to created_at DESC for invalid sortField', async () => {
    await listAdminSubtitles(db, 1, 20, 'DROP TABLE', 'asc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.created_at DESC')
    expect(sql).not.toContain('DROP TABLE')
  })

  it('maps format sortField correctly', async () => {
    await listAdminSubtitles(db, 1, 20, 'format', 'desc')
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('s.format DESC')
  })
})
