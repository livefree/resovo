import Link from 'next/link'
import { Suspense } from 'react'
import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { BannerTable } from '@/components/admin/banners/BannerTable'

export default function AdminBannersPage() {
  return (
    <ListPageShell
      variant="admin"
      title="Banner 管理"
      description="管理首页横幅展位；拖拽调整显示顺序，设置时间窗控制生效区间。"
      testId="admin-banners-page"
      actions={(
        <Link href="/admin/banners/new">
          <AdminButton variant="primary" className="px-4 font-medium">
            新建 Banner
          </AdminButton>
        </Link>
      )}
    >
      <Suspense>
        <BannerTable />
      </Suspense>
    </ListPageShell>
  )
}
