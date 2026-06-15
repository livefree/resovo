/**
 * tests/unit/api/metadataFieldSplit.test.ts — META-49-B1
 *
 * splitIdentityScalarFields 纯函数：把 catalog 更新字段拆为「身份/type（留各源 service 事务写）」
 * 与「内容标量（上抛 reconcile / B1 过渡期 enrich 层立即 safeUpdate）」。
 */

import { describe, it, expect } from 'vitest'
import { splitIdentityScalarFields } from '@/api/services/metadata/fieldSplit'
import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'

describe('splitIdentityScalarFields — 身份/type vs 内容标量拆分', () => {
  it('身份字段（4 cache 列 + type）入 identityFields，内容字段入 contentFields', () => {
    const fields: CatalogUpdateData = {
      tmdbId: 123,
      imdbId: 'tt0001',
      bangumiSubjectId: 456,
      doubanId: '789',
      type: 'movie',
      title: '标题',
      titleOriginal: 'Original',
      description: '简介',
      rating: 8.5,
      coverUrl: 'http://x/c.jpg',
      country: 'CN',
    }
    const { identityFields, contentFields } = splitIdentityScalarFields(fields)
    expect(identityFields).toEqual({
      tmdbId: 123,
      imdbId: 'tt0001',
      bangumiSubjectId: 456,
      doubanId: '789',
      type: 'movie',
    })
    expect(contentFields).toEqual({
      title: '标题',
      titleOriginal: 'Original',
      description: '简介',
      rating: 8.5,
      coverUrl: 'http://x/c.jpg',
      country: 'CN',
    })
  })

  it('纯内容字段：identityFields 空', () => {
    const { identityFields, contentFields } = splitIdentityScalarFields({ title: 'x', rating: 9 })
    expect(identityFields).toEqual({})
    expect(contentFields).toEqual({ title: 'x', rating: 9 })
  })

  it('纯身份字段（bangumi auto 仅 bangumiSubjectId）：contentFields 空', () => {
    const { identityFields, contentFields } = splitIdentityScalarFields({ bangumiSubjectId: 999 })
    expect(identityFields).toEqual({ bangumiSubjectId: 999 })
    expect(contentFields).toEqual({})
  })

  it('不改值、不丢字段（拆分前后字段并集 = 原对象）', () => {
    const fields: CatalogUpdateData = { tmdbId: 1, type: 'anime', title: 't', genresRaw: ['原'] }
    const { identityFields, contentFields } = splitIdentityScalarFields(fields)
    expect({ ...identityFields, ...contentFields }).toEqual(fields)
  })
})
