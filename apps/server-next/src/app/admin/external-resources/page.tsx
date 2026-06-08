import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { ExternalResourcesClient } from './_client/ExternalResourcesClient'

export const metadata: Metadata = { title: '外部资源 | Resovo Admin' }

/**
 * /admin/external-resources — 外部资源治理页（ADR-188 D-188-1）
 *
 * provider 无关框架（豆瓣首接入；Bangumi/IMDB/TMDb registry 占位）。
 * Suspense 边界包裹：ExternalResourcesClient 内部 useSearchParams 读 ?provider=&tab=。
 */
export default function ExternalResourcesPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <ExternalResourcesClient />
    </Suspense>
  )
}
