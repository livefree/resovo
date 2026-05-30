/**
 * @resovo/admin-ui — admin 专属 UI 组件库（packages/admin-ui v1）
 *
 * 真源：ADR-103a Shell 公开 API 契约 / ADR-103 DataTable v2（M-SN-2 落地中）
 *
 * 不变约束（plan §4.4 / §4.7 / ADR-103a §4.4）：
 *   - 零 BrandProvider / ThemeProvider 声明（Provider 不下沉）
 *   - 零图标库依赖（lucide-react 等由 server-next 应用层注入 ReactNode）
 *   - Edge Runtime 兼容（模块顶层零 fetch / Cookie / localStorage）
 *   - 颜色 / 间距 / 阴影只读 packages/design-tokens（admin-layout + semantic + brands）
 */

// Shell 编排层（CHG-SN-2-03+）
export * from './shell'

// DataTable v2 数据原语层（CHG-SN-2-13+）
export * from './components/data-table'

// Pagination v2（CHG-SN-2-15）
export * from './components/pagination'

// Drawer / Modal overlay 原语（CHG-SN-2-16）
export * from './components/overlay'

// AdminDropdown 行操作下拉菜单（CHG-SN-2-17）
export * from './components/dropdown'

// Empty / Error / Loading 状态原语（CHG-SN-2-18）
export * from './components/state'

// Cell 共享组件（CHG-DESIGN-07 7B：KpiCard + Spark；CHG-DESIGN-12 扩张其余 cell；CHG-SN-4-04 D-14：BarSignal / DecisionCard）
export * from './components/cell'

// Layout 多栏布局原语（CHG-SN-4-01）
export * from './components/layout'

// PageHeader 页面顶栏通用原语（CHG-SN-5-PRE-03-A）
export * from './components/page-header'

// AdminButton 后台按钮通用原语（CHG-SN-5-PRE-03-B）
export * from './components/admin-button'

// AdminInput 后台输入框通用原语（CHG-SN-5-PRE-03-C）
export * from './components/admin-input'

// AdminCheckbox boolean toggle 通用原语（CHG-SN-6-09 / arch-reviewer Opus PASS）
export * from './components/admin-checkbox'

// AdminTextarea 长文本通用原语（CHG-SN-6-09 / arch-reviewer Opus PASS）
export * from './components/admin-textarea'

// AdminCard 后台卡片通用原语（CHG-SN-5-PRE-03-E）
export * from './components/admin-card'

// AdminSelect 后台选择器通用原语（CHG-SN-5-PRE-03-D）
export * from './components/admin-select'

// 视频枚举值 Option helpers（ADR-157 D-157-2 / CHG-340-A 起 4 P0，CHG-340-B/-C 扩 P1/P2）
export * from './enums'

// Popover 通用弹层原语（CHG-SN-5-PRE-03-F / SEQ-20260506-02 / ADR-115）
export * from './components/popover'

// Feedback 共享组件（CHG-SN-4-04 D-14：StaffNoteBar / LineHealthDrawer / RejectModal）
export * from './components/feedback'

// Segment pill-style 分段控件 + badge count（CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A / ADR-124 / spec §5.13）
export * from './components/segment'

// LinesPanel 复合组件（FIX-B / CHG-SN-7-MISC-MOD-PLAYER；arch-reviewer Opus PASS）
// 视频线路聚合展示 + 单集 toggle + 线路 toggle + AdminPlayer 切源回调
export * from './components/composite/lines-panel'

// EnrichmentBadge 富集徽标（META-10 / ADR-172 / ADR-E；arch-reviewer Opus PASS）
// 单徽标（douban/bangumi/source/meta/pinyin）+ 组合簇（消费 EnrichmentSummary，anime-only bangumi）
export * from './components/enrichment-badge'

// VideoPicker 业务级选择器（M-SN-SHARED-04-A / CHG-SN-8 SEQ-20260521-02 / arch-reviewer Opus A−）
// 消灭 UUID 输入；fetcher 注入实现 admin-ui ↔ apps/* 隔离（ADR-103b）
export * from './components/pickers'
