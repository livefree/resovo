/**
 * TableSettings types — 表格运行时列设置
 *
 * 管理每列的显示、排序维度的运行时开关状态。
 * filterable 维度暂缓实现，等 filter UI 基础设施就绪后扩展（SEQ-20260328-42）。
 */

export interface ColumnRuntimeSetting {
  /** 列 ID，与 TableColumn.id 对应 */
  id: string
  /** 面板中显示的列名 */
  label: string
  /** 当前是否显示此列 */
  visible: boolean
  /** 当前是否允许按此列排序 */
  sortable: boolean
  /**
   * 设为 true 时，此列的 visible 开关禁用（无法被隐藏）。
   * sortable 开关不受此约束。
   */
  required?: boolean
}

export type ColumnRuntimeSettingsMap = Record<string, ColumnRuntimeSetting>

/** localStorage 存储格式 */
export interface PersistedTableSettings {
  version: 'v1'
  settings: ColumnRuntimeSettingsMap
  /** 列宽持久化（CHG-313），可选字段，旧格式数据不受影响 */
  widths?: Record<string, number>
}
