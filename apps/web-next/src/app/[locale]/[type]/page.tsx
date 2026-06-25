import { notFound } from 'next/navigation'
import { PageTransition } from '@/components/primitives/page-transition/PageTransition'
import { CategoryFilterBar } from '@/components/browse/CategoryFilterBar'
import { BrowseGrid } from '@/components/browse/BrowseGrid'
import { ALL_CATEGORIES } from '@/lib/categories'
import type { VideoType } from '@resovo/types'

// ── 类型映射（单源：lib/categories.ts，ADR-048 §4）────────────────────────────

const VALID_TYPES: Record<string, VideoType> = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.typeParam, c.videoType as VideoType])
)

// ── 共享内容组件（允许 movie/anime/series/tvshow 目录静态路由复用） ─────────────

export async function CategoryPageContent({
  locale,
  type,
}: {
  locale: string
  type: string
}) {
  const videoType = VALID_TYPES[type]
  if (!videoType) notFound()

  return (
    <PageTransition transitionKey={type} variant="sibling">
      {/* HANDOFF-15: max-w-page(1280px) + px-6(24px) + pt-8(32px) + pb-20(80px) — spec §12.1 */}
      <div
        className="max-w-page mx-auto w-full px-6"
        style={{ paddingTop: '32px', paddingBottom: '80px' }}
      >
        {/* 统一筛选区 — 5 维（type 行显示全类型 + 与顶部导航双向联动，HANDOFF-40B）。
            分类标题已移除——筛选区 type 行已承载当前分类高亮（用户 2026-06-24）。 */}
        <div style={{ marginBottom: '24px' }}>
          <CategoryFilterBar locale={locale} videoType={videoType} />
        </div>

        {/* 网格 + 排序条 + 分页 — spec §12.4（initialType 强制覆盖 URL type 参数） */}
        <BrowseGrid initialType={videoType} />
      </div>
    </PageTransition>
  )
}

// ── 页面 ──────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>
}) {
  const { locale, type } = await params
  return CategoryPageContent({ locale, type })
}
