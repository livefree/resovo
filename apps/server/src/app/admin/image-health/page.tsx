import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { ImageHealthDashboard } from '@/components/admin/image-health/ImageHealthDashboard'

export default function AdminImageHealthPage() {
  return (
    <ListPageShell
      variant="admin"
      title="图片健康"
      description="监控封面/背景图覆盖率与破损趋势，定位 CDN 故障域名与缺图视频。"
      testId="admin-image-health-page"
    >
      <ImageHealthDashboard />
    </ListPageShell>
  )
}
