'use client'

import { useCallback, useRef, useState } from 'react'
import type { UnderlineRegistryApi } from './types'

/**
 * 管理 (key → element) 注册表，供 SlidingUnderline 测量几何。
 *
 * - `register(key)` 返回**稳定**的 per-key ref 回调（缓存在 ref，同 key 跨渲染同一函数实例）——
 *   否则每次渲染返回新函数会令 React 反复 ref(null)+ref(el)，触发重注册抖动 / 潜在循环。
 * - 仅当某项 element 真正变化（挂载 / 卸载 / 换 DOM）才以新 Map identity setState，
 *   驱动 SlidingUnderline 的测量 effect 重跑（React 18 自动批处理多项注册为一次重渲染）。
 */
export function useUnderlineRegistry(): UnderlineRegistryApi {
  const mapRef = useRef<Map<string, HTMLElement | null>>(new Map())
  const callbacksRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const [registry, setRegistry] = useState<ReadonlyMap<string, HTMLElement | null>>(mapRef.current)

  const register = useCallback((key: string) => {
    let cb = callbacksRef.current.get(key)
    if (cb === undefined) {
      cb = (el: HTMLElement | null) => {
        const map = mapRef.current
        let changed = false
        if (el === null) {
          changed = map.delete(key)
        } else if (map.get(key) !== el) {
          map.set(key, el)
          changed = true
        }
        if (changed) setRegistry(new Map(map))
      }
      callbacksRef.current.set(key, cb)
    }
    return cb
  }, [])

  return { registry, register }
}
