import { describe, it, expect } from 'vitest'
import { parseM3u8 } from '../../../../../apps/worker/src/lib/parsers/m3u8'

const MASTER_MANIFEST = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8`

const MEDIA_MANIFEST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg001.ts
#EXTINF:10.0,
seg002.ts`

describe('parseM3u8', () => {
  it('parses master manifest with variants', () => {
    const result = parseM3u8(MASTER_MANIFEST)
    expect(result.isMaster).toBe(true)
    expect(result.variants).toHaveLength(4)
    expect(result.maxResolutionHeight).toBe(1080)
    expect(result.variants[0]).toMatchObject({ resolution: '640x360', bandwidth: 800000, url: '360p.m3u8' })
    expect(result.variants[3]).toMatchObject({ resolution: '1920x1080', bandwidth: 5000000 })
  })

  it('parses media manifest (not master)', () => {
    const result = parseM3u8(MEDIA_MANIFEST)
    expect(result.isMaster).toBe(false)
    expect(result.variants).toHaveLength(0)
    expect(result.maxResolutionHeight).toBeNull()
  })

  it('handles empty manifest', () => {
    const result = parseM3u8('')
    expect(result.isMaster).toBe(false)
    expect(result.variants).toHaveLength(0)
    expect(result.maxResolutionHeight).toBeNull()
  })

  it('handles manifest with no RESOLUTION attribute', () => {
    const text = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream.m3u8`
    const result = parseM3u8(text)
    expect(result.isMaster).toBe(true)
    expect(result.variants[0].resolution).toBeNull()
    expect(result.maxResolutionHeight).toBeNull()
  })
})
