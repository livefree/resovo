/**
 * /admin/analytics — hidden in IA v1（ADR-100 IA 修订段 IA-2）
 *
 * 路由文件保留但侧栏不暴露（admin-nav.ts 不导出此项）。M-SN-3 阶段把
 * 数据看板内容并入 dashboard 内部 Tab/卡片库；本文件届时改为 redirect
 * 到 dashboard 或保留作直链入口（M-SN-3 卡决议）。
 *
 * 不变约束：URL 不动（plan §5.2 BLOCKER 第 8 条），路由占位文件不删。
 */
import { PlaceholderPage } from '@/components/PlaceholderPage'

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="数据看板 · hidden in IA v1"
      milestone="M-SN-3 阶段并入 dashboard 内部 Tab/卡片库（详见 ADR-100 IA 修订段 IA-2）"
    />
  )
}
