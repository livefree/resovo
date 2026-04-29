/**
 * /admin/dev/components — packages/admin-ui 全量组件 demo 页（CHG-SN-2-19）
 *
 * 验收要点：
 *   - DataTable v2 客户端模式（mock 数据，客户端排序/分页）
 *   - DataTable v2 服务端模式（外部分页受控）
 *   - useTableQuery URL 同步（刷新后保留 page/sort/filter）
 *   - Drawer / Modal / AdminDropdown / SelectionActionBar 可交互
 *   - EmptyState / ErrorState / LoadingState 三档展示
 */
import { Suspense } from 'react'
import { ComponentsDemo } from './components-demo'

export const metadata = { title: 'Admin UI 组件 Demo' }

export default function DevComponentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>加载中…</div>}>
      <ComponentsDemo />
    </Suspense>
  )
}
