import { describe, expect, it } from 'vitest'
import { getInlineEpisodes, getPlayerLayoutClass, getSidePanelClass } from '@/components/player/playerShell.layout'

describe('playerShell.layout', () => {
  it('default mode keeps spacing and row split on large screens', () => {
    const classes = getPlayerLayoutClass(false)
    expect(classes).toContain('gap-4')
    expect(classes).toContain('lg:flex-row')
  })

  it('theater mode removes gap for full-width player area', () => {
    const classes = getPlayerLayoutClass(true)
    expect(classes).toContain('gap-0')
    expect(classes).not.toContain('gap-4')
  })

  it('default mode side panel is visible', () => {
    const classes = getSidePanelClass(false)
    expect(classes).toContain('lg:w-72')
    expect(classes).toContain('opacity-100')
  })

  it('theater mode side panel is collapsed and non-interactive', () => {
    const classes = getSidePanelClass(true)
    expect(classes).toContain('max-h-0')
    expect(classes).toContain('opacity-0')
    expect(classes).toContain('pointer-events-none')
    expect(classes).toContain('lg:w-0')
  })

  it('default mode does not enable inline player episodes', () => {
    expect(getInlineEpisodes(false, 12)).toBeUndefined()
  })

  it('theater mode enables inline player episodes for multi-episode videos', () => {
    const episodes = getInlineEpisodes(true, 3)
    expect(episodes).toHaveLength(3)
    expect(episodes?.[0]?.title).toBe('第1集')
    expect(episodes?.[2]?.title).toBe('第3集')
  })

  it('theater mode keeps inline episodes disabled for single-episode video', () => {
    expect(getInlineEpisodes(true, 1)).toBeUndefined()
  })
})
