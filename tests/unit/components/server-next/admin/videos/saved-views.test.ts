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
