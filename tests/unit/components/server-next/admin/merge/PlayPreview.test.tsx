/**
 * PlayPreview.test.tsx — CHG-VIR-13-PLAY 播放抽验
 *
 * 范围（8 用例）：
 *  PlayPreviewDrawer：
 *   1. current 渲染 AdminPlayer（key=sourceId）+ 当前标识文案
 *   2. 同集成员切换 chips（同 episodeNumber >1 时渲染）+ 点击 onSelect
 *   3. 集数条（当前线路 >1 集）+ 点击 onSelect
 *   4. current=null → 占位不渲染 player
 *  StructurePreview 内置抽屉：
 *   5. ▶ 格点击（无外部 onEpisodeClick）→ 内置抽屉打开
 *   6. 外部 onEpisodeClick 注入 → 优先外部、不渲染内置抽屉
 *  SplitAssignTable：
 *   7. 行级 ▶ → onPlay 收到 PlayTarget
 *  MergeWorkspace 嵌入：
 *   8. 成员 ≥2 → 结构预览 toggle 渲染（§11.3 工作区嵌入）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getVideoMatrixMock = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  getVideoMatrix: (...args: unknown[]) => getVideoMatrixMock(...args),
}))

// AdminPlayer stub（player-core 真播放器不进 jsdom 单测；props 透传断言即可）
vi.mock('../../../../../../apps/server-next/src/app/admin/moderation/_client/AdminPlayer', () => ({
  AdminPlayer: ({ videoId, sourceId, sourceUrl }: { videoId: string; sourceId: string; sourceUrl: string }) => (
    <div data-testid="admin-player-stub" data-video={videoId} data-source={sourceId} data-url={sourceUrl} />
  ),
}))

import { PlayPreviewDrawer, type PlayTarget } from '../../../../../../apps/server-next/src/app/admin/merge/_client/PlayPreviewDrawer'
import { StructurePreview } from '../../../../../../apps/server-next/src/app/admin/merge/_client/StructurePreview'
import { SplitAssignTable } from '../../../../../../apps/server-next/src/app/admin/merge/_client/SplitAssignTable'
import type { LineMatrixRow } from '@resovo/types'

function makeTarget(over: Partial<PlayTarget> = {}): PlayTarget {
  return {
    videoId: 'vid-a',
    videoTitle: '视频 A',
    sourceId: 's-1',
    sourceUrl: 'https://x.test/1',
    episodeNumber: 1,
    lineLabel: '线路1',
    ...over,
  }
}

function makeLine(siteKey: string, sourceName: string, eps: number[]): LineMatrixRow {
  return {
    sourceSiteKey: siteKey,
    sourceName,
    displayName: sourceName,
    episodes: eps.map((n) => ({
      episodeNumber: n,
      sourceId: `s-${siteKey}-${n}`,
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

describe('PlayPreviewDrawer (CHG-VIR-13-PLAY · §11.9)', () => {
  it('1. current 渲染 AdminPlayer + 当前标识', () => {
    const t = makeTarget()
    render(
      <PlayPreviewDrawer open current={t} targets={[t]} onSelect={vi.fn()} onClose={vi.fn()} />,
    )
    const player = screen.getByTestId('admin-player-stub')
    expect(player.getAttribute('data-source')).toBe('s-1')
    expect(screen.getByTestId('play-preview-current').textContent).toContain('视频 A · 线路1 · E1')
  })

  it('2. 同集成员切换 chips（核心交互）→ 点击 onSelect', () => {
    const onSelect = vi.fn()
    const a = makeTarget()
    const b = makeTarget({ videoId: 'vid-b', videoTitle: '视频 B', sourceId: 's-2', lineLabel: '线路X' })
    render(
      <PlayPreviewDrawer open current={a} targets={[a, b]} onSelect={onSelect} onClose={vi.fn()} />,
    )
    expect(screen.getByTestId('play-preview-peers')).toBeTruthy()
    fireEvent.click(screen.getByTestId('play-peer-s-2'))
    expect(onSelect).toHaveBeenCalledWith(b)
  })

  it('3. 集数条（当前线路多集）→ 点击 onSelect', () => {
    const onSelect = vi.fn()
    const e1 = makeTarget()
    const e2 = makeTarget({ sourceId: 's-1b', episodeNumber: 2 })
    render(
      <PlayPreviewDrawer open current={e1} targets={[e1, e2]} onSelect={onSelect} onClose={vi.fn()} />,
    )
    expect(screen.getByTestId('play-preview-episodes')).toBeTruthy()
    fireEvent.click(screen.getByTestId('play-ep-s-1b'))
    expect(onSelect).toHaveBeenCalledWith(e2)
  })

  it('4. current=null → 占位不渲染 player', () => {
    render(
      <PlayPreviewDrawer open current={null} targets={[]} onSelect={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.queryByTestId('admin-player-stub')).toBeNull()
  })
})

describe('StructurePreview 内置抽屉 (13-PLAY)', () => {
  it('5. ▶ 格点击（无外部回调）→ 内置抽屉打开播放', async () => {
    getVideoMatrixMock.mockResolvedValue([makeLine('siteA', '线1', [1])])
    render(<StructurePreview videos={[{ id: 'vid-a', title: '视频 A' }]} />)
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    await waitFor(() => expect(screen.getByTestId('merge-result-structure')).toBeTruthy())
    fireEvent.click(screen.getByTestId('structure-ep-s-siteA-1'))
    await waitFor(() => expect(screen.getByTestId('admin-player-stub')).toBeTruthy())
    expect(screen.getByTestId('play-preview-current').textContent).toContain('视频 A')
  })

  it('6. 外部 onEpisodeClick 注入 → 优先外部、内置抽屉不渲染', async () => {
    getVideoMatrixMock.mockResolvedValue([makeLine('siteA', '线1', [1])])
    const onEpisodeClick = vi.fn()
    render(
      <StructurePreview videos={[{ id: 'vid-a', title: '视频 A' }]} onEpisodeClick={onEpisodeClick} />,
    )
    fireEvent.click(screen.getByTestId('merge-result-structure-toggle'))
    await waitFor(() => expect(screen.getByTestId('merge-result-structure')).toBeTruthy())
    fireEvent.click(screen.getByTestId('structure-ep-s-siteA-1'))
    expect(onEpisodeClick).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 's-siteA-1', episodeNumber: 1 }))
    expect(screen.queryByTestId('admin-player-stub')).toBeNull()
  })
})

describe('SplitAssignTable ▶ (13-PLAY)', () => {
  it('7. 行级 ▶ → onPlay 收到 PlayTarget', () => {
    const onPlay = vi.fn()
    render(
      <SplitAssignTable
        lines={[makeLine('siteA', '线1', [3])]}
        assignments={{ 's-siteA-3': 0 }}
        groupCount={2}
        groupLabels={['组1', '组2']}
        onAssign={vi.fn()}
        videoId="vid-x"
        videoTitle="某剧合集"
        onPlay={onPlay}
      />,
    )
    fireEvent.click(screen.getByTestId('split-play-s-siteA-3'))
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({
      videoId: 'vid-x',
      videoTitle: '某剧合集',
      sourceId: 's-siteA-3',
      episodeNumber: 3,
      lineLabel: '线1',
    }))
  })
})
