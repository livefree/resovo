import { describe, it, expect } from 'vitest'
import { heightToQuality } from '../../../../../apps/worker/src/jobs/source-health/level2-render'

describe('heightToQuality', () => {
  it('maps 2160 to 4K', () => expect(heightToQuality(2160)).toBe('4K'))
  it('maps 2161 to 4K', () => expect(heightToQuality(2161)).toBe('4K'))
  it('maps 1440 to 2K', () => expect(heightToQuality(1440)).toBe('2K'))
  it('maps 1441 to 2K', () => expect(heightToQuality(1441)).toBe('2K'))
  it('maps 1080 to 1080P', () => expect(heightToQuality(1080)).toBe('1080P'))
  it('maps 720 to 720P', () => expect(heightToQuality(720)).toBe('720P'))
  it('maps 480 to 480P', () => expect(heightToQuality(480)).toBe('480P'))
  it('maps 360 to 360P', () => expect(heightToQuality(360)).toBe('360P'))
  it('maps 240 to 240P', () => expect(heightToQuality(240)).toBe('240P'))
  it('maps 1 to 240P', () => expect(heightToQuality(1)).toBe('240P'))
  it('maps 1079 to 720P', () => expect(heightToQuality(1079)).toBe('720P'))
})
