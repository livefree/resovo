/**
 * TabDetailMetadataStatus.test.tsx — META-34 / ADR-201 §审核详情
 *
 * 真源：apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail.tsx
 *
 * 验证审核台 TabDetail 元数据散落 4 处收敛为单一「元数据状态」section：
 *   - triad 仅留发布/可见性/审核（豆瓣 pill 移除，业务边界保留）
 *   - 「富集」section / 裸 meta_score 行 / 独立「外部元数据」section 全移除
 *   - 懒加载 extDetail.metadataStatus → MetadataStatusPanel variant="detail"
 *   - 加载中 / 加载失败 / 已加载但无 metadataStatus 三态降级
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type {
  MetadataProvider,
  MetadataProviderStatus,
  MetadataStatusSummary,
} from '@resovo/types'

const getVideoMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideoSources: vi.fn().mockResolvedValue([]),
  getVideo: (...args: unknown[]) => getVideoMock(...args),
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

afterEach(() => {
  cleanup()
  getVideoMock.mockReset()
})

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeProviderStatus(
  provider: MetadataProvider,
  overrides: Partial<MetadataProviderStatus> = {},
): MetadataProviderStatus {
  return {
    provider,
    state: 'missing',
    issueLevel: 'none',
    externalId: null,
    label: null,
    confidence: null,
    matchMethod: null,
    appliedAt: null,
    fetchedAt: null,
    reasonCodes: [],
    tooltipLines: [],
    ...overrides,
  }
}

function makeMetadataStatus(overrides: Partial<MetadataStatusSummary> = {}): MetadataStatusSummary {
  return {
    overall: 'partial',
    issueLevel: 'warn',
    score: 72,
    enrichedAt: '2026-06-14T10:00:00.000Z',
    primaryProvider: 'douban',
    providers: {
      douban: makeProviderStatus('douban', { state: 'applied', externalId: '3541415', confidence: 0.92, matchMethod: 'manual' }),
      bangumi: makeProviderStatus('bangumi', { state: 'candidate', externalId: '123', issueLevel: 'warn' }),
      tmdb: makeProviderStatus('tmdb', { state: 'missing' }),
      imdb: makeProviderStatus('imdb', { state: 'missing' }),
    },
    issues: [
      { code: 'candidate_unconfirmed', level: 'warn', provider: 'bangumi', message: 'x', action: 'confirm_candidate' },
    ],
    nextAction: 'confirm_candidate',
    sort: { statusRank: 4, issueRank: 2, scoreRank: 72, updatedAt: '2026-06-14T10:00:00.000Z' },
    ...overrides,
  }
}

function makeDetail(metadataStatus: MetadataStatusSummary | undefined): unknown {
  return {
    id: 'video-uuid', short_id: 'V001', title: 'X', type: 'series',
    year: 2024, is_published: false, source_count: '0',
    metadataStatus,
  }
}

const V_FIXTURE = {
  id: 'video-uuid', title: 'X', shortId: 'V001',
  type: 'series', year: 2024, country: 'CN',
  episodeCount: 8, totalEpisodes: null, currentEpisodes: null,
  metaScore: 72, sourceCheckStatus: 'pending', doubanStatus: 'matched',
  isPublished: false, visibilityStatus: 'private', reviewStatus: 'pending',
} as unknown as Parameters<typeof TabDetail>[0]['v']

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TabDetail · 元数据状态统一 section (META-34 / ADR-201)', () => {
  it('triad 仅留发布/可见性/审核 3 个 pill（douban pill 移除）', async () => {
    getVideoMock.mockResolvedValue(makeDetail(makeMetadataStatus()))
    const { container } = render(<TabDetail v={V_FIXTURE} />)
    const triad = container.querySelector('[data-status-triad]') as HTMLElement
    expect(triad.querySelectorAll('[data-pill]')).toHaveLength(3)
    // triad 内不再含豆瓣状态 pill（aria-label 不含「豆瓣」）
    const labels = Array.from(triad.querySelectorAll('[data-pill]')).map((p) => p.getAttribute('aria-label') ?? '')
    expect(labels.some((l) => l.includes('豆瓣'))).toBe(false)
    // flush 懒加载 getVideo 异步 state 更新（避免 act 警告）
    await screen.findByTestId('moderation-detail-metadata-status')
  })

  it('懒加载 metadataStatus → 渲染 MetadataStatusPanel(variant=detail) + 四来源卡', async () => {
    getVideoMock.mockResolvedValue(makeDetail(makeMetadataStatus()))
    render(<TabDetail v={V_FIXTURE} />)
    const panel = await screen.findByTestId('moderation-detail-metadata-status')
    expect(panel.getAttribute('data-variant')).toBe('detail')
    // detail 变体展开四来源卡
    expect(panel.querySelectorAll('[data-metadata-source-card]')).toHaveLength(4)
    // 单一「元数据状态」section 标题存在
    expect(screen.getByText('元数据状态')).toBeTruthy()
  })

  it('移除「富集」/「外部元数据」section + 裸 meta_score 行', async () => {
    getVideoMock.mockResolvedValue(makeDetail(makeMetadataStatus()))
    const { container } = render(<TabDetail v={V_FIXTURE} />)
    await screen.findByTestId('moderation-detail-metadata-status')
    expect(container.querySelector('[data-right-detail-enrichment]')).toBeNull()
    expect(container.querySelector('[data-right-detail-external-meta]')).toBeNull()
    // 信息区不再有裸 meta_score DetailRow（label code）
    expect(screen.queryByText('meta_score')).toBeNull()
    // 旧并列标题不再出现
    expect(screen.queryByText('富集')).toBeNull()
    expect(screen.queryByText('外部元数据')).toBeNull()
  })

  it('只读展示：未接 onAction → panel 不渲染下一步主按钮（无死按钮）', async () => {
    getVideoMock.mockResolvedValue(makeDetail(makeMetadataStatus({ nextAction: 'confirm_candidate' })))
    render(<TabDetail v={V_FIXTURE} />)
    const panel = await screen.findByTestId('moderation-detail-metadata-status')
    expect(panel.querySelector('[data-panel-next-action]')).toBeNull()
  })

  it('加载中（getVideo 未决）→ 显示「加载中…」占位', () => {
    getVideoMock.mockReturnValue(new Promise(() => {})) // 永不 resolve
    render(<TabDetail v={V_FIXTURE} />)
    expect(screen.getByText('加载中…')).toBeTruthy()
    expect(screen.queryByTestId('moderation-detail-metadata-status')).toBeNull()
  })

  it('加载失败 → 显示「元数据状态加载失败」降级，不阻断其余详情', async () => {
    getVideoMock.mockRejectedValue(new Error('网络 500'))
    render(<TabDetail v={V_FIXTURE} />)
    await waitFor(() => {
      expect(screen.getByText(/元数据状态加载失败/)).toBeTruthy()
    })
    // 其余详情（重测按钮 / 信息区）仍在
    expect(screen.getByTestId('moderation-detail-reprobe-all')).toBeTruthy()
  })

  it('已加载但无 metadataStatus（旧路径）→ 显示「暂无元数据状态」', async () => {
    getVideoMock.mockResolvedValue(makeDetail(undefined))
    render(<TabDetail v={V_FIXTURE} />)
    await waitFor(() => {
      expect(screen.getByText('暂无元数据状态')).toBeTruthy()
    })
    expect(screen.queryByTestId('moderation-detail-metadata-status')).toBeNull()
  })

  it('enrichedAt → panel Header 显示「最近 2026-06-14」(日期截断)', async () => {
    getVideoMock.mockResolvedValue(makeDetail(makeMetadataStatus({ enrichedAt: '2026-06-14T10:00:00.000Z' })))
    render(<TabDetail v={V_FIXTURE} />)
    const panel = await screen.findByTestId('moderation-detail-metadata-status')
    expect(within(panel).getByText('最近 2026-06-14')).toBeTruthy()
  })
})
