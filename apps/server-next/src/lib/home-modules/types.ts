/**
 * home-modules/types.ts — `/admin/home` 视图数据类型契约（CHG-SN-5-07）
 *
 * 真源端点：apps/api/src/routes/admin/home-modules.ts（ADR-104）
 *   - GET    /admin/home-modules              — 列表
 *   - POST   /admin/home-modules              — 创建
 *   - PATCH  /admin/home-modules/:id          — 部分更新
 *   - DELETE /admin/home-modules/:id          — 硬删除
 *   - POST   /admin/home-modules/reorder      — 批量重排序
 *   - POST   /admin/home-modules/:id/publish-toggle — 切换 enabled
 */

import type { HomeModule, HomeModuleSlot, HomeModuleContentRefType, HomeBrandScope } from '@resovo/types'

export type { HomeModule, HomeModuleSlot, HomeModuleContentRefType, HomeBrandScope }

export interface HomeModuleListFilter {
  readonly slot?: HomeModuleSlot
  readonly brandScope?: HomeBrandScope
  readonly brandSlug?: string
  readonly enabled?: boolean
  readonly page?: number
  readonly limit?: number
}

export interface HomeModuleListResult {
  readonly data: readonly HomeModule[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface CreateHomeModuleBody {
  readonly slot: HomeModuleSlot
  readonly brandScope: HomeBrandScope
  readonly brandSlug?: string | null
  readonly ordering?: number
  readonly contentRefType: HomeModuleContentRefType
  readonly contentRefId: string
  /** 多语言标题映射 locale→string（ADR-104 AMENDMENT D-104-9；空键不传） */
  readonly title?: Record<string, string>
  /** 运营横图 URL；null 清空（video 类型消费端回退封面，D-052-10） */
  readonly imageUrl?: string | null
  readonly startAt?: string | null
  readonly endAt?: string | null
  readonly enabled?: boolean
  readonly metadata?: Record<string, unknown>
}

export type UpdateHomeModuleBody = Partial<Omit<CreateHomeModuleBody, 'enabled'>>

export interface ReorderItem {
  readonly id: string
  readonly ordering: number
}
