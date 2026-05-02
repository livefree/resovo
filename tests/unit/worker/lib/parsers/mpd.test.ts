import { describe, it, expect } from 'vitest'
import { parseMpd } from '../../../../../apps/worker/src/lib/parsers/mpd'

const MPD_XML = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet>
      <Representation id="1" bandwidth="500000" height="360" width="640"/>
      <Representation id="2" bandwidth="1000000" height="720" width="1280"/>
      <Representation id="3" bandwidth="3000000" height="1080" width="1920"/>
    </AdaptationSet>
  </Period>
</MPD>`

describe('parseMpd', () => {
  it('parses representations with height and bandwidth', () => {
    const result = parseMpd(MPD_XML)
    expect(result.representations).toHaveLength(3)
    expect(result.maxResolutionHeight).toBe(1080)
    expect(result.representations[0]).toMatchObject({ height: 360, bandwidth: 500000 })
    expect(result.representations[2]).toMatchObject({ height: 1080, bandwidth: 3000000 })
  })

  it('handles missing height', () => {
    const xml = `<MPD><Representation bandwidth="1000000"/></MPD>`
    const result = parseMpd(xml)
    expect(result.representations[0].height).toBeNull()
    expect(result.maxResolutionHeight).toBeNull()
  })

  it('handles empty MPD', () => {
    const result = parseMpd('<MPD/>')
    expect(result.representations).toHaveLength(0)
    expect(result.maxResolutionHeight).toBeNull()
  })
})
