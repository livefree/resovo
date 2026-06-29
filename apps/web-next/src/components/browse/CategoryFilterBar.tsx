'use client'

/**
 * CategoryFilterBar — 分类页筛选区 client 包装器（HANDOFF-40B）
 *
 * 分类页 `[type]/page.tsx` 是 Server Component，无法向 client 共享组件 FilterArea 传
 * onTypeChange 回调（函数不可跨 RSC 边界）。本包装器（client）承接路由知识（lib/categories.ts
 * videoType→typeParam 映射 + tvshow 特例，ADR-048），把 type 选择翻译为路由跳转，
 * 使共享 FilterArea 保持纯净（不持路由知识）。
 *
 * type 双向联动：点 type → 跳 /[locale]/[typeParam] → pathname 变 → 顶部 Nav 自动重算高亮
 * （Nav 经 pathname 单源，无需改）。activeType 受控高亮当前分类。
 */

import { useRouter } from 'next/navigation'
import { ALL_CATEGORIES } from '@/lib/categories'
import { FilterArea } from '@/components/shared/filter/FilterArea'
import type { VideoType } from '@resovo/types'

const TYPE_OPTIONS: readonly VideoType[] = ALL_CATEGORIES.map((c) => c.videoType as VideoType)

interface CategoryFilterBarProps {
  readonly locale: string
  /** 当前分类（pathname [type] 段解析出的 videoType，受控高亮 + 联动唯一权威） */
  readonly videoType: VideoType
}

export function CategoryFilterBar({ locale, videoType }: CategoryFilterBarProps) {
  const router = useRouter()

  function handleTypeChange(next: VideoType | null) {
    // category 模式 type 维已无「全部」选项（FilterArea 不渲染），next 恒非 null。
    // 防御：即便收到 null 也留在当前页，不再跳首页（SEQ-20260628 用户反馈）。
    if (next === null) return
    const entry = ALL_CATEGORIES.find((c) => c.videoType === next)
    const typeParam = entry?.typeParam ?? next
    router.push(`/${locale}/${typeParam}`)
  }

  return (
    <FilterArea
      mode="category"
      typeOptions={TYPE_OPTIONS}
      activeType={videoType}
      onTypeChange={handleTypeChange}
    />
  )
}
