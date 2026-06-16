/**
 * form-helpers.test.ts — META-50-3B-2（ADR-206 D-206-9）
 *
 * 验证编辑抽屉 原名/原语种/别名 的回填（videoToForm）+ 提交 diff（formToPatch）：
 *   - videoToForm：title_original/original_language 回填 + aliases 逗号 join（结构化 manual aka，3B-1 注入）
 *   - formToPatch：三字段 diff（空串→null / aliases splitComma 数组 / 清空别名→[] 替换语义 / 未改不入 patch）
 */
import { describe, it, expect } from 'vitest'
import { videoToForm, formToPatch } from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/form-helpers'
import { EMPTY_FORM } from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/types'
import type { FormState } from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/types'
import type { VideoAdminDetail } from '../../../../../../apps/server-next/src/lib/videos/types'

function detail(over: Partial<VideoAdminDetail> = {}): VideoAdminDetail {
  return {
    id: 'v1', short_id: 'abc', title: '海贼王', title_en: null,
    title_original: null, original_language: null, aliases: [],
    cover_url: null, type: 'anime', year: null, is_published: false, source_count: '0',
    description: null, genres: [], country: null, episode_count: 0,
    status: 'ongoing', rating: null, director: [], cast: [], writers: [], douban_id: null,
    ...over,
  } as unknown as VideoAdminDetail
}

const base = (): FormState => ({ ...EMPTY_FORM, title: '海贼王' })

describe('videoToForm — 3B-2 原名/原语种/别名回填', () => {
  it('title_original/original_language 回填 + aliases 逗号 join', () => {
    const f = videoToForm(detail({ title_original: 'ONE PIECE', original_language: 'ja', aliases: ['航海王', '海盗王'] }))
    expect(f.titleOriginal).toBe('ONE PIECE')
    expect(f.originalLanguage).toBe('ja')
    expect(f.aliases).toBe('航海王, 海盗王')
  })

  it('null / 空别名 → 空串', () => {
    const f = videoToForm(detail())
    expect(f.titleOriginal).toBe('')
    expect(f.originalLanguage).toBe('')
    expect(f.aliases).toBe('')
  })
})

describe('formToPatch — 3B-2 三字段 diff', () => {
  it('改 titleOriginal/originalLanguage → patch', () => {
    const orig = base()
    const p = formToPatch(orig, { ...orig, titleOriginal: 'ONE PIECE', originalLanguage: 'ja' })
    expect(p.titleOriginal).toBe('ONE PIECE')
    expect(p.originalLanguage).toBe('ja')
  })

  it('改 aliases → splitComma 数组（trim + 去空）', () => {
    const orig = base()
    const p = formToPatch(orig, { ...orig, aliases: '航海王, ONE PIECE ,' })
    expect(p.aliases).toEqual(['航海王', 'ONE PIECE'])
  })

  it('清空 aliases（orig 有 curr 空）→ [] 替换清空（非追加语义）', () => {
    const orig = { ...base(), aliases: '航海王' }
    const p = formToPatch(orig, { ...orig, aliases: '' })
    expect(p.aliases).toEqual([])
  })

  it('清空 titleOriginal（orig 有 curr 空）→ null', () => {
    const orig = { ...base(), titleOriginal: 'ONE PIECE' }
    const p = formToPatch(orig, { ...orig, titleOriginal: '' })
    expect(p.titleOriginal).toBeNull()
  })

  it('三字段未改 → 不入 patch（diff 守卫）', () => {
    const orig = { ...base(), titleOriginal: 'X', originalLanguage: 'ja', aliases: '航海王' }
    const p = formToPatch(orig, { ...orig })
    expect('titleOriginal' in p).toBe(false)
    expect('originalLanguage' in p).toBe(false)
    expect('aliases' in p).toBe(false)
  })
})
