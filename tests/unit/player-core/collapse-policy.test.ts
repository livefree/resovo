/**
 * collapse-policy.test.ts — PLAYER-11
 *
 * 固化桌面折叠策略 applyDesktopCollapsePolicy 的控件保留/移除契约，重点回归：
 *   - 音量键在所有桌面 profile（default/short-height/compact/medium/narrow）均保留
 *     （修复 ≤960px 桌面播放器音量键消失；音量静止态仅图标，无空间依据可删）
 *   - 既有移除不回归：chapter（非 default 移除）/ theater（short-height + narrow 移除）
 *     / airplay·pip（narrow 移除）
 *   - promoteCompactControls：非 default 下 speed/settings 提升 top-right，episodes 视
 *     hasEpisodes 提升
 *
 * 仅测纯函数（无 React / 无 DOM）。
 */
import { describe, it, expect } from 'vitest'
import { applyDesktopCollapsePolicy } from '../../../packages/player-core/src/hooks/useLayoutDecision/collapsePolicy'
import { createDesktopDefaultSlots, cloneSlots } from '../../../packages/player-core/src/hooks/useLayoutDecision/slotFactories'
import type { ControlId, ControlSlot, LayoutProfile } from '../../../packages/player-core/src/hooks/useLayoutDecision/types'

function runPolicy(profile: LayoutProfile, hasEpisodes: boolean) {
  const base = createDesktopDefaultSlots(hasEpisodes, /* hasNext */ true)
  const slots = applyDesktopCollapsePolicy({
    profile,
    hasEpisodes,
    slots: cloneSlots(base),
  })
  const visible = new Set<ControlId>(
    Object.values(slots).flatMap((controls) => controls),
  )
  const slotOf = (control: ControlId): ControlSlot | undefined =>
    (Object.keys(slots) as ControlSlot[]).find((slot) => slots[slot].includes(control))
  return { slots, visible, slotOf }
}

const NON_DEFAULT_PROFILES: LayoutProfile[] = [
  'short-height',
  'compact-width',
  'medium-width',
  'narrow-width',
]

describe('applyDesktopCollapsePolicy — 音量键保留（PLAYER-11 回归）', () => {
  it('default profile：原样返回，volume/chapter/theater 全在', () => {
    const { visible } = runPolicy('default', true)
    expect(visible.has('volume')).toBe(true)
    expect(visible.has('chapter')).toBe(true)
    expect(visible.has('theater')).toBe(true)
  })

  it.each(NON_DEFAULT_PROFILES)('%s profile：volume 必须保留', (profile) => {
    expect(runPolicy(profile, true).visible.has('volume')).toBe(true)
    expect(runPolicy(profile, false).visible.has('volume')).toBe(true)
  })
})

describe('applyDesktopCollapsePolicy — 既有移除契约不回归', () => {
  it.each(NON_DEFAULT_PROFILES)('%s profile：chapter 移除', (profile) => {
    expect(runPolicy(profile, true).visible.has('chapter')).toBe(false)
  })

  it('short-height：theater 移除（volume 仍在）', () => {
    const { visible } = runPolicy('short-height', true)
    expect(visible.has('theater')).toBe(false)
    expect(visible.has('volume')).toBe(true)
  })

  it('compact-width / medium-width：theater 保留', () => {
    expect(runPolicy('compact-width', true).visible.has('theater')).toBe(true)
    expect(runPolicy('medium-width', true).visible.has('theater')).toBe(true)
  })

  it('narrow-width：theater/airplay/pip 移除（volume 仍在）', () => {
    const { visible } = runPolicy('narrow-width', true)
    expect(visible.has('theater')).toBe(false)
    expect(visible.has('airplay')).toBe(false)
    expect(visible.has('pip')).toBe(false)
    expect(visible.has('volume')).toBe(true)
  })
})

describe('applyDesktopCollapsePolicy — promoteCompactControls', () => {
  it.each(NON_DEFAULT_PROFILES)('%s profile：speed/settings 提升 top-right', (profile) => {
    const { slotOf } = runPolicy(profile, true)
    expect(slotOf('speed')).toBe('top-right')
    expect(slotOf('settings')).toBe('top-right')
  })

  it.each(NON_DEFAULT_PROFILES)('%s profile：hasEpisodes 时 episodes 提升 top-right', (profile) => {
    expect(runPolicy(profile, true).slotOf('episodes')).toBe('top-right')
  })

  it.each(NON_DEFAULT_PROFILES)('%s profile：无 episodes 时不出现 episodes', (profile) => {
    expect(runPolicy(profile, false).visible.has('episodes')).toBe(false)
  })
})
