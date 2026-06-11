/**
 * admin-preview-url.test.ts — MODUX-P1-3 / ADR-160 D-160-7
 *
 * 覆盖 server-next admin「前台预览」URL builder：
 * - origin + locale 前缀 + ?preview=admin 三要素拼装
 * - slug 有/无（slugPart 回退 shortId，复用 getVideoDetailHref 语义）
 * - segment 映射透传（variety → tvshow / 非主类型 → others）
 * - locale 显式覆盖
 */
import { describe, it, expect } from 'vitest'
import { buildAdminPreviewUrl } from '../../../apps/server-next/src/lib/admin-preview-url'

describe('buildAdminPreviewUrl — preview 链接派生（MODUX-P1-3）', () => {
  it('默认 locale zh-CN + preview query + origin 拼装', () => {
    const url = buildAdminPreviewUrl({ type: 'movie', slug: 'foo', shortId: 'aB3kR9x1' })
    expect(url).toBe('http://localhost:3000/zh-CN/movie/foo-aB3kR9x1?preview=admin')
  })

  it('slug=null → slugPart 回退 shortId', () => {
    const url = buildAdminPreviewUrl({ type: 'series', slug: null, shortId: 'aBcd1234' })
    expect(url).toBe('http://localhost:3000/zh-CN/series/aBcd1234?preview=admin')
  })

  it('segment 映射透传：variety → tvshow', () => {
    const url = buildAdminPreviewUrl({ type: 'variety', slug: null, shortId: 'Mc4W3j93' })
    expect(url).toContain('/zh-CN/tvshow/Mc4W3j93')
  })

  it('非主详情类型 → others segment', () => {
    const url = buildAdminPreviewUrl({ type: 'other', slug: null, shortId: 'NAt2TRjO' })
    expect(url).toContain('/zh-CN/others/NAt2TRjO')
  })

  it('locale 显式覆盖', () => {
    const url = buildAdminPreviewUrl({ type: 'movie', slug: null, shortId: 'aB3kR9x1' }, 'en')
    expect(url).toBe('http://localhost:3000/en/movie/aB3kR9x1?preview=admin')
  })
})
