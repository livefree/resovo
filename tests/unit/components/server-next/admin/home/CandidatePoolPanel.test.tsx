/**
 * CandidatePoolPanel.test.tsx — 候选池面板测试（CHG-HOME-AUTOFILL-UI / 方案 §2.3 + §12）
 *
 * 覆盖（视图卡 ≥9 用例规范）：
 * - loading / error+重试 / 快照未生成提示
 * - 解释展示：snapshot meta（时间+策略版本+候选数）/ origin 中文映射 + 未知降级 /
 *   filtered 标灰 filterReason 映射 + 未知降级 / applied 已应用态
 * - 可跳过可应用：复选选择 → 应用调用 + onApplied；409 整体拒绝提示 + 重拉
 * - 立即刷新：202 成功 / 429 进行中 warn / manual_only 禁用
 * - banner 分支：预填上抛 + 无复选框；type_shortcuts 无候选源不发请求
 * - gaps 折叠展开
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// useToast 捕获（HomeCanvas.test 同范式）；其余 admin-ui 导出走真实现
const mockToastPush = vi.fn()
vi.mock('@resovo/admin-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resovo/admin-ui')>()
  return {
    ...actual,
    useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/home-curation/api', () => ({
  getAutofillCandidates: vi.fn(),
  applyAutofillCandidates: vi.fn(),
  refreshSectionCandidates: vi.fn(),
}))

import {
  getAutofillCandidates,
  applyAutofillCandidates,
  refreshSectionCandidates,
} from '../../../../../../apps/server-next/src/lib/home-curation/api'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'
import { CandidatePoolPanel } from '../../../../../../apps/server-next/src/app/admin/home/_client/canvas/CandidatePoolPanel'
import type {
  AutofillCandidate,
  AutofillCandidatesResult,
} from '../../../../../../apps/server-next/src/lib/home-curation/types'

const mockedGet = vi.mocked(getAutofillCandidates)
const mockedApply = vi.mocked(applyAutofillCandidates)
const mockedRefresh = vi.mocked(refreshSectionCandidates)

function candidate(over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id: 'c-1',
    videoId: 'v-1',
    videoSummary: {
      title: '示例电影',
      slug: 'sample-movie',
      coverUrl: 'https://cdn.example.com/p.jpg',
      type: 'movie',
      year: 2024,
      rating: 8.5,
      sourceCount: 2,
    },
    score: 0.812,
    rank: 1,
    origin: 'douban',
    filtered: false,
    ...over,
  }
}

function result(over: Partial<AutofillCandidatesResult> = {}): AutofillCandidatesResult {
  return {
    candidates: [candidate()],
    snapshotAt: '2026-06-06T08:00:00Z',
    policyVersion: 'hp-v1',
    ...over,
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockedGet.mockResolvedValue(result())
})

describe('CandidatePoolPanel — 加载与状态', () => {
  it('加载中提示', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    expect(screen.getByTestId('candidate-pool-loading')).not.toBeNull()
  })

  it('加载失败 → 错误提示 + 重试重拉', async () => {
    mockedGet.mockRejectedValueOnce(new Error('网络错误'))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-error')).not.toBeNull())
    expect(screen.getByTestId('candidate-pool-error').textContent).toContain('网络错误')

    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-list')).not.toBeNull())
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('快照未生成（snapshotAt null）→ 引导提示', async () => {
    mockedGet.mockResolvedValue(result({ candidates: [], snapshotAt: null, policyVersion: null }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-no-snapshot')).not.toBeNull())
  })

  it('拉取恒带 include_filtered=true（解释展示前提）', async () => {
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('hot_movies', { includeFiltered: true }))
  })
})

describe('CandidatePoolPanel — 解释展示（方案 §2.3）', () => {
  it('快照 meta：生成时间 + 策略版本 + 候选数', async () => {
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-meta')).not.toBeNull())
    const meta = screen.getByTestId('candidate-pool-meta').textContent ?? ''
    expect(meta).toContain('策略 hp-v1')
    expect(meta).toContain('候选 1 条')
  })

  it('候选行：rank 前缀 + origin 中文映射 + 分数', async () => {
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-row-c-1')).not.toBeNull())
    const row = screen.getByTestId('candidate-row-c-1')
    expect(row.textContent).toContain('1. 示例电影')
    expect(screen.getByTestId('candidate-origin-c-1').textContent).toBe('豆瓣')
    expect(row.textContent).toContain('分 0.812')
  })

  it('未知 origin 原样降级展示（开放字符串，D-182-4.4）', async () => {
    mockedGet.mockResolvedValue(result({ candidates: [candidate({ origin: 'future_source' })] }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-origin-c-1')).not.toBeNull())
    expect(screen.getByTestId('candidate-origin-c-1').textContent).toBe('future_source')
  })

  it('filtered 候选：filterReason 中文映射 + 无复选框（rank=0 哨兵无前缀）', async () => {
    mockedGet.mockResolvedValue(result({
      candidates: [candidate({ id: 'c-f', filtered: true, filterReason: 'not_published', rank: 0 })],
    }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-filter-reason-c-f')).not.toBeNull())
    expect(screen.getByTestId('candidate-filter-reason-c-f').textContent).toBe('未发布')
    expect(screen.queryByTestId('candidate-check-c-f')).toBeNull()
    expect(screen.getByTestId('candidate-row-c-f').textContent).not.toContain('0. 示例电影')
  })

  it('未知 filterReason 原样降级展示', async () => {
    mockedGet.mockResolvedValue(result({
      candidates: [candidate({ id: 'c-f2', filtered: true, filterReason: 'future_reason', rank: 0 })],
    }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-filter-reason-c-f2')).not.toBeNull())
    expect(screen.getByTestId('candidate-filter-reason-c-f2').textContent).toBe('future_reason')
  })

  it('已应用候选：已应用 Pill + 无复选框', async () => {
    mockedGet.mockResolvedValue(result({
      candidates: [candidate({ id: 'c-a', appliedAt: '2026-06-06T09:00:00Z' })],
    }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-applied-c-a')).not.toBeNull())
    expect(screen.queryByTestId('candidate-check-c-a')).toBeNull()
  })
})

describe('CandidatePoolPanel — 可跳过可应用（方案 §12 / D-182-4.5）', () => {
  it('选择部分候选应用（跳过未选）→ applyAutofillCandidates 仅携选中 + onApplied + 重拉', async () => {
    mockedGet.mockResolvedValue(result({
      candidates: [candidate({ id: 'c-1' }), candidate({ id: 'c-2', videoId: 'v-2', rank: 2 })],
    }))
    mockedApply.mockResolvedValue({ applied: 1 })
    const onApplied = vi.fn()
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={onApplied} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-apply-btn')).not.toBeNull())

    // 应用按钮初始 disabled（零选中）
    expect((screen.getByTestId('candidate-pool-apply-btn') as HTMLButtonElement).disabled).toBe(true)

    const check = screen.getByTestId('candidate-check-c-1').querySelector('input') ??
      (screen.getByTestId('candidate-check-c-1') as HTMLInputElement)
    fireEvent.click(check)
    await waitFor(() =>
      expect(screen.getByTestId('candidate-pool-selected-count').textContent).toContain('已选 1 / 可选 2'))

    fireEvent.click(screen.getByTestId('candidate-pool-apply-btn'))
    await waitFor(() => expect(mockedApply).toHaveBeenCalledWith('hot_movies', ['c-1']))
    await waitFor(() => expect(onApplied).toHaveBeenCalled())
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' }))
    // 应用成功重拉快照（appliedAt 派生更新）
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })

  it('应用 409（全有或全无整体拒绝）→ danger 提示 + 重拉最新快照', async () => {
    mockedApply.mockRejectedValue(new ApiClientError('STATE_CONFLICT', '候选已失效: c-1', 409))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-check-c-1')).not.toBeNull())

    const check = screen.getByTestId('candidate-check-c-1').querySelector('input') ??
      (screen.getByTestId('candidate-check-c-1') as HTMLInputElement)
    fireEvent.click(check)
    fireEvent.click(screen.getByTestId('candidate-pool-apply-btn'))

    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      level: 'danger',
      title: expect.stringContaining('整体拒绝'),
      description: '候选已失效: c-1',
    })))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })
})

describe('CandidatePoolPanel — 立即刷新（端点 #7）', () => {
  it('202 入队成功 → success 提示（异步语义）', async () => {
    mockedRefresh.mockResolvedValue({ enqueued: true })
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-refresh-btn')).not.toBeNull())

    fireEvent.click(screen.getByTestId('candidate-pool-refresh-btn'))
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalledWith('hot_movies'))
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      level: 'success',
      title: '已加入重算队列',
    }))
  })

  it('429 进行中 → warn 提示', async () => {
    mockedRefresh.mockRejectedValue(new ApiClientError('RATE_LIMITED', '已有进行中的重算任务', 429))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-refresh-btn')).not.toBeNull())

    fireEvent.click(screen.getByTestId('candidate-pool-refresh-btn'))
    await waitFor(() => expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: '已有进行中的重算任务',
    })))
  })

  it('manual_only：提示 + 刷新按钮禁用（端点会 422）', async () => {
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_only" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-manual-only-hint')).not.toBeNull())
    expect((screen.getByTestId('candidate-pool-refresh-btn') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('CandidatePoolPanel — 区块分支', () => {
  it('banner：提示 + 预填上抛（onBannerPrefill 携候选）+ 无复选框无应用按钮', async () => {
    const onPrefill = vi.fn()
    render(
      <CandidatePoolPanel
        section="banner"
        autofillMode="suggest_only"
        onApplied={vi.fn()}
        onBannerPrefill={onPrefill}
      />,
    )
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-banner-hint')).not.toBeNull())
    await waitFor(() => expect(screen.queryByTestId('candidate-prefill-c-1')).not.toBeNull())
    expect(screen.queryByTestId('candidate-check-c-1')).toBeNull()
    expect(screen.queryByTestId('candidate-pool-apply-btn')).toBeNull()

    fireEvent.click(screen.getByTestId('candidate-prefill-c-1'))
    expect(onPrefill).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1', videoId: 'v-1' }))
  })

  it('type_shortcuts：无候选源提示且不发请求', () => {
    render(<CandidatePoolPanel section="type_shortcuts" autofillMode="manual_only" onApplied={vi.fn()} />)
    expect(screen.getByTestId('candidate-pool-no-source')).not.toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })
})

describe('CandidatePoolPanel — 内容缺口（D-183-7.3）', () => {
  it('gaps 折叠展开：toggle 显示 provider 中文 + 标题 + 分数', async () => {
    mockedGet.mockResolvedValue(result({
      gaps: [
        { provider: 'douban', externalId: 'd-1', title: '霸王别姬', score: 0.681, rank: 1 },
        { provider: 'unknown_provider', externalId: 'x-1', title: '某新源条目', score: 0.5 },
      ],
    }))
    render(<CandidatePoolPanel section="hot_movies" autofillMode="manual_plus_autofill" onApplied={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('candidate-pool-gaps-toggle')).not.toBeNull())
    expect(screen.getByTestId('candidate-pool-gaps-toggle').textContent).toContain('内容缺口 2')
    expect(screen.queryByTestId('candidate-pool-gaps-list')).toBeNull()

    fireEvent.click(screen.getByTestId('candidate-pool-gaps-toggle'))
    const list = screen.getByTestId('candidate-pool-gaps-list')
    expect(list.textContent).toContain('豆瓣')
    expect(list.textContent).toContain('霸王别姬')
    expect(list.textContent).toContain('分 0.681')
    // 未知 provider 原样降级
    expect(list.textContent).toContain('unknown_provider')
  })
})
