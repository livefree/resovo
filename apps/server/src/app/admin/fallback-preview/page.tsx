import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { FallbackPreviewPage } from '@/components/admin/fallback-preview/FallbackPreviewPage'

export default function AdminFallbackPreviewPageRoute() {
  return (
    <ListPageShell
      variant="admin"
      title="样板图预览"
      description="预览不同比例、类型与主题下的 FallbackCover 渲染效果，确认颜色变量无硬编码。"
      testId="admin-fallback-preview-page"
    >
      <FallbackPreviewPage />
    </ListPageShell>
  )
}
