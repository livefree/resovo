'use client'

import { useState, useEffect } from 'react'
import { imageHealthService } from '@/services/image-health-stats.service'
import type { ImageHealthStats, BrokenDomainRow, MissingVideoRow, MissingVideoSortField, SortDir } from '@/services/image-health-stats.service'
import { BrokenDomainTable } from './BrokenDomainTable'
import { MissingVideoTable } from './MissingVideoTable'
import { DashboardShell, DashboardSection } from '@/components/shared/layout/DashboardShell'

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'success' | 'danger' | 'warning'
}

function StatCard({ label, value, sub, tone = 'default' }: StatCardProps) {
  const toneColor: Record<string, string> = {
    default: 'var(--text)',
    success: 'var(--status-success)',
    danger:  'var(--status-danger)',
    warning: 'var(--status-warning)',
  }
  return (
    <div
      className="rounded-lg border p-4 space-y-1"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: toneColor[tone] }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

export function ImageHealthDashboard() {
  const [stats, setStats] = useState<ImageHealthStats | null>(null)
  const [domains, setDomains] = useState<BrokenDomainRow[]>([])
  const [missing, setMissing] = useState<MissingVideoRow[]>([])
  const [missingTotal, setMissingTotal] = useState(0)
  const [missingPage, setMissingPage] = useState(1)
  const [missingPageSize, setMissingPageSize] = useState(20)
  const [missingSortField, setMissingSortField] = useState<MissingVideoSortField>('created_at')
  const [missingSortDir, setMissingSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)
  const [missingLoading, setMissingLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      imageHealthService.getStats(),
      imageHealthService.getBrokenDomains(20),
    ]).then(([s, d]) => {
      setStats(s)
      setDomains(d)
    }).catch(() => {
      // 数据加载失败时保持空状态，不阻断页面渲染
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setMissingLoading(true)
    imageHealthService.getMissingVideos(missingPage, missingPageSize, missingSortField, missingSortDir)
      .then(({ data, total }) => {
        setMissing(data)
        setMissingTotal(total)
      })
      .catch(() => {
        // 分页加载失败时保持上一页数据
      })
      .finally(() => setMissingLoading(false))
  }, [missingPage, missingPageSize, missingSortField, missingSortDir])

  return (
    <DashboardShell testId="image-health-dashboard">
      <DashboardSection title="总览" testId="image-health-stats">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="视频总数"
            value={stats ? stats.totalVideos.toLocaleString() : '—'}
            tone="default"
          />
          <StatCard
            label="P0 封面覆盖率"
            value={stats ? pct(stats.posterCoverage) : '—'}
            sub={stats ? `${stats.posterOkCount.toLocaleString()} / ${stats.totalVideos.toLocaleString()}` : undefined}
            tone={stats && stats.posterCoverage >= 0.9 ? 'success' : 'warning'}
          />
          <StatCard
            label="P1 背景图覆盖率"
            value={stats ? pct(stats.backdropCoverage) : '—'}
            sub={stats ? `${stats.backdropOkCount.toLocaleString()} / ${stats.totalVideos.toLocaleString()}` : undefined}
            tone={stats && stats.backdropCoverage >= 0.7 ? 'success' : 'warning'}
          />
          <StatCard
            label="7 天新增破损视频"
            value={stats ? String(stats.brokenLast7Days) : '—'}
            tone={stats && stats.brokenLast7Days > 0 ? 'danger' : 'success'}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="TOP 破损域名" testId="image-health-broken-domains">
        <BrokenDomainTable rows={domains} loading={loading} />
      </DashboardSection>

      <DashboardSection title="缺图视频" testId="image-health-missing-videos">
        <MissingVideoTable
          rows={missing}
          total={missingTotal}
          page={missingPage}
          pageSize={missingPageSize}
          sortField={missingSortField}
          sortDir={missingSortDir}
          loading={missingLoading}
          onPageChange={setMissingPage}
          onPageSizeChange={(size) => { setMissingPage(1); setMissingPageSize(size) }}
          onSortChange={(field, dir) => { setMissingPage(1); setMissingSortField(field); setMissingSortDir(dir) }}
        />
      </DashboardSection>
    </DashboardShell>
  )
}
