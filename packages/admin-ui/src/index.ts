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
