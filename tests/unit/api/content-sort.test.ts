/**
 * content-sort.test.ts — CHG-258
 * listSubmissions + listAdminSubtitles + listAdminSources 服务端排序参数测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminSources, listSubmissions } from '@/api/db/queries/sources'
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

describe('listAdminSources — filters and server-side sort (CHG-290)', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] })
  })

  it('uses default created_at DESC when no sortField provided', async () => {
    await listAdminSources(db, { active: 'all', page: 1, limit: 20 })
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('ORDER BY s.created_at DESC, s.created_at DESC')
  })

  it('supports keyword + title + siteKey filters', async () => {
    await listAdminSources(db, {
      active: 'all',
      keyword: 'm3u8',
      title: 'Test',
      siteKey: 'site-a',
      page: 1,
      limit: 20,
    })

    const sql: string = query.mock.calls[0][0]
    const params: unknown[] = query.mock.calls[0][1]
    expect(sql).toContain('s.source_url ILIKE')
    expect(sql).toContain('v.title ILIKE')
    expect(sql).toContain('v.site_key =')
    expect(params).toContain('%m3u8%')
    expect(params).toContain('%Test%')
    expect(params).toContain('site-a')
  })

  it('supports sorting by video_title ASC', async () => {
    await listAdminSources(db, {
      active: 'all',
      sortField: 'video_title',
      sortDir: 'asc',
      page: 1,
      limit: 20,
    })
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('ORDER BY v.title ASC')
  })

  it('supports sorting by last_checked DESC NULLS LAST', async () => {
    await listAdminSources(db, {
      active: 'all',
      sortField: 'last_checked',
      sortDir: 'desc',
      page: 1,
      limit: 20,
    })
    const sql: string = query.mock.calls[0][0]
    expect(sql).toContain('ORDER BY s.last_checked DESC NULLS LAST')
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
