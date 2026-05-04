/**
 * admin table layout — server-next 表格行高 / 列宽下限
 * 来源：v2.1 后台设计稿 + plan §4.3 admin-layout 草案
 * 消费：apps/server-next + packages/admin-ui DataTable v2（M-SN-2 起）
 *
 * row-h-relaxed（CHG-UX2-01 新增）：
 *   宽松密度行高（48px），用于详情/列表 ModListRow 类元素；
 *   ModListRow 实测 padding 10/12 + 内容 ~32 = ~52，~48 是更标准化的值。
 */
export const adminTable = {
  'row-h': '40px',
  'row-h-compact': '32px',
  'row-h-relaxed': '48px',
  // CHG-UX2-03b 新增：含 poster-md(48×72) 封面的列表行高（封面 72 + 上下 padding ~8）
  // 视频库 / 审核台列表等使用 Thumb size="poster-md/lg" 的场景；DataTable density="poster" 消费
  'row-h-poster': '80px',
  'col-min-w': '80px',
} as const

export type AdminTableToken = keyof typeof adminTable
