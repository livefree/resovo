/**
 * feedback-driven-recheck.test.ts — SRCHEALTH-P1-5（F2）定向化编排测试
 *
 * mock source-health 三模块，断言编排顺序与定向参数：
 *   level1 定向重探（loadSourcesByIds 入参）→ aggregateBatch（受影响 videoIds）→
 *   render 重置 → runLevel2Render({ sourceIds }) → 全量标 processed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type pino from 'pino'

const runLevel1ProbeMock = vi.fn()
const loadSourcesByIdsMock = vi.fn()
const runLevel2RenderMock = vi.fn()
const aggregateBatchMock = vi.fn()

vi.mock('../../../../apps/worker/src/jobs/source-health/level1-probe', () => ({
  runLevel1Probe: (...args: unknown[]) => runLevel1ProbeMock(...args),
  loadSourcesByIds: (...args: unknown[]) => loadSourcesByIdsMock(...args),
}))
vi.mock('../../../../apps/worker/src/jobs/source-health/level2-render', () => ({
  runLevel2Render: (...args: unknown[]) => runLevel2RenderMock(...args),
}))
vi.mock('../../../../apps/worker/src/jobs/source-health/aggregate-source-check-status', () => ({
  aggregateBatch: (...args: unknown[]) => aggregateBatchMock(...args),
}))

import { runFeedbackDrivenRecheck } from '../../../../apps/worker/src/jobs/feedback-driven-recheck'

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as pino.Logger

function makePool(queryImpl: (sql: string, params?: readonly unknown[]) => { rows: unknown[] }): Pool {
  return {
    query: vi.fn((sql: string, params?: readonly unknown[]) => Promise.resolve(queryImpl(sql, params))),
  } as unknown as Pool
}

const EVENTS = [
  { id: 'ev-1', source_id: 'src-1', video_id: 'vid-1', origin: 'feedback_driven' },
  { id: 'ev-2', source_id: 'src-2', video_id: 'vid-2', origin: 'feedback_driven' },
  { id: 'ev-3', source_id: 'src-1', video_id: 'vid-1', origin: 'feedback_driven' },   // 同源重复信号 → sourceIds 去重
  { id: 'ev-4', source_id: null,    video_id: 'vid-3', origin: 'feedback_driven' },   // 旧行 source_id NULL → 跳过定向
]

beforeEach(() => {
  runLevel1ProbeMock.mockReset().mockResolvedValue(undefined)
  loadSourcesByIdsMock.mockReset()
  runLevel2RenderMock.mockReset().mockResolvedValue(undefined)
  aggregateBatchMock.mockReset().mockResolvedValue(undefined)
})

describe('runFeedbackDrivenRecheck — 定向编排（SRCHEALTH-P1-5 / F2）', () => {
  it('level1 定向重探 → aggregateBatch → render 重置 → level2 定向 → 全量标 processed', async () => {
    const sqlCalls: string[] = []
    const pool = makePool((sql) => {
      sqlCalls.push(sql)
      if (sql.includes('FROM source_health_events')) return { rows: EVENTS }
      return { rows: [] }
    })
    loadSourcesByIdsMock.mockResolvedValue([
      { id: 'src-1', video_id: 'vid-1', source_url: 'https://a/1.m3u8', type: 'hls' },
      { id: 'src-2', video_id: 'vid-2', source_url: 'https://a/2.m3u8', type: 'hls' },
    ])

    await runFeedbackDrivenRecheck(pool, log)

    // 定向 load：信号源去重 + 滤 NULL
    expect(loadSourcesByIdsMock).toHaveBeenCalledWith(pool, ['src-1', 'src-2'])
    // level1 接收已查 sources（不再全表扫）
    expect(runLevel1ProbeMock).toHaveBeenCalledTimes(1)
    expect(runLevel1ProbeMock.mock.calls[0][2]).toEqual({
      sources: expect.arrayContaining([expect.objectContaining({ id: 'src-1' }), expect.objectContaining({ id: 'src-2' })]),
    })
    // 聚合受影响 videoIds（去重）
    expect(aggregateBatchMock).toHaveBeenCalledWith(pool, log, ['vid-1', 'vid-2'])
    // level2 定向参数（F2 修复核心：不再全局 candidates）
    expect(runLevel2RenderMock).toHaveBeenCalledWith(pool, log, { sourceIds: ['src-1', 'src-2'] })
    // render 重置谓词与 level2 定向 candidates 完全对齐（probe=ok + active + 未删除），
    // 防任何 level2 会跳过的源（probe dead / 停用 / 软删）render 真相被洗成 stale pending
    const resetSql = sqlCalls.find((s) => s.includes("SET render_status = 'pending'"))
    expect(resetSql).toBeDefined()
    expect(resetSql).toContain("probe_status = 'ok'")
    expect(resetSql).toContain('is_active = true')
    expect(resetSql).toContain('deleted_at IS NULL')
    expect(sqlCalls.some((s) => s.includes('SET processed_at = NOW()'))).toBe(true)
  })

  it('信号源已全部失效下线（loadSourcesByIds 空）→ 跳过 level1/聚合，仍走 level2 定向 + 标 processed', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('FROM source_health_events')) return { rows: [EVENTS[0]] }
      return { rows: [] }
    })
    loadSourcesByIdsMock.mockResolvedValue([])

    await runFeedbackDrivenRecheck(pool, log)

    expect(runLevel1ProbeMock).not.toHaveBeenCalled()
    expect(aggregateBatchMock).not.toHaveBeenCalled()
    expect(runLevel2RenderMock).toHaveBeenCalledWith(pool, log, { sourceIds: ['src-1'] })
  })

  it('无未处理信号 → 全程 no-op', async () => {
    const pool = makePool(() => ({ rows: [] }))
    await runFeedbackDrivenRecheck(pool, log)
    expect(loadSourcesByIdsMock).not.toHaveBeenCalled()
    expect(runLevel1ProbeMock).not.toHaveBeenCalled()
    expect(runLevel2RenderMock).not.toHaveBeenCalled()
  })

  it('全部信号 source_id 为 NULL（存量旧行）→ 不定向，仅标 processed', async () => {
    const sqlCalls: string[] = []
    const pool = makePool((sql) => {
      sqlCalls.push(sql)
      if (sql.includes('FROM source_health_events')) return { rows: [EVENTS[3]] }
      return { rows: [] }
    })

    await runFeedbackDrivenRecheck(pool, log)

    expect(loadSourcesByIdsMock).not.toHaveBeenCalled()
    expect(runLevel2RenderMock).not.toHaveBeenCalled()
    expect(sqlCalls.some((s) => s.includes('SET processed_at = NOW()'))).toBe(true)
  })

  // SRCHEALTH-P2-4-B：manual_route_reprobe 信号消费（与 feedback_driven 同编排混批）
  it('拉取条件覆盖两种 origin；reprobe 信号与 feedback 信号混批定向消费 + 全量标 processed', async () => {
    const sqlCalls: Array<[string, readonly unknown[] | undefined]> = []
    const MIXED = [
      EVENTS[0],
      { id: 'ev-r1', source_id: 'src-9', video_id: 'vid-9', origin: 'manual_route_reprobe' },
      { id: 'ev-r2', source_id: 'src-10', video_id: 'vid-9', origin: 'manual_route_reprobe' },
    ]
    const pool = makePool((sql, params) => {
      sqlCalls.push([sql, params])
      if (sql.includes('FROM source_health_events')) return { rows: MIXED }
      return { rows: [] }
    })
    loadSourcesByIdsMock.mockResolvedValue([
      { id: 'src-1', video_id: 'vid-1', source_url: 'https://a/1.m3u8', type: 'hls' },
      { id: 'src-9', video_id: 'vid-9', source_url: 'https://a/9.m3u8', type: 'hls' },
      { id: 'src-10', video_id: 'vid-9', source_url: 'https://a/10.m3u8', type: 'hls' },
    ])

    await runFeedbackDrivenRecheck(pool, log)

    // 拉取 SQL 必须同时消费两种 origin（仅 feedback_driven 会让 reprobe 信号永久滞留）
    const fetchSql = sqlCalls.find(([s]) => s.includes('FROM source_health_events'))![0]
    expect(fetchSql).toContain("'feedback_driven'")
    expect(fetchSql).toContain("'manual_route_reprobe'")
    expect(fetchSql).toContain('processed_at IS NULL')
    // 混批定向：reprobe 信号源进入同一 level1/level2 定向链
    expect(loadSourcesByIdsMock).toHaveBeenCalledWith(pool, ['src-1', 'src-9', 'src-10'])
    expect(runLevel2RenderMock).toHaveBeenCalledWith(pool, log, { sourceIds: ['src-1', 'src-9', 'src-10'] })
    // 消费多少标多少：三个事件 id 全量标 processed
    const markCall = sqlCalls.find(([s]) => s.includes('SET processed_at = NOW()'))
    expect(markCall).toBeDefined()
    expect(markCall![1]?.[0]).toEqual(['ev-1', 'ev-r1', 'ev-r2'])
  })
})
