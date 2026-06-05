'use client'

/**
 * use-home-add-entry.ts — /admin/home 批量添加深链落地 hook（CHG-HOME-UX-08）
 *
 * 职责：解析 ?add_ids=&from=（entry.ts 真源）→ fetchPickerItemByIdSafe 并发充实
 * → 过滤无效引用（404 → invalidCount 供 toast 提示）→ 产出 BatchAddVideosModal
 * 的 initialItems + 来源元数据。
 *
 * consumed 守卫：同一深链只触发一次（Modal 关闭后不重弹；URL 不清写保留可刷新重入）。
 */

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { PickerVideoItem } from '@resovo/admin-ui'
import { fetchPickerItemByIdSafe } from '@/lib/videos/picker-fetcher'
import { parseHomeAddEntry, type HomeEntrySource } from './entry'

export interface HomeAddEntryState {
  /** 深链充实完成的候选（无效引用已过滤）；null = 无深链/未就绪 */
  readonly items: readonly PickerVideoItem[] | null
  /** 充实阶段被过滤的无效引用数（404），供消费方 toast 提示 */
  readonly invalidCount: number
  readonly from: HomeEntrySource | null
  /** 消费方在 Modal 关闭后调用，标记已消费（防重弹） */
  readonly dismiss: () => void
}

export function useHomeAddEntry(): HomeAddEntryState {
  const searchParams = useSearchParams()
  const consumedRef = useRef(false)
  const [items, setItems] = useState<readonly PickerVideoItem[] | null>(null)
  const [invalidCount, setInvalidCount] = useState(0)
  const [from, setFrom] = useState<HomeEntrySource | null>(null)

  useEffect(() => {
    if (consumedRef.current) return
    const entry = parseHomeAddEntry(new URLSearchParams(searchParams.toString()))
    if (!entry) return
    consumedRef.current = true
    setFrom(entry.from)

    let cancelled = false
    void Promise.all(entry.ids.map((id) => fetchPickerItemByIdSafe(id))).then((results) => {
      if (cancelled) return
      const valid = results.filter((r): r is PickerVideoItem => r !== null)
      setInvalidCount(results.length - valid.length)
      setItems(valid)
    })
    return () => { cancelled = true }
  }, [searchParams])

  return {
    items,
    invalidCount,
    from,
    dismiss: () => { setItems(null) },
  }
}
