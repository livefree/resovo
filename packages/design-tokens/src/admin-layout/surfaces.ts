/**
 * admin shell 专属视觉 token（design spec v2.1 tokens.css → admin-layout 命名空间）
 *
 * 与 semantic 层的分层依据：
 *   - accent-soft / warn-soft：rgba 半透明叠加色，semantic 层无此形态（均为 solid OKLCH）
 *   - admin-avatar-bg：装饰性渐变，应用专属，不进入跨域 semantic 层
 *   - admin-input-radius：design spec --r-2 (6px)，semantic radius 层无该步长
 *   - admin-count-font-size：design spec --fs-11 (11px)，semantic font-size 层无该步长
 *
 * 命名约定：以 admin- 为前缀，区别于 semantic 层 token（无前缀）。
 * 全部 theme-independent：rgba 半透明在深/浅色背景上均适用；渐变/字号不随主题变化。
 */
export const adminShellSurfaces = {
  // 半透明 amber 叠加 — 与深/浅色表面共用，不需要深/浅色两套
  'admin-accent-soft': 'rgba(245, 158, 11, 0.12)',
  'admin-warn-soft': 'rgba(245, 158, 11, 0.14)',
  'admin-danger-soft': 'rgba(239, 68, 68, 0.14)',

  // avatar 装饰渐变（design spec .sb__avatar）
  'admin-avatar-bg': 'linear-gradient(135deg, #6366f1, #8b5cf6)',

  // 6px 圆角步长（design spec --r-2，用于 search trigger / nav item）
  'admin-input-radius': '6px',

  // 11px 字号（design spec --fs-11，用于 count badge）
  'admin-count-font-size': '11px',
} as const

export type AdminShellSurfacesToken = keyof typeof adminShellSurfaces
