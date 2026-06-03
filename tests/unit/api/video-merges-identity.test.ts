/**
 * video-merges-identity.test.ts — listCandidates 集成 identity 评分回归守卫
 * （SEQ-20260602-03 / CHG-VIR-7 Phase 2a）
 *
 * 验收（Y-105a-1 / D-105a-9 / D-105a-15）：（CHG-VIR-9-D 默认翻 identity 后显式 source:'legacy'，本文件测 legacy 聚合路径）
 *  - 每组附加 identity 字段；候选数量/默认排序与旧逻辑逐值一致（仅新增字段）。
 *  - legacyScore（score）与 identityScore 字段分离（R3 / D-105a-6）。
 *  - 组内 release_marker 冲突 → identity.autoMergeBlocked + strongNegativeReasons 含 release_marker_mismatch。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoMergesService } from '@/api/services/VideoMergesService'

const mockQuery = vi.fn()
const mockDb = { query: mockQuery } as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
})

function groupRow(titleNormalized: string, year: number, type: string, videoIds: string[]) {
  return { title_normalized: titleNormalized, year, type, video_ids: videoIds, video_count: String(videoIds.length) }
}

function videoRow(
  id: string,
  title: string,
  type: string,
  year: number,
  siteKeys: string[],
  sourceCount = 2,
) {
  return {
    id,
    title,
    title_normalized: 'x',
    year,
    type,
    created_at: '2026-01-01T00:00:00Z',
    source_count: String(sourceCount),
    site_keys: siteKeys,
  }
}

/** mock listCandidates 三次 db.query：fetchRawCandidateGroups → count → fetchVideoDetails */
function mockListCandidates(groups: ReturnType<typeof groupRow>[], total: number, videos: ReturnType<typeof videoRow>[]) {
  mockQuery
    .mockResolvedValueOnce({ rows: groups }) // fetchRawCandidateGroups
    .mockResolvedValueOnce({ rows: [{ total: String(total) }] }) // countRawCandidateGroups
    .mockResolvedValueOnce({ rows: videos }) // fetchVideoDetailsForCandidates
}

describe('VideoMergesService.listCandidates — CHG-VIR-7 identity 附加', () => {
  it('每组附加 identity 字段（identityScore/evidence/blockingReasons/strongNegativeReasons）', async () => {
    mockListCandidates(
      [groupRow('复仇者联盟', 2019, 'movie', ['a', 'b'])],
      1,
      [
        videoRow('a', '复仇者联盟', 'movie', 2019, ['s1', 's2']),
        videoRow('b', '复仇者联盟', 'movie', 2019, ['s1', 's2']),
      ],
    )
    const svc = new VideoMergesService(mockDb)
    const res = await svc.listCandidates({ minScore: 0, limit: 20, page: 1, source: 'legacy' })

    expect(res.data).toHaveLength(1)
    const g = res.data[0]!
    expect(g.identity).toBeDefined()
    expect(typeof g.identity!.identityScore).toBe('number')
    expect(g.identity!.pairs).toHaveLength(1) // C(2,2)=1
    expect(Array.isArray(g.identity!.strongNegativeReasons)).toBe(true)
    expect(Array.isArray(g.identity!.blockingReasons)).toBe(true)
  })

  it('legacyScore（score）与 identityScore 字段分离（R3）', async () => {
    mockListCandidates(
      [groupRow('复仇者联盟', 2019, 'movie', ['a', 'b'])],
      1,
      [
        videoRow('a', '复仇者联盟', 'movie', 2019, ['s1', 's2']),
        videoRow('b', '复仇者联盟', 'movie', 2019, ['s1', 's2']),
      ],
    )
    const svc = new VideoMergesService(mockDb)
    const res = await svc.listCandidates({ minScore: 0, limit: 20, page: 1, source: 'legacy' })
    const g = res.data[0]!
    // 两个独立字段并存（source_overlap=1.0 全共享 vs identity 多证据评分），可不等
    expect(g.score).toBeCloseTo(1.0, 4) // 2 video 全共享 s1/s2 → overlap 1.0
    expect(g.identity!.identityScore).not.toBe(g.score)
  })

  it('组内 release_marker 冲突（剧场版 vs OVA）→ autoMergeBlocked + release_marker_mismatch', async () => {
    mockListCandidates(
      [groupRow('某动画', 2020, 'anime', ['c', 'd'])],
      1,
      [
        videoRow('c', '某动画 剧场版', 'anime', 2020, ['s3']),
        videoRow('d', '某动画 OVA', 'anime', 2020, ['s4']),
      ],
    )
    const svc = new VideoMergesService(mockDb)
    const res = await svc.listCandidates({ minScore: 0, limit: 20, page: 1, source: 'legacy' })
    const g = res.data[0]!
    expect(g.identity!.autoMergeBlocked).toBe(true)
    expect(g.identity!.strongNegativeReasons).toContain('release_marker_mismatch')
  })

  it('候选数量不变 + 默认排序 score DESC（identity 不影响来源/排序 / Y-105a-1）', async () => {
    mockListCandidates(
      [
        groupRow('低重合', 2019, 'movie', ['a', 'b']),
        groupRow('高重合', 2020, 'anime', ['c', 'd']),
      ],
      2,
      [
        videoRow('a', '低重合', 'movie', 2019, ['s1']),
        videoRow('b', '低重合', 'movie', 2019, ['s2']), // 无共享 → legacyScore 0
        videoRow('c', '高重合', 'anime', 2020, ['s3', 's4']),
        videoRow('d', '高重合', 'anime', 2020, ['s3', 's4']), // 全共享 → legacyScore 1.0
      ],
    )
    const svc = new VideoMergesService(mockDb)
    const res = await svc.listCandidates({ minScore: 0, limit: 20, page: 1, source: 'legacy' })
    expect(res.data).toHaveLength(2) // 数量不变
    // 默认 score DESC：高重合（1.0）在前，低重合（0）在后
    expect(res.data[0]!.titleNormalized).toBe('高重合')
    expect(res.data[1]!.titleNormalized).toBe('低重合')
  })
})
