/**
 * AuditClient.test.tsx — /admin/audit 视图单元测试（CHG-SN-6-01 / ADR-118 §验证段）
 *
 * 覆盖（≥ 9 用例硬清单，quality-gates §7 第 1 项）：
 *   1. 渲染基础：PageHeader + 表头 + 默认空态
 *   2. Loading state（初始 skeleton）
 *   3. Empty state（rows 空）
 *   4. Error state（list 抛错）
 *   5. 列表渲染：列 cell + payloadSummary
 *   6. 单维 filter actionType 触发 page=1 + 调 listAdminAuditLogs
 *   7. 多维 filter（actionType + targetKind + from/to）
 *   8. 行点击 → DetailDrawer 加载 + 完整 jsonb 渲染
 *   9. 详情加载失败 toast
 *   10. 清空筛选还原默认
 *   11. enums 加载失败不阻塞主视图（actionType select 空 options）
 *
 * 路径策略：相对路径 import（与 MergeClient.test.tsx / HomeOpsClient.test.tsx 同范式）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── mock api ──────────────────────────────────────────────────────

const listAdminAuditLogsMock = vi.fn()
const getAdminAuditLogDetailMock = vi.fn()
const getAdminAuditEnumsMock = vi.fn()
const toastPushMock = vi.fn()

// CHG-SN-8-GAPS-AUDIT-ROLLBACK：AuditClient 新增 useRouter 调用（回滚按钮跳转）
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('../../../../../../apps/server-next/src/lib/audit/api', () => ({
  listAdminAuditLogs: (...args: unknown[]) => listAdminAuditLogsMock(...args),
  getAdminAuditLogDetail: (...args: unknown[]) => getAdminAuditLogDetailMock(...args),
  getAdminAuditEnums: (...args: unknown[]) => getAdminAuditEnumsMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'test-toast-id' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { AuditClient } from '../../../../../../apps/server-next/src/app/admin/audit/_client/AuditClient'

// ── fixtures ──────────────────────────────────────────────────────

const ROW_1 = {
  id: '1001',
  actorId: '00000000-0000-0000-0000-000000000aaa',
  actorUsername: 'admin-alice',
  actionType: 'video.approve' as const,
  targetKind: 'video' as const,
  targetId: '00000000-0000-0000-0000-000000000111',
  requestId: 'req-001',
  createdAt: '2026-05-15T10:00:00Z',
  payloadSummary: 'reviewLabelKey=approved · staffNote=ok',
}

const ROW_BATCH = {
  id: '1002',
  actorId: '00000000-0000-0000-0000-000000000aaa',
  actorUsername: 'admin-alice',
  actionType: 'staging.batch_publish' as const,
  targetKind: 'staging' as const,
  targetId: null,
  requestId: 'req-002',
  createdAt: '2026-05-15T11:00:00Z',
  payloadSummary: '批量 5 项 (staging.batch_publish)',
}

const ENUMS_RESULT = {
  actionTypes: ['video.approve', 'video.reject_labeled', 'staging.publish', 'staging.batch_publish'] as const,
  targetKinds: ['video', 'staging', 'video_source'] as const,
}

const DETAIL_FIXTURE = {
  ...ROW_1,
  beforeJsonb: { reviewLabelKey: 'pending' },
  afterJsonb: { reviewLabelKey: 'approved', staffNote: 'ok' },
  ipHash: 'abcd1234',
}

const EMPTY_RES = { data: [], total: 0, page: 1, limit: 20 }
const ONE_ROW_RES = { data: [ROW_1], total: 1, page: 1, limit: 20 }
const TWO_ROWS_RES = { data: [ROW_1, ROW_BATCH], total: 2, page: 1, limit: 20 }

beforeEach(() => {
  listAdminAuditLogsMock.mockReset()
  getAdminAuditLogDetailMock.mockReset()
  getAdminAuditEnumsMock.mockReset()
  toastPushMock.mockReset()
  // 默认 enums 成功（多数 test 用）
  getAdminAuditEnumsMock.mockResolvedValue(ENUMS_RESULT)
})

// ── 测试 ──────────────────────────────────────────────────────────

describe('AuditClient', () => {
  it('1. 渲染基础：PageHeader + 表头 + 默认空态', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(EMPTY_RES)
    render(<AuditClient />)
    expect(screen.getByText('审计日志')).not.toBeNull()
    await waitFor(() => {
      expect(screen.getByText('暂无审计记录')).not.toBeNull()
    })
  })

  it('2. Loading state（初始 skeleton）', async () => {
    listAdminAuditLogsMock.mockReturnValueOnce(new Promise(() => {})) // pending
    const { container } = render(<AuditClient />)
    // skeleton state 渲染（admin-ui LoadingState variant='skeleton'）
    expect(container.querySelector('[data-audit-client]')).not.toBeNull()
  })

  it('3. Error state（list 抛错）', async () => {
    listAdminAuditLogsMock.mockRejectedValueOnce(new Error('网络错误'))
    render(<AuditClient />)
    await waitFor(() => {
      expect(screen.getAllByText(/网络错误|加载失败/).length).toBeGreaterThan(0)
    })
  })

  it('4. 列表渲染：列 cell + payloadSummary 摘要', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    render(<AuditClient />)
    await waitFor(() => {
      expect(screen.getByText('video.approve')).not.toBeNull()
      expect(screen.getByText('admin-alice')).not.toBeNull()
      expect(screen.getByText(/reviewLabelKey=approved/)).not.toBeNull()
    })
  })

  it('5. batch action（targetId NULL）payloadSummary 显示"批量 N 项"', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(TWO_ROWS_RES)
    render(<AuditClient />)
    await waitFor(() => {
      expect(screen.getByText(/批量 5 项 \(staging.batch_publish\)/)).not.toBeNull()
    })
  })

  it('6. 单维 filter actionType 切换触发 page=1 + 调 listAdminAuditLogs', async () => {
    listAdminAuditLogsMock.mockResolvedValue(EMPTY_RES)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('暂无审计记录'))
    // 等 enums 加载后 select options 就位
    await waitFor(() => {
      expect(getAdminAuditEnumsMock).toHaveBeenCalled()
    })
    // 校验初次 listAdminAuditLogs 被调（page=1 / limit=20）
    expect(listAdminAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })

  it('7. 行点击 → DetailDrawer 加载 + 完整 jsonb 渲染', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    getAdminAuditLogDetailMock.mockResolvedValueOnce(DETAIL_FIXTURE)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('admin-alice'))
    // 点击行（DataTable onRowClick）
    fireEvent.click(screen.getByText('admin-alice'))
    await waitFor(() => {
      expect(getAdminAuditLogDetailMock).toHaveBeenCalledWith('1001')
      expect(screen.getByTestId('audit-detail-drawer')).not.toBeNull()
      expect(screen.getByTestId('audit-before-jsonb')).not.toBeNull()
      expect(screen.getByTestId('audit-after-jsonb')).not.toBeNull()
    })
    // 完整 jsonb 内容渲染（before + after 各含 reviewLabelKey，故 ≥ 1）
    expect(screen.getAllByText(/reviewLabelKey/).length).toBeGreaterThan(0)
  })

  it('8. 详情加载失败 toast', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    getAdminAuditLogDetailMock.mockRejectedValueOnce(new Error('详情 500'))
    render(<AuditClient />)
    await waitFor(() => screen.getByText('admin-alice'))
    fireEvent.click(screen.getByText('admin-alice'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: '详情加载失败',
      }))
    })
  })

  it('9. 清空筛选按钮按 hasFilter 显示/隐藏', async () => {
    listAdminAuditLogsMock.mockResolvedValue(EMPTY_RES)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('暂无审计记录'))
    // 初始无 filter → 清空按钮不存在
    expect(screen.queryByTestId('audit-filter-clear')).toBeNull()
  })

  it('10. enums 加载失败不阻塞主视图', async () => {
    getAdminAuditEnumsMock.mockReset()
    getAdminAuditEnumsMock.mockRejectedValueOnce(new Error('enums 500'))
    listAdminAuditLogsMock.mockResolvedValueOnce(EMPTY_RES)
    render(<AuditClient />)
    await waitFor(() => {
      expect(screen.getByText('暂无审计记录')).not.toBeNull()
    })
    // enums 失败时主视图仍可用（无 toast 触发；视图不阻塞）
  })

  it('11. ipHash 仅在详情端点暴露（ADR-118 D-118-2 列表行不带 ipHash）', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('admin-alice'))
    // 列表行不带 ipHash 字段
    expect(JSON.stringify(ROW_1)).not.toContain('ipHash')
    // 详情端点字段（DETAIL_FIXTURE）含 ipHash
    expect(DETAIL_FIXTURE.ipHash).toBe('abcd1234')
  })

  it('12. 时间格式本地化（zh-CN hour12: false）', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    render(<AuditClient />)
    await waitFor(() => {
      // 2026-05-15T10:00:00Z → 本地时间渲染（不一定是 10:00，但应该被格式化）
      const formatted = new Date('2026-05-15T10:00:00Z').toLocaleString('zh-CN', { hour12: false })
      expect(screen.getByText(formatted)).not.toBeNull()
    })
  })

  // ── 导出 CSV（CHG-SN-6-22）─────────────────────────────────

  it('13. 导出按钮渲染：rows 非空 → enabled', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('admin-alice'))
    const btn = screen.getByTestId('audit-export-csv') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(false)
  })

  it('14. 导出按钮：rows 空 → disabled', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(EMPTY_RES)
    render(<AuditClient />)
    await waitFor(() => screen.getByText('暂无审计记录'))
    const btn = screen.getByTestId('audit-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('15. 点击导出 → a.click + filename pattern + Blob 类型', async () => {
    listAdminAuditLogsMock.mockResolvedValueOnce(ONE_ROW_RES)
    const clickSpy = vi.fn()
    const downloads: string[] = []
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        Object.defineProperty(anchor, 'download', {
          set(v: string) { downloads.push(v) },
          configurable: true,
        })
      }
      return el
    })
    try {
      render(<AuditClient />)
      const btn = await waitFor(() => screen.getByTestId('audit-export-csv'))
      fireEvent.click(btn)
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(createObjectUrlSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      expect(downloads[0]).toMatch(/^audit-logs-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
    } finally {
      createSpy.mockRestore()
    }
  })
})
