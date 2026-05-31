/**
 * TabDetailEpisodes.test.tsx — CHG-367-B-B / ADR-163 §6 + Y1
 *
 * 验证审核台 TabDetail 三维集数显示 + Y1 防御：
 *   - "已收 / 已播 / 共" 按字段 NULL 状态降级
 *   - currentEpisodes > totalEpisodes 触发 Y1 数据异常标记
 *   - type='movie' 仅显示"已收"维度
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideoSources: vi.fn().mockResolvedValue([]),
  getVideo: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  reprobeRoute: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { TabDetail } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail'

function makeFixture(overrides: Partial<{
  type: string; episodeCount: number; totalEpisodes: number | null; currentEpisodes: number | null
}>) {
  return {
    id: 'video-uuid', title: 'X', shortId: 'V001',
    type: 'series', year: 2024, country: 'CN',
    episodeCount: 8, totalEpisodes: null, currentEpisodes: null,
    metaScore: 80, sourceCheckStatus: 'pending', doubanStatus: 'pending',
    isPublished: false, visibilityStatus: 'private', reviewStatus: 'pending',
    ...overrides,
  } as unknown as Parameters<typeof TabDetail>[0]['v']
}

describe('TabDetail · episodes 三维显示 (CHG-367-B-B / ADR-163 §6)', () => {
  it('three fields all set → "已收 8 / 已播 12 / 共 24"', () => {
    render(<TabDetail v={makeFixture({ episodeCount: 8, currentEpisodes: 12, totalEpisodes: 24 })} />)
    expect(screen.getByText('已收 8 / 已播 12 / 共 24')).toBeTruthy()
  })

  it('only episodeCount + totalEpisodes → "已收 8 / 共 24" (current=null skipped)', () => {
    render(<TabDetail v={makeFixture({ episodeCount: 8, currentEpisodes: null, totalEpisodes: 24 })} />)
    expect(screen.getByText('已收 8 / 共 24')).toBeTruthy()
  })

  it('only episodeCount → "已收 8" (single dimension fallback)', () => {
    render(<TabDetail v={makeFixture({ episodeCount: 8, currentEpisodes: null, totalEpisodes: null })} />)
    expect(screen.getByText('已收 8')).toBeTruthy()
  })

  it('type="movie" → "已收 1"（仅单维 / D-163-3 电影无 total/current 语义）', () => {
    render(<TabDetail v={makeFixture({ type: 'movie', episodeCount: 1, currentEpisodes: 24, totalEpisodes: 24 })} />)
    // 电影类型即使有 total/current 也只显示已收 1
    expect(screen.getByText('已收 1')).toBeTruthy()
  })

  it('Y1 防御: currentEpisodes > totalEpisodes → 仅显示 current + 数据异常标记', () => {
    render(<TabDetail v={makeFixture({ episodeCount: 8, currentEpisodes: 13, totalEpisodes: 12 })} />)
    // "已收 8 / 已播 13" + 数据异常 span（颜色 var(--state-warning-fg)）
    expect(screen.getByText(/已收 8/)).toBeTruthy()
    expect(screen.getByText(/已播 13/)).toBeTruthy()
    expect(screen.getByText(/数据异常/)).toBeTruthy()
    // 不应该出现 "共 12"
    expect(screen.queryByText(/共 12/)).toBeNull()
  })
})
