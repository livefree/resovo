/**
 * episode-url.test.ts — BUGFIX-WATCH-EP-URL
 * parseEpisodeParam / buildEpisodeUrl 纯函数边界。
 */

import { describe, it, expect } from 'vitest'
import { parseEpisodeParam, buildEpisodeUrl } from '../../../apps/web-next/src/lib/episode-url'

describe('parseEpisodeParam', () => {
  it('合法集号原样解析', () => {
    expect(parseEpisodeParam('3')).toBe(3)
    expect(parseEpisodeParam('12')).toBe(12)
  })

  it('缺省/null/空 → 第 1 集', () => {
    expect(parseEpisodeParam(null)).toBe(1)
    expect(parseEpisodeParam(undefined)).toBe(1)
    expect(parseEpisodeParam('')).toBe(1)
  })

  it('非法/越界 → 第 1 集', () => {
    expect(parseEpisodeParam('0')).toBe(1)
    expect(parseEpisodeParam('-2')).toBe(1)
    expect(parseEpisodeParam('abc')).toBe(1)
  })

  it('小数向下取整', () => {
    expect(parseEpisodeParam('3.9')).toBe(3)
  })
})

describe('buildEpisodeUrl', () => {
  it('无既有 query → 仅 ep', () => {
    expect(buildEpisodeUrl('/zh/watch/title-abc123', '', 5)).toBe('/zh/watch/title-abc123?ep=5')
  })

  it('覆盖既有 ep', () => {
    expect(buildEpisodeUrl('/zh/watch/title-abc123', '?ep=1', 7)).toBe('/zh/watch/title-abc123?ep=7')
  })

  it('保留其它 query（如 preview）', () => {
    const out = buildEpisodeUrl('/zh/watch/title-abc123', '?preview=admin&ep=1', 9)
    const params = new URLSearchParams(out.split('?')[1])
    expect(params.get('preview')).toBe('admin')
    expect(params.get('ep')).toBe('9')
  })
})
