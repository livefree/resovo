/**
 * tests/unit/web-next/admin-preview-query.test.ts — carryAdminPreview（BUGFIX-PREVIEW-LINK-B）
 *
 * ADR-160 D-160-1 双因素 query 跨页透传：preview 模式下详情页 → /watch 链接必须携带
 * `?preview=admin`，否则 middleware 不注入 x-admin-preview header → 未公开视频 404。
 */

import { describe, it, expect } from 'vitest'
import { carryAdminPreview } from '../../../apps/web-next/src/lib/admin-preview-query'

describe('carryAdminPreview', () => {
  it('当前 URL 处于 preview 模式 → 已带 query 的 href 用 & 追加', () => {
    const current = new URLSearchParams('preview=admin')
    expect(carryAdminPreview('/watch/three-body-abc12345?ep=3', current)).toBe(
      '/watch/three-body-abc12345?ep=3&preview=admin',
    )
  })

  it('当前 URL 处于 preview 模式 → 无 query 的 href 用 ? 追加', () => {
    const current = new URLSearchParams('preview=admin')
    expect(carryAdminPreview('/watch/abc12345', current)).toBe(
      '/watch/abc12345?preview=admin',
    )
  })

  it('public 普通访问（无 preview query）→ href 原样返回', () => {
    expect(carryAdminPreview('/watch/abc12345?ep=1', new URLSearchParams())).toBe(
      '/watch/abc12345?ep=1',
    )
  })

  it('preview 值非 admin（伪造/其它值）→ 不透传', () => {
    const current = new URLSearchParams('preview=user')
    expect(carryAdminPreview('/watch/abc12345?ep=1', current)).toBe(
      '/watch/abc12345?ep=1',
    )
  })
})
