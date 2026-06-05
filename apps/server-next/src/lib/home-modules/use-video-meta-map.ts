'use client'

/**
 * use-video-meta-map.ts — 首页运营位 video 引用批量充实 hook（CHG-HOME-UX-03）
 *
 * 职责：对 modules 中 contentRefType='video' 的 contentRefId（UUID）并发取回
 * { title, coverUrl, isPublished }，供模块卡片 / 预览面板共用（HomeOpsClient 顶层
 * 调用一次下传，杜绝重复请求）。
 *
 * 取数通道：fetchPickerItemByIdSafe（GET /admin/videos/:id；404/网络失败返回 null）。
 * 缓存：组件实例级 useRef 持久 Map（id 已解析则不重复 fetch；含 null「已确认失效」）。
 *
 * Map 值语义（与 deriveModuleStatus 契约对齐）：
 *   - VideoMeta  — 取回成功
 *   - null       — 已 fetch 且 404（引用失效 → 红 pill）
 *   - 键不存在   — 尚未取回（loadingIds 含该 id 时为 in-flight）
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPickerItemByIdSafe } from '@/lib/videos/picker-fetcher'
import type { HomeModule } from './types'

export interface VideoMeta {
  readonly title: string
  readonly coverUrl: string | null
  readonly isPublished: boolean
}

export type VideoMetaMap = ReadonlyMap<string, VideoMeta | null>

export interface UseVideoMetaMapResult {
  readonly metaMap: VideoMetaMap
  readonly loadingIds: ReadonlySet<string>
}

export function useVideoMetaMap(modules: readonly HomeModule[]): UseVideoMetaMapResult {
  // 持久缓存：跨 slot 切换 / 列表刷新不重复取（null = 已确认失效也缓存）
  const cacheRef = useRef<Map<string, VideoMeta | null>>(new Map())
  const [metaMap, setMetaMap] = useState<VideoMetaMap>(() => new Map())
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set())

  // 稳定依赖键：仅 video 类型 id 去重升序 join（modules 引用变动但 id 集不变时不重触发）
  const videoIdsKey = useMemo(() => {
    const ids = new Set<string>()
    for (const m of modules) {
      if (m.contentRefType === 'video' && m.contentRefId) ids.add(m.contentRefId)
    }
    return [...ids].sort().join(',')
  }, [modules])

  useEffect(() => {
    const ids = videoIdsKey ? videoIdsKey.split(',') : []
    const missing = ids.filter((id) => !cacheRef.current.has(id))

    // 无新 id：同步快照（缓存可能已含本批 id）
    if (missing.length === 0) {
      setMetaMap(new Map(cacheRef.current))
      return
    }

    let cancelled = false
    setLoadingIds(new Set(missing))

    void Promise.all(
      missing.map(async (id) => {
        const item = await fetchPickerItemByIdSafe(id)
        return [id, item === null
          ? null
          : { title: item.title, coverUrl: item.coverUrl ?? null, isPublished: item.isPublished }] as const
      }),
    ).then((entries) => {
      for (const [id, meta] of entries) cacheRef.current.set(id, meta)
      if (cancelled) return
      setMetaMap(new Map(cacheRef.current))
      setLoadingIds(new Set())
    })

    return () => { cancelled = true }
  }, [videoIdsKey])

  return { metaMap, loadingIds }
}
