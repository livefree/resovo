'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { extractShortId } from '@/lib/short-id'
import { parseEpisodeParam } from '@/lib/episode-url'

export function useWatchSlugSync(slug: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    // BUGFIX-WATCH-EP-URL：honor URL `?ep`（曾写死 1 → 详情页选集恒回第 1 集）+ 用 extractShortId
    // 与 PlayerShell init 对齐（曾传完整 slug 当 shortId → mini player 端点拼错）。
    initPlayer(extractShortId(slug), parseEpisodeParam(searchParams.get('ep')))
    setHostMode('full', { href: `/watch/${slug}`, slug })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isHydrated])

  return {
    needsConfirm,
    confirm: () => {
      setNeedsConfirm(false)
      initPlayer(extractShortId(slug), parseEpisodeParam(searchParams.get('ep')))
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
