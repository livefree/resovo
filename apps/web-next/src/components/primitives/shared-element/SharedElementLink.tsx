'use client'

import Link from 'next/link'
import { captureSnapshot } from './registry'

interface SharedElementLinkProps {
  sharedId: string
  href: string
  children: React.ReactNode
  prefetch?: boolean
  className?: string
}

/**
 * Drop-in replacement for <Link> that eagerly captures a SharedElement snapshot
 * on pointer-down (before router.push fires), ensuring the rect is captured
 * while the source element is still mounted and connected.
 */
export function SharedElementLink({
  sharedId,
  href,
  children,
  prefetch,
  className,
}: SharedElementLinkProps) {
  function handlePointerDown() {
    captureSnapshot(sharedId)
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onPointerDown={handlePointerDown}
      onClick={handlePointerDown}
    >
      {children}
    </Link>
  )
}
