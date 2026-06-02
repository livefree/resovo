/**
 * VideoListClient.layout-reset.test.tsx — 列重构布局失效回归（CHG-VSR-4-A / Codex stop-time review）
 *
 * 背景：`useTableQuery` 把列可见性持久化到 localStorage `admin-ui:table:{tableId}:v2`；
 * storage-sync 仅做 schema 校验、不对账列集默认可见性变化。§2.2 列重构后，回访用户旧 stored
 * 偏好（source_health/probe/visibility/review 显示、updated 隐藏）会覆盖新 defaultVisible →
 * 新默认表不可靠生效。修复：tableId bump 'admin-videos'→'admin-videos-v2' 失效旧布局。
 *
 * 本测试在独立模块（vitest isolate → tableQueryStore 单例全新）预置**旧 key** stale 偏好，
 * 断言新默认列生效（旧 key 被忽略）。若 tableId 被误 revert 回 'admin-videos'，本测试会读到
 * 旧 key 的 source_health:visible → source-health 渲染 → 失败（回归护栏）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const listVideosMock = vi.fn()

vi.mock('@/lib/videos/api', () => ({
  listVideos: (...args: unknown[]) => listVideosMock(...args),
  batchPublish: vi.fn(),
  batchUnpublish: vi.fn(),
  reviewVideo: vi.fn(),
}))
vi.mock('@/lib/crawler/api', () => ({ listCrawlerSites: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/videos',
}))
vi.mock('@/app/admin/videos/_client/VideoEditDrawer', () => ({ VideoEditDrawer: () => null }))
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return { ...actual, useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }) }
})

import { VideoListClient } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoListClient'

const ROW = {
  id: 'vid-1', short_id: 'abc1234', title: '示例视频', title_en: 'Sample', cover_url: null,
  type: 'series' as const, year: 2024, is_published: true, source_count: '5', active_source_count: '5',
  visibility_status: 'public' as const, review_status: 'approved' as const,
  created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-20T10:00:00Z',
  episode_count: 12, current_episodes: 12, total_episodes: 12,
}

// 旧 tableId='admin-videos' 布局 key（CHG-VSR-4-A bump 前）；预置 stale 列可见性
const LEGACY_LAYOUT_KEY = 'admin-ui:table:admin-videos:v2'

beforeEach(() => {
  listVideosMock.mockReset()
  localStorage.clear()
  // 模拟回访用户旧偏好：source_health 显示（新默认应隐藏）、updated_at 隐藏（新默认应显示）
  localStorage.setItem(LEGACY_LAYOUT_KEY, JSON.stringify({
    columns: {
      source_health: { visible: true },
      updated_at: { visible: false },
      visibility: { visible: true },
      review_status: { visible: true },
    },
  }))
})

describe('VideoListClient — 列重构布局失效（回访用户获得新默认列）', () => {
  it('旧 tableId 的 stale 列偏好被忽略 → source_health 仍隐藏 + 新默认复合列渲染', async () => {
    listVideosMock.mockResolvedValue({ data: [ROW], total: 1, page: 1, limit: 20 })
    render(<VideoListClient />)
    // 行渲染锚点：title 列始终可见
    await screen.findByText('示例视频')
    // 新默认可见复合列渲染（episodes / status）
    await waitFor(() => expect(screen.getByTestId('episodes-cell')).toBeTruthy())
    expect(screen.getByTestId('status-cell')).toBeTruthy()
    // 关键断言：source_health 列在新默认下隐藏；旧 key 的 visible:true 不生效（tableId 已 bump）
    expect(screen.queryByTestId('source-health')).toBeNull()
  })
})
