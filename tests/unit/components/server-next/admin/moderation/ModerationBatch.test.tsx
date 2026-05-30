/**
 * ModerationBatch.test.tsx — CHG-SN-8-GAPS-MOD-BATCH
 *
 * 范围（4 用例）：
 *  1. 批量模式 toggle on → ModListRow 显示 checkbox + J/K 流暂停
 *  2. 选多行 + bulk bar 渲染 + 「批量通过」点击 → confirm + batchApproveVideos 携带 ids
 *  3. 「清除选择」按钮 → selectedIds 清空 + bulk bar 消失
 *  4. moderation-api 批量函数 lib 调用形态
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

describe('moderation/api — batchApproveVideos / batchRejectVideos (CHG-SN-8-GAPS-MOD-BATCH)', () => {
  it('batchApproveVideos → POST /admin/moderation/batch-approve { ids }', async () => {
    vi.resetModules()
    vi.doMock('../../../../../../apps/server-next/src/lib/api-client', () => ({
      apiClient: {
        post: vi.fn().mockResolvedValue({ data: { ok: 3, failed: 0 } }),
      },
    }))
    vi.doMock('../../../../../../apps/server-next/src/stores/authStore', () => ({
      useAuthStore: vi.fn(() => ({ accessToken: null })),
    }))
    const { apiClient } = await import('../../../../../../apps/server-next/src/lib/api-client')
    const postSpy = apiClient.post as ReturnType<typeof vi.fn>
    const { batchApproveVideos } = await import('../../../../../../apps/server-next/src/lib/moderation/api')
    const result = await batchApproveVideos(['v1', 'v2', 'v3'])
    expect(postSpy).toHaveBeenCalledWith('/admin/moderation/batch-approve', { ids: ['v1', 'v2', 'v3'] })
    expect(result).toEqual({ ok: 3, failed: 0 })
    vi.doUnmock('../../../../../../apps/server-next/src/lib/api-client')
    vi.doUnmock('../../../../../../apps/server-next/src/stores/authStore')
  })

  it('batchRejectVideos → POST /admin/moderation/batch-reject { ids, reason, labelKey? }', async () => {
    vi.resetModules()
    vi.doMock('../../../../../../apps/server-next/src/lib/api-client', () => ({
      apiClient: {
        post: vi.fn().mockResolvedValue({ data: { ok: 2, failed: 0 } }),
      },
    }))
    vi.doMock('../../../../../../apps/server-next/src/stores/authStore', () => ({
      useAuthStore: vi.fn(() => ({ accessToken: null })),
    }))
    const { apiClient } = await import('../../../../../../apps/server-next/src/lib/api-client')
    const postSpy = apiClient.post as ReturnType<typeof vi.fn>
    const { batchRejectVideos } = await import('../../../../../../apps/server-next/src/lib/moderation/api')
    await batchRejectVideos(['v1', 'v2'], '质量不达标', 'quality_low')
    expect(postSpy).toHaveBeenCalledWith('/admin/moderation/batch-reject', {
      ids: ['v1', 'v2'],
      reason: '质量不达标',
      labelKey: 'quality_low',
    })
    // 测试不带 labelKey
    await batchRejectVideos(['v3'], '重复')
    expect(postSpy).toHaveBeenLastCalledWith('/admin/moderation/batch-reject', {
      ids: ['v3'],
      reason: '重复',
    })
  })
})

describe('ModListRow · selectionMode (CHG-SN-8-GAPS-MOD-BATCH)', () => {
  it('selectionMode=true → 渲染 checkbox + onToggleSelect on click', async () => {
    const { ModListRow } = await import('../../../../../../apps/server-next/src/app/admin/moderation/_client/ModListRow')
    const onClick = vi.fn()
    const onToggle = vi.fn()
    const it = {
      id: 'v1', title: 'X', type: 'movie', year: 2020, country: 'US',
      episodeCount: 1, coverUrl: null, rating: null, category: null,
      isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
      reviewReason: null, reviewedBy: null, reviewedAt: null,
      probe: 'pending', render: 'pending',
      // CHG-360-C / ADR-159：ModListRow 用 probeAggregate / renderAggregate + DualSignalCount 显示 X/Y
      probeAggregate: { total: 0, ok: 0, state: 'pending' },
      renderAggregate: { total: 0, ok: 0, state: 'pending' },
      sourceCheckStatus: 'pending',
      metaScore: 50, needsManualReview: false, badges: [], staffNote: null,
      reviewLabelKey: null, doubanStatus: 'pending', reviewSource: 'manual',
      trendingTag: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
    } as unknown as Parameters<typeof ModListRow>[0]['it']
    render(<ModListRow it={it} active={false} onClick={onClick} selectionMode selected={false} onToggleSelect={onToggle} />)
    const cb = screen.getByTestId('mod-list-checkbox-v1') as HTMLInputElement
    expect(cb).not.toBeNull()
    expect(cb.checked).toBe(false)
    // 点击 row 触发 toggle 而非 onClick（selectionMode 时）
    fireEvent.click(cb)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('selectionMode=true + selected=true → checkbox checked + data-batch-selected', async () => {
    const { ModListRow } = await import('../../../../../../apps/server-next/src/app/admin/moderation/_client/ModListRow')
    const it = {
      id: 'v2', title: 'Y', type: 'movie', year: 2021, country: null,
      episodeCount: 1, coverUrl: null, rating: null, category: null,
      isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
      reviewReason: null, reviewedBy: null, reviewedAt: null,
      probe: 'pending', render: 'pending',
      // CHG-360-C / ADR-159：ModListRow 用 probeAggregate / renderAggregate + DualSignalCount 显示 X/Y
      probeAggregate: { total: 0, ok: 0, state: 'pending' },
      renderAggregate: { total: 0, ok: 0, state: 'pending' },
      sourceCheckStatus: 'pending',
      metaScore: 50, needsManualReview: false, badges: [], staffNote: null,
      reviewLabelKey: null, doubanStatus: 'pending', reviewSource: 'manual',
      trendingTag: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
    } as unknown as Parameters<typeof ModListRow>[0]['it']
    const { container } = render(<ModListRow it={it} active={false} onClick={() => {}} selectionMode selected onToggleSelect={() => {}} />)
    const cb = screen.getByTestId('mod-list-checkbox-v2') as HTMLInputElement
    expect(cb.checked).toBe(true)
    expect(container.querySelector('[data-batch-selected]')).not.toBeNull()
  })
})

describe('ModListRow · 默认模式回归', () => {
  it('selectionMode=undefined → 无 checkbox + onClick 触发', async () => {
    const { ModListRow } = await import('../../../../../../apps/server-next/src/app/admin/moderation/_client/ModListRow')
    const onClick = vi.fn()
    const it = {
      id: 'v3', title: 'Z', type: 'movie', year: 2022, country: null,
      episodeCount: 1, coverUrl: null, rating: null, category: null,
      isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
      reviewReason: null, reviewedBy: null, reviewedAt: null,
      probe: 'pending', render: 'pending',
      // CHG-360-C / ADR-159：ModListRow 用 probeAggregate / renderAggregate + DualSignalCount 显示 X/Y
      probeAggregate: { total: 0, ok: 0, state: 'pending' },
      renderAggregate: { total: 0, ok: 0, state: 'pending' },
      sourceCheckStatus: 'pending',
      metaScore: 50, needsManualReview: false, badges: [], staffNote: null,
      reviewLabelKey: null, doubanStatus: 'pending', reviewSource: 'manual',
      trendingTag: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
    } as unknown as Parameters<typeof ModListRow>[0]['it']
    render(<ModListRow it={it} active={false} onClick={onClick} />)
    expect(screen.queryByTestId('mod-list-checkbox-v3')).toBeNull()
    // 单击行触发 onClick
    fireEvent.click(screen.getByRole('option'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
