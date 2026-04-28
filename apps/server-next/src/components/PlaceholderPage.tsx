/**
 * PlaceholderPage — M-SN-1 路由占位页统一组件
 *
 * 业务实装在后续 milestone：
 *   M-SN-3 标杆页（视频库）/ M-SN-4 P0 视图（审核台 + 视频编辑）/
 *   M-SN-5 P1 视图（其他业务页）/ M-SN-6 周边视图
 *
 * 本组件 M-SN-2 起步可下沉到 packages/admin-ui 作为 EmptyState 原语，
 * 也可以保留 server-next 本地（视 M-SN-2 复用情况决定）。
 */

import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  readonly title: string
  readonly milestone?: string
  readonly note?: ReactNode
}

export function PlaceholderPage({ title, milestone, note }: PlaceholderPageProps) {
  return (
    <article>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>{title}</h1>
      <p style={{ color: 'var(--fg-muted)', margin: 0 }}>
        M-SN-1 工程骨架占位{milestone ? `（业务实装 ${milestone}）` : ''}
      </p>
      {note ? <div style={{ marginTop: 'var(--space-4)' }}>{note}</div> : null}
    </article>
  )
}
