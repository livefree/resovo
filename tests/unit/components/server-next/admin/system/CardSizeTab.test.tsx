/**
 * CardSizeTab.test.tsx — 「前台展示」卡片尺寸 Tab 单元测试（SEQ-20260622-03 Phase 3 / ADR-214/215）
 *
 * 覆盖：
 *   1. 渲染不崩溃 + testid
 *   2. 三档卡渲染 + 字段初值注入（standard 列数 5 / scroll 卡宽 170）
 *   3. 修改标准列数 → dirty + save 调 updateCardSize（网格档 body：desktopColumns + gapPx）
 *   4. 越界（列数 10 > 8）→ save 禁用 + error 文案，不调 updateCardSize
 *   5. scroll 档渲染卡宽字段（aria-label「卡片宽度」、非列数）
 *   6. 加载失败 ErrorState
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

const ROWS = [
  { id: 'id-standard', sizeClass: 'standard', desktopColumns: 5, cardWidthPx: null, gapPx: 16, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
  { id: 'id-compact', sizeClass: 'compact', desktopColumns: 3, cardWidthPx: null, gapPx: 12, settings: {}, updatedAt: '2026-06-23T00:00:00Z' },
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

  it('2. 三档卡渲染 + 字段初值注入', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => {
      expect(screen.getByTestId('card-size-card-standard')).not.toBeNull()
      expect(screen.getByTestId('card-size-card-compact')).not.toBeNull()
      expect(screen.getByTestId('card-size-card-scroll')).not.toBeNull()
    })
    expect(inputOf(container, 'card-size-standard-size')?.value).toBe('5')
    expect(inputOf(container, 'card-size-standard-gap')?.value).toBe('16')
    expect(inputOf(container, 'card-size-scroll-size')?.value).toBe('170')
  })

  it('3. 修改标准列数 → dirty + save 调 updateCardSize（网格档 body）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    updateCardSizeMock.mockResolvedValueOnce({ ...ROWS[0], desktopColumns: 6 })
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-standard')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-standard-size')!
    fireEvent.change(sizeInput, { target: { value: '6' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-standard-dirty').textContent).toContain('有未保存的修改'),
    )

    fireEvent.click(screen.getByTestId('card-size-standard-save'))
    await waitFor(() =>
      expect(updateCardSizeMock).toHaveBeenCalledWith('standard', { desktopColumns: 6, gapPx: 16 }),
    )
  })

  it('4. 越界列数（10 > 8）→ save 禁用 + error 文案，不调 updateCardSize', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-standard')).not.toBeNull())

    const sizeInput = inputOf(container, 'card-size-standard-size')!
    fireEvent.change(sizeInput, { target: { value: '10' } })

    const saveBtn = screen.getByTestId('card-size-standard-save') as HTMLButtonElement
    await waitFor(() => expect(saveBtn.disabled).toBe(true))
    expect(screen.getByText('范围 2–8')).not.toBeNull()

    fireEvent.click(saveBtn)
    expect(updateCardSizeMock).not.toHaveBeenCalled()
  })

  it('5. scroll 档渲染卡宽字段（非列数）', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-card-scroll')).not.toBeNull())
    const scrollSize = inputOf(container, 'card-size-scroll-size')!
    expect(scrollSize.getAttribute('aria-label')).toBe('卡片宽度')
    expect(scrollSize.value).toBe('170')
  })

  it('6. 加载失败 ErrorState', async () => {
    listCardSizesMock.mockRejectedValueOnce(new Error('加载失败'))
    render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-tab')).not.toBeNull())
    expect(screen.queryByTestId('card-size-card-standard')).toBeNull()
  })

  it('7. 标准档实时预览：grid-template-columns 反映 draft 列数', async () => {
    listCardSizesMock.mockResolvedValueOnce(ROWS)
    const { container } = render(<CardSizeTab />)
    await waitFor(() => expect(screen.getByTestId('card-size-standard-preview-track')).not.toBeNull())

    const track = screen.getByTestId('card-size-standard-preview-track')
    // 初值 5 列
    expect(track.style.gridTemplateColumns).toContain('repeat(5,')
    expect(track.style.gap).toBe('16px')

    // 改列数 5 → 6，预览实时更新
    fireEvent.change(inputOf(container, 'card-size-standard-size')!, { target: { value: '6' } })
    await waitFor(() =>
      expect(screen.getByTestId('card-size-standard-preview-track').style.gridTemplateColumns).toContain('repeat(6,'),
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
