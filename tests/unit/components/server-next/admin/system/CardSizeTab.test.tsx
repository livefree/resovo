/**
 * CardSizeTab.test.tsx — 「前台展示」卡片尺寸 Tab 单元测试（ADR-214/215 + Amendment A1 / SEQ-20260623-01）
 *
 * 覆盖（Amendment A1：2 档、单位统一为卡宽，standard size-driven）：
 *   1. 渲染不崩溃 + testid
 *   2. 2 档卡渲染 + 字段初值注入（standard 卡宽 200 / scroll 卡宽 170）
 *   3. 修改标准卡宽 → dirty + save 调 updateCardSize（统一 body：cardWidthPx + gapPx）
 *   4. 越界（卡宽 401 > 400）→ save 禁用 + error 文案「范围 120–400」，不调 updateCardSize
 *   5. standard 档渲染卡宽字段（aria-label「卡片宽度」、非列数）
 *   6. 加载失败 ErrorState
 *   7. standard 实时预览：size-driven auto-fill grid-template-columns 反映 draft 卡宽
 *   8. scroll 实时预览：横滚 + 占位卡宽反映 draft
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

// Amendment A1：2 档、单位统一为卡宽（standard size-driven / scroll 横滚）
const ROWS = [
  { id: 'id-standard', sizeClass: 'standard', desktopColumns: null, cardWidthPx: 200, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
  { id: 'id-scroll', sizeClass: 'scroll', desktopColumns: null, cardWidthPx: 170, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
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

  it('2. 2 档卡渲染 + 字段初值注入（卡宽）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => {
      expect(screen.getByTestId('card-size-card-standard')).not.toBeNull()
      expect(screen.getByTestId('card-size-card-scroll')).not.toBeNull()
    })
    expect(screen.queryByTestId('card-size-card-compact')).toBeNull()
    expect(inputOf(container, 'card-size-standard-size')?.value).toBe('200')
    expect(inputOf(container, 'card-size-standard-gap')?.value).toBe('16')
    expect(inputOf(container, 'card-size-scroll-size')?.value).toBe('170')
  })

  it('3. 修改标准卡宽 → dirty + save 调 updateCardSize（统一 cardWidthPx body）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    updateCardSizeMock.mockResolvedValueOnce({ ...ROWS[0], cardWidthPx: 220 })
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-standard')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-standard-size')!
    fireEvent.change(sizeInput, { target: { value: '220' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-standard-dirty').textContent).toContain('有未保存的修改'),
    )

    fireEvent.click(screen.getByTestId('card-size-standard-save'))
    await waitFor(() =>
      expect(updateCardSizeMock).toHaveBeenCalledWith('standard', { cardWidthPx: 220, gapPx: 16 }),
    )
  })

  it('4. 越界卡宽（401 > 400）→ save 禁用 + error 文案，不调 updateCardSize', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-standard')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-standard-size')!
    fireEvent.change(sizeInput, { target: { value: '401' } })

    const saveBtn = screen.getByTestId('card-size-standard-save') as HTMLButtonElement
    await waitFor(() => expect(saveBtn.disabled).toBe(true))
    expect(screen.getByText('范围 120–400')).not.toBeNull()

    fireEvent.click(saveBtn)
    expect(updateCardSizeMock).not.toHaveBeenCalled()
  })

  it('5. standard 档渲染卡宽字段（aria-label「卡片宽度」、非列数）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-standard')).not.toBeNull())
    const standardSize = inputOf(container, 'card-size-standard-size')!
    expect(standardSize.getAttribute('aria-label')).toBe('卡片宽度')
    expect(standardSize.value).toBe('200')
  })

  it('6. 加载失败 ErrorState', async () => {
    listCardSizesMock.mockRejectedValueOnce(new Error('加载失败'))
    render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-tab')).not.toBeNull())
    expect(screen.queryByTestId('card-size-card-standard')).toBeNull()
  })

  it('7. 标准档实时预览：size-driven auto-fill grid-template-columns 反映 draft 卡宽', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-standard-preview-track')).not.toBeNull())

    const track = screen.getByTestId('card-size-standard-preview-track')
    // 初值卡宽 200 → auto-fill minmax(min(200px,...))
    expect(track.style.gridTemplateColumns).toContain('auto-fill')
    expect(track.style.gridTemplateColumns).toContain('200px')
    expect(track.style.gap).toBe('16px')

    // 改卡宽 200 → 220，预览实时更新
    fireEvent.change(inputOf(container, 'card-size-standard-size')!, { target: { value: '220' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-standard-preview-track').style.gridTemplateColumns).toContain('220px'),
    )
  })

  it('8. scroll 档实时预览：横滚预览 + 占位卡宽反映 draft', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-scroll-preview')).not.toBeNull())

    const track = screen.getByTestId('card-size-scroll-preview-track')
    expect(track.style.display).toBe('flex')
    // 首张占位卡宽 = draft 卡宽 170px
    const firstCard = track.firstElementChild as HTMLElement
    expect(firstCard.style.width).toBe('170px')

    // 改卡宽 170 → 200，预览实时更新
    fireEvent.change(inputOf(container, 'card-size-scroll-size')!, { target: { value: '200' } })
    await waitFor(() => {
      const card = screen.getByTestId('card-size-scroll-preview-track').firstElementChild as HTMLElement
      expect(card.style.width).toBe('200px')
    })
  })
})
