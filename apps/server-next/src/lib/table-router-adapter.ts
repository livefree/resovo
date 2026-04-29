/**
 * table-router-adapter.ts — Next.js App Router → TableRouterAdapter 包装
 * 真源：ADR-103 §4.2.1（CHG-SN-2-13 同卡新建建议）
 *
 * 职责：将 next/navigation 的 useRouter + useSearchParams + usePathname
 * 包装为 packages/admin-ui TableRouterAdapter 契约，避免 admin-ui 直 import next/navigation。
 *
 * 使用方式：
 *   const router = useTableRouterAdapter()
 *   const tableQuery = useTableQuery({ tableId: 'videos', router, columns })
 */
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemo } from 'react'
import type { TableRouterAdapter } from '@resovo/admin-ui'

export function useTableRouterAdapter(): TableRouterAdapter {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  return useMemo(
    (): TableRouterAdapter => ({
      getSearchParams: () => new URLSearchParams(searchParams.toString()),
      replace: (next) => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false })
      },
      push: (next) => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false })
      },
    }),
    [router, searchParams, pathname],
  )
}
