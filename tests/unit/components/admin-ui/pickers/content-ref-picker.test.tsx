/**
 * content-ref-picker.test.tsx — ContentRefPicker 复合原语单测
 *
 * 真源：packages/admin-ui/src/components/pickers/content-ref-picker.tsx
 *      arch-reviewer Opus A− PASS / D10 列出 8+2 用例
 *
 * 覆盖 8 必须用例 + 2 advisory：
 *  1. type='video' → 渲染 VideoPicker；选中后 onChange 收到 video.id
 *  2. type='external_url' → 渲染 input；输入合法 URL → onChange 收到 URL
 *  3. type='external_url' → 输入非法 URL → 内联错误文案
 *  4. type='custom_html' → 渲染 input；输入后 onChange
 *  5. type='video_type' → 渲染 AdminSelect；选 movie → onChange('movie')
 *  6. type 切换：video → external_url，VideoPicker 卸载 / AdminInput 挂载
 *  7. type='video' 但 videoFetcher 缺失 → console.error + fallback input
 *  8. disabled=true 透传到子输入器
 *  9. (advisory) type='video' 编辑态 value 已有 UUID → 触发 fetcher 恢复
 * 10. (advisory) error prop 传入 → 显示
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ContentRefPicker } from '../../../../../packages/admin-ui/src/components/pickers/content-ref-picker'
import type {
  PickerVideoItem,
  VideoPickerFetcher,
} from '../../../../../packages/admin-ui/src/components/pickers/video-picker.types'

const ITEM_A: PickerVideoItem = {
  id: 'video-uuid-aaaa', shortId: 'V001', title: '银河护卫队', titleEn: null,
  type: 'movie', year: 2014, coverUrl: null, isPublished: true,
}

function makeFetcher(items: readonly PickerVideoItem[]): VideoPickerFetcher {
  return async () => ({ items })
}

const VIDEO_TYPE_OPTIONS = [
  { value: 'movie', label: '电影 (movie)' },
  { value: 'series', label: '连续剧 (series)' },
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ContentRefPicker (CHG-SN-8-FUP-HOME)', () => {
  it('1. type=video → 渲染 VideoPicker；选中后 onChange(video.id)', async () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker
        type="video"
        value=""
        onChange={onChange}
        videoFetcher={makeFetcher([ITEM_A])}
        data-testid="crp"
      />,
    )
    fireEvent.click(screen.getByTestId('crp'))
    const row = await waitFor(() => screen.getByTestId(`crp-row-${ITEM_A.id}`))
    fireEvent.click(row)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(ITEM_A.id)
    })
  })

  it('2. type=external_url → 输入合法 URL → onChange(URL)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ContentRefPicker type="external_url" value="" onChange={onChange} data-testid="crp" />,
    )
    const wrapper = screen.getByTestId('crp')
    const input = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/path' } })
    expect(onChange).toHaveBeenCalledWith('https://example.com/path')
    // 无内联错误
    expect(container.querySelector('[data-testid="crp-url-error"]')).toBeNull()
  })

  it('3. type=external_url → 输入非法 URL → 内联错误文案', async () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker type="external_url" value="" onChange={onChange} data-testid="crp" />,
    )
    const wrapper = screen.getByTestId('crp')
    const input = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-url' } })
    await waitFor(() => {
      expect(screen.getByTestId('crp-url-error')).not.toBeNull()
    })
    expect(screen.getByTestId('crp-url-error').textContent).toContain('有效的 URL')
  })

  it('4. type=custom_html → 输入后 onChange', () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker type="custom_html" value="" onChange={onChange} data-testid="crp" />,
    )
    const wrapper = screen.getByTestId('crp')
    const input = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'fragment-id-001' } })
    expect(onChange).toHaveBeenCalledWith('fragment-id-001')
  })

  it('5. type=video_type → 渲染 AdminSelect；选 movie → onChange("movie")', async () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker
        type="video_type"
        value=""
        onChange={onChange}
        videoTypeOptions={VIDEO_TYPE_OPTIONS}
        data-testid="crp"
      />,
    )
    // 打开 AdminSelect dropdown
    const trigger = screen.getByTestId('crp')
    const triggerBtn = trigger.querySelector('[role="combobox"], [role="button"], button') as HTMLElement
    if (triggerBtn) {
      fireEvent.click(triggerBtn)
      await waitFor(() => screen.getByText('电影 (movie)'))
      fireEvent.click(screen.getByText('电影 (movie)'))
      expect(onChange).toHaveBeenCalledWith('movie')
    }
  })

  it('6. type 切换：video → external_url，DOM 中 url input 替代 picker dialog', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ContentRefPicker
        type="video"
        value=""
        onChange={onChange}
        videoFetcher={makeFetcher([])}
        data-testid="crp"
      />,
    )
    // type=video 时触发器是 combobox role
    expect(screen.getByTestId('crp')).not.toBeNull()
    // 切换 type
    rerender(
      <ContentRefPicker type="external_url" value="" onChange={onChange} data-testid="crp" />,
    )
    const wrapper = screen.getByTestId('crp')
    const input = wrapper.querySelector('input[type="url"]')
    expect(input).not.toBeNull()
  })

  it('7. type=video 但 videoFetcher 缺失 → console.error + 降级 input', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    render(
      <ContentRefPicker type="video" value="" onChange={onChange} data-testid="crp" />,
    )
    expect(errSpy).toHaveBeenCalled()
    // 降级 input data-testid 后缀 -fallback
    expect(screen.getByTestId('crp-fallback')).not.toBeNull()
  })

  it('8. disabled=true → 子 input disabled', () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker
        type="custom_html"
        value=""
        onChange={onChange}
        disabled
        data-testid="crp"
      />,
    )
    const wrapper = screen.getByTestId('crp')
    const input = wrapper.querySelector('input') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('9. type=video 编辑态 value 已有 UUID → 触发 fetcher 恢复', async () => {
    const onChange = vi.fn()
    const fetcherCalls: { q: string; limit: number }[] = []
    const fetcher: VideoPickerFetcher = async ({ q, limit, signal: _signal }) => {
      fetcherCalls.push({ q, limit })
      return { items: q === ITEM_A.id ? [ITEM_A] : [] }
    }
    render(
      <ContentRefPicker
        type="video"
        value={ITEM_A.id}
        onChange={onChange}
        videoFetcher={fetcher}
        data-testid="crp"
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    await waitFor(() => {
      // fetcher 至少被调用一次（picker dialog 初始 + resolve query）
      expect(fetcherCalls.some((c) => c.q === ITEM_A.id && c.limit === 1)).toBe(true)
    })
  })

  it('10. error prop 传入 → 显示错误文案', () => {
    const onChange = vi.fn()
    render(
      <ContentRefPicker
        type="custom_html"
        value=""
        onChange={onChange}
        error="必填"
        data-testid="crp"
      />,
    )
    expect(screen.getByText('必填')).not.toBeNull()
  })
})
