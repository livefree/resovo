/**
 * adminColumnTypes.ts — 共享列元数据类型
 * CHG-314: 从 useAdminTableColumns 中提取，供列定义常量使用
 */

export type AdminColumnMeta = {
  id: string
  visible?: boolean
  width?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean
}
