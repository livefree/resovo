/**
 * admin table layout — server-next 表格行高 / 列宽下限
 * 来源：v2.1 后台设计稿 + plan §4.3 admin-layout 草案
 * 消费：apps/server-next + packages/admin-ui DataTable v2（M-SN-2 起）
 */
export const adminTable = {
  'row-h': '40px',
  'row-h-compact': '32px',
  'col-min-w': '80px',
} as const

export type AdminTableToken = keyof typeof adminTable
