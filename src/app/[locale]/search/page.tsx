/**
 * search/page.tsx — 搜索页
 * 顶部筛选栏 + 激活标签条 + 结果列表
 */

import { Suspense } from 'react'
import { Nav } from '@/components/layout/Nav'
import { FilterBar } from '@/components/search/FilterBar'
import { ActiveFilterStrip } from '@/components/search/ActiveFilterStrip'
import { SearchResultList } from '@/components/search/SearchResultList'
import { Footer } from '@/components/layout/Footer'

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main className="max-w-screen-xl mx-auto w-full" data-testid="search-page">
        <Suspense>
          <FilterBar className="sticky top-14 z-40" />
          <ActiveFilterStrip />
          <SearchResultList />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
