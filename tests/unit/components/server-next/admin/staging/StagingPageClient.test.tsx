/**
 * StagingPageClient.test.tsx — 暂存发布独立页单元测试（CHG-SN-7-REDO-04-B）
 *
 * 范围：
 *   - case A：接口成功 → 页面标题 / 流水线统计 / 表格行渲染
 *   - case B：接口失败 → ErrorState 兜底
 *   - case C：批量发布 → toast success + 刷新
 *   - case D：单行发布 → toast success + 刷新
 *   - case E：单行退回 → toast success + 刷新
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// ── mock staging/api ────────────────────────────────────────────────

const listStagingVideosMock = vi.fn()
const saveStagingRulesMock = vi.fn()
const publishStagingVideoMock = vi.fn()
const batchPublishStagingVideosMock = vi.fn()
const revertStagingVideoMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/staging/api', () => ({
  listStagingVideos: (...args: unknown[]) => listStagingVideosMock(...args),
  saveStagingRules: (...args: unknown[]) => saveStagingRulesMock(...args),
  publishStagingVideo: (...args: unknown[]) => publishStagingVideoMock(...args),
  batchPublishStagingVideos: (...args: unknown[]) => batchPublishStagingVideosMock(...args),
  revertStagingVideo: (...args: unknown[]) => revertStagingVideoMock(...args),
}))

// ── mock api-client（断开 authStore 依赖链）─────────────────────────

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    constructor(msg: string) { super(msg) }
  }
  return {
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    ApiClientError: MockApiClientError,
  }
})

// ── mock @resovo/admin-ui（保留实现，spy useToast）──────────────────

const toastPushMock = vi.fn()

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
    }),
  }
})

import { StagingPageClient } from '../../../../../../apps/server-next/src/app/admin/staging/_client/StagingPageClient'

// ── fixtures ────────────────────────────────────────────────────────

const BASE_RULES = {
  minMetaScore: 60,
  requireDoubanMatched: true,
  requireCoverUrl: true,
  minActiveSourceCount: 1,
}

const BASE_SUMMARY = { all: 10, ready: 6, warning: 3, blocked: 1 }

function makeRow(overrides: Partial<{ id: string; title: string; readiness: { ready: boolean; blockers: string[] } }> = {}) {
  return {
    id: overrides.id ?? 'v-001',
    title: overrides.title ?? '测试视频',
    type: 'movie',
    year: 2024,
    coverUrl: null,
    doubanStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 75,
    activeSourceCount: 2,
    qualityHighest: 'HD',
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readiness: overrides.readiness ?? { ready: true, blockers: [] },
  }
}

function makeListResponse(overrides: Partial<{ data: ReturnType<typeof makeRow>[]; total: number }> = {}) {
  return {
    data: overrides.data ?? [makeRow()],
    total: overrides.total ?? 1,
    rules: BASE_RULES,
    summary: BASE_SUMMARY,
  }
}

afterEach(() => {
  cleanup()
  listStagingVideosMock.mockReset()
  saveStagingRulesMock.mockReset()
  publishStagingVideoMock.mockReset()
  batchPublishStagingVideosMock.mockReset()
  revertStagingVideoMock.mockReset()
  toastPushMock.mockReset()
})

// ── case A：接口成功 ────────────────────────────────────────────────

describe('case A：接口成功', () => {
  beforeEach(() => {
    listStagingVideosMock.mockResolvedValue(makeListResponse())
  })

  it('渲染页面标题 + subtitle', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByTestId('staging-page')).toBeTruthy())
    expect(screen.getByText('暂存发布')).toBeTruthy()
    expect(screen.getByText('1 条待发布')).toBeTruthy()
  })

  it('渲染表格行（title 可见）', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).toBeTruthy())
  })

  it('流水线统计卡标题渲染', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByText('发布流水线')).toBeTruthy())
    expect(screen.getByText('当前暂存队列就绪分布')).toBeTruthy()
    // 全部/就绪/警告/阻塞 标签均可见
    expect(screen.getAllByText('全部').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('就绪').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('警告').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('阻塞').length).toBeGreaterThanOrEqual(1)
  })

  it('DataTable 挂载（data-testid="staging-table"）', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByTestId('staging-table')).toBeTruthy())
  })
})

// ── case B：接口失败 ────────────────────────────────────────────────

describe('case B：接口失败', () => {
  it('渲染 ErrorState 兜底，不渲染表格', async () => {
    listStagingVideosMock.mockRejectedValue(new Error('网络错误'))
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.queryByTestId('staging-table')).toBeNull())
    expect(screen.getByText('加载失败')).toBeTruthy()
  })
})

// ── case C：批量发布 ────────────────────────────────────────────────

describe('case C：批量发布', () => {
  beforeEach(() => {
    listStagingVideosMock.mockResolvedValue(makeListResponse())
    batchPublishStagingVideosMock.mockResolvedValue({ published: 5, skipped: 1 })
  })

  it('点击批量发布 → 调用 API + toast success', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).toBeTruthy())
    fireEvent.click(screen.getByText('批量发布就绪'))
    await waitFor(() => expect(batchPublishStagingVideosMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'success', title: expect.stringContaining('5') }),
    ))
  })
})

// ── case D：单行发布 ────────────────────────────────────────────────

describe('case D：单行发布', () => {
  beforeEach(() => {
    listStagingVideosMock.mockResolvedValue(makeListResponse())
    publishStagingVideoMock.mockResolvedValue(undefined)
  })

  it('点击"发布"按钮 → 调用 publishStagingVideo + toast', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).toBeTruthy())
    fireEvent.click(screen.getByText('发布'))
    await waitFor(() => expect(publishStagingVideoMock).toHaveBeenCalledWith('v-001'))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'success' }),
    ))
  })
})

// ── case E：单行退回 ────────────────────────────────────────────────

describe('case E：单行退回', () => {
  beforeEach(() => {
    listStagingVideosMock.mockResolvedValue(makeListResponse())
    revertStagingVideoMock.mockResolvedValue(undefined)
  })

  it('点击"退回"按钮 → 调用 revertStagingVideo + toast', async () => {
    render(<StagingPageClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).toBeTruthy())
    fireEvent.click(screen.getByText('退回'))
    await waitFor(() => expect(revertStagingVideoMock).toHaveBeenCalledWith('v-001'))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info' }),
    ))
  })
})
