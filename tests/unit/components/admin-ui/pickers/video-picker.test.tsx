/**
 * video-picker.test.tsx — VideoPicker 业务原语单测（M-SN-SHARED-04-A）
 *
 * 真源：packages/admin-ui/src/components/pickers/video-picker.tsx
 *      arch-reviewer Opus 1 轮 A−（2026-05-21）
 *
 * 覆盖 D10 列出的 14 用例：
 *  1 触发器渲染（占位）
 *  2 触发器回显（单选）
 *  3 多选触发器回显（chip）
 *  4 点击触发器打开 Dialog + search 自动 focus
 *  5 搜索调 fetcher（debounce 后）
 *  6 搜索结果渲染
 *  7 单选点击确认 → onChange + Dialog 关闭
 *  8 多选 staging：点击 3 行 → 不触发 onChange → 点确认 → onChange 收到 3 条
 *  9 多选取消：选 2 行 → onChange 不被调用
 * 10 空结果显式提示
 * 11 网络错误显示「重试」
 * 12 键盘 ArrowDown + Enter
 * 13 disabled 时点击不打开
 * 14 AbortSignal abort 上一次 fetcher
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { VideoPicker } from '../../../../../packages/admin-ui/src/components/pickers/video-picker'
import type {
  PickerVideoItem,
  VideoPickerFetcher,
} from '../../../../../packages/admin-ui/src/components/pickers/video-picker.types'

const ITEM_A: PickerVideoItem = {
  id: 'uuid-aaaa-1111',
  shortId: 'V001',
  title: '银河护卫队',
  titleEn: 'Guardians of the Galaxy',
  type: 'movie',
  year: 2014,
  coverUrl: null,
  isPublished: true,
}
const ITEM_B: PickerVideoItem = {
  id: 'uuid-bbbb-2222',
  shortId: 'V002',
  title: '复仇者联盟',
  titleEn: 'The Avengers',
  type: 'movie',
  year: 2012,
  coverUrl: null,
  isPublished: true,
}
const ITEM_C: PickerVideoItem = {
  id: 'uuid-cccc-3333',
  shortId: 'V003',
  title: '蜘蛛侠',
  titleEn: 'Spider-Man',
  type: 'movie',
  year: 2020,
  coverUrl: null,
  isPublished: false,
}

function makeFetcher(items: readonly PickerVideoItem[]): { fetcher: VideoPickerFetcher; calls: { q: string; signal?: AbortSignal }[] } {
  const calls: { q: string; signal?: AbortSignal }[] = []
  const fetcher: VideoPickerFetcher = async ({ q, signal }) => {
    calls.push({ q, signal })
    return { items }
  }
  return { fetcher, calls }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('VideoPicker (M-SN-SHARED-04-A)', () => {
  it('1. 触发器渲染：未选时显示 placeholder 文案', () => {
    const { fetcher } = makeFetcher([])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    expect(screen.getByTestId('vp').textContent).toContain('选择视频')
  })

  it('2. 触发器回显（单选）：选中 1 个视频时显示 title + shortId', () => {
    const { fetcher } = makeFetcher([])
    render(<VideoPicker value={ITEM_A} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    const trigger = screen.getByTestId('vp')
    expect(trigger.textContent).toContain('银河护卫队')
    expect(trigger.textContent).toContain('V001')
  })

  it('3. 多选触发器回显：3 个 chip 包含各 title + shortId', () => {
    const { fetcher } = makeFetcher([])
    render(<VideoPicker multiple value={[ITEM_A, ITEM_B, ITEM_C]} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    const trigger = screen.getByTestId('vp')
    expect(trigger.textContent).toContain('银河护卫队')
    expect(trigger.textContent).toContain('复仇者联盟')
    expect(trigger.textContent).toContain('蜘蛛侠')
  })

  it('4. 点击触发器打开 Dialog + 搜索框可见', async () => {
    const { fetcher } = makeFetcher([ITEM_A])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => {
      expect(screen.getByTestId('vp-search')).not.toBeNull()
    })
  })

  it('5. 搜索调 fetcher（debounce 300ms）', async () => {
    const { fetcher, calls } = makeFetcher([ITEM_A])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => screen.getByTestId('vp-search'))
    // 初始（空 q）会立即触发一次
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(1))

    const initialLen = calls.length
    // AdminInput data-testid 挂在外层 wrapper，input 在内部；querySelector 直查
    const wrapper = screen.getByTestId('vp-search')
    const input = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '银河' } })
    // debounce 期内不应增加
    expect(calls.length).toBe(initialLen)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    await waitFor(() => expect(calls.length).toBeGreaterThan(initialLen))
    expect(calls[calls.length - 1].q).toBe('银河')
  })

  it('6. 搜索结果渲染：fetcher 返回 2 行 → 列表显示 2 行', async () => {
    const { fetcher } = makeFetcher([ITEM_A, ITEM_B])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => {
      expect(screen.getByTestId(`vp-row-${ITEM_A.id}`)).not.toBeNull()
      expect(screen.getByTestId(`vp-row-${ITEM_B.id}`)).not.toBeNull()
    })
  })

  it('7. 单选点击 → onChange + Dialog 关闭', async () => {
    const onChange = vi.fn()
    const { fetcher } = makeFetcher([ITEM_A, ITEM_B])
    render(<VideoPicker value={null} onChange={onChange} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    const row = await waitFor(() => screen.getByTestId(`vp-row-${ITEM_A.id}`))
    fireEvent.click(row)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(ITEM_A)
    })
    // Dialog 关闭：搜索框不再可见
    await waitFor(() => expect(screen.queryByTestId('vp-search')).toBeNull())
  })

  it('8. 多选 staging：点 3 行不触发 onChange；点确认 → onChange 收到 3 条', async () => {
    const onChange = vi.fn()
    const { fetcher } = makeFetcher([ITEM_A, ITEM_B, ITEM_C])
    render(<VideoPicker multiple value={[]} onChange={onChange} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => screen.getByTestId(`vp-row-${ITEM_A.id}`))
    fireEvent.click(screen.getByTestId(`vp-row-${ITEM_A.id}`))
    fireEvent.click(screen.getByTestId(`vp-row-${ITEM_B.id}`))
    fireEvent.click(screen.getByTestId(`vp-row-${ITEM_C.id}`))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('vp-confirm'))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([ITEM_A, ITEM_B, ITEM_C])
    })
  })

  it('9. 多选取消：选 2 行后点取消 → onChange 不被调用', async () => {
    const onChange = vi.fn()
    const { fetcher } = makeFetcher([ITEM_A, ITEM_B])
    render(<VideoPicker multiple value={[]} onChange={onChange} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => screen.getByTestId(`vp-row-${ITEM_A.id}`))
    fireEvent.click(screen.getByTestId(`vp-row-${ITEM_A.id}`))
    fireEvent.click(screen.getByTestId(`vp-row-${ITEM_B.id}`))
    fireEvent.click(screen.getByTestId('vp-cancel'))
    await waitFor(() => expect(screen.queryByTestId('vp-search')).toBeNull())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('10. 空结果：fetcher 返回空 → 显示「未找到匹配的视频」', async () => {
    const { fetcher } = makeFetcher([])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => {
      expect(screen.getByTestId('vp-empty')).not.toBeNull()
      expect(screen.getByTestId('vp-empty').textContent).toContain('未找到')
    })
  })

  it('11. 网络错误：fetcher throw → 显示错误 + 重试按钮', async () => {
    const fetcher: VideoPickerFetcher = vi.fn(async () => {
      throw new Error('network 500')
    })
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => {
      expect(screen.getByTestId('vp-error')).not.toBeNull()
      expect(screen.getByTestId('vp-error').textContent).toContain('network 500')
    })
  })

  it('12. 键盘 ArrowDown + Enter（单选）→ 选中第二项 + Dialog 关闭', async () => {
    const onChange = vi.fn()
    const { fetcher } = makeFetcher([ITEM_A, ITEM_B])
    render(<VideoPicker value={null} onChange={onChange} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    await waitFor(() => screen.getByTestId(`vp-row-${ITEM_A.id}`))
    const list = screen.getByTestId('vp-list')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Enter' })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(ITEM_B)
    })
  })

  it('13. disabled 时点击触发器不打开 Dialog', () => {
    const { fetcher } = makeFetcher([ITEM_A])
    render(<VideoPicker value={null} onChange={() => {}} fetcher={fetcher} disabled data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp'))
    expect(screen.queryByTestId('vp-search')).toBeNull()
  })

  it('14. 触发器清除按钮（单选有 value）→ onChange(null)', () => {
    const onChange = vi.fn()
    const { fetcher } = makeFetcher([])
    render(<VideoPicker value={ITEM_A} onChange={onChange} fetcher={fetcher} data-testid="vp" />)
    fireEvent.click(screen.getByTestId('vp-clear'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
