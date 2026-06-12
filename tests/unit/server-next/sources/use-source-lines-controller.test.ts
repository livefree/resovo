// @vitest-environment jsdom

/**
 * use-source-lines-controller.test.ts — CHG-VSR-PRE-2 中性线路控制器单测
 *
 * 覆盖：reload + onLoaded（Y4）/ 乐观锁 toggle 成功·409 race·非 race 回滚（R2）/
 *      disableDead / refetch / 单源 probe·render / 批量 probe·render + summary /
 *      R3 batch stale-write 防御 / fetchHealth / onActionResult 结构化反馈（R4）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../apps/server-next/src/lib/sources/api', () => ({
  fetchVideoSources: vi.fn(),
  toggleSource: vi.fn(),
  disableDeadSources: vi.fn(),
  refetchSources: vi.fn(),
  probeOneSource: vi.fn(),
  renderCheckOneSource: vi.fn(),
  batchProbeVideo: vi.fn(),
  batchRenderCheckVideo: vi.fn(),
  fetchLineHealth: vi.fn(),
}))

import * as api from '../../../../apps/server-next/src/lib/sources/api'
import { useSourceLinesController } from '../../../../apps/server-next/src/lib/sources/use-source-lines-controller'
import type { SourceLineRowData, SourceActionResult } from '../../../../apps/server-next/src/lib/sources/types'

function makeRow(overrides: Partial<SourceLineRowData> = {}): SourceLineRowData {
  return {
    id: 's1',
    updated_at: '2024-01-01T00:00:00Z',
    source_site_key: 'sitea',
    source_name: 'Line A',
    source_url: 'https://a.example/ep1.m3u8',
    episode_number: 1,
    is_active: true,
    probe_status: 'ok',
    render_status: 'ok',
    latency_ms: 100,
    quality_detected: '1080P',
    ...overrides,
  }
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('useSourceLinesController', () => {
  // resetAllMocks（非 clearAllMocks）：清 mockResolvedValueOnce 队列，防短路用例残留 once 泄漏到后续用例
  beforeEach(() => { vi.resetAllMocks() })

  it('reload：loading=true → 成功后 lines 就位，onLoaded 收到原始行（Y4）', async () => {
    const rows = [makeRow()]
    vi.mocked(api.fetchVideoSources).mockResolvedValue(rows)
    const onLoaded = vi.fn()

    const { result } = renderHook(() => useSourceLinesController('v1', { onLoaded }))
    expect(result.current[0].loading).toBe(true)

    await flush()

    expect(result.current[0].loading).toBe(false)
    expect(result.current[0].lines).toHaveLength(1)
    expect(result.current[0].lines[0]!.id).toBe('s1')
    expect(api.fetchVideoSources).toHaveBeenCalledWith('v1')
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onLoaded).toHaveBeenCalledWith(rows)
  })

  it('applyExternalHealthUpdate：外科改指定源 probe/render，不重 fetch、不动其他行（playback-verify 同步）', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([
      makeRow({ id: 's1', probe_status: 'pending', render_status: 'pending' }),
      makeRow({ id: 's2', probe_status: 'dead', render_status: 'dead' }),
    ])
    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()
    const fetchCallsBefore = vi.mocked(api.fetchVideoSources).mock.calls.length

    act(() => {
      result.current[1].applyExternalHealthUpdate('s1', { renderStatus: 'ok', probeStatus: 'ok' })
    })

    const lines = result.current[0].lines
    expect(lines.find((l) => l.id === 's1')!.render_status).toBe('ok')
    expect(lines.find((l) => l.id === 's1')!.probe_status).toBe('ok')
    // 不动其他行
    expect(lines.find((l) => l.id === 's2')!.render_status).toBe('dead')
    // 外科更新非 reload → 不重 fetch（不触发 Y4 首行自动选，不打断播放）
    expect(vi.mocked(api.fetchVideoSources).mock.calls.length).toBe(fetchCallsBefore)
  })

  it('applyExternalHealthUpdate：只传 renderStatus → probe_status 不动', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([
      makeRow({ id: 's1', probe_status: 'pending', render_status: 'pending' }),
    ])
    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    act(() => {
      result.current[1].applyExternalHealthUpdate('s1', { renderStatus: 'ok' })
    })

    expect(result.current[0].lines[0]!.render_status).toBe('ok')
    expect(result.current[0].lines[0]!.probe_status).toBe('pending') // 未传 → 不动
  })

  it('reload 失败 → state.error 就位（原始 Error / R4 本地化留消费方）', async () => {
    vi.mocked(api.fetchVideoSources).mockRejectedValue(new Error('网络错误'))

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    expect(result.current[0].error).toBeInstanceOf(Error)
    expect(result.current[0].error?.message).toBe('网络错误')
  })

  it('toggle：乐观更新 + 透传 updated_at + 用 server 新版本同步 + onActionResult success（R2）', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ is_active: true, updated_at: 't0' })])
    vi.mocked(api.toggleSource).mockResolvedValue({ id: 's1', is_active: false, updated_at: 't1' })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].toggleEpisode('s1', false) })

    expect(result.current[0].lines[0]!.is_active).toBe(false)
    expect(result.current[0].lines[0]!.updated_at).toBe('t1')
    expect(api.toggleSource).toHaveBeenCalledWith('v1', 's1', false, 't0')
    expect(results).toContainEqual({ action: 'toggle', status: 'success' })
  })

  it('toggle：409 REVIEW_RACE → 重 fetch 覆盖 + onActionResult race（不回滚到旧 snapshot）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([makeRow({ is_active: true, updated_at: 't0' })])
      .mockResolvedValueOnce([makeRow({ is_active: false, updated_at: 't2' })])
    vi.mocked(api.toggleSource).mockRejectedValue(Object.assign(new Error('race'), { code: 'REVIEW_RACE', status: 409 }))
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()
    const initialCalls = vi.mocked(api.fetchVideoSources).mock.calls.length

    await act(async () => { await result.current[1].toggleEpisode('s1', false) })

    expect(vi.mocked(api.fetchVideoSources).mock.calls.length).toBeGreaterThan(initialCalls)
    expect(result.current[0].lines[0]!.updated_at).toBe('t2')
    expect(result.current[0].lines[0]!.is_active).toBe(false)
    expect(results).toContainEqual({ action: 'toggle', status: 'race' })
  })

  it('toggle：非 race 失败 → 回滚 snapshot + onActionResult failed 携带 code', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ is_active: true })])
    vi.mocked(api.toggleSource).mockRejectedValue(Object.assign(new Error('invalid'), { code: 'STATE_INVALID', status: 422 }))
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].toggleEpisode('s1', false) })

    expect(result.current[0].lines[0]!.is_active).toBe(true) // 回滚
    expect(results).toContainEqual({ action: 'toggle', status: 'failed', code: 'STATE_INVALID' })
  })

  it('toggle 失败：以 server 真相重 fetch 对账，同一行并发 server-confirmed is_active 不被回滚覆盖（Codex stop-time review）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: true, probe_status: 'dead', render_status: 'dead' })])
      // 失败后重 fetch 的 server 真相：A 已被（并发 disableDead）确认为 inactive
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: false, probe_status: 'dead', render_status: 'dead' })])
    vi.mocked(api.toggleSource).mockRejectedValue(Object.assign(new Error('network'), { code: 'INTERNAL' }))
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].toggleEpisode('a', false) })

    // 重 fetch 对账 server 真相 → A=inactive（旧版整组/单行回滚会错误还原为 active=prevActive）
    expect(api.fetchVideoSources).toHaveBeenCalledTimes(2)
    expect(result.current[0].lines.find((l) => l.id === 'a')!.is_active).toBe(false)
    expect(results).toContainEqual({ action: 'toggle', status: 'failed', code: 'INTERNAL' })
  })

  it('toggle 失败 + 重 fetch 亦失败 → 退化为仅回滚目标行（不还原 stale 整组）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([
        makeRow({ id: 'a', is_active: true }),
        makeRow({ id: 'b', is_active: true, probe_status: 'ok' }),
      ])
      .mockRejectedValueOnce(new Error('refetch down'))
    vi.mocked(api.toggleSource).mockRejectedValue(new Error('network'))
    vi.mocked(api.probeOneSource).mockResolvedValue({ sourceId: 'b', newProbeStatus: 'dead', latencyMs: null, queued: false })

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    // 并发：B 探测 server-confirmed dead（在 toggle A 失败前）
    await act(async () => { await result.current[1].probeEpisode('b') })
    expect(result.current[0].lines.find((l) => l.id === 'b')!.probe_status).toBe('dead')

    // A toggle 失败 + 重 fetch 也失败 → 退化为仅回滚 A，不动 B（B 并发更新保留）
    await act(async () => { await result.current[1].toggleEpisode('a', false) })

    expect(result.current[0].lines.find((l) => l.id === 'a')!.is_active).toBe(true)      // A 退化回滚
    expect(result.current[0].lines.find((l) => l.id === 'b')!.probe_status).toBe('dead') // B 不被整组还原抹掉
  })

  it('toggle 失败：re-fetch 成功也只对账目标行，不用 stale fresh 覆盖其他行 newer 写（Codex stop-time review 第 3 轮）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([
        makeRow({ id: 'a', is_active: true }),
        makeRow({ id: 'b', is_active: true, probe_status: 'ok' }),
      ])
      // 失败对账的 re-fetch 返回 stale B（probe ok，未含期间并发 probe 的 dead）→ 不得用于覆盖 B
      .mockResolvedValueOnce([
        makeRow({ id: 'a', is_active: true }),
        makeRow({ id: 'b', is_active: true, probe_status: 'ok' }),
      ])
    let rejectToggle!: (e: unknown) => void
    vi.mocked(api.toggleSource).mockReturnValue(new Promise((_res, rej) => { rejectToggle = rej }))
    vi.mocked(api.probeOneSource).mockResolvedValue({ sourceId: 'b', newProbeStatus: 'dead', latencyMs: null, queued: false })

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    // A 的 toggle 挂起（乐观 inactive）
    let toggleDone!: Promise<void>
    act(() => { toggleDone = result.current[1].toggleEpisode('a', false) })

    // 并发：B 探测 server-confirmed dead（newer write）
    await act(async () => { await result.current[1].probeEpisode('b') })
    expect(result.current[0].lines.find((l) => l.id === 'b')!.probe_status).toBe('dead')

    // A 失败 → re-fetch 成功但只对账 A；B 不被 stale fresh（probe ok）覆盖
    await act(async () => {
      rejectToggle(Object.assign(new Error('network'), { code: 'INTERNAL' }))
      await toggleDone
    })

    expect(result.current[0].lines.find((l) => l.id === 'a')!.is_active).toBe(true)      // A 对账 server 值
    expect(result.current[0].lines.find((l) => l.id === 'b')!.probe_status).toBe('dead') // B 的 newer confirmed 写不被 stale fresh 覆盖
  })

  it('toggle 失败：同行并发 disableDead confirmed 写短路对账（不 re-fetch / 不回滚 / 让 confirmed 写赢）（Codex stop-time review 第 3 轮）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: true, probe_status: 'dead', render_status: 'dead' })])
      // 若失败对账误触发 re-fetch（stale 读未含 disableDead 的写）→ 会把 A 错误还原为 active；本用例断言不触发
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: true, probe_status: 'dead', render_status: 'dead' })])
    let rejectToggle!: (e: unknown) => void
    vi.mocked(api.toggleSource).mockReturnValue(new Promise((_res, rej) => { rejectToggle = rej }))
    vi.mocked(api.disableDeadSources).mockResolvedValue({ disabled: 1 })

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    // A 的 toggle 挂起（乐观 inactive）
    let toggleDone!: Promise<void>
    act(() => { toggleDone = result.current[1].toggleEpisode('a', false) })

    // 并发：disableDead server-confirmed → A=inactive（A 在 togglingIds → 标记 externallyModified）
    await act(async () => { await result.current[1].disableDead() })
    expect(result.current[0].lines.find((l) => l.id === 'a')!.is_active).toBe(false)

    // A toggle 失败 → 本行被并发 confirmed 写改过 → 完全不对账（不 re-fetch、不回滚）→ A 保持 false
    await act(async () => {
      rejectToggle(Object.assign(new Error('network'), { code: 'INTERNAL' }))
      await toggleDone
    })

    expect(result.current[0].lines.find((l) => l.id === 'a')!.is_active).toBe(false) // confirmed 写保留
    expect(api.fetchVideoSources).toHaveBeenCalledTimes(1) // 并发标记短路 → 未触发失败 re-fetch
  })

  it('toggle 失败：re-fetch 对账只改 is_active，保留同行被并发 probe 改的字段（Codex stop-time review 第 4 轮）', async () => {
    vi.mocked(api.fetchVideoSources)
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: true, probe_status: 'ok', latency_ms: 100 })])
      // 失败对账 re-fetch 返回 stale A（probe_status 仍 ok / latency 100，未含期间 probe 的 dead/42）
      .mockResolvedValueOnce([makeRow({ id: 'a', is_active: true, probe_status: 'ok', latency_ms: 100 })])
    let rejectToggle!: (e: unknown) => void
    vi.mocked(api.toggleSource).mockReturnValue(new Promise((_res, rej) => { rejectToggle = rej }))
    vi.mocked(api.probeOneSource).mockResolvedValue({ sourceId: 'a', newProbeStatus: 'dead', latencyMs: 42, queued: false })

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    // A 的 toggle 挂起（乐观 is_active=false）
    let toggleDone!: Promise<void>
    act(() => { toggleDone = result.current[1].toggleEpisode('a', false) })

    // 并发：同一行 A 的 probe server-confirmed dead（不同字段 probe_status/latency_ms）
    await act(async () => { await result.current[1].probeEpisode('a') })
    expect(result.current[0].lines.find((l) => l.id === 'a')!.probe_status).toBe('dead')

    // A toggle 失败 → re-fetch 对账**只改 is_active**；同行 probe confirmed 字段不被 stale fresh 覆盖
    await act(async () => {
      rejectToggle(Object.assign(new Error('network'), { code: 'INTERNAL' }))
      await toggleDone
    })

    const a = result.current[0].lines.find((l) => l.id === 'a')!
    expect(a.is_active).toBe(true)       // is_active 对账 server 真相
    expect(a.probe_status).toBe('dead')  // 同行 probe confirmed 写保留（旧整行 freshTarget 会回退 ok）
    expect(a.latency_ms).toBe(42)        // 同行 latency 保留（旧整行会回退 100）
  })

  it('disableDead：dead 行本地置 inactive + onActionResult success', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([
      makeRow({ id: 'dead1', probe_status: 'dead', render_status: 'dead', is_active: true }),
      makeRow({ id: 'ok1', probe_status: 'ok', render_status: 'ok', is_active: true }),
    ])
    vi.mocked(api.disableDeadSources).mockResolvedValue({ disabled: 1 })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].disableDead() })

    expect(result.current[0].lines.find((l) => l.id === 'dead1')!.is_active).toBe(false)
    expect(result.current[0].lines.find((l) => l.id === 'ok1')!.is_active).toBe(true)
    expect(api.disableDeadSources).toHaveBeenCalledWith('v1')
    // MODUX-P1-4：success 携带 disabledCount（反馈一致性）
    expect(results).toContainEqual({ action: 'disableDead', status: 'success', disabledCount: 1 })
  })

  it('refetch：成功 + 失败分别 onActionResult success / failed', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow()])
    vi.mocked(api.refetchSources).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'))
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].refetch() })
    await act(async () => { await result.current[1].refetch(['sitea']) })

    expect(api.refetchSources).toHaveBeenNthCalledWith(1, 'v1', undefined)
    expect(api.refetchSources).toHaveBeenNthCalledWith(2, 'v1', ['sitea'])
    expect(results).toContainEqual({ action: 'refetch', status: 'success' })
    expect(results).toContainEqual({ action: 'refetch', status: 'failed' })
  })

  it('probeEpisode：成功 dead → setLines + onActionResult success dead=true', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ probe_status: 'ok', latency_ms: 100 })])
    vi.mocked(api.probeOneSource).mockResolvedValue({ sourceId: 's1', newProbeStatus: 'dead', latencyMs: null, queued: false })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].probeEpisode('s1') })

    expect(result.current[0].lines[0]!.probe_status).toBe('dead')
    expect(result.current[0].lines[0]!.latency_ms).toBe(null)
    expect(results).toContainEqual({ action: 'probeEpisode', status: 'success', dead: true })
  })

  it('probeEpisode：409 → onActionResult freeze', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow()])
    vi.mocked(api.probeOneSource).mockRejectedValue(Object.assign(new Error('frozen'), { status: 409 }))
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].probeEpisode('s1') })

    expect(results).toContainEqual({ action: 'probeEpisode', status: 'freeze' })
  })

  it('renderCheckEpisode：成功 ok → setLines render_status + onActionResult success dead=false', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ render_status: 'pending' })])
    vi.mocked(api.renderCheckOneSource).mockResolvedValue({ sourceId: 's1', newRenderStatus: 'ok', queued: false })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].renderCheckEpisode('s1') })

    expect(result.current[0].lines[0]!.render_status).toBe('ok')
    expect(results).toContainEqual({ action: 'renderCheckEpisode', status: 'success', dead: false })
  })

  it('probeAllSources：批量回填 + onActionResult success 携带 summary', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ id: 's1', probe_status: 'pending', latency_ms: null })])
    vi.mocked(api.batchProbeVideo).mockResolvedValue({
      videoId: 'v1',
      results: [{ sourceId: 's1', newProbeStatus: 'ok', latencyMs: 50 }],
      summary: { total: 1, ok: 1, dead: 0, failed: 0 },
    })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].probeAllSources() })

    expect(result.current[0].lines[0]!.probe_status).toBe('ok')
    expect(result.current[0].lines[0]!.latency_ms).toBe(50)
    expect(results).toContainEqual({ action: 'probeAll', status: 'success', summary: { total: 1, ok: 1, dead: 0, failed: 0 } })
  })

  it('renderCheckAllSources：批量回填 render_status + summary', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow({ id: 's1', render_status: 'pending' })])
    vi.mocked(api.batchRenderCheckVideo).mockResolvedValue({
      videoId: 'v1',
      results: [{ sourceId: 's1', newRenderStatus: 'ok' }],
      summary: { total: 1, ok: 1, dead: 0, failed: 0 },
    })
    const results: SourceActionResult[] = []

    const { result } = renderHook(() => useSourceLinesController('v1', { onActionResult: (r) => results.push(r) }))
    await flush()

    await act(async () => { await result.current[1].renderCheckAllSources() })

    expect(result.current[0].lines[0]!.render_status).toBe('ok')
    expect(results).toContainEqual({ action: 'renderCheckAll', status: 'success', summary: { total: 1, ok: 1, dead: 0, failed: 0 } })
  })

  it('R3：batch 进行中切换 videoId → 旧 video 结果不污染新 video lines', async () => {
    vi.mocked(api.fetchVideoSources).mockImplementation(async (vid: string) =>
      vid === 'v1'
        ? [makeRow({ id: 'a', probe_status: 'pending' })]
        : [makeRow({ id: 'b', probe_status: 'pending' })],
    )
    let resolveBatch!: (v: api.BatchProbeResult) => void
    vi.mocked(api.batchProbeVideo).mockReturnValue(new Promise<api.BatchProbeResult>((res) => { resolveBatch = res }))

    const { result, rerender } = renderHook(({ vid }) => useSourceLinesController(vid), { initialProps: { vid: 'v1' } })
    await flush()
    expect(result.current[0].lines[0]!.id).toBe('a')

    // 启动 v1 的批量探测（promise 挂起）
    let batchDone!: Promise<void>
    act(() => { batchDone = result.current[1].probeAllSources() })

    // 切到 v2 → reload v2
    rerender({ vid: 'v2' })
    await flush()
    expect(result.current[0].lines[0]!.id).toBe('b')

    // 解决 v1 批量 → stale 守卫应跳过 setLines（不污染 v2）
    await act(async () => {
      resolveBatch({ videoId: 'v1', results: [{ sourceId: 'a', newProbeStatus: 'ok', latencyMs: 1 }], summary: { total: 1, ok: 1, dead: 0, failed: 0 } })
      await batchDone
    })

    expect(result.current[0].lines[0]!.id).toBe('b')
    expect(result.current[0].lines[0]!.probe_status).toBe('pending') // 未被 v1 批量结果改写
  })

  it('fetchHealth：透传 videoId + sourceId + page', async () => {
    vi.mocked(api.fetchVideoSources).mockResolvedValue([makeRow()])
    const page = { data: [], pagination: { total: 0, page: 2, limit: 20, hasNext: false } }
    vi.mocked(api.fetchLineHealth).mockResolvedValue(page)

    const { result } = renderHook(() => useSourceLinesController('v1'))
    await flush()

    let got: unknown
    await act(async () => { got = await result.current[1].fetchHealth('s1', 2) })

    expect(api.fetchLineHealth).toHaveBeenCalledWith('v1', 's1', 2)
    expect(got).toBe(page)
  })
})
