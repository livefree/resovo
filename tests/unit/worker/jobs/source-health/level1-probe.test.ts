import { describe, it, expect } from 'vitest'
import { extractSiteId } from '../../../../../apps/worker/src/jobs/source-health/level1-probe'

describe('extractSiteId', () => {
  it('extracts hostname from valid URL', () => {
    expect(extractSiteId('https://cdn.example.com/video/master.m3u8')).toBe('cdn.example.com')
  })

  it('returns truncated raw string for invalid URL', () => {
    const result = extractSiteId('not-a-url')
    expect(result).toBe('not-a-url')
    expect(result.length).toBeLessThanOrEqual(64)
  })

  it('handles URL with port', () => {
    expect(extractSiteId('https://stream.site.com:8080/hls/index.m3u8')).toBe('stream.site.com')
  })

  it('handles very long invalid URL by truncating', () => {
    const longStr = 'a'.repeat(200)
    expect(extractSiteId(longStr).length).toBeLessThanOrEqual(64)
  })
})
