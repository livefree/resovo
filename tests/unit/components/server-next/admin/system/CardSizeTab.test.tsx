/**
 * CardSizeTab.test.tsx — 「前台展示」卡片尺寸 Tab 单元测试（ADR-214/215 + Amendment A2 / SEQ-20260623-02）
 *
 * 覆盖（Amendment A2：单一全局卡宽，全站统一）：
 *   1. 渲染不崩溃 + testid
 *   2. 单一全局卡渲染 + 字段初值注入（卡宽 160 / 间距 16）；无 standard/scroll/compact 分档卡
 *   3. 修改卡宽 → dirty + save 调 updateCardSize('global', { cardWidthPx, gapPx }）
 *   4. 越界（卡宽 401 > 400）→ save 禁用 + error 文案「范围 120–400」，不调 updateCardSize
 *   5. 渲染卡宽字段（aria-label「卡片宽度」、非列数）
 *   6. 加载失败 ErrorState
 *   7. 实时预览：auto-fit 精确定宽 grid-template-columns + justify-content:center 反映 draft 卡宽
 *   8. 手机列数提示随卡宽变化（D-214-A2-4）
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listCardSizesMock = vi.fn()
const updateCardSizeMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/card-size/api', () => ({
  listCardSizes: (...args: unknown[]) => listCardSizesMock(...args),
  updateCardSize: (...args: unknown[]) => updateCardSizeMock(...args),
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

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { CardSizeTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/CardSizeTab'

// Amendment A2：单行全局，全站统一卡宽
const ROWS = [
  { id: 'id-global', sizeClass: 'global', cardWidthPx: 160, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
]

function inputOf(container: HTMLElement, testId: string): HTMLInputElement | null {
  return container.querySelector(`[data-testid="${testId}"] input`) as HTMLInputElement | null
}

beforeEach(() => {
  listCardSizesMock.mockReset()
  updateCardSizeMock.mockReset()
  toastPushMock.mockReset()
})

describe('CardSizeTab', () => {
  it('1. 渲染不崩溃 + testid', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-tab')).not.toBeNull())
  })

  it('2. 单一全局卡渲染 + 字段初值注入（卡宽 160 / 间距 16），无分档卡', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => {
      expect(screen.getByTestId('card-size-card-global')).not.toBeNull()
    })
    expect(screen.queryByTestId('card-size-card-standard')).toBeNull()
    expect(screen.queryByTestId('card-size-card-scroll')).toBeNull()
    expect(screen.queryByTestId('card-size-card-compact')).toBeNull()
    expect(inputOf(container, 'card-size-global-size')?.value).toBe('160')
    expect(inputOf(container, 'card-size-global-gap')?.value).toBe('16')
  })

  it('3. 修改卡宽 → dirty + save 调 updateCardSize（global + cardWidthPx body）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    updateCardSizeMock.mockResolvedValueOnce({ ...ROWS[0], cardWidthPx: 220 })
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-global')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-global-size')!
    fireEvent.change(sizeInput, { target: { value: '220' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-global-dirty').textContent).toContain('有未保存的修改'),
    )

    fireEvent.click(screen.getByTestId('card-size-global-save'))
    await waitFor(() =>
      expect(updateCardSizeMock).toHaveBeenCalledWith('global', { cardWidthPx: 220, gapPx: 16 }),
    )
  })

  it('4. 越界卡宽（401 > 400）→ save 禁用 + error 文案，不调 updateCardSize', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-global')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-global-size')!
    fireEvent.change(sizeInput, { target: { value: '401' } })

    const saveBtn = screen.getByTestId('card-size-global-save') as HTMLButtonElement
    await waitFor(() => expect(saveBtn.disabled).toBe(true))
    expect(screen.getByText('范围 120–400')).not.toBeNull()

    fireEvent.click(saveBtn)
    expect(updateCardSizeMock).not.toHaveBeenCalled()
  })

  it('5. 渲染卡宽字段（aria-label「卡片宽度」、非列数）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-global')).not.toBeNull())
    const sizeInput = inputOf(container, 'card-size-global-size')!
    expect(sizeInput.getAttribute('aria-label')).toBe('卡片宽度')
    expect(sizeInput.value).toBe('160')
  })

  it('6. 加载失败 ErrorState', async () => {
    listCardSizesMock.mockRejectedValueOnce(new Error('加载失败'))
    render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-tab')).not.toBeNull())
    expect(screen.queryByTestId('card-size-card-global')).toBeNull()
  })

  it('7. 实时预览：auto-fit 精确定宽 + justify-content:center 反映 draft 卡宽', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-global-preview-track')).not.toBeNull())

    const track = screen.getByTestId('card-size-global-preview-track')
    // 初值卡宽 160 → auto-fit min(160px,100%) + 居中
    expect(track.style.gridTemplateColumns).toContain('auto-fit')
    expect(track.style.gridTemplateColumns).toContain('160px')
    expect(track.style.justifyContent).toBe('center')
    expect(track.style.gap).toBe('16px')

    // 改卡宽 160 → 220，预览实时更新
    fireEvent.change(inputOf(container, 'card-size-global-size')!, { target: { value: '220' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-global-preview-track').style.gridTemplateColumns).toContain('220px'),
    )
  })

  it('8. 手机列数提示随卡宽变化（D-214-A2-4：W=160 约 2 列 / W 大则约 1 列）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-global-preview')).not.toBeNull())

    // 初值 W=160 → 手机约 2 列
    expect(screen.getByTestId('card-size-global-preview').textContent).toContain('手机约 2 列')

    // 改 W=200 → 手机约 1 列
    fireEvent.change(inputOf(container, 'card-size-global-size')!, { target: { value: '200' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-global-preview').textContent).toContain('手机约 1 列'),
    )
  })
})
