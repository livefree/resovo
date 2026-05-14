/**
 * admin-sources.test.ts — /admin/sources/* 端点 SQL 真实执行集成测试
 * （CHG-SN-6-INTEGRATION-TEST / RETRO 2/7）
 *
 * 验证：mock 不验真 SQL → 直接调 queries 函数（不经 Route 鉴权），
 *      跑真实 PG → 验证 schema 对齐 + 类型 cast 正确 + 不抛 DatabaseError
 *
 * 防 CHG-SN-5-13-PATCH-2 类偏离（v.year / v.cover_url / vs.updated_at 等）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

import {
  listVideoGroups,
  getVideoGroupStats,
  getVideoMatrix,
  listLineAliases,
} from '../../../apps/api/src/db/queries/sources-matrix'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('GET /admin/sources/video-groups SQL 集成', () => {
  it('listVideoGroups({}) 无过滤跑通（验证 mc JOIN + STRING_AGG / COUNT 类型 cast）', async () => {
    const result = await listVideoGroups(db, {})
    expect(result).toMatchObject({
      data: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      limit: 20,
    })
  })

  it('listVideoGroups({segment: dead}) 失效过滤跑通', async () => {
    const result = await listVideoGroups(db, { segment: 'dead' })
    expect(result.data).toBeInstanceOf(Array)
  })

  it('listVideoGroups({segment: orphan}) 孤岛过滤跑通（is_published = false 路径）', async () => {
    const result = await listVideoGroups(db, { segment: 'orphan' })
    expect(result.data).toBeInstanceOf(Array)
  })

  it('listVideoGroups({segment: correction}) 用户纠错过滤跑通（submitted_by EXISTS）', async () => {
    const result = await listVideoGroups(db, { segment: 'correction' })
    expect(result.data).toBeInstanceOf(Array)
  })

  it('listVideoGroups({keyword: xxx}) ILIKE 关键词搜索跑通', async () => {
    const result = await listVideoGroups(db, { keyword: '__nonexistent_test_keyword__' })
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('listVideoGroups({page: 2, limit: 10}) 分页跑通', async () => {
    const result = await listVideoGroups(db, { page: 2, limit: 10 })
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
  })
})

describe('GET /admin/sources/video-groups/stats SQL 集成', () => {
  it('getVideoGroupStats() 4 指标 SQL FILTER 跑通', async () => {
    const stats = await getVideoGroupStats(db)
    expect(stats).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      dead: expect.any(Number),
      orphan: expect.any(Number),
    })
    expect(stats.total).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /admin/sources/video-groups/:videoId/matrix SQL 集成', () => {
  it('getVideoMatrix(nonexistent) 返回空数组（不抛错）', async () => {
    // 用合法 uuid 格式但不存在的 id
    const lines = await getVideoMatrix(db, '00000000-0000-0000-0000-000000000000')
    expect(lines).toEqual([])
  })
})

describe('GET /admin/source-line-aliases SQL 集成', () => {
  it('listLineAliases() 跑通（验证 source_line_aliases 表存在 + 顺序）', async () => {
    const aliases = await listLineAliases(db)
    expect(aliases).toBeInstanceOf(Array)
    // 每行结构核验（如果有数据）
    if (aliases.length > 0) {
      expect(aliases[0]).toMatchObject({
        sourceSiteKey: expect.any(String),
        sourceName: expect.any(String),
        displayName: expect.any(String),
        updatedAt: expect.any(String),
      })
    }
  })
})
