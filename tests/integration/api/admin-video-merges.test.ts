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
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
} from '../../../apps/api/src/db/queries/video-merge-candidates'
import {
  fetchVideosByIds,
  fetchSourcesByVideoId,
  fetchSourcesByVideoIds,
  detectMergeConflicts,
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

describe('video-merge-candidates SQL 集成', () => {
  it('fetchRawCandidateGroups({type: null}) JOIN media_catalog 跑通', async () => {
    const rows = await fetchRawCandidateGroups(db, { type: null, offset: 0, limit: 20 })
    expect(rows).toBeInstanceOf(Array)
  })

  it('fetchRawCandidateGroups({type: movie}) type 过滤跑通', async () => {
    const rows = await fetchRawCandidateGroups(db, { type: 'movie', offset: 0, limit: 20 })
    expect(rows).toBeInstanceOf(Array)
  })

  it('countRawCandidateGroups 子查询跑通（mc.title_normalized GROUP BY）', async () => {
    const count = await countRawCandidateGroups(db, { type: null })
    expect(count).toBeGreaterThanOrEqual(0)
  })

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

  it('detectMergeConflicts([nonexistent uuids]) 自连接 SQL 跑通（CHG-SN-5-10-PATCH P0-2 源 vs 源探测）', async () => {
    const conflicts = await detectMergeConflicts(db, [
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    ])
    expect(conflicts).toBe(0)
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
