/**
 * inferBreadcrumbs 纯函数单测（CHG-SN-2-05）
 *
 * 覆盖：顶层路径 / 嵌套（children）/ hidden 路由（未在 nav 中）→ 返空 / 不存在路径 → 返空 /
 * 多组遍历 / 与 server-next ADMIN_NAV 真实数据对齐
 */
import { describe, it, expect } from 'vitest'
import {
  inferBreadcrumbs,
  type BreadcrumbItem,
} from '../../../../../packages/admin-ui/src/shell/breadcrumbs'
import type { AdminNavSection } from '../../../../../packages/admin-ui/src/shell/types'

// 复用 server-next admin-nav.tsx ADMIN_NAV 5 组结构（mock 不含 ReactNode icon，纯类型/数据测试）
const MOCK_NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin' },
      { label: '内容审核', href: '/admin/moderation' },
    ],
  },
  {
    title: '内容资产',
    items: [
      { label: '视频库', href: '/admin/videos' },
      { label: '播放线路', href: '/admin/sources' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { label: '用户管理', href: '/admin/users' },
      { label: '站点设置', href: '/admin/system/settings' },
      { label: '审计日志', href: '/admin/audit' },
    ],
  },
] as const

describe('inferBreadcrumbs — 顶层路径命中', () => {
  it('/admin → [{运营中心}, {管理台站, /admin}]', () => {
    const result = inferBreadcrumbs('/admin', MOCK_NAV)
    expect(result).toEqual<BreadcrumbItem[]>([
      { label: '运营中心' },
      { label: '管理台站', href: '/admin' },
    ])
  })

  it('/admin/moderation → [{运营中心}, {内容审核, ...}]', () => {
    expect(inferBreadcrumbs('/admin/moderation', MOCK_NAV)).toEqual<BreadcrumbItem[]>([
      { label: '运营中心' },
      { label: '内容审核', href: '/admin/moderation' },
    ])
  })

  it('/admin/system/settings → [{系统管理}, {站点设置, ...}]（嵌套路径在第 1 层即命中）', () => {
    expect(inferBreadcrumbs('/admin/system/settings', MOCK_NAV)).toEqual<BreadcrumbItem[]>([
      { label: '系统管理' },
      { label: '站点设置', href: '/admin/system/settings' },
    ])
  })
})

describe('inferBreadcrumbs — children 嵌套（未来兼容）', () => {
  const NAV_WITH_CHILDREN: readonly AdminNavSection[] = [
    {
      title: '系统管理',
      items: [
        {
          label: '系统',
          href: '/admin/system',
          children: [
            { label: '缓存管理', href: '/admin/system/cache' },
            { label: '迁移工具', href: '/admin/system/migration' },
          ],
        },
      ],
    },
  ]

  it('parent.href 命中 → 返父项 2 段', () => {
    expect(inferBreadcrumbs('/admin/system', NAV_WITH_CHILDREN)).toEqual<BreadcrumbItem[]>([
      { label: '系统管理' },
      { label: '系统', href: '/admin/system' },
    ])
  })

  it('child.href 命中 → 返 3 段（section + parent + child）', () => {
    expect(inferBreadcrumbs('/admin/system/cache', NAV_WITH_CHILDREN)).toEqual<BreadcrumbItem[]>([
      { label: '系统管理' },
      { label: '系统', href: '/admin/system' },
      { label: '缓存管理', href: '/admin/system/cache' },
    ])
  })
})

describe('inferBreadcrumbs — 未命中场景（hidden 路由 + 不存在路径）', () => {
  it('hidden 路由（不在 nav 中）→ 返空（IA v1 analytics 等）', () => {
    expect(inferBreadcrumbs('/admin/analytics', MOCK_NAV)).toEqual<BreadcrumbItem[]>([])
  })

  it('完全不存在的路径 → 返空', () => {
    expect(inferBreadcrumbs('/admin/does-not-exist', MOCK_NAV)).toEqual<BreadcrumbItem[]>([])
  })

  it('空字符串 / 非 admin 路径 → 返空', () => {
    expect(inferBreadcrumbs('', MOCK_NAV)).toEqual<BreadcrumbItem[]>([])
    expect(inferBreadcrumbs('/some-other-path', MOCK_NAV)).toEqual<BreadcrumbItem[]>([])
  })

  it('空 nav → 返空', () => {
    expect(inferBreadcrumbs('/admin', [])).toEqual<BreadcrumbItem[]>([])
  })
})

describe('inferBreadcrumbs — 返回值不可变（readonly）', () => {
  it('返回的 BreadcrumbItem 数组可被 readonly 数组类型变量接收', () => {
    const result: readonly BreadcrumbItem[] = inferBreadcrumbs('/admin', MOCK_NAV)
    expect(result.length).toBe(2)
  })
})

describe('inferBreadcrumbs — 递归深度契约（仅一层 children；锁定当前实现，防未来误改）', () => {
  const NAV_THREE_LEVELS: readonly AdminNavSection[] = [
    {
      title: '系统管理',
      items: [
        {
          label: '系统',
          href: '/admin/system',
          children: [
            {
              label: '缓存',
              href: '/admin/system/cache',
              // 当前实现不递归 grandchildren；以下三层数据用于负向断言
              children: [
                { label: '统计', href: '/admin/system/cache/stats' },
              ],
            },
          ],
        },
      ],
    },
  ]

  it('祖孙路径（三层 child.children）未命中 → 返空', () => {
    expect(inferBreadcrumbs('/admin/system/cache/stats', NAV_THREE_LEVELS)).toEqual<BreadcrumbItem[]>([])
  })

  it('父项与子项仍可正常命中（递归一层契约不破）', () => {
    expect(inferBreadcrumbs('/admin/system', NAV_THREE_LEVELS)).toHaveLength(2)
    expect(inferBreadcrumbs('/admin/system/cache', NAV_THREE_LEVELS)).toHaveLength(3)
  })
})
