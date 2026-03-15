/**
 * /[locale]/browse — 分类浏览页
 * 展开式筛选区 + 排序条 + 视频网格
 */

import { Suspense } from 'react'
import { Nav } from '@/components/layout/Nav'
import { FilterArea } from '@/components/browse/FilterArea'
import { BrowseGrid } from '@/components/browse/BrowseGrid'

export default function BrowsePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />

      {/* FilterArea: sticky below nav (top-14 matches Nav height h-14) */}
      <Suspense fallback={null}>
        <FilterArea />
      </Suspense>

      {/* 视频网格 */}
      <main className="flex-1 pb-12">
        <Suspense fallback={null}>
          <BrowseGrid />
        </Suspense>
      </main>
    </div>
  )
}
