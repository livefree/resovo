/**
 * MergeRecordsSections.test.tsx — records mode 两子视图单测（CHG-VIR-13-C2）
 *
 * 覆盖：
 *  AuditSection（D-105-8 + §10.2 #5）：
 *   1. actorType 列（system→自动 / 缺省→人工）
 *   2. 行展开明细（videoTitlesSnapshot 前后形态 + 关联候选计数）
 *   3. 行内撤销（有效行 reason 输入 + unmergeVideos 调用 + 刷新）
 *   4. 已撤销行无撤销控件（reverted 信息展示）
 *  DecisionsSection（ADR-179 消费）：
 *   5. 列表渲染（pair 摘要 + 软删标注 + decision badge）
 *   6. rejected 未撤销 → revive 调用 + reused 幂等提示
 *   7. confirmed / 已推翻 / pair 含软删 → 无复活按钮
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

const listAuditMock = vi.fn()
const unmergeVideosMock = vi.fn()
const listDecisionsMock = vi.fn()
const reviveMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  listAudit: (...args: unknown[]) => listAuditMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
  mergeVideos: vi.fn(),
  splitVideo: vi.fn(),
  getSplitSuggestions: vi.fn(),
  listCandidates: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/identity/api', () => ({
  listIdentityDecisions: (...args: unknown[]) => listDecisionsMock(...args),
  reviveIdentityCandidate: (...args: unknown[]) => reviveMock(...args),
  rejectIdentityCandidate: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient', () => ({
  describeError: (e: unknown) => (e instanceof Error ? e.message : '未知'),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { AuditSection } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeAuditSection'
import { DecisionsSection } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeDecisionsSection'

const AUDIT_1 = 'audit-0001'
const SRC_A = 'vid-aaaa-1111'
const TGT_1 = 'vid-tttt-1111'

function makeAuditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AUDIT_1,
    action: 'merge' as const,
    sourceVideoIds: [SRC_A],
    targetVideoIds: [TGT_1],
    performedBy: 'actor-00000001',
    performedByUsername: 'admin',
    reason: '同作品合并',
    performedAt: '2026-06-04T10:00:00Z',
    revertedAt: null,
    revertedBy: null,
    revertedReason: null,
    actorType: 'human' as const,
    relatedCandidateIds: ['cand-1'],
    relatedDecisionIds: ['dec-1'],
    videoTitlesSnapshot: [
      { videoId: SRC_A, title: '源视频甲' },
      { videoId: TGT_1, title: '目标视频' },
    ],
    ...overrides,
  }
}

function makeDecisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dec-0001',
    candidateId: 'cand-0001',
    decision: 'rejected' as const,
    actorType: 'human' as const,
    performedBy: 'actor-00000001',
    performedByUsername: 'admin',
    reason: '不是同一作品',
    videoMergeAuditId: null,
    revertedAt: null,
    revertedBy: null,
    revertedReason: null,
    createdAt: '2026-06-04T10:00:00Z',
    leftVideoId: 'vid-l',
    rightVideoId: 'vid-r',
    leftVideoTitle: '左视频',
    leftVideoDeleted: false,
    rightVideoTitle: '右视频',
    rightVideoDeleted: false,
    identityScore: 0.85,
    candidateStatus: 'rejected' as const,
    ...overrides,
  }
}

beforeEach(() => {
  listAuditMock.mockReset()
  unmergeVideosMock.mockReset()
  listDecisionsMock.mockReset()
  reviveMock.mockReset()
  toastPushMock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

// ── AuditSection（D-105-8 + 行内撤销）─────────────────────────────────

describe('AuditSection — CHG-VIR-13-C2', () => {
  it('1. actorType 列：system→「自动」/ human→「人工」', async () => {
    listAuditMock.mockResolvedValue({
      data: [makeAuditRow(), makeAuditRow({ id: 'audit-0002', actorType: 'system' })],
      total: 2, page: 1, limit: 20,
    })
    render(<AuditSection />)
    await waitFor(() => screen.getByTestId(`audit-actor-${AUDIT_1}`))
    expect(screen.getByTestId(`audit-actor-${AUDIT_1}`).textContent).toBe('人工')
    expect(screen.getByTestId('audit-actor-audit-0002').textContent).toBe('自动')
  })

  it('2. 行展开明细：前后形态标题 + 关联候选计数 + reason', async () => {
    listAuditMock.mockResolvedValue({ data: [makeAuditRow()], total: 1, page: 1, limit: 20 })
    render(<AuditSection />)
    await waitFor(() => screen.getByTestId(`audit-expand-${AUDIT_1}`))
    fireEvent.click(screen.getByTestId(`audit-expand-${AUDIT_1}`))
    const detail = screen.getByTestId(`audit-detail-${AUDIT_1}`)
    expect(detail.textContent).toContain('源视频甲')
    expect(detail.textContent).toContain('目标视频')
    expect(detail.textContent).toContain('关联候选 1 个')
    expect(detail.textContent).toContain('同作品合并')
  })

  it('3. 行内撤销：reason 输入 → unmergeVideos(auditId, reason) + 成功刷新', async () => {
    listAuditMock.mockResolvedValue({ data: [makeAuditRow()], total: 1, page: 1, limit: 20 })
    unmergeVideosMock.mockResolvedValue({ restoredVideoIds: [SRC_A] })
    render(<AuditSection />)
    await waitFor(() => screen.getByTestId(`audit-expand-${AUDIT_1}`))
    fireEvent.click(screen.getByTestId(`audit-expand-${AUDIT_1}`))
    fireEvent.change(screen.getByPlaceholderText(/撤销原因/), { target: { value: '误操作' } })
    const callsBefore = listAuditMock.mock.calls.length
    fireEvent.click(screen.getByTestId(`audit-revert-${AUDIT_1}`))
    await waitFor(() => expect(unmergeVideosMock).toHaveBeenCalledWith(AUDIT_1, '误操作'))
    await waitFor(() => expect(listAuditMock.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('4. 已撤销行：展开区无撤销控件 + reverted 信息展示', async () => {
    listAuditMock.mockResolvedValue({
      data: [makeAuditRow({ revertedAt: '2026-06-04T11:00:00Z', revertedReason: '用户撤销' })],
      total: 1, page: 1, limit: 20,
    })
    render(<AuditSection />)
    await waitFor(() => screen.getByTestId(`audit-expand-${AUDIT_1}`))
    fireEvent.click(screen.getByTestId(`audit-expand-${AUDIT_1}`))
    expect(screen.queryByTestId(`audit-revert-${AUDIT_1}`)).toBeNull()
    expect(screen.getByTestId(`audit-detail-${AUDIT_1}`).textContent).toContain('用户撤销')
  })
})

// ── DecisionsSection（ADR-179 消费）──────────────────────────────────

describe('DecisionsSection — CHG-VIR-13-C2', () => {
  it('5. 列表渲染：pair 摘要 + 软删标注', async () => {
    listDecisionsMock.mockResolvedValue({
      data: [makeDecisionRow({ rightVideoDeleted: true })],
      total: 1, page: 1, limit: 20,
    })
    render(<DecisionsSection />)
    await waitFor(() => screen.getByTestId('decision-row-dec-0001'))
    const row = screen.getByTestId('decision-row-dec-0001')
    expect(row.textContent).toContain('左视频')
    expect(row.textContent).toContain('右视频（已删）')
    expect(row.textContent).toContain('拒绝')
  })

  it('6. rejected 未撤销 → 复活按钮 → reviveIdentityCandidate + reused 幂等提示', async () => {
    listDecisionsMock.mockResolvedValue({ data: [makeDecisionRow()], total: 1, page: 1, limit: 20 })
    reviveMock.mockResolvedValue({ newCandidateId: 'cand-new', revivedFromCandidateId: 'cand-0001', reused: true })
    render(<DecisionsSection />)
    await waitFor(() => screen.getByTestId('decision-revive-dec-0001'))
    fireEvent.click(screen.getByTestId('decision-revive-dec-0001'))
    await waitFor(() => expect(reviveMock).toHaveBeenCalledWith('cand-0001', '决策记录人工复活'))
    await waitFor(() => {
      expect(toastPushMock.mock.calls.some(
        (c: unknown[]) => String((c[0] as { title?: string }).title).includes('已有待裁定候选'),
      )).toBe(true)
    })
  })

  it('7. confirmed / 已推翻 / pair 含软删 → 无复活按钮', async () => {
    listDecisionsMock.mockResolvedValue({
      data: [
        makeDecisionRow({ id: 'dec-c', decision: 'confirmed', videoMergeAuditId: 'audit-x' }),
        makeDecisionRow({ id: 'dec-r', revertedAt: '2026-06-04T11:00:00Z' }),
        makeDecisionRow({ id: 'dec-d', leftVideoDeleted: true }),
      ],
      total: 3, page: 1, limit: 20,
    })
    render(<DecisionsSection />)
    await waitFor(() => screen.getByTestId('decision-row-dec-c'))
    expect(screen.queryByTestId('decision-revive-dec-c')).toBeNull()
    expect(screen.queryByTestId('decision-revive-dec-r')).toBeNull()
    expect(screen.queryByTestId('decision-revive-dec-d')).toBeNull()
  })
})
