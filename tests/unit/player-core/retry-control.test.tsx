/**
 * @vitest-environment jsdom
 *
 * retry-control.test.tsx — CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-ADR / ADR-166 / Wave 4 #4-ADR
 *
 * 覆盖 player-core onError(event, controls) 命令面契约：
 *   #1 同步合法 retry：onError 回调内同 tick 调 controls.retry() → retrySourceLoad 被调（hls.startLoad / video.load）
 *   #2 异步 retry 守卫：onError 内 await Promise.resolve 后调 retry → dev warn + retrySourceLoad 不被调（R-166-2）
 *   #3 切 src 同 tick 调 retry：onError 内 setState src='B' 后调 retry → 守卫 no-op（R-166-2 边界）
 *   #4 连续 fatal 拿新 controls：第一次 retry → 第二次 onError 携带新 frozen 对象（不复用旧引用 / 不共享冻结状态）
 *   #5 data-retry-attempt 计数：retry 2 次 → video data-retry-attempt='2' / src 变化重置 0（Y-166-2）
 *
 * 测试策略：
 *   - 不渲染整个 Player（usePlayerOrchestration 依赖庞大），用 controlled wrapper 包裹 Player + mock HLS（hls.js 占位 + Hls.isSupported false）
 *   - 直接通过 video DOM 触发原生 error 事件（mock 路径 isManagedHlsSource=false → 走 native onError）
 *   - apiClient / next 不涉及（player-core 是纯前端依赖）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { useState } from 'react'
import { render, act, fireEvent, cleanup } from '@testing-library/react'

// jsdom 默认无 matchMedia / IntersectionObserver / ResizeObserver — Player 依赖 useViewportSignals 等
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  }
  if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver) {
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
  }
}

// hls.js mock：isSupported 返回 false 让 useSourceLoader 走 loadDirectSource 路径
// 避免 HLS 路径牵涉 dynamic import + Hls 类构造（path mock 简化测试）
vi.mock('hls.js', () => ({
  default: class FakeHls {
    static isSupported() { return false }
    static Events = { MANIFEST_PARSED: 'parsed', ERROR: 'error' }
    loadSource() {}
    attachMedia() {}
    startLoad() {}
    destroy() {}
    on() {}
  },
}))

import { Player } from '../../../packages/player-core/src/Player'

// HLS .m3u8 后缀会触发 isManagedHlsSource 路径；用 .mp4 让 native onError 路径生效
const MP4_SRC_A = 'https://example.com/a.mp4'
const MP4_SRC_B = 'https://example.com/b.mp4'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function triggerNativeError(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video')!
  fireEvent.error(video)
  return video as HTMLVideoElement
}

describe('player-core onError(event, controls) — ADR-166 / Wave 4 #4-ADR', () => {
  it('#1 同步合法 retry：onError 回调**内**同步 controls.retry() → video.load 被调（retrySourceLoad 执行）', () => {
    // Codex FIX-1：retry 必须在 onError 同步窗口内调用 / 否则 active 守卫拦截 / 测试如实反映契约
    let capturedEvent: unknown = null
    let capturedControls: { retry: () => void } | null = null
    const onError = vi.fn((event, controls) => {
      capturedEvent = event
      capturedControls = controls
      // 在 onError 同步窗口内调 retry / active=true / 守卫放行
      controls.retry()
    })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement
    const loadSpy = vi.spyOn(video, 'load')

    fireEvent.error(video)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(Object.isFrozen(capturedControls)).toBe(true)
    expect(capturedEvent).toEqual({ code: 'native_media_failed', src: MP4_SRC_A, fatal: true })
    expect(loadSpy).toHaveBeenCalled()
  })

  it('#2 异步 retry 守卫：await 后调 retry → active 守卫拦截 + dev warn (R-166-2 / Codex FIX-1)', async () => {
    // FIX-1 后 active 守卫优先级 > srcRef 守卫；await 后 onError 同步窗口早已关闭
    // 即便 src 后续是否变化都拦截在 active 层（语义清晰：controls 生命周期 = onError 同 tick）
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let leakedControls: { retry: () => void } | null = null
    const onError = vi.fn((_event: unknown, controls: { retry: () => void }) => {
      leakedControls = controls
    })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement
    const loadSpy = vi.spyOn(video, 'load')

    fireEvent.error(video)

    // 模拟 await：等下个 tick
    await act(async () => { await Promise.resolve() })

    // active=false 已生效 / 即便 src 未变，调用 retry → no-op + dev warn
    act(() => { leakedControls!.retry() })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outside onError tick'))
    expect(loadSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('#3 retry 后第二次 fatal → 拿到新 controls 实例（不复用旧引用 / 不共享冻结状态）', () => {
    const seen: Array<{ retry: () => void }> = []
    const onError = vi.fn((_event, controls) => {
      seen.push(controls)
      controls.retry()
    })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement

    fireEvent.error(video)
    fireEvent.error(video)

    expect(seen.length).toBe(2)
    expect(seen[1]).not.toBe(seen[0])
    expect(Object.isFrozen(seen[1])).toBe(true)
  })

  it('#4 data-retry-attempt 计数：retry 2 次 → 属性=2（Y-166-2）', () => {
    // retry 必须在 onError 同步窗口内调用 / 否则 active 守卫拦截
    const onError = vi.fn((_event, controls) => { controls.retry() })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.getAttribute('data-retry-attempt')).toBeNull()

    fireEvent.error(video)
    expect(video.getAttribute('data-retry-attempt')).toBe('1')

    fireEvent.error(video)
    expect(video.getAttribute('data-retry-attempt')).toBe('2')
  })

  it('#5b 持有 controls 引用 onError 返回后调用 → no-op + dev warn（Codex FIX-1 / active 守卫 / src 未变也拒）', () => {
    // Codex stop-time review 命中：仅靠 srcRef 守卫无法识别"消费方持有 controls 外溢调用 + src 未变"
    // 这一合法路径但语义违约场景；active 标志在 onError 同步返回瞬间关闭契约窗口
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let leakedControls: { retry: () => void } | null = null
    const onError = vi.fn((_event: unknown, controls: { retry: () => void }) => {
      leakedControls = controls
    })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement
    const loadSpy = vi.spyOn(video, 'load')

    fireEvent.error(video)
    expect(leakedControls).not.toBeNull()

    // onError 已同步返回 → active=false；src 未变 → srcRef 守卫不会触发
    // 仅靠 srcRef 单层守卫的初版会**放行**这次调用 → 契约破缺
    // FIX-1 active 守卫拦截
    act(() => { leakedControls!.retry() })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outside onError tick'))
    expect(loadSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('#6 setTimeout 内调用 controls.retry → no-op + dev warn（Codex FIX-1 / active 守卫覆盖 setTimeout 路径）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let leakedControls: { retry: () => void } | null = null
    const onError = vi.fn((_event: unknown, controls: { retry: () => void }) => {
      leakedControls = controls
    })
    const { container } = render(<Player src={MP4_SRC_A} onError={onError} />)
    const video = container.querySelector('video') as HTMLVideoElement
    const loadSpy = vi.spyOn(video, 'load')

    fireEvent.error(video)

    // 模拟 setTimeout 后调用
    await new Promise(resolve => setTimeout(resolve, 0))
    act(() => { leakedControls!.retry() })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outside onError tick'))
    expect(loadSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('#7 src 变化 → retryAttemptRef 重置 0（Y-166-2 / 下一轮 mount 周期独立计数）', async () => {
    const onError = vi.fn((_event, controls) => { controls.retry() })
    function Wrapper() {
      const [src, setSrc] = useState(MP4_SRC_A)
      return (
        <>
          <button data-testid="switch-src" onClick={() => setSrc(MP4_SRC_B)}>switch</button>
          <Player src={src} onError={onError} />
        </>
      )
    }
    const { container, getByTestId } = render(<Wrapper />)
    const video = container.querySelector('video') as HTMLVideoElement

    fireEvent.error(video)
    expect(video.getAttribute('data-retry-attempt')).toBe('1')

    // 切 src 后 retryAttemptRef 重置 0；video 仍是同一元素 / setAttribute 不会被自动清除
    // 但下次 retry 时 retryAttemptRef.current = 0 + 1 = 1（而不是 2）→ 验证计数从 0 开始
    fireEvent.click(getByTestId('switch-src'))
    await act(async () => { await Promise.resolve() })

    fireEvent.error(video)
    // 计数从 0 开始 → 1（而不是 2）
    expect(video.getAttribute('data-retry-attempt')).toBe('1')
  })
})
