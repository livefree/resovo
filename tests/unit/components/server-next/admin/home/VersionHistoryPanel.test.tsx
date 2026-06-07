/**
 * VersionHistoryPanel.test.tsx — 发布版本历史 Drawer 测试
 * （CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-3.3/-3.4/-4.2）
 *
 * 覆盖（视图卡 ≥9 用例规范）：
 * - loading / error+重试 / 空版本链提示
 * - 列表：source pill（发布/回滚）/ 当前版本标记 / note·时间 meta
 * - diff：相邻较旧版本取数（serial 空洞防御——按列表序非 n-1）/ 无差异提示 /
 *   行渲染 / 二次点击折叠 / 加载失败 toast
 * - 回滚：最新版本禁用 / 确认 modal → rollbackHomeVersion + onRolledBack + 列表重拉 /
 *   失败 danger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const mockToastPush = vi.fn()
vi.mock('@resovo/admin-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resovo/admin-ui')>()
  return {
    ...actual,
    useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/home-curation/api', () => ({
  listHomeVersions: vi.fn(),
  getHomeVersion: vi.fn(),
  rollbackHomeVersion: vi.fn(),
}))

import {
  listHomeVersions,
  getHomeVersion,
  rollbackHomeVersion,
} from '../../../../../../apps/server-next/src/lib/home-curation/api'
import { VersionHistoryPanel } from '../../../../../../apps/server-next/src/app/admin/home/_client/canvas/VersionHistoryPanel'
import type {
  HomePageConfig,
  HomePublishVersionSummary,
} from '../../../../../../apps/server-next/src/lib/home-curation/types'

const mockedList = vi.mocked(listHomeVersions)
const mockedGet = vi.mocked(getHomeVersion)
const mockedRollback = vi.mocked(rollbackHomeVersion)

function summary(versionNo: number, over: Partial<HomePublishVersionSummary> = {}): HomePublishVersionSummary {
  return {
    id: `ver-${versionNo}`,
    versionNo,
    source: 'publish',
    note: null,
    publishedBy: 'u-admin',
    publishedAt: '2026-06-07T01:00:00Z',
    ...over,
  }
}

function config(modulesCount = 1): HomePageConfig {
  return {
    banners: [],
    modules: Array.from({ length: modulesCount }, (_, i) => ({
      id: `m-${i}`,
      slot: 'hot_movies' as const,
      brandScope: 'all-brands' as const,
      brandSlug: null,
      ordering: i,
      contentRefType: 'video' as const,
      contentRefId: `v-${i}`,
      title: {},
      imageUrl: null,
      startAt: null,
      endAt: null,
      enabled: true,
      metadata: {},
    })),
    settings: (['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime'] as const).map((section) => ({
      section,
      autofillMode: 'manual_plus_autofill' as const,
      refreshIntervalMinutes: 60,
      displayCount: 10,
      allowDuplicates: false,
      pinnedLimit: null,
      settings: {},
    })),
  }
}

function renderPanel(over: Partial<Parameters<typeof VersionHistoryPanel>[0]> = {}) {
  const onRolledBack = vi.fn()
  const view = render(
    <VersionHistoryPanel open onClose={vi.fn()} onRolledBack={onRolledBack} {...over} />,
  )
  return { ...view, onRolledBack }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockedList.mockResolvedValue({ rows: [summary(3), summary(2, { source: 'rollback', note: 'rollback to v1' }), summary(1)], total: 3, page: 1, limit: 50 })
})

describe('VersionHistoryPanel — 列表', () => {
  it('打开即拉取列表：行渲染 + source pill + 当前版本标记', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-list')).not.toBeNull())
    expect(screen.getByTestId('version-source-3').textContent).toContain('v3 · 发布')
    expect(screen.getByTestId('version-source-2').textContent).toContain('v2 · 回滚')
    expect(screen.getByTestId('version-row-3').textContent).toContain('当前版本')
    expect(screen.getByTestId('version-row-2').textContent).toContain('rollback to v1')
  })

  it('加载失败 → 错误态 + 重试重拉', async () => {
    mockedList.mockRejectedValueOnce(new Error('网络错误'))
    renderPanel()
    await waitFor(() => expect(screen.queryByText('版本列表加载失败')).not.toBeNull())
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.queryByTestId('version-list')).not.toBeNull())
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('空版本链 → 冷启动语义提示（D-185-1.5）', async () => {
    mockedList.mockResolvedValue({ rows: [], total: 0, page: 1, limit: 50 })
    renderPanel()
    await waitFor(() => expect(screen.queryByText('暂无发布版本')).not.toBeNull())
  })

  it('关闭态不拉取', () => {
    renderPanel({ open: false })
    expect(mockedList).not.toHaveBeenCalled()
  })
})

describe('VersionHistoryPanel — diff（D-185-4.2 消费端计算）', () => {
  it('对比上一版：按列表序取相邻较旧版本两份详情（serial 空洞防御，非 n-1 推算）', async () => {
    // 列表 v3/v2/v1 但模拟空洞：v3 与 v1（中间 v2 在列表里——用自定义列表验证相邻取数）
    mockedList.mockResolvedValue({ rows: [summary(5), summary(3)], total: 2, page: 1, limit: 50 })
    mockedGet.mockImplementation(async (n: number) => ({
      ...summary(n),
      config: n === 5 ? config(2) : config(1),
    }))
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-diff-btn-5')).not.toBeNull())

    fireEvent.click(screen.getByTestId('version-diff-btn-5'))
    await waitFor(() => expect(screen.queryByTestId('version-diff-line-5-hot_movies')).not.toBeNull())
    // 相邻较旧版本 = v3（非 v4）
    expect(mockedGet).toHaveBeenCalledWith(3)
    expect(mockedGet).toHaveBeenCalledWith(5)
    expect(screen.getByTestId('version-diff-line-5-hot_movies').textContent).toContain('+1 新增')
  })

  it('无内容差异 → 「与上一版无内容差异」', async () => {
    mockedGet.mockImplementation(async (n: number) => ({ ...summary(n), config: config(1) }))
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-diff-btn-3')).not.toBeNull())
    fireEvent.click(screen.getByTestId('version-diff-btn-3'))
    await waitFor(() => expect(screen.queryByTestId('version-diff-empty-3')).not.toBeNull())
  })

  it('再次点击折叠 diff 区', async () => {
    mockedGet.mockImplementation(async (n: number) => ({ ...summary(n), config: config(1) }))
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-diff-btn-3')).not.toBeNull())
    fireEvent.click(screen.getByTestId('version-diff-btn-3'))
    await waitFor(() => expect(screen.queryByTestId('version-diff-3')).not.toBeNull())
    fireEvent.click(screen.getByTestId('version-diff-btn-3'))
    expect(screen.queryByTestId('version-diff-3')).toBeNull()
  })

  it('最旧版本无「对比上一版」按钮；diff 取数失败 → danger toast + 折叠', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-list')).not.toBeNull())
    expect(screen.queryByTestId('version-diff-btn-1')).toBeNull() // 最旧行

    fireEvent.click(screen.getByTestId('version-diff-btn-3'))
    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: 'diff 加载失败',
      level: 'danger',
    })))
    expect(screen.queryByTestId('version-diff-3')).toBeNull()
  })
})

describe('VersionHistoryPanel — 回滚（D-185-3.4 roll-forward）', () => {
  it('最新版本回滚按钮禁用（即当前发布态）', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-rollback-btn-3')).not.toBeNull())
    expect((screen.getByTestId('version-rollback-btn-3') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('version-rollback-btn-1') as HTMLButtonElement).disabled).toBe(false)
  })

  it('回滚：确认 modal → rollbackHomeVersion + success + onRolledBack + 列表重拉', async () => {
    mockedRollback.mockResolvedValue({ versionNo: 4 })
    const { onRolledBack } = renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-rollback-btn-1')).not.toBeNull())

    fireEvent.click(screen.getByTestId('version-rollback-btn-1'))
    await waitFor(() => expect(screen.queryByTestId('rollback-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('rollback-confirm-btn'))

    await waitFor(() => expect(mockedRollback).toHaveBeenCalledWith(1))
    await waitFor(() => expect(onRolledBack).toHaveBeenCalledWith(4))
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      level: 'success',
      title: expect.stringContaining('v4'),
    }))
    expect(mockedList).toHaveBeenCalledTimes(2) // roll-forward 后重拉
  })

  it('回滚失败（版本数不足 422 等）→ danger toast，列表不重拉', async () => {
    mockedRollback.mockRejectedValue(new Error('版本数不足，无可回滚目标'))
    const { onRolledBack } = renderPanel()
    await waitFor(() => expect(screen.queryByTestId('version-rollback-btn-1')).not.toBeNull())

    fireEvent.click(screen.getByTestId('version-rollback-btn-1'))
    await waitFor(() => expect(screen.queryByTestId('rollback-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('rollback-confirm-btn'))

    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: '回滚失败',
      description: '版本数不足，无可回滚目标',
      level: 'danger',
    })))
    expect(onRolledBack).not.toHaveBeenCalled()
    expect(mockedList).toHaveBeenCalledTimes(1)
  })
})
