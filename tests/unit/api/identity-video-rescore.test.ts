/**
 * tests/unit/api/identity-video-rescore.test.ts — BUGFIX-IDENTITY-ENRICH-RESCORE
 *
 * 覆盖外部 ID 绑定后定向重评三件：
 *  - runVideoRescore 编排：双键召回 → buildSides → scoreAndPersistPairs（triggerSource='enrichment'
 *    + pair canonical 排序）；软删/不存在输入跳过；无对侧不评分。
 *  - identityCandidateWorker job 分发：'video-rescore' → runVideoRescore / 'full-rescan' → runIdentityRescore。
 *  - enqueueIdentityVideoRescore：jobId 去抖形态 + add 失败 fire-and-forget 不抛。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type pino from 'pino'

// ── Mocks（import 被测模块之前）──────────────────────────────────

const mockRecallCore = vi.fn()
const mockRecallExt = vi.fn()
vi.mock('@/api/services/identity/blockingRecall', () => ({
  recallCoreKeyCounterparts: (...a: unknown[]) => mockRecallCore(...a),
  recallExternalIdCounterparts: (...a: unknown[]) => mockRecallExt(...a),
}))

const mockBuildSides = vi.fn()
const mockScoreAndPersist = vi.fn()
vi.mock('@/api/services/identity/pairScoringPersist', async (orig) => ({
  ...(await orig<typeof import('@/api/services/identity/pairScoringPersist')>()),
  buildSides: (...a: unknown[]) => mockBuildSides(...a),
  scoreAndPersistPairs: (...a: unknown[]) => mockScoreAndPersist(...a),
}))

import { runVideoRescore } from '@/api/services/identity/videoRescore'

const log = { info: vi.fn(), warn: vi.fn() } as unknown as pino.Logger
const db = {} as never

function side(videoId: string, exactIds: Record<string, string> = {}) {
  return {
    videoId,
    coreTitleKey: '佐贺偶像是传奇 梦想银河乐园',
    facets: {},
    year: 2025,
    type: 'anime',
    sourceSiteKeys: [],
    externalIds: { exactIds },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockScoreAndPersist.mockResolvedValue([])
  mockRecallCore.mockResolvedValue([])
  mockRecallExt.mockResolvedValue([])
})

describe('runVideoRescore', () => {
  it('双键召回对侧 → scoreAndPersistPairs（triggerSource=enrichment + canonical 排序 pair）', async () => {
    const vidB = 'c5bbe74a-0000-0000-0000-000000000002'
    const vidA = '6f2493a5-0000-0000-0000-000000000001'
    mockBuildSides
      .mockResolvedValueOnce(new Map([[vidB, side(vidB, { bangumi: '353181' })]])) // self
      .mockResolvedValueOnce(new Map([[vidB, side(vidB)], [vidA, side(vidA)]]))    // pair sides
    mockRecallCore.mockResolvedValue([vidA])
    mockRecallExt.mockResolvedValue([vidA])

    const result = await runVideoRescore(db, log, [vidB])

    // ext 桶 key 由 self exactIds 派生
    expect(mockRecallExt).toHaveBeenCalledWith(db, ['bangumi:353181'], vidB, expect.any(Number))
    // canonical 排序：6f… < c5…
    expect(mockScoreAndPersist).toHaveBeenCalledWith(
      db,
      expect.any(Map),
      [[vidA, vidB]],
      expect.objectContaining({ triggerSource: 'enrichment' }),
      expect.any(Object),
    )
    expect(result.videos).toBe(1)
    expect(result.counterparts).toBe(1)
  })

  it('软删/不存在输入（buildSides 无返回）→ 跳过不评分', async () => {
    mockBuildSides.mockResolvedValueOnce(new Map())
    const result = await runVideoRescore(db, log, ['gone-0000-0000-0000-000000000000'])
    expect(result.videos).toBe(0)
    expect(mockScoreAndPersist).not.toHaveBeenCalled()
  })

  it('无对侧 → 不调 scoreAndPersistPairs', async () => {
    const vid = 'aaaa0000-0000-0000-0000-000000000001'
    mockBuildSides.mockResolvedValueOnce(new Map([[vid, side(vid)]]))
    const result = await runVideoRescore(db, log, [vid])
    expect(result.videos).toBe(1)
    expect(result.counterparts).toBe(0)
    expect(mockScoreAndPersist).not.toHaveBeenCalled()
  })
})

// ── worker job 分发 ───────────────────────────────────────────────

describe('identityCandidateWorker job 分发', () => {
  it("type='video-rescore' → runVideoRescore / 'full-rescan' → runIdentityRescore", async () => {
    vi.resetModules()
    let handler: ((job: { data: unknown }) => Promise<unknown>) | undefined
    vi.doMock('@/api/lib/queue', () => ({
      identityCandidateQueue: {
        process: vi.fn((_c: number, h: typeof handler) => { handler = h }),
      },
    }))
    vi.doMock('@/api/lib/postgres', () => ({ db: {} }))
    const runFull = vi.fn().mockResolvedValue({ buckets: 0 })
    vi.doMock('@/api/services/identity', () => ({ runIdentityRescore: runFull }))
    const runVideo = vi.fn().mockResolvedValue({ videos: 1 })
    vi.doMock('@/api/services/identity/videoRescore', () => ({ runVideoRescore: runVideo }))
    vi.doMock('@/api/lib/logger', () => ({
      baseLogger: { child: vi.fn(() => ({ info: vi.fn() })) },
      withJob: vi.fn((l: unknown) => l),
    }))

    const { registerIdentityCandidateWorker } = await import('@/api/workers/identityCandidateWorker')
    registerIdentityCandidateWorker()
    expect(handler).toBeDefined()

    await handler!({ data: { type: 'video-rescore', videoIds: ['v1'] } })
    expect(runVideo).toHaveBeenCalledWith({}, expect.anything(), ['v1'])
    expect(runFull).not.toHaveBeenCalled()

    await handler!({ data: { type: 'full-rescan', batchSize: 10 } })
    expect(runFull).toHaveBeenCalledTimes(1)
  })
})

// ── enqueue fire-and-forget ───────────────────────────────────────

describe('enqueueIdentityVideoRescore', () => {
  it('入队 payload + jobId 去抖形态；add 失败不抛（fire-and-forget）', async () => {
    vi.resetModules()
    const add = vi.fn().mockResolvedValue({ id: 'j1' })
    vi.doMock('@/api/lib/queue', () => ({ identityCandidateQueue: { add } }))
    const warn = vi.fn()
    vi.doMock('@/api/lib/logger', () => ({ baseLogger: { warn } }))

    const { enqueueIdentityVideoRescore } = await import('@/api/services/identity/enqueueVideoRescore')
    enqueueIdentityVideoRescore('v-123')
    expect(add).toHaveBeenCalledWith(
      { type: 'video-rescore', videoIds: ['v-123'] },
      expect.objectContaining({ jobId: 'video-rescore-v-123' }),
    )

    add.mockRejectedValueOnce(new Error('redis down'))
    expect(() => enqueueIdentityVideoRescore('v-456')).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  })
})
