'use client'

/**
 * use-top10-autofill.ts — top10 前台自动补位可视化 hook（CHG-HOME-UX-09）
 *
 * 公开 /home/top10 的 isPinned=false 项 = 读时 rating DESC 自动补位（HomeService
 * manual_plus_rating 策略，Redis 60s 缓存）。父级 HomeOpsClient 在 top10 tab 激活
 * 时取一次下传 PreviewPanel（守住面板「不自取数据」原则）。
 *
 * manualCount 进依赖：人工置顶增删后补位集合会变（前台缓存 60s，结果可能短暂滞后，
 * 可接受——可视化为提示性非精确实时）。
 */

import { useEffect, useState } from 'react'
import { fetchTop10AutoFill, type Top10AutoFillItem } from './api'

export function useTop10AutoFill(active: boolean, manualCount: number): readonly Top10AutoFillItem[] {
  const [items, setItems] = useState<readonly Top10AutoFillItem[]>([])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetchTop10AutoFill()
      .then((next) => { if (!cancelled) setItems(next) })
      .catch(() => { if (!cancelled) setItems([]) }) // 可视化提示性数据，失败静默降级为不展示
    return () => { cancelled = true }
  }, [active, manualCount])

  return active ? items : []
}
