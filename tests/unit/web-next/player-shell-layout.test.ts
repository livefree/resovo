/**
 * player-shell-layout.test.ts — PLAYER-11
 *
 * 固化 getInlineEpisodes 去 theater 门后的契约：
 *   - >1 集时无论是否影院模式都返回内嵌选集数组（默认模式控制条也有选集入口）
 *   - ≤1 集返回 undefined（单集不渲染选集守卫保留）
 *   - 文案按活跃线路实际集号渲染（非连续集号安全，PLAYER-LINE-BOUND-EP）
 */
import { describe, it, expect } from 'vitest'
import { getInlineEpisodes } from '../../../apps/web-next/src/components/player/playerShell.layout'

describe('getInlineEpisodes — PLAYER-11 去 theater 门', () => {
  it('多集：返回内嵌选集数组（默认模式同样提供，不再绑死影院）', () => {
    const result = getInlineEpisodes([1, 2, 3])
    expect(result).toEqual([{ title: '第1集' }, { title: '第2集' }, { title: '第3集' }])
  })

  it('单集：返回 undefined（守卫保留）', () => {
    expect(getInlineEpisodes([1])).toBeUndefined()
  })

  it('空数组：返回 undefined', () => {
    expect(getInlineEpisodes([])).toBeUndefined()
  })

  it('非连续集号：按实际集号渲染文案', () => {
    expect(getInlineEpisodes([2, 5, 11])).toEqual([
      { title: '第2集' },
      { title: '第5集' },
      { title: '第11集' },
    ])
  })
})
