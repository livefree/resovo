import type { Metadata } from 'next'
import { StagingDashboard } from '@/components/admin/staging/StagingDashboard'

export const metadata: Metadata = {
  title: '暂存发布队列 — 流光后台',
}

export default function StagingPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--text)]">暂存发布队列</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          审核通过的视频进入暂存，检查元数据与播放源质量后发布上线
        </p>
      </header>
      <StagingDashboard />
    </div>
  )
}
