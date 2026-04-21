'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { BannerForm } from '@/components/admin/banners/BannerForm'
import type { Banner } from '@resovo/types'

interface BannerEditLoaderProps {
  bannerId: string
}

export function BannerEditLoader({ bannerId }: BannerEditLoaderProps) {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<{ data: Banner }>(`/admin/banners/${bannerId}`)
      .then((res) => setBanner(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [bannerId])

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-[var(--bg3)]" />
        ))}
      </div>
    )
  }

  if (error || !banner) {
    return (
      <p className="text-sm text-red-400">{error ?? 'Banner 不存在'}</p>
    )
  }

  return <BannerForm initial={banner} />
}
