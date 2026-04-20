'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

export function useWatchSlugSync(slug: string) {
  const router = useRouter()
  const hostMode = usePlayerStore((s) => s.hostMode)
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const initPlayer = usePlayerStore((s) => s.initPlayer)
  const setHostMode = usePlayerStore((s) => s.setHostMode)
  const isHydrated = usePlayerStore((s) => s.isHydrated)

  const [needsConfirm, setNeedsConfirm] = useState(false)

  useEffect(() => {
    if (!isHydrated) return

    const sameSlug = hostOrigin?.slug === slug
    const busy = hostMode === 'full' || hostMode === 'mini'

    if (sameSlug) {
      if (hostMode !== 'full') setHostMode('full')
      return
    }

    if (busy) {
      setNeedsConfirm(true)
      return
    }

    // closed/pip 且 slug 不同 → 直接初始化
    initPlayer(slug, 1)
    setHostMode('full', { href: `/watch/${slug}`, slug })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isHydrated])

  return {
    needsConfirm,
    confirm: () => {
      setNeedsConfirm(false)
      initPlayer(slug, 1)
      setHostMode('full', { href: `/watch/${slug}`, slug })
    },
    cancel: () => {
      setNeedsConfirm(false)
      if (hostOrigin?.href) {
        router.replace(hostOrigin.href)
      } else {
        router.back()
      }
    },
  }
}
