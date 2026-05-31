/**
 * external-meta-panel/index.ts — ExternalMetaPanel 共享组件公开 API
 * （ADR-172 AMENDMENT 3 / META-18 / arch-reviewer Opus PASS 契约）
 *
 * 外部元数据真源并集视图（条目级）。消费方：视频编辑抽屉新 tab + 审核台 RightPane/TabDetail。
 */
export { ExternalMetaPanel } from './external-meta-panel'
export type {
  ExternalMetaPanelProps,
  ExternalMetaPanelDensity,
  ExternalMetaCatalogFields,
} from './types'
