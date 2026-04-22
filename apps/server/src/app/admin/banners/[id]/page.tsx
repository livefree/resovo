import Link from 'next/link'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { BannerEditLoader } from '@/components/admin/banners/BannerEditLoader'

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/banners">
          <AdminButton variant="ghost" size="sm">← 返回</AdminButton>
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text)]">编辑 Banner</h1>
      </div>
      <BannerEditLoader bannerId={id} />
    </div>
  )
}
