/**
 * overlay-manager.test.ts — CHG-SN-9-PLAYER-ERROR / arch-reviewer Opus R-N-2
 *
 * 覆盖 buildOverlayEntries 纯函数 suppressDefaultErrorUI 守卫：
 *   #1 error 非空 + suppressDefaultErrorUI 缺省 → error entry visible=true（既有行为）
 *   #2 error 非空 + suppressDefaultErrorUI=false → 同上（显式 false 等同缺省）
 *   #3 error 非空 + suppressDefaultErrorUI=true → error entry visible=false（消费方接管）
 *   #4 error=null + suppressDefaultErrorUI=true → error entry visible=false（既有 null 判定不受影响）
 *   #5 spinner / bezel 等其他 overlay 不受 suppressDefaultErrorUI 影响
 *
 * 仅测纯函数（无 React 依赖 / 无 DOM / 无 hls.js）。
 * Player.tsx native onError + useSourceLoader HLS fatal 行为测试需 DOM + hls.js mock，
 * 留独立 e2e 卡承接。
 */
import { describe, it, expect } from 'vitest'
import { buildOverlayEntries } from '../../../packages/player-core/src/hooks/useOverlayManager'

function baseParams(overrides: Partial<Parameters<typeof buildOverlayEntries>[0]> = {}) {
  return {
    chromeVisible: false,
    error: null,
    episodesPlacement: 'bottom-right' as const,
    hasTopChrome: false,
    isEpisodesOpen: false,
    loadingState: 'idle' as const,
    openPanel: false,
    settingsPlacement: 'bottom-right' as const,
    seekVisible: false,
    showCaptions: false,
    showTouchSeekIndicator: false,
    showUnmute: false,
    showBezel: false,
    ...overrides,
  }
}

describe('buildOverlayEntries — CHG-SN-9-PLAYER-ERROR suppressDefaultErrorUI 守卫', () => {
  it('#1 error 非空 + suppressDefaultErrorUI 缺省 → error entry visible=true（既有行为）', () => {
    const entries = buildOverlayEntries(baseParams({ error: 'Failed' }))
    const errorEntry = entries.find(e => e.kind === 'error')
    expect(errorEntry).toBeDefined()
    expect(errorEntry?.visible).toBe(true)
  })

  it('#2 error 非空 + suppressDefaultErrorUI=false → error entry visible=true（显式 false 等同缺省）', () => {
    const entries = buildOverlayEntries(baseParams({ error: 'Failed', suppressDefaultErrorUI: false }))
    const errorEntry = entries.find(e => e.kind === 'error')
    expect(errorEntry?.visible).toBe(true)
  })

  it('#3 error 非空 + suppressDefaultErrorUI=true → error entry visible=false（消费方接管错误 UI）', () => {
    const entries = buildOverlayEntries(baseParams({ error: 'Failed', suppressDefaultErrorUI: true }))
    const errorEntry = entries.find(e => e.kind === 'error')
    expect(errorEntry?.visible).toBe(false)
  })

  it('#4 error=null + suppressDefaultErrorUI=true → error entry visible=false（null 判定仍优先）', () => {
    const entries = buildOverlayEntries(baseParams({ error: null, suppressDefaultErrorUI: true }))
    const errorEntry = entries.find(e => e.kind === 'error')
    expect(errorEntry?.visible).toBe(false)
  })

  it('#5 spinner / bezel 不受 suppressDefaultErrorUI 影响（仅 error overlay 被守卫）', () => {
    const entries = buildOverlayEntries(baseParams({
      error: 'Failed',
      suppressDefaultErrorUI: true,
      loadingState: 'buffering',
      showBezel: true,
    }))
    const spinner = entries.find(e => e.kind === 'spinner')
    const bezel = entries.find(e => e.kind === 'bezel')
    expect(spinner?.visible).toBe(true)  // loadingState=buffering → spinner visible
    expect(bezel?.visible).toBe(true)    // showBezel=true → bezel visible
  })

  it('#6 error entry 仍保留 priority=600 / blocksGestures=true 不变（仅 visible 改变）', () => {
    const entriesA = buildOverlayEntries(baseParams({ error: 'X', suppressDefaultErrorUI: false }))
    const entriesB = buildOverlayEntries(baseParams({ error: 'X', suppressDefaultErrorUI: true }))
    const errA = entriesA.find(e => e.kind === 'error')
    const errB = entriesB.find(e => e.kind === 'error')
    expect(errA?.priority).toBe(errB?.priority)
    expect(errA?.blocksGestures).toBe(errB?.blocksGestures)
    expect(errA?.interactive).toBe(errB?.interactive)
  })
})
