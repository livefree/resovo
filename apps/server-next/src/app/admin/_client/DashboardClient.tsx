'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ErrorState, LoadingState } from '@resovo/admin-ui'
import { getModerationStats, type ModerationStats } from '@/lib/videos/api'

// ── types ─────────────────────────────────────────────────────────

type TabId = 'overview' | 'analytics'

// ── styles ────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: 1024 }
const TAB_BAR_STYLE: React.CSSProperties = { display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }
const CARDS_STYLE: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }
const CARD_STYLE: React.CSSProperties = { background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '20px' }
const CARD_LABEL_STYLE: React.CSSProperties = { fontSize: '12px', color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }
const CARD_VALUE_STYLE: React.CSSProperties = { fontSize: '32px', fontWeight: 700, color: 'var(--fg-default)', marginTop: '8px', lineHeight: 1 }

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    border: 0,
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '-1px',
  }
}

// ── stat card ─────────────────────────────────────────────────────

interface StatCardProps {
  readonly label: string
  readonly value: number | string | null
  readonly loading: boolean
  readonly error: Error | undefined
  readonly onRetry: () => void
}

function StatCard({ label, value, loading, error, onRetry }: StatCardProps) {
  return (
    <div style={CARD_STYLE} data-stat-card>
      <div style={CARD_LABEL_STYLE}>{label}</div>
      {loading
        ? <LoadingState variant="spinner" />
        : error
          ? <ErrorState error={error} title="" onRetry={onRetry} />
          : <div style={CARD_VALUE_STYLE}>{value ?? '—'}</div>
      }
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────

export function DashboardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab: TabId = (searchParams.get('tab') as TabId) === 'analytics' ? 'analytics' : 'overview'

  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<Error | undefined>()

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    setStatsError(undefined)
    getModerationStats()
      .then(setStats)
      .catch((e: unknown) => setStatsError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const switchTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'overview') { params.delete('tab') } else { params.set('tab', tab) }
    router.push(`/admin${params.size > 0 ? `?${params}` : ''}`)
  }

  return (
    <div style={PAGE_STYLE} data-dashboard-client>
      <div style={TAB_BAR_STYLE}>
        <button style={tabBtnStyle(activeTab === 'overview')} onClick={() => switchTab('overview')} data-tab="overview">概览</button>
        <button style={tabBtnStyle(activeTab === 'analytics')} onClick={() => switchTab('analytics')} data-tab="analytics">分析</button>
      </div>

      {activeTab === 'overview' && (
        <div style={CARDS_STYLE} data-testid="overview-cards">
          <StatCard
            label="待审视频"
            value={stats?.pendingReview ?? null}
            loading={statsLoading}
            error={statsError}
            onRetry={loadStats}
          />
          <StatCard
            label="已发布视频"
            value={stats?.published ?? null}
            loading={statsLoading}
            error={statsError}
            onRetry={loadStats}
          />
          <StatCard
            label="视频总量"
            value={stats?.total ?? null}
            loading={statsLoading}
            error={statsError}
            onRetry={loadStats}
          />
          <StatCard
            label="活跃采集源"
            value="—"
            loading={false}
            error={undefined}
            onRetry={() => undefined}
          />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div data-testid="analytics-tab" style={{ color: 'var(--fg-muted)', fontSize: '14px' }}>
          数据看板功能正在迁移中，将于 M-SN-6 全功能实装。
        </div>
      )}
    </div>
  )
}
