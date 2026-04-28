/**
 * /admin/system/config — hidden in IA v1（ADR-100 IA 修订段 IA-4）
 *
 * 路由文件保留但侧栏不暴露（admin-nav.ts 不导出此项）。M-SN-3 阶段
 * 改造为 settings 容器的 Tab 面板（运行时配置）；URL 仍可直链访问，
 * 届时由 settings 容器把 URL 映射到对应 Tab 状态。
 *
 * 不变约束：URL 不动（plan §5.2 BLOCKER 第 8 条），路由占位文件不删。
 */
import { PlaceholderPage } from '@/components/PlaceholderPage'

export default function SystemConfigPage() {
  return (
    <PlaceholderPage
      title="运行时配置 · hidden in IA v1"
      milestone="M-SN-3 阶段改造为 settings 容器 Tab 面板（详见 ADR-100 IA 修订段 IA-4）"
    />
  )
}
