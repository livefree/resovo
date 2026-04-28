/**
 * admin-nav.tsx — IA v1 路由树常量 + Shell 5 字段扩展协议（ADR-100 IA 修订段 / ADR-103a §4.2 / ADR-103b lucide-react / plan §7 v2.2 + §4.7 v2.4）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/app/shell.jsx:10-35`（5 组 NAV + icon/count/badge/shortcut 设计）
 *   2. ADR-100 IA 修订段（v0 → v1，2026-04-28 · CHG-SN-1-10）
 *   3. ADR-103a §4.2 AdminNavItem 5 字段扩展协议（CHG-SN-2-01）
 *   4. ADR-103b lucide-react 选型（CHG-SN-2-01.5）
 *   5. plan §7 v2.2 IA tree + §4.7 v2.4 lucide-react 预批
 *
 * 区段（IA v1）：运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理 / 认证
 *
 * 路由占位与侧栏暴露策略（IA v1）：
 *   - 路由占位总数 21（M-SN-1 落地基线，CHG-SN-1-08 对账确认）
 *   - 侧栏暴露 13 项链接（IA v1 修订；12 admin 顶层 + 1 system 子）：
 *     dashboard / moderation / videos / sources / merge / subtitles / image-health
 *     / home / submissions / crawler / users / system/settings / audit
 *   - 路由保留但侧栏隐藏（M-SN-3 起按 Tab 容器化策略迁移内容）：
 *     - analytics（→ dashboard 内 Tab/卡片库）
 *     - system/cache · system/monitor · system/config · system/migration
 *       （→ settings 容器 Tab 面板）
 *
 * IA v1 修订点（v0 → v1，4 项决策详见 ADR-100）：
 *   - IA-1：dashboard label "工作台" → "管理台站"
 *   - IA-2：analytics 路由保留，侧栏不暴露
 *   - IA-3：home + submissions 独立成"首页运营"组（从系统管理剥离）
 *   - IA-4：system 5 子侧栏只暴露"站点设置"（mod+,）；4 子作 settings 容器 Tab
 *
 * Shell 5 字段扩展（ADR-103a §4.2 / CHG-SN-2-02 stage 2/2 实装）：
 *   - icon?: ReactNode（lucide-react named import 直注；packages/admin-ui 零图标库依赖）
 *   - count?: number（编译期回退值；AdminShellProps.countProvider 的 runtime 返回值优先）
 *   - badge?: 'info' | 'warn' | 'danger'（控制徽章配色）
 *   - shortcut?: 'mod+x' 规范化（formatShortcut 渲染期映射 ⌘/Ctrl）
 *   - children?: 已存在字段（保留，本卡未启用嵌套）
 *
 * URL slug 优先英文（plan §7 IA 命名声明 / §5.2 BLOCKER 第 8 条）；中文菜单
 * 文案在 cutover 前可调；调整 URL 触发 BLOCKER。
 *
 * 本表既驱动 admin layout 侧栏渲染，也供 packages/admin-ui Sidebar / CommandPalette /
 * KeyboardShortcuts 组件下沉时复用（M-SN-2 CHG-SN-2-03+）。
 */
import type { ReactNode } from 'react'
import {
  Layers,
  Inbox,
  Film,
  Link2,
  Merge,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Flag,
  Bug,
  Users,
  Settings,
} from 'lucide-react'

export interface AdminNavItem {
  readonly label: string
  readonly href: string
  /** 图标节点（lucide-react named import 直注；packages/admin-ui 零图标库依赖，ADR-103a §4.4-4） */
  readonly icon?: ReactNode
  /** 静态计数（编译期回退值）；AdminShellProps.countProvider 的 runtime 返回值优先于本字段 */
  readonly count?: number
  /** 角标语义（控制 dot/count 颜色；undefined → neutral） */
  readonly badge?: 'info' | 'warn' | 'danger'
  /** 规范化快捷键字符串（'mod+1' / 'mod+,'）；formatShortcut() 渲染期映射平台标签 */
  readonly shortcut?: string
  readonly children?: readonly AdminNavItem[]
}

/** count 运行时供给（ADR-103a §4.2 / CHG-SN-2-02 stage 2/2 新增）
 *  同步求值，返回 ReadonlyMap<href, count>；M-SN-2 落地 stub 返 empty；M-SN-3+ 接入 RSC/SWR */
export type AdminNavCountProvider = () => ReadonlyMap<string, number>

export interface AdminNavSection {
  readonly title: string
  readonly items: readonly AdminNavItem[]
}

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin', icon: <Layers />, shortcut: 'mod+1' },
      { label: '内容审核', href: '/admin/moderation', icon: <Inbox />, count: 484, badge: 'warn', shortcut: 'mod+2' },
    ],
  },
  {
    title: '内容资产',
    items: [
      { label: '视频库', href: '/admin/videos', icon: <Film />, shortcut: 'mod+3' },
      { label: '播放线路', href: '/admin/sources', icon: <Link2 />, count: 1939, badge: 'danger' },
      { label: '合并拆分', href: '/admin/merge', icon: <Merge />, count: 6, badge: 'warn' },
      { label: '字幕管理', href: '/admin/subtitles', icon: <FileText />, shortcut: 'mod+4' },
      { label: '图片健康', href: '/admin/image-health', icon: <ImageIcon />, count: 597, badge: 'warn' },
    ],
  },
  {
    title: '首页运营',
    items: [
      { label: '首页编辑', href: '/admin/home', icon: <Megaphone /> },
      { label: '用户投稿', href: '/admin/submissions', icon: <Flag />, count: 12, badge: 'info' },
    ],
  },
  {
    title: '采集中心',
    items: [{ label: '采集控制', href: '/admin/crawler', icon: <Bug />, shortcut: 'mod+5' }],
  },
  {
    title: '系统管理',
    items: [
      { label: '用户管理', href: '/admin/users', icon: <Users /> },
      { label: '站点设置', href: '/admin/system/settings', icon: <Settings />, shortcut: 'mod+,' },
      { label: '审计日志', href: '/admin/audit', icon: <FileText /> },
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
