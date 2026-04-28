/**
 * admin-nav.ts — IA v0 路由树常量（plan §7 / ADR-100）
 *
 * 区段：运营中心 / 内容资产 / 采集中心 / 系统管理 / 认证
 * 实际路由（以 plan §7 文字清单为真源，行 519-545）：
 *   - 顶层 13：dashboard / moderation / videos / sources / merge / subtitles
 *               / home / submissions / crawler / image-health / analytics / users / audit
 *   - system 子 5：settings / cache / monitor / config / migration
 *   - 编辑子 1：videos/[id]/edit（M-SN-4 起步实装，M-SN-1 不占位）
 *   - 认证 1：login
 *   = 19 路由占位（M-SN-1 落 13 顶层 + 5 system 子 + 1 login = 19；videos/edit
 *     编辑子 M-SN-4 起步落，本卡不占位）
 *
 * 注：plan §7 视图数行 549 写"顶层视图 21 / 总路由 27"与文字清单数据不一致，
 * 已记录偏离 → CHG-SN-1-05 review；以文字清单为准。M-SN-1-08 milestone 验收
 * 时统一对账修订 plan §7 数字字段或补漏视图。
 *
 * URL slug 优先英文（plan §7 IA 命名声明）；中文菜单文案在 cutover 前可调；
 * 调整 URL 触发 plan §5.2 BLOCKER 第 8 条。
 *
 * 本表既驱动 admin layout 侧栏渲染，也供未来 packages/admin-ui Sidebar 组件
 * 下沉时复用（M-SN-2）。
 */

export interface AdminNavItem {
  readonly label: string
  readonly href: string
  readonly children?: readonly AdminNavItem[]
}

export interface AdminNavSection {
  readonly title: string
  readonly items: readonly AdminNavItem[]
}

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '工作台', href: '/admin' },
      { label: '内容审核', href: '/admin/moderation' },
    ],
  },
  {
    title: '内容资产',
    items: [
      { label: '视频库', href: '/admin/videos' },
      { label: '播放线路', href: '/admin/sources' },
      { label: '合并拆分', href: '/admin/merge' },
      { label: '字幕管理', href: '/admin/subtitles' },
      { label: '图片健康', href: '/admin/image-health' },
    ],
  },
  {
    title: '采集中心',
    items: [{ label: '采集控制', href: '/admin/crawler' }],
  },
  {
    title: '系统管理',
    items: [
      { label: '首页编辑', href: '/admin/home' },
      { label: '用户投稿', href: '/admin/submissions' },
      { label: '数据看板', href: '/admin/analytics' },
      { label: '用户管理', href: '/admin/users' },
      { label: '审计日志', href: '/admin/audit' },
      {
        label: '系统',
        href: '/admin/system',
        children: [
          { label: '站点设置', href: '/admin/system/settings' },
          { label: '缓存管理', href: '/admin/system/cache' },
          { label: '性能监控', href: '/admin/system/monitor' },
          { label: '运行时配置', href: '/admin/system/config' },
          { label: '迁移工具', href: '/admin/system/migration' },
        ],
      },
    ],
  },
] as const

/** 扁平化路由列表（仅含 page，不含 section 标题） */
export function flattenAdminRoutes(sections: readonly AdminNavSection[] = ADMIN_NAV): readonly AdminNavItem[] {
  const out: AdminNavItem[] = []
  for (const section of sections) {
    for (const item of section.items) {
      out.push(item)
      if (item.children) for (const c of item.children) out.push(c)
    }
  }
  return out
}
