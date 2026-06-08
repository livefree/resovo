'use client'

/**
 * ExternalResourcesClient — 外部资源治理页框架（ADR-188 D-188-1）
 *
 * provider 切换（Segment）+ tab 容器（URL ?provider=&tab= 同步，仿 settings/SettingsContainer）。
 * active provider（douban）渲染功能 tab；planned（bangumi/imdb/tmdb）渲染「待接入」占位。
 *
 * 本卡（UI-A）tab：概览 / 采集与富集记录。热门资源 / 资源搜索见 UI-B（追加 TABS + panel）。
 *
 * 取数：providers 列表挂载拉取（驱动 Segment + 能力占位）；各 tab 自管数据拉取。
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader, Segment, AdminCard, LoadingState, ErrorState, Pill } from '@resovo/admin-ui'
import { PROVIDER_KEYS, type ProviderKey } from '@resovo/types'
import { fetchProviders, METHOD_LABELS, labelOf, type ProviderSummary } from '@/lib/external-resources/api'
import { OverviewTab } from './OverviewTab'
import { ActivityTab } from './ActivityTab'
import { CollectionsTab } from './CollectionsTab'
import { SearchTab } from './SearchTab'

// ── tab 定义（概览 / 热门资源 / 资源搜索 / 采集记录）──────────────────
const TABS = [
  { id: 'overview', label: '概览' },
  { id: 'collections', label: '热门资源' },
  { id: 'search', label: '资源搜索' },
  { id: 'activity', label: '采集与富集记录' },
] as const
type TabId = (typeof TABS)[number]['id']

const DEFAULT_PROVIDER: ProviderKey = 'douban'
const DEFAULT_TAB: TabId = 'overview'

function isProviderKey(v: string | null): v is ProviderKey {
  return v !== null && (PROVIDER_KEYS as readonly string[]).includes(v)
}

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px 24px',
}

const TABBAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

const PANEL_STYLE: React.CSSProperties = {
  minHeight: '320px',
}

const CAP_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  margin: '8px 0 0',
}

export function ExternalResourcesClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const rawProvider = searchParams.get('provider')
  const provider: ProviderKey = isProviderKey(rawProvider) ? rawProvider : DEFAULT_PROVIDER
  const rawTab = searchParams.get('tab')
  const activeTab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : DEFAULT_TAB

  const [providers, setProviders] = useState<ProviderSummary[] | null>(null)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    fetchProviders()
      .then((list) => { if (!cancelled) setProviders(list) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => { cancelled = true }
  }, [retryKey])

  const current = useMemo(
    () => providers?.find((p) => p.key === provider) ?? null,
    [providers, provider],
  )

  const switchProvider = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === DEFAULT_PROVIDER) params.delete('provider')
    else params.set('provider', next)
    // 切 provider 重置 tab + 清理表格 namespaced query（act./col./srch.）避免跨 provider 串状态
    params.delete('tab')
    for (const k of [...params.keys()]) {
      if (k.startsWith('act.') || k.startsWith('col.') || k.startsWith('srch.')) params.delete(k)
    }
    router.push(`/admin/external-resources${params.size > 0 ? `?${params}` : ''}`)
  }

  const switchTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === DEFAULT_TAB) params.delete('tab')
    else params.set('tab', next)
    router.push(`/admin/external-resources${params.size > 0 ? `?${params}` : ''}`)
  }

  const segmentItems = useMemo(
    () =>
      (providers ?? []).map((p) => ({
        value: p.key,
        label: p.label,
        ...(p.status === 'planned' ? { badge: '待接入' } : {}),
      })),
    [providers],
  )

  if (error) {
    return (
      <div style={PAGE_STYLE} data-external-resources>
        <ExtHeader />
        <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
      </div>
    )
  }

  if (!providers) {
    return (
      <div style={PAGE_STYLE} data-external-resources>
        <ExtHeader />
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  const isActive = current?.status === 'active'

  return (
    <div style={PAGE_STYLE} data-external-resources>
      <ExtHeader />

      <Segment
        items={segmentItems}
        value={provider}
        onChange={switchProvider}
        size="lg"
        aria-label="外部资源 provider"
        data-testid="ext-provider-segment"
      />

      {isActive ? (
        <>
          <div style={TABBAR_STYLE} role="tablist" aria-label="治理面板">
            <Segment
              items={TABS.map((t) => ({ value: t.id, label: t.label }))}
              value={activeTab}
              onChange={switchTab}
              size="md"
              aria-label="治理 tab"
              data-testid="ext-tab-segment"
            />
          </div>
          <section
            style={PANEL_STYLE}
            role="tabpanel"
            id={`ext-tabpanel-${activeTab}`}
            data-ext-tabpanel={activeTab}
          >
            {activeTab === 'overview' && <OverviewTab provider={provider} />}
            {activeTab === 'collections' && <CollectionsTab provider={provider} />}
            {activeTab === 'search' && <SearchTab provider={provider} />}
            {activeTab === 'activity' && <ActivityTab provider={provider} />}
          </section>
        </>
      ) : (
        <PlannedPlaceholder summary={current} />
      )}
    </div>
  )
}

function ExtHeader() {
  return (
    <PageHeader
      title="外部资源"
      subtitle="provider 无关治理框架 · 采集观测 / 热门资源 / 资源搜索（豆瓣首接入）"
      data-testid="ext-page-header"
    />
  )
}

/** planned provider「待接入」占位：展示已声明获取方式 + 能力，提示框架就绪待实装。 */
function PlannedPlaceholder({ summary }: { summary: ProviderSummary | null }) {
  if (!summary) {
    return <AdminCard header={{ title: '未知 provider' }}>该外部资源未在 registry 中声明。</AdminCard>
  }
  return (
    <AdminCard
      header={{
        title: `${summary.label} · 待接入`,
        subtitle: '框架已就绪，provider adapter 与治理能力将在后续阶段实装',
      }}
      data-testid="ext-planned-placeholder"
    >
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>
        该外部资源已在 provider registry 中登记，但尚未接入采集/富集链路。接入后本页将自动渲染其
        概览与采集记录。
      </p>
      <div style={CAP_ROW_STYLE} data-ext-planned-acquisition>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>获取方式：</span>
        {summary.acquisition.length > 0 ? (
          summary.acquisition.map((m) => (
            <Pill key={m} variant="neutral">{labelOf(METHOD_LABELS, m)}</Pill>
          ))
        ) : (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>待调研</span>
        )}
      </div>
    </AdminCard>
  )
}
