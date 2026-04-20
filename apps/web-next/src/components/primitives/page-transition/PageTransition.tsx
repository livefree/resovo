import type { PageTransitionProps } from './types'
import { PageTransitionController } from './PageTransitionController'

/**
 * Server Component wrapper — 不含 'use client'，可被 RSC layout 直接使用。
 * 动画逻辑由内部 PageTransitionController（Client Component）处理。
 */
export function PageTransition(props: PageTransitionProps) {
  return <PageTransitionController {...props} />
}
