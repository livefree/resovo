/**
 * admin-nav.ts — IA v1 路由树常量（ADR-100 IA 修订段 / plan §7 v2.2）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/app/shell.jsx:10-35`（5 组 NAV）
 *   2. ADR-100 IA 修订段（v0 → v1，2026-04-28 · CHG-SN-1-10）
 *   3. plan §7 v2.2 IA tree（CHG-SN-1-10 落地）
 *
 * 区段（IA v1）：运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理 / 认证
 *
 * 路由占位与侧栏暴露策略（IA v1）：
 *   - 路由占位总数 21（M-SN-1 落地基线，CHG-SN-1-08 对账确认）：
 *     - admin 顶层 13：dashboard / moderation / videos / sources / merge / subtitles
 *                     / image-health / crawler / home / submissions / analytics
 *                     / users / audit
 *     - system landing 1：/admin/system
 *     - system 子 5：settings / cache / monitor / config / migration
 *     - 编辑子 1：videos/[id]/edit（M-SN-4 落地）
 *     - 认证 1：/login
 *   - 侧栏暴露 10 项链接（IA v1 修订）：
 *     dashboard / moderation / videos / sources / merge / subtitles / image-health
 *     / home / submissions / crawler / users / system/settings / audit
 *     （= 9 admin 顶层 + 1 system 子 = 10 项；users 在系统管理组内单算）
 *   - 路由保留但侧栏隐藏（M-SN-3 起按 Tab 容器化策略迁移内容）：
 *     - analytics（→ dashboard 内 Tab/卡片库）
 *     - system/cache · system/monitor · system/config · system/migration
 *       （→ settings 容器 Tab 面板）
 *
 * IA v1 修订点（v0 → v1，4 项决策详见 ADR-100）：
 *   - IA-1：dashboard label "工作台" → "管理台站"
 *   - IA-2：analytics 路由保留，侧栏不暴露
 *   - IA-3：home + submissions 独立成"首页运营"组（从系统管理剥离）
 *   - IA-4：system 5 子侧栏只暴露"站点设置"（⌘,）；4 子作 settings 容器 Tab
 *
 * URL slug 优先英文（plan §7 IA 命名声明 / §5.2 BLOCKER 第 8 条）；中文菜单
 * 文案在 cutover 前可调；调整 URL 触发 BLOCKER。
 *
 * 本表既驱动 admin layout 侧栏渲染，也供未来 packages/admin-ui Sidebar 组件
 * 下沉时复用（M-SN-2）。M-SN-2 Sidebar 组件下沉时按 ADR 流程扩展 icon /
 * shortcut / count provider 字段（剩余差异详见 ADR-100 IA 修订段）。
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
      { label: '管理台站', href: '/admin' },
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
    title: '首页运营',
    items: [
      { label: '首页编辑', href: '/admin/home' },
      { label: '用户投稿', href: '/admin/submissions' },
    ],
  },
  {
    title: '采集中心',
    items: [{ label: '采集控制', href: '/admin/crawler' }],
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
