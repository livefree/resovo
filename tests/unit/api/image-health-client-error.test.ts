/**
 * image-health-client-error.test.ts — markCatalogClientError 的信号列写入 SQL
 * （ADR-213 D-213-6：beacon 置 <kind>_client_error_at=NOW()，带 URL 同源守卫 + 列名白名单）
 *
 * 真函数 + mock db.query，断言生成的 SQL 与参数化（route 单测里查询被整体 mock，无法覆盖此 SQL）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { markCatalogClientError } from '@/api/db/queries/imageHealth'

function mockDb(rowCount = 1): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rowCount, rows: [] })
  return { db: { query } as unknown as Pool, query }
}

describe('markCatalogClientError — 信号列写入 SQL（ADR-213 D-213-6）', () => {
  it('poster → 写 poster_client_error_at + URL 守卫用历史列名 cover_url', async () => {
    const { db, query } = mockDb()
    await markCatalogClientError(db, {
      videoId: 'vid-1',
      kind: 'poster',
      url: 'https://cdn.example.com/p.jpg',
    })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('SET poster_client_error_at = NOW()')
    expect(sql).toContain('mc.cover_url = $2') // poster URL 列历史名
    expect(sql).toContain('FROM videos v')
    expect(sql).toContain('mc.id = v.catalog_id') // per-catalog fanout
    expect(params).toEqual(['vid-1', 'https://cdn.example.com/p.jpg'])
  })

  it('backdrop / logo / banner_backdrop → 各自信号列 + <kind>_url 守卫', async () => {
    const cases = [
      { kind: 'backdrop' as const, signal: 'backdrop_client_error_at', url: 'mc.backdrop_url = $2' },
      { kind: 'logo' as const, signal: 'logo_client_error_at', url: 'mc.logo_url = $2' },
      {
        kind: 'banner_backdrop' as const,
        signal: 'banner_backdrop_client_error_at',
        url: 'mc.banner_backdrop_url = $2',
      },
    ]
    for (const c of cases) {
      const { db, query } = mockDb()
      await markCatalogClientError(db, { videoId: 'v', kind: c.kind, url: 'u' })
      const [sql] = query.mock.calls[0]
      expect(sql).toContain(`SET ${c.signal} = NOW()`)
      expect(sql).toContain(c.url)
    }
  })

  it('URL 不匹配 / video 不存在 → rowCount 0 原样返回（调用方据此判定未命中）', async () => {
    const { db } = mockDb(0)
    const affected = await markCatalogClientError(db, { videoId: 'v', kind: 'poster', url: 'u' })
    expect(affected).toBe(0)
  })

  it('rowCount 为 null（驱动未提供）→ 归一化为 0，不抛', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: null, rows: [] })
    const db = { query } as unknown as Pool
    const affected = await markCatalogClientError(db, { videoId: 'v', kind: 'poster', url: 'u' })
    expect(affected).toBe(0)
  })
})
