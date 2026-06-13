/**
 * admin-video-merges.test.ts — /admin/video-merges/* 端点 SQL 真实执行集成测试
 * （CHG-SN-6-INTEGRATION-TEST / RETRO 2/7）
 *
 * 防 CHG-SN-5-13-PATCH-2 类 title_normalized / year 等 schema 偏离。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

import {
  fetchVideoDetailsForCandidates,
} from '../../../apps/api/src/db/queries/video-merge-candidates'
import {
  fetchVideosByIds,
  fetchSourcesByVideoId,
  fetchSourcesByVideoIds,
  listAuditTimeline,
  countAuditTimeline,
} from '../../../apps/api/src/db/queries/video-merge-mutations'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('video-merge-candidates SQL 集成（CHG-VIR-18：legacy 聚合 query 退役，仅 detail 回查保留）', () => {
  it('fetchVideoDetailsForCandidates([nonexistent uuid]) 返回空数组', async () => {
    const rows = await fetchVideoDetailsForCandidates(db, ['00000000-0000-0000-0000-000000000000'])
    expect(rows).toEqual([])
  })
})

describe('video-merge-mutations SQL 集成', () => {
  it('fetchVideosByIds(nonexistent) JOIN media_catalog 跑通（验证 mc.* 15 列）', async () => {
    const rows = await fetchVideosByIds(db, ['00000000-0000-0000-0000-000000000000'])
    expect(rows).toEqual([])
  })

  it('fetchSourcesByVideoId(nonexistent) 跑通', async () => {
    const rows = await fetchSourcesByVideoId(db, '00000000-0000-0000-0000-000000000000')
    expect(rows).toEqual([])
  })

  it('fetchSourcesByVideoIds([]) 空数组短路返回', async () => {
    const rows = await fetchSourcesByVideoIds(db, [])
    expect(rows).toEqual([])
  })

  it('去重/残余预检 SQL 跑通（CHG-MERGE-DEDUP-EP D-105-13 / Y-105-D3：nonexistent uuids 零命中）', async () => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const { dedupeSourcesForMerge, detectResidualTargetConflicts } =
        await import('../../../apps/api/src/db/queries/video-merge-mutations')
      const deduped = await dedupeSourcesForMerge(
        client,
        ['00000000-0000-0000-0000-000000000000'],
        '00000000-0000-0000-0000-000000000001',
      )
      expect(deduped).toEqual([])
      const residual = await detectResidualTargetConflicts(
        client,
        ['00000000-0000-0000-0000-000000000000'],
        '00000000-0000-0000-0000-000000000001',
      )
      expect(residual).toBe(0)
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})

describe('GET /admin/video-merges/audit SQL 集成（CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7）', () => {
  it('listAuditTimeline 无过滤跑通（LEFT JOIN users 取 username）', async () => {
    const rows = await listAuditTimeline(db, { action: null, videoId: null, offset: 0, limit: 20 })
    expect(rows).toBeInstanceOf(Array)
  })

  it('listAuditTimeline action=merge 过滤跑通', async () => {
    const rows = await listAuditTimeline(db, { action: 'merge', videoId: null, offset: 0, limit: 20 })
    expect(rows).toBeInstanceOf(Array)
  })

  it('listAuditTimeline videoId 过滤跑通（GIN 索引 source_video_ids/target_video_ids ANY）', async () => {
    const rows = await listAuditTimeline(db, {
      action: null,
      videoId: '00000000-0000-0000-0000-000000000000',
      offset: 0,
      limit: 20,
    })
    expect(rows).toEqual([])
  })

  it('countAuditTimeline 同过滤跑通', async () => {
    const total = await countAuditTimeline(db, { action: null, videoId: null })
    expect(total).toBeGreaterThanOrEqual(0)
  })
})
