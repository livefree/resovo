/**
 * identity-source-switch.test.ts — 候选来源切换 + 空表自动降级（CHG-VIR-9-A / Phase 2c）
 *
 * ModerationService.listSimilar（默认 identity / 空降级 legacy）+
 * VideoMergesService.listCandidates（默认 identity / CHG-VIR-9-D 翻转 / 折叠 / 空降级）。
 *
 * ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE / 评审 R-2 登记改写）：
 * identity 路径换轨有界全量轻列折叠管线（listPendingCandidatePairsLight + listPendingPairsByIds），
 * total 语义 pending pair 数 → 过滤后组数；组级筛选/排序/搜索 + truncated 闭包补全用例。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/moderation', () => ({
  findVideoFeatures: vi.fn(),
  listSimilarCandidates: vi.fn(),
}))
vi.mock('@/api/db/queries/identity-candidate', () => ({
  listPendingCandidatesByVideoId: vi.fn(),
  // D-105a-19：轻列折叠管线（listPendingCandidatePairs/count 在列表路径退役）
  listPendingCandidatePairsLight: vi.fn(),
  listPendingPairsLightByVideoIds: vi.fn(),
  listPendingPairsByIds: vi.fn(),
}))
vi.mock('@/api/db/queries/video-merge-candidates', () => ({
  fetchRawCandidateGroups: vi.fn(),
  countRawCandidateGroups: vi.fn(),
  fetchVideoDetailsForCandidates: vi.fn(),
  fetchVideoMetaLight: vi.fn(),
}))

import { ModerationService } from '@/api/services/ModerationService'
import { VideoMergesService, MAX_COLLAPSE_PAIRS } from '@/api/services/VideoMergesService'
import { findVideoFeatures, listSimilarCandidates } from '@/api/db/queries/moderation'
import {
  listPendingCandidatesByVideoId,
  listPendingCandidatePairsLight,
  listPendingPairsLightByVideoIds,
  listPendingPairsByIds,
} from '@/api/db/queries/identity-candidate'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
  fetchVideoMetaLight,
} from '@/api/db/queries/video-merge-candidates'

const mockDb = {} as import('pg').Pool
const mockEs = {} as import('@elastic/elasticsearch').Client

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findVideoFeatures).mockResolvedValue({
    id: 'v1', type: 'anime', year: 2020, country: 'JP', genres: ['action'],
  } as never)
})

function neighborRow() {
  return {
    candidate_id: 'c1', neighbor_video_id: 'v2', title: '某动画', type: 'anime',
    year: 2020, country: 'JP', genres: ['action'], cover_url: null, meta_score: 50,
    review_status: 'approved', is_published: true, identity_score: '0.9000',
    strong_negative_reasons: [], evidence_jsonb: [], status: 'pending',
  }
}

describe('ModerationService.listSimilar — source 切换', () => {
  const svc = () => new ModerationService(mockDb, mockEs)

  it('source=identity 有候选 → identity 来源 + candidateId/identityScore', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([neighborRow()] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.items[0]!.candidateId).toBe('c1')
    expect(r.items[0]!.identityScore).toBe(0.9)
    expect(r.items[0]!.similarityScore).toBe(90) // round(0.9*100) 保旧前端不空
    expect(listSimilarCandidates).not.toHaveBeenCalled()
  })

  it('source=identity 空候选 → 自动降级 legacy', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([] as never)
    vi.mocked(listSimilarCandidates).mockResolvedValue([] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'identity' })
    expect(r.source).toBe('legacy')
    expect(listSimilarCandidates).toHaveBeenCalled()
  })

  it('source=legacy → 直接 legacy（不查 identity_candidate）', async () => {
    vi.mocked(listSimilarCandidates).mockResolvedValue([] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5, source: 'legacy' })
    expect(r.source).toBe('legacy')
    expect(listPendingCandidatesByVideoId).not.toHaveBeenCalled()
  })

  it('默认（无 source）→ identity', async () => {
    vi.mocked(listPendingCandidatesByVideoId).mockResolvedValue([neighborRow()] as never)
    const r = await svc().listSimilar('v1', { limit: 10, yearRange: 5 })
    expect(r.source).toBe('identity')
  })
})

// ── VideoMergesService.listCandidates（D-105a-19 轻列折叠管线） ──────────────

/** 轻列行（stage 1/closure 用） */
function lightRow(id: string, left: string, right: string, score = '0.9000', key?: string) {
  return {
    id, left_video_id: left, right_video_id: right,
    identity_score: score, canonical_pair_key: key ?? `${left}|${right}`,
  }
}
/** 完整行（stage 5 回查用） */
function fullRow(id: string, left: string, right: string, score = '0.9000') {
  return {
    id, left_video_id: left, right_video_id: right, identity_score: score,
    legacy_score: null, strong_negative_reasons: [], evidence_jsonb: [], group_key: null,
  }
}
function detailRow(id: string, title?: string) {
  return {
    id, title: title ?? `V${id}`, title_normalized: (title ?? `v${id}`).toLowerCase(), year: 2020, type: 'anime',
    created_at: '2026-01-01T00:00:00Z', source_count: '2', site_keys: [],
  }
}
function metaRow(id: string, title: string, titleNormalized: string) {
  return { id, title, title_normalized: titleNormalized, year: 2020 }
}

