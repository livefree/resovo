/**
 * MergeComparePreview.test.tsx — CHG-VIR-13-B2A 对比矩阵 + 结果预览
 *
 * 范围（12 用例）：
 *  MergeComparePanel：
 *   1. N 列渲染（列 = videos）+ 8 字段行
 *   2. 列头单选 target → onTargetChange + 推荐 badge
 *   3. type/year 冲突 → warn 行标警
 *   4. 外部 ID 同 provider 不同 id → danger 行标警
 *   5. 字段缺失（旧 response）渲染「—」零崩溃
 *  combineMatrices（纯函数 / §10.5 三信号）：
 *   6a/6b. (ep,url) 精确重复→「将自动去重 N 条」/ 同站同名 URL 不同→归并提示（D-105-16）
 *   7. 集数互补 → ok 信号
 *   8. 集数完全重叠 → info 信号
 *  MergeResultPreview（merge 形态）：
 *   9. After 汇总（源数总和/站点并集）+ 软删列表
 *  10. 状态降级警示（source 已审公开 + target 非公开）
 *  11. 展开线路集数预览 → getVideoMatrix ×N + 信号渲染
 *  MergeResultPreview（split 形态）：
 *  12. 组卡（新建/转入已有）+ 原视频软删明示
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getVideoMatrixMock = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  getVideoMatrix: (...args: unknown[]) => getVideoMatrixMock(...args),
}))

// AdminPlayer stub（player-core 真播放器不进 jsdom 单测；沿 PlayPreview.test 先例）
vi.mock('../../../../../../apps/server-next/src/app/admin/moderation/_client/AdminPlayer', () => ({
  AdminPlayer: ({ videoId, sourceId, testId }: { videoId: string; sourceId: string; testId?: string }) => (
    <div data-testid={testId ?? 'admin-player-stub'} data-video={videoId} data-source={sourceId} />
  ),
}))

import { MergeComparePanel } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeComparePanel'
import { StructurePreview } from '../../../../../../apps/server-next/src/app/admin/merge/_client/StructurePreview'
import {
  MergeResultPreview,
  combineMatrices,
} from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeResultPreview'
import type { VideoSummaryForMerge, LineMatrixRow } from '@resovo/types'

// ── fixtures ──────────────────────────────────────────────────────

function makeVideo(id: string, overrides: Partial<VideoSummaryForMerge> = {}): VideoSummaryForMerge {
  return {
    id,
    title: `视频 ${id}`,
    titleNormalized: '视频',
    year: 2024,
    type: 'series',
    createdAt: '2026-01-01T00:00:00Z',
    sourceCount: 3,
    sourceSiteKeys: ['iqiyi', 'youku'],
    reviewStatus: 'approved',
    visibilityStatus: 'public',
    catalogId: 'cat-1',
    catalogTitle: '某剧',
    episodeRange: { min: 1, max: 12 },
    externalIds: [{ provider: 'douban', externalId: 'db-1' }],
    coverUrl: null,
    ...overrides,
  }
}

function makeLine(siteKey: string, sourceName: string, eps: number[]): LineMatrixRow {
  return {
    sourceSiteKey: siteKey,
    sourceName,
    displayName: sourceName,
    episodes: eps.map((n) => ({
      episodeNumber: n,
      sourceId: `s-${siteKey}-${sourceName}-${n}`,
      sourceUrl: `https://x.test/${siteKey}/${n}`,
      probeStatus: 'ok' as const,
      renderStatus: 'ok' as const,
      isActive: true,
    })),
  }
}

beforeEach(() => {
  getVideoMatrixMock.mockReset()
})

// ── MergeComparePanel ─────────────────────────────────────────────

describe('MergeComparePanel (CHG-VIR-13-B2A · §10.4 N 列矩阵)', () => {
  it('1. N 列渲染 + 8 字段行', () => {
    const videos = [makeVideo('a'), makeVideo('b'), makeVideo('c')]
    render(<MergeComparePanel videos={videos} targetId="a" onTargetChange={vi.fn()} />)
    expect(screen.getByTestId('merge-compare-panel')).toBeTruthy()
    for (const id of ['a', 'b', 'c']) expect(screen.getByTestId(`compare-head-${id}`)).toBeTruthy()
    for (const key of ['cover', 'title', 'type-year', 'catalog', 'status', 'sources', 'episodes', 'external']) {
      expect(screen.getByTestId(`compare-row-${key}`)).toBeTruthy()
    }
  })

  it('2. 列头单选 target → onTargetChange + 推荐 badge', () => {
    const onTargetChange = vi.fn()
    const videos = [makeVideo('a'), makeVideo('b')]
    render(
      <MergeComparePanel videos={videos} targetId="a" onTargetChange={onTargetChange} recommendedTargetId="b" />,
    )
    fireEvent.click(screen.getByTestId('compare-head-b'))
    expect(onTargetChange).toHaveBeenCalledWith('b')
    expect(screen.getByLabelText('推荐合并目标')).toBeTruthy()
  })

  it('3. type/year 冲突 → warn 行标警（⚠ 前缀）', () => {
    const videos = [makeVideo('a', { year: 2023 }), makeVideo('b', { year: 2024 })]
    render(<MergeComparePanel videos={videos} targetId="a" onTargetChange={vi.fn()} />)
    expect(screen.getByTestId('compare-row-type-year').textContent).toContain('⚠')
  })

  it('4. 外部 ID 同 provider 不同 id → danger 行标警', () => {
    const videos = [
      makeVideo('a', { externalIds: [{ provider: 'douban', externalId: 'db-1' }] }),
      makeVideo('b', { externalIds: [{ provider: 'douban', externalId: 'db-2' }] }),
    ]
    render(<MergeComparePanel videos={videos} targetId="a" onTargetChange={vi.fn()} />)
    expect(screen.getByTestId('compare-row-external').textContent).toContain('⚠')
  })

  it('5. 字段缺失（旧 response / legacy）渲染「—」零崩溃', () => {
    const bare: VideoSummaryForMerge = {
      id: 'x', title: '旧行', titleNormalized: '旧行', year: null, type: 'movie',
      createdAt: '2026-01-01T00:00:00Z', sourceCount: 1, sourceSiteKeys: [],
    }
    render(<MergeComparePanel videos={[bare, makeVideo('a')]} targetId="x" onTargetChange={vi.fn()} />)
    expect(screen.getByTestId('compare-row-status').textContent).toContain('—')
    expect(screen.getByTestId('compare-row-external').textContent).toContain('—')
  })
})

// ── combineMatrices 纯函数（§10.5 三信号）─────────────────────────

describe('combineMatrices (§10.5 结构信号)', () => {
  it('6a. (episodeNumber, sourceUrl) 跨 video 精确重复 → info「将自动去重 N 条」（D-105-16 与后端 PARTITION 同口径）', () => {
    // 同 site 同集数 → makeLine 的 sourceUrl 相同 → 2 对重复（ep1 + ep2 各保留 1 条）
    const { signals } = combineMatrices([
      { video: makeVideo('a'), lines: [makeLine('siteA', '线路1', [1, 2, 3])] },
      { video: makeVideo('b'), lines: [makeLine('siteA', '线路2', [1, 2])] },
    ])
    expect(signals.some((s) => s.tone === 'info' && s.text.includes('自动去重 2 条'))).toBe(true)
  })

  it('6b. 同站同名但 URL 不重复（集数不同）→ 归并显示提示，无去重信号', () => {
    const { signals } = combineMatrices([
      { video: makeVideo('a'), lines: [makeLine('siteA', '线路1', [1, 2])] },
      { video: makeVideo('b'), lines: [makeLine('siteA', '线路1', [3, 4])] },
    ])
    expect(signals.some((s) => s.tone === 'info' && s.text.includes('归并为同一线路'))).toBe(true)
    expect(signals.some((s) => s.text.includes('自动去重'))).toBe(false)
  })

  it('7. 集数互补（无重叠）→ ok 正信号', () => {
    const { signals } = combineMatrices([
      { video: makeVideo('a'), lines: [makeLine('siteA', '线1', [1, 2, 3])] },
      { video: makeVideo('b'), lines: [makeLine('siteB', '线2', [4, 5, 6])] },
    ])
    expect(signals.some((s) => s.tone === 'ok' && s.text.includes('互补'))).toBe(true)
    expect(signals.some((s) => s.tone === 'danger')).toBe(false)
  })

  it('8. 集数完全重叠 → info 信号（建议播放抽验）', () => {
    const { signals, lines } = combineMatrices([
      { video: makeVideo('a'), lines: [makeLine('siteA', '线1', [1, 2, 3])] },
      { video: makeVideo('b'), lines: [makeLine('siteB', '线2', [1, 2, 3])] },
    ])
    expect(signals.some((s) => s.tone === 'info' && s.text.includes('播放抽验'))).toBe(true)
    expect(lines).toHaveLength(2)
  })
})

// ── MergeResultPreview ────────────────────────────────────────────

describe('MergeResultPreview · merge 形态', () => {
  it('9. After 汇总（源数总和/站点并集）+ 软删列表', () => {
    const videos = [
      makeVideo('a', { sourceCount: 3, sourceSiteKeys: ['iqiyi', 'youku'] }),
      makeVideo('b', { sourceCount: 2, sourceSiteKeys: ['iqiyi', 'bilibili'] }),
    ]
    render(<MergeResultPreview kind="merge" videos={videos} targetId="a" />)
    const head = screen.getByTestId('merge-result-preview').textContent!
    expect(head).toContain('5 源')
    expect(head).toContain('3 站')
    expect(screen.getByTestId('merge-result-soft-delete-list').textContent).toContain('视频 b')
    expect(screen.getByTestId('merge-result-soft-delete-list').textContent).toContain('将软删除')
  })

  it('10. 状态降级警示：source 已审公开 + target 非公开', () => {
    const videos = [
      makeVideo('t', { reviewStatus: 'pending_review', visibilityStatus: 'internal' }),
      makeVideo('s', { reviewStatus: 'approved', visibilityStatus: 'public' }),
    ]
    render(<MergeResultPreview kind="merge" videos={videos} targetId="t" />)
    expect(screen.getByTestId('merge-result-downgrade-warn')).toBeTruthy()
  })

  // ── CHG-VIR-15-UX-B ③：线路×集数迁 ComparePanel「线路 · 播放」行（数据注入契约）──

  it('11. ComparePanel 线路行：ready 注入 → 每视频列渲染自己的线路 + ▶En；点击 → 列内嵌播放器', async () => {
    const videos = [makeVideo('a'), makeVideo('b')]
    const linesState = {
      status: 'ready' as const,
      byVideo: new Map([
        ['a', [makeLine('siteA', '线1', [1, 2])]],
        ['b', [makeLine('siteB', '线2', [3])]],
      ]),
    }
    render(
      <MergeComparePanel
        videos={videos} targetId="a" onTargetChange={vi.fn()}
        linesState={linesState} onToggleLines={vi.fn()}
      />,
    )
    // 每列只含自己的线路（区分归属 / 用户裁定 ③）
    expect(screen.getByTestId('compare-lines-a').textContent).toContain('线1')
    expect(screen.getByTestId('compare-lines-a').textContent).not.toContain('线2')
    expect(screen.getByTestId('compare-lines-b').textContent).toContain('线2')
    // toggle 显示「收起」（ready 态）
    expect(screen.getByTestId('compare-lines-toggle').textContent).toContain('收起')
    // 点击 ▶E1 → a 列内嵌播放器装载（b 列不受影响）
    const ep1 = screen.getByTestId('compare-ep-s-siteA-线1-1')
    fireEvent.click(ep1)
    await waitFor(() => expect(screen.getByTestId('compare-player-a')).toBeTruthy())
    expect(screen.queryByTestId('compare-player-b')).toBeNull()
    // 关闭按钮卸载该列播放器
    fireEvent.click(screen.getByTestId('compare-player-close-a'))
    expect(screen.queryByTestId('compare-player-a')).toBeNull()
  })

  it('11a. ComparePanel 线路行：idle → 「展开」按钮 + onToggleLines 回调；loading 禁用', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <MergeComparePanel
        videos={[makeVideo('a')]} targetId="a" onTargetChange={vi.fn()}
        linesState={{ status: 'idle', byVideo: new Map() }} onToggleLines={onToggle}
      />,
    )
    const toggle = screen.getByTestId('compare-lines-toggle')
    expect(toggle.textContent).toContain('展开')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
    rerender(
      <MergeComparePanel
        videos={[makeVideo('a')]} targetId="a" onTargetChange={vi.fn()}
        linesState={{ status: 'loading', byVideo: new Map() }} onToggleLines={onToggle}
      />,
    )
    expect((screen.getByTestId('compare-lines-toggle') as HTMLButtonElement).disabled).toBe(true)
  })

  it('11e. ResultPreview signals 注入：信号条渲染（线路列表本体不再内嵌）', () => {
    render(
      <MergeResultPreview
        kind="merge" videos={[makeVideo('a'), makeVideo('b')]} targetId="a"
        signals={[{ tone: 'info', text: '合并时将自动去重 2 条' }, { tone: 'ok', text: '集数互补' }]}
      />,
    )
    expect(screen.getByTestId('structure-signal-info').textContent).toContain('自动去重 2 条')
    expect(screen.getByTestId('structure-signal-ok').textContent).toContain('互补')
    // 旧内嵌展开按钮退役
    expect(screen.queryByTestId('merge-result-structure-toggle')).toBeNull()
  })

  // ── StructurePreview stale 守卫（组件本体保留，MergeWorkspace 消费）──

  it('11b. Codex FIX：videos 集合变化 → 旧结构预览立即失效（stale 守卫）', async () => {
    getVideoMatrixMock.mockResolvedValue([makeLine('siteA', '线1', [1])])
    const { rerender } = render(
      <StructurePreview videos={[makeVideo('a'), makeVideo('b')]} />,
    )
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    await waitFor(() => expect(screen.getByTestId('merge-result-structure')).toBeTruthy())
    // 集合变化（b → c）：旧预览（a+b 的线路）必须立即清空，不得显示在新集合下
    rerender(
      <StructurePreview videos={[makeVideo('a'), makeVideo('c')]} />,
    )
    expect(screen.queryByTestId('merge-result-structure')).toBeNull()
  })

  it('11c. Codex FIX：videos 变化时飞行中旧请求作废（过期响应丢弃，不覆盖新集合）', async () => {
    // 旧集合请求挂起（手动控制 resolve 时序）
    let resolveOld!: (v: LineMatrixRow[]) => void
    getVideoMatrixMock.mockImplementation(() => new Promise<LineMatrixRow[]>((res) => { resolveOld = res }))
    const { rerender } = render(
      <StructurePreview videos={[makeVideo('a'), makeVideo('b')]} />,
    )
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    // 请求未返回时集合变化 → 旧请求作废
    rerender(
      <StructurePreview videos={[makeVideo('a'), makeVideo('c')]} />,
    )
    resolveOld([makeLine('siteA', '旧线路', [1])])
    await new Promise((r) => setTimeout(r, 0))
    // 过期响应不得渲染（structure 仍为空）
    expect(screen.queryByTestId('merge-result-structure')).toBeNull()
  })

  it('11d. Codex FIX-2：StrictMode（mount→unmount→remount，ref 保留）下守卫仍工作', async () => {
    const { StrictMode } = await import('react')
    getVideoMatrixMock.mockResolvedValue([makeLine('siteA', '线1', [1])])
    const { rerender } = render(
      <StrictMode>
        <StructurePreview videos={[makeVideo('a'), makeVideo('b')]} />
      </StrictMode>,
    )
    // remount 后正常加载路径不被破坏（MAX_SAFE_INTEGER 哨兵会在此失效——seq 恒等导致守卫永真/加载异常）
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    await waitFor(() => expect(screen.getByTestId('merge-result-structure')).toBeTruthy())
    // 集合变化 → stale 守卫在 StrictMode 下依然生效（旧预览清空）
    rerender(
      <StrictMode>
        <StructurePreview videos={[makeVideo('a'), makeVideo('c')]} />
      </StrictMode>,
    )
    expect(screen.queryByTestId('merge-result-structure')).toBeNull()
    // 新集合可重新展开（守卫未被永久禁用）
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    await waitFor(() => expect(screen.getByTestId('merge-result-structure')).toBeTruthy())
  })
})

describe('MergeResultPreview · split 形态', () => {
  it('12. 组卡（新建/转入已有）+ 原视频软删明示（§10.2 增强 #4）', () => {
    render(
      <MergeResultPreview
        kind="split"
        originalTitle="某剧合集"
        groups={[
          { label: '某剧 第一季', typeLabel: '剧集', sourceCount: 5, lineSummaries: ['站A·线路1 E1–E8'] },
          { label: '组2', existingTarget: '某剧 S2', sourceCount: 3, lineSummaries: [] },
        ]}
      />,
    )
    expect(screen.getByTestId('split-group-card-0').textContent).toContain('某剧 第一季')
    expect(screen.getByTestId('split-group-card-0').textContent).toContain('默认待审·内部')
    expect(screen.getByTestId('split-group-card-1').textContent).toContain('已有视频「某剧 S2」')
    expect(screen.getByTestId('split-group-card-1').textContent).toContain('不改其元数据')
    const note = screen.getByTestId('split-original-soft-delete-note')
    expect(note.textContent).toContain('某剧合集')
    expect(note.textContent).toContain('软删除')
  })
})
