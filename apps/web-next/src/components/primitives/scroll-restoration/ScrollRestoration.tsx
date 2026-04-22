'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'resovo-scroll-'

function getKey(pathname: string) {
  return `${STORAGE_KEY}${pathname}`
}

/**
 * 同层路由切换时恢复 scrollY。
 * 在 layout.tsx 中紧靠 <main> 放置，每个路径保存一个 sessionStorage key。
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevPathname.current

    if (prev !== null && prev !== pathname) {
      // 保存上一个路径的滚动位置
      try {
        sessionStorage.setItem(getKey(prev), String(window.scrollY))
      } catch {
        // sessionStorage 不可用时静默忽略
      }
    }

    // 恢复当前路径的滚动位置
    if (prev !== null) {
      try {
        const saved = sessionStorage.getItem(getKey(pathname))
        if (saved !== null) {
          window.scrollTo({ top: Number(saved), behavior: 'instant' })
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
      } catch {
        // sessionStorage 不可用时静默忽略
      }
    }

    prevPathname.current = pathname
  }, [pathname])

  return null
}
