import Link from 'next/link'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { BannerForm } from '@/components/admin/banners/BannerForm'

export default function NewBannerPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/banners">
          <AdminButton variant="ghost" size="sm">← 返回</AdminButton>
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text)]">新建 Banner</h1>
      </div>
      <BannerForm />
    </div>
  )
}
