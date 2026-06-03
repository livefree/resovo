/**
 * tests/unit/api/video-merge-insert-new-video.test.ts — CHG-VIR-PRE-1 schema 漂移修复
 *
 * 回归：insertNewVideo 的 INSERT 列必须对齐 migration 029 后的 videos schema——
 * 携带 catalog_id（029 改 NOT NULL），不再引用已 DROP 的 year / title_normalized。
 */

import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'
import { insertNewVideo } from '@/api/db/queries/video-merge-mutations'

describe('insertNewVideo — CHG-VIR-PRE-1 schema 漂移修复', () => {
  it('INSERT 列含 catalog_id，不含已 DROP 的 year / title_normalized', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: 'nv-1' }] })
    const client = { query: queryMock } as unknown as PoolClient

    const id = await insertNewVideo(client, {
      shortId: 'sh-1',
      catalogId: 'cat-1',
      title: '某作品',
      type: 'anime',
    })

    expect(id).toBe('nv-1')

    const sql = queryMock.mock.calls[0]![0] as string
    expect(sql).toContain('catalog_id')
    // migration 029 已 DROP 这两列：不得再出现在 split 新建 video 的 INSERT 中
    expect(sql).not.toMatch(/\byear\b/)
    expect(sql).not.toContain('title_normalized')
  })

  it('参数顺序与列集严格对应 [shortId, catalogId, title, type]（5 列含 is_published=false 字面量）', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ id: 'nv-2' }] })
    const client = { query: queryMock } as unknown as PoolClient

    await insertNewVideo(client, {
      shortId: 'sh-2',
      catalogId: 'cat-2',
      title: 'T',
      type: 'movie',
    })

    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params).toEqual(['sh-2', 'cat-2', 'T', 'movie'])
    // 仅 4 个绑定参数（is_published 走 SQL 字面量 false，不入参）
    expect(params).toHaveLength(4)
  })
})
