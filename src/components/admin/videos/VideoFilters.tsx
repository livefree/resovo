/**
 * VideoFilters.tsx — 视频筛选栏
 * CHG-27: 类型/上架状态/关键词搜索，参数写入 URL searchParams
 * ADMIN-07: 新增来源站点筛选
 */

'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'

interface CrawlerSite {
  key: string
  name: string
}

export function VideoFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sites, setSites] = useState<CrawlerSite[]>([])

  useEffect(() => {
    apiClient
      .get<{ data: CrawlerSite[] }>('/admin/crawler/sites')
      .then((res) => setSites(res.data ?? []))
      .catch(() => {/* 站点加载失败时下拉为空，不影响其他筛选 */})
  }, [])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')  // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => updateParam('q', val), 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, pathname]
  )

  return (
    <AdminToolbar
      className="gap-3"
      dataTestId="video-filters"
      actions={(
        <>
      {/* 关键词搜索 */}
      <input
        type="text"
        placeholder="搜索标题…"
        defaultValue={searchParams.get('q') ?? ''}
        onChange={handleSearch}
        className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        data-testid="video-filters-q"
      />

      {/* 类型筛选 */}
      <select
        value={searchParams.get('type') ?? ''}
        onChange={(e) => updateParam('type', e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        data-testid="video-filters-type"
      >
        <option value="">全部类型</option>
        <option value="movie">电影</option>
        <option value="series">剧集</option>
        <option value="anime">动漫</option>
        <option value="variety">综艺</option>
      </select>

      {/* 上架状态筛选 */}
      <select
        value={searchParams.get('status') ?? ''}
        onChange={(e) => updateParam('status', e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        data-testid="video-filters-status"
      >
        <option value="">全部状态</option>
        <option value="published">已上架</option>
        <option value="pending">待审核</option>
      </select>

      {/* 来源站点筛选（ADMIN-07） */}
      {sites.length > 0 && (
        <select
          value={searchParams.get('site') ?? ''}
          onChange={(e) => updateParam('site', e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="video-filters-site"
        >
          <option value="">全部来源</option>
          {sites.map((s) => (
            <option key={s.key} value={s.key}>{s.name || s.key}</option>
          ))}
        </select>
      )}
        </>
      )}
    />
  )
}
