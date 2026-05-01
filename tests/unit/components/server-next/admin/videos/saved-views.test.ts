/**
 * saved-views 单测（CHG-DESIGN-08 8B）
 *
 * 覆盖：
 *   - localStorage 持久化（personal scope）
 *   - Map / Set 序列化往返一致性
 *   - 损坏数据 / SSR 路径降级
 *   - team scope 暂返空（follow-up VIDEO-TEAM-VIEWS-API）
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import {
  appendPersonalView,
  loadPersonalViews,
  loadTeamViews,
  makePersonalView,
  removePersonalView,
  DEFAULT_VIEWS,
} from '../../../../../../apps/server-next/src/lib/videos/saved-views'
import type { PersistedQuery } from '@resovo/admin-ui'

const STORAGE_KEY = 'admin-videos-views-personal'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

function makeQuery(): PersistedQuery {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: 'created_at', direction: 'desc' },
    filters: new Map([
      ['type', { kind: 'enum', value: ['movie'] }],
      ['q', { kind: 'text', value: 'avatar' }],
    ]),
    columns: new Map([
      ['title', { visible: true }],
      ['year', { visible: false }],
    ]),
  }
}

describe('saved-views — loadPersonalViews', () => {
  it('localStorage 空 → 返空数组', () => {
    expect(loadPersonalViews()).toEqual([])
  })

  it('localStorage 损坏（非 JSON）→ 返空数组（不抛错）', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadPersonalViews()).toEqual([])
  })

  it('localStorage 非数组 → 返空数组', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(loadPersonalViews()).toEqual([])
  })
})

describe('saved-views — append + persist + load 往返', () => {
  it('appendPersonalView 写入 localStorage 后 loadPersonalViews 返同样数据', () => {
    const view = makePersonalView('我的视图', makeQuery())
    const next = appendPersonalView([], view)
    expect(next.length).toBe(1)

    const loaded = loadPersonalViews()
    expect(loaded.length).toBe(1)
    expect(loaded[0]?.label).toBe('我的视图')
    expect(loaded[0]?.scope).toBe('personal')
  })

  it('Map / Set 序列化往返：filters / columns 完整恢复', () => {
    const view = makePersonalView('Test', makeQuery())
    appendPersonalView([], view)
    const loaded = loadPersonalViews()
    const q = loaded[0]?.query

    // filters Map 恢复（2 项）
    expect(q?.filters.size).toBe(2)
    expect(q?.filters.get('type')).toEqual({ kind: 'enum', value: ['movie'] })
    expect(q?.filters.get('q')).toEqual({ kind: 'text', value: 'avatar' })
    // columns Map 恢复
    expect(q?.columns.size).toBe(2)
    expect(q?.columns.get('title')).toEqual({ visible: true })
    expect(q?.columns.get('year')).toEqual({ visible: false })
    // pagination / sort 字段保留
    expect(q?.pagination).toEqual({ page: 1, pageSize: 20 })
    expect(q?.sort).toEqual({ field: 'created_at', direction: 'desc' })
  })

  it('追加多个 view：保留顺序', () => {
    const v1 = makePersonalView('A', makeQuery())
    const v2 = makePersonalView('B', makeQuery())
    let next = appendPersonalView([], v1)
    next = appendPersonalView(next, v2)
    const loaded = loadPersonalViews()
    expect(loaded.map((v) => v.label)).toEqual(['A', 'B'])
  })
})

describe('saved-views — removePersonalView', () => {
  it('按 id 移除指定 view + 同步 localStorage', () => {
    const v1 = makePersonalView('A', makeQuery())
    const v2 = makePersonalView('B', makeQuery())
    let list = appendPersonalView([], v1)
    list = appendPersonalView(list, v2)
    list = removePersonalView(list, v1.id)
    expect(list.length).toBe(1)
    expect(list[0]?.label).toBe('B')

    const loaded = loadPersonalViews()
    expect(loaded.map((v) => v.label)).toEqual(['B'])
  })

  it('id 不存在 → 不抛错 + 列表不变', () => {
    const v1 = makePersonalView('A', makeQuery())
    const list = appendPersonalView([], v1)
    const next = removePersonalView(list, 'non-existent')
    expect(next.length).toBe(1)
  })
})

describe('saved-views — makePersonalView', () => {
  it('id 含 personal- 前缀 + 时间戳', () => {
    const view = makePersonalView('Test', makeQuery())
    expect(view.id).toMatch(/^personal-\d+-/)
    expect(view.scope).toBe('personal')
  })

  it('createdAt / updatedAt 是 ISO 字符串', () => {
    const view = makePersonalView('Test', makeQuery())
    expect(view.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(view.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('saved-views — loadTeamViews', () => {
  it('暂返空数组（VIDEO-TEAM-VIEWS-API follow-up）', () => {
    expect(loadTeamViews()).toEqual([])
  })
})

describe('saved-views — DEFAULT_VIEWS（reference §5.3 4 默认 views）', () => {
  it('含 4 默认 views，id 全部 default- 前缀', () => {
    expect(DEFAULT_VIEWS.length).toBe(4)
    DEFAULT_VIEWS.forEach((v) => {
      expect(v.id).toMatch(/^default-/)
    })
  })

  it('label 与 reference §5.3 完全一致：我的待审 / 本周 / 封面失效 / 团队新增上架', () => {
    expect(DEFAULT_VIEWS.map((v) => v.label)).toEqual([
      '我的待审', '本周', '封面失效', '团队新增上架',
    ])
  })

  it('我的待审：reviewStatus=pending_review enum filter（精确匹配业务 filter）', () => {
    const view = DEFAULT_VIEWS.find((v) => v.id === 'default-my-pending-review')!
    expect(view.scope).toBe('personal')
    expect(view.query.filters.get('reviewStatus')).toEqual({
      kind: 'enum', value: ['pending_review'],
    })
    expect(view.query.sort).toEqual({ field: 'created_at', direction: 'desc' })
  })

  it('团队新增上架：status=published + sort created_at desc（精确匹配）', () => {
    const view = DEFAULT_VIEWS.find((v) => v.id === 'default-team-published')!
    expect(view.scope).toBe('team')
    expect(view.query.filters.get('status')).toEqual({
      kind: 'enum', value: ['published'],
    })
    expect(view.query.sort).toEqual({ field: 'created_at', direction: 'desc' })
  })

  it('本周：sort created_at desc + pageSize 50 近似（业务 filter 不支持时间区间）', () => {
    const view = DEFAULT_VIEWS.find((v) => v.id === 'default-this-week')!
    expect(view.query.pagination.pageSize).toBe(50)
    expect(view.query.sort).toEqual({ field: 'created_at', direction: 'desc' })
    // VIDEO-FILTER-TIME-RANGE follow-up 前不应有时间字段 filter
    expect(view.query.filters.size).toBe(0)
  })

  it('封面失效：scope=team + sort created_at desc + columns 空（columns patch 完全替换语义守门）', () => {
    const view = DEFAULT_VIEWS.find((v) => v.id === 'default-image-broken')!
    expect(view.scope).toBe('team')
    expect(view.query.sort).toEqual({ field: 'created_at', direction: 'desc' })
    // fix#3：columns 空 Map（applyPatch.columns 是完全替换语义；写单列会清空用户偏好）
    expect(view.query.columns.size).toBe(0)
  })

  it('所有默认 views 的 columns 均为空 Map（防 columns patch 替换破坏用户列偏好）', () => {
    DEFAULT_VIEWS.forEach((v) => {
      expect(v.query.columns.size).toBe(0)
    })
  })

  it('默认 views 不与 user views 共享 id 命名空间（personal-* / team-* 隔离）', () => {
    DEFAULT_VIEWS.forEach((v) => {
      expect(v.id).not.toMatch(/^personal-\d+/)
      expect(v.id).not.toMatch(/^team-\d+/)
    })
  })
})
