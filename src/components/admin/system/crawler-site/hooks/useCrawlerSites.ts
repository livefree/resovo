import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CrawlerSite } from '@/types'

export function useCrawlerSites() {
  const [sites, setSites] = useState<CrawlerSite[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSites = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const res = await apiClient.get<{ data: CrawlerSite[] }>('/admin/crawler/sites')
      const sorted = [...res.data].sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' })
      )
      setSites(sorted)
    } catch {
      // 静默
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSites()
  }, [fetchSites])

  return {
    sites,
    loading,
    fetchSites,
    setSites,
  }
}
