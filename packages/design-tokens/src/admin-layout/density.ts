/**
 * admin density — 信息密度切换变量
 * M-SN-1 仅占位；M-SN-2 packages/admin-ui DataTable / Drawer 真正消费时扩展
 * 数值供 calc() / line-height 等场景按比例缩放
 */
export const adminDensity = {
  'density-comfortable': '1',
  'density-compact': '0.75',
} as const

export type AdminDensityToken = keyof typeof adminDensity