describe('VideoMergesService.listCandidates — source 切换 + D-105a-19 组级检索', () => {
  const svc = () => new VideoMergesService(mockDb)

  /** 缺省：byIds 回显与轻列行同构的完整行（多数用例轻列/完整一一对应） */
  function wireFullRowsFromLight(light: ReturnType<typeof lightRow>[]) {
    vi.mocked(listPendingPairsByIds).mockImplementation(async (_db: import('pg').Pool, ids: readonly string[]) =>
      light
        .filter((p) => ids.includes(p.id))
        .map((p) => fullRow(p.id, p.left_video_id, p.right_video_id, p.identity_score)) as never)
  }

  it('source=identity 有 pairs → 折叠 group + source identity + total=组数（D-105a-19 语义）', async () => {
    const light = [lightRow('c1', 'a', 'b', '0.9000')]
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(light as never)
    wireFullRowsFromLight(light)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([detailRow('a', 'X'), detailRow('b', 'X')] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.data).toHaveLength(1)
    expect(r.total).toBe(1) // 组数（曾为 pending pair 全量 count）
    expect(r.truncated).toBeUndefined() // 非截断态不填
    expect(r.data[0]!.videos).toHaveLength(2)
    expect(r.data[0]!.identity!.identityScore).toBe(0.9)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
    expect(fetchVideoMetaLight).not.toHaveBeenCalled() // 无 q / title·year 排序不拉 meta
  })

  it('source=identity 真空表（轻列空）→ 降级 legacy', async () => {
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue([] as never)
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.source).toBe('legacy')
    expect(fetchRawCandidateGroups).toHaveBeenCalled()
  })

  it('source=identity total>0 但本页空（offset 超尾）→ 空 data 保持 identity 不悄降 legacy（FIX-2）', async () => {
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue([lightRow('c1', 'a', 'b')] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 99, source: 'identity' })
    expect(r.source).toBe('identity')
    expect(r.data).toHaveLength(0)
    expect(r.total).toBe(1)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
    expect(listPendingPairsByIds).not.toHaveBeenCalled() // 页空短路零回查
  })

  it('默认（无 source）→ identity（CHG-VIR-9-D 翻转；空表仍降级 legacy）', async () => {
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue([] as never)
    vi.mocked(fetchRawCandidateGroups).mockResolvedValue([] as never)
    vi.mocked(countRawCandidateGroups).mockResolvedValue(0 as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1 })
    // 默认先查 identity_candidate（翻转生效），真空表自动降级 legacy 回显
    expect(listPendingCandidatePairsLight).toHaveBeenCalled()
    expect(r.source).toBe('legacy')
  })

  // ── CHG-VIR-9-D / D-105a-18 → 19：connected components 折叠（全量） ────────

  it('N-video 连通分量折叠：3 pair 同分量 → 1 行 group（C(N,2) 重复消除）+ candidateIds 全锚点', async () => {
    const light = [
      lightRow('c1', 'a', 'b', '0.9500'),
      lightRow('c2', 'b', 'c', '0.9000'),
      lightRow('c3', 'a', 'c', '0.8500'),
    ]
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(light as never)
    wireFullRowsFromLight(light)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('a'), detailRow('b'), detailRow('c'),
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.data).toHaveLength(1)
    expect(r.total).toBe(1)
    const g = r.data[0]!
    expect(g.groupKey).toBe('a|b|c') // 成员升序 join，幂等稳定
    expect(g.videos.map((v) => v.id).sort()).toEqual(['a', 'b', 'c'])
    expect(g.candidateIds).toEqual(['c1', 'c2', 'c3'])
    expect(g.candidateId).toBeUndefined() // 多 pair 不填单数锚点
    // group 聚合 = min over pairs（D-105a-15 保守口径）+ 逐 pair candidateId 锚点
    expect(g.identity!.identityScore).toBe(0.85)
    expect(g.identity!.pairs).toHaveLength(3)
    expect(g.identity!.pairs.map((p) => p.candidateId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('多分量混合：缺省排序 identityScore（=min over pairs）DESC——评审 Y-3 最弱链接主导组序', async () => {
    const light = [
      lightRow('c1', 'a', 'b', '0.9500'),
      lightRow('c4', 'x', 'y', '0.9200'),
      lightRow('c2', 'b', 'c', '0.9000'),
    ]
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(light as never)
    wireFullRowsFromLight(light)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('a'), detailRow('b'), detailRow('c'), detailRow('x'), detailRow('y'),
    ] as never)
    const r = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity' })
    expect(r.data).toHaveLength(2)
    expect(r.total).toBe(2)
    // {a,b,c} min=0.90 / {x,y} min=0.92 → x|y 在前（非折叠前「最高分 pair 首现序」）
    expect(r.data[0]!.groupKey).toBe('x|y')
    expect(r.data[1]!.groupKey).toBe('a|b|c')
    // N=2 单 pair：candidateId 单数保留（9-C 兼容）
    expect(r.data[0]!.candidateId).toBe('c4')
    expect(r.data[0]!.candidateIds).toEqual(['c4'])
  })

  // ── D-105a-19：组级排序/筛选/搜索 ─────────────────────────────────────

  function threeClusters() {
    // {a,b,c}（min 0.90 / N=3）、{x,y}（0.92 / N=2）、{m,n}（0.60 / N=2）
    return [
      lightRow('c1', 'a', 'b', '0.9500'),
      lightRow('c4', 'x', 'y', '0.9200'),
      lightRow('c2', 'b', 'c', '0.9000'),
      lightRow('c5', 'm', 'n', '0.6000'),
    ]
  }
  function wireThreeClusters() {
    const light = threeClusters()
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(light as never)
    wireFullRowsFromLight(light)
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('a'), detailRow('b'), detailRow('c'),
      detailRow('x'), detailRow('y'), detailRow('m'), detailRow('n'),
    ] as never)
  }

  it('sortField=identityScore asc → 组级升序（tiebreaker clusterKey）', async () => {
    wireThreeClusters()
    const r = await svc().listCandidates({
      minScore: 0, limit: 20, page: 1, source: 'identity', sortField: 'identityScore', sortDir: 'asc',
    })
    expect(r.data.map((g) => g.groupKey)).toEqual(['m|n', 'a|b|c', 'x|y'])
  })

  it('sortField=videoCount desc → 大组优先', async () => {
    wireThreeClusters()
    const r = await svc().listCandidates({
      minScore: 0, limit: 20, page: 1, source: 'identity', sortField: 'videoCount', sortDir: 'desc',
    })
    expect(r.data[0]!.groupKey).toBe('a|b|c')
  })

  it('identityScoreMin/Max 区间筛选 → 组分（min over pairs）口径 + total=过滤后组数', async () => {
    wireThreeClusters()
    const r = await svc().listCandidates({
      minScore: 0, limit: 20, page: 1, source: 'identity', identityScoreMin: 0.85, identityScoreMax: 0.91,
    })
    // 仅 {a,b,c}（0.90）命中；{x,y} 0.92 超上限、{m,n} 0.60 低于下限
    expect(r.data.map((g) => g.groupKey)).toEqual(['a|b|c'])
    expect(r.total).toBe(1)
  })

  it('videoCountMin=3 筛选 → 仅 N≥3 分量', async () => {
    wireThreeClusters()
    const r = await svc().listCandidates({
      minScore: 0, limit: 20, page: 1, source: 'identity', videoCountMin: 3,
    })
    expect(r.data.map((g) => g.groupKey)).toEqual(['a|b|c'])
    expect(r.total).toBe(1)
  })

  it('q 搜索：任一成员标题命中（meta 轻查询激活）；无命中 → 空 data 保持 identity 不降级', async () => {
    wireThreeClusters()
    vi.mocked(fetchVideoMetaLight).mockResolvedValue([
      metaRow('a', '星辰变 第一季', '星辰变第一季'), metaRow('b', '星辰变', '星辰变'), metaRow('c', '星辰变 S1', '星辰变s1'),
      metaRow('x', '斗破苍穹', '斗破苍穹'), metaRow('y', '斗破苍穹 年番', '斗破苍穹年番'),
      metaRow('m', '完美世界', '完美世界'), metaRow('n', '完美世界 2', '完美世界2'),
    ] as never)
    const hit = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity', q: '斗破' })
    expect(fetchVideoMetaLight).toHaveBeenCalled()
    expect(hit.data.map((g) => g.groupKey)).toEqual(['x|y'])
    expect(hit.total).toBe(1)

    const miss = await svc().listCandidates({ minScore: 0, limit: 20, page: 1, source: 'identity', q: '不存在标题' })
    expect(miss.source).toBe('identity') // 筛选空不降级（D-105a-19 降级判定收窄）
    expect(miss.data).toHaveLength(0)
    expect(miss.total).toBe(0)
    expect(fetchRawCandidateGroups).not.toHaveBeenCalled()
  })

  // ── D-105a-19：cap 截断 + 闭包补全（评审红线 R-1 方案 b） ──────────────

  it('pending > cap → truncated:true + 闭包补全保展示分量完整（videoCount 可信 + candidateIds 不漏）', async () => {
    // cap+1 行轻列（互不连通 pair）：探测截断
    const probe = Array.from({ length: MAX_COLLAPSE_PAIRS + 1 }, (_, i) =>
      lightRow(`c${i}`, `v${2 * i}`, `v${2 * i + 1}`, '0.9000', `k${String(i).padStart(5, '0')}`))
    vi.mocked(listPendingCandidatePairsLight).mockResolvedValue(probe as never)
    // 闭包补全：界外桥接 pair cb 把界内 v0 连到新成员 vz（首轮 fresh、次轮幂等空增）
    const bridge = lightRow('cb', 'v0', 'vz', '0.8000', 'kbridge')
    vi.mocked(listPendingPairsLightByVideoIds).mockResolvedValue([bridge] as never)
    wireFullRowsFromLight([...probe, bridge])
    vi.mocked(fetchVideoDetailsForCandidates).mockResolvedValue([
      detailRow('v0'), detailRow('v1'), detailRow('vz'),
    ] as never)

    // videoCountMin=3 把补全后的 {v0,v1,vz} 分量单独过滤出来
    const r = await svc().listCandidates({
      minScore: 0, limit: 20, page: 1, source: 'identity', videoCountMin: 3,
    })
    expect(r.truncated).toBe(true)
    expect(listPendingPairsLightByVideoIds).toHaveBeenCalled()
    expect(r.data).toHaveLength(1)
    const g = r.data[0]!
    expect(g.groupKey).toBe('v0|v1|vz')
    expect(g.videos).toHaveLength(3) // videoCount 可信（闭包补全后）
    expect(g.candidateIds).toEqual(['c0', 'cb']) // confirm 锚点不漏桥接 pair
  })
})
