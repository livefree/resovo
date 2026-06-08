'use client'

/**
 * OverviewTab — 外部资源概览（ADR-188 D-188-5）
 *
 * 4 张 KpiCard（数据规模 ×2 / 采集次数 / 富集匹配）+ 3 张明细卡（采集按内容类型 /
 * 采集按方式 / 富集按方式）+ 合集新鲜度。直接回答用户诉求：
 *   - 抓了几次、成功否 → 采集次数 KPI + 按内容类型/方式明细（成功/失败/超时分桶）
 *   - 抓的是基础信息/评论/热播/时间表 → 按 operation 明细（中文标签）
 *   - 离线/在线/API → 按 method 明细
 *   - 富集覆盖 → 富集匹配 KPI + 按 match_method 分布
 *
 * 共享原语：KpiCard / AdminCard / Pill / LoadingState / ErrorState / EmptyState（零新组件）。
 */
import React, { useEffect, useState } from 'react'
import { KpiCard, AdminCard, Pill, LoadingState, ErrorState, EmptyState } from '@resovo/admin-ui'
import type { PillVariant } from '@resovo/admin-ui'
import type { ProviderKey } from '@resovo/types'
import {
  fetchOverview,
  OPERATION_LABELS,
  METHOD_LABELS,
  PROVIDER_LINKS,
  labelOf,
  type OverviewData,
  type FetchAggregateBucket,
  type MatchBucket,
  type CollectionFreshness,
} from '@/lib/external-resources/api'

function fmt(n: number): string {
  return n.toLocaleString('zh-CN')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const KPI_ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
}

const GRID_2_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '12px',
  marginTop: '12px',
}

const SECTION_STYLE: React.CSSProperties = { marginTop: '12px' }

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '6px 0',
  borderTop: '1px solid var(--border-subtle, var(--border-default))',
  fontSize: 'var(--font-size-sm)',
}

const ROW_FIRST_STYLE: React.CSSProperties = { ...ROW_STYLE, borderTop: 'none' }

const COUNT_CLUSTER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const TOTAL_STYLE: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const STATUS_PILL: Readonly<Record<string, PillVariant>> = {
  ok: 'ok',
  fail: 'danger',
  timeout: 'warn',
}

export function OverviewTab({ provider }: { provider: ProviderKey }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    fetchOverview(provider)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider, retryKey])

  if (loading) return <LoadingState variant="skeleton" />
  if (error) return <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
  if (!data) return <EmptyState title="暂无概览数据" description="该 provider 尚未接入采集链路" />

  const { fetchStats, enrichStats, collectionFreshness, dataScale } = data
  const failure = fetchStats.fail + fetchStats.timeout
  const fetchVariant =
    fetchStats.total === 0 ? 'default'
      : failure === 0 ? 'is-ok'
        : failure / fetchStats.total > 0.2 ? 'is-danger'
          : 'is-warn'
  const avgText = fetchStats.avgDurationMs == null ? '—' : `${fmt(fetchStats.avgDurationMs)}ms`

  return (
    <div data-overview-tab>
      <div style={KPI_ROW_STYLE} data-overview-kpis>
        {dataScale.map((m) => (
          <KpiCard
            key={m.key}
            label={m.label}
            value={fmt(m.value)}
            dataSource="live"
            ariaLabel={`${m.label}: ${m.value}`}
            testId={`ext-kpi-${m.key}`}
          />
        ))}
        <KpiCard
          label="采集次数 · 24h"
          value={fmt(fetchStats.total)}
          variant={fetchVariant}
          delta={{ text: `成功 ${fmt(fetchStats.ok)} · 失败 ${fmt(failure)} · 均 ${avgText}`, direction: failure === 0 ? 'up' : 'flat' }}
          dataSource="live"
          ariaLabel={`采集次数 24 小时: ${fetchStats.total}`}
          testId="ext-kpi-fetch-total"
        />
        <KpiCard
          label="富集匹配数"
          value={fmt(enrichStats.total)}
          dataSource="live"
          ariaLabel={`富集匹配数: ${enrichStats.total}`}
          testId="ext-kpi-enrich-total"
        />
      </div>

      <div style={GRID_2_STYLE}>
        <AdminCard
          header={{ title: '采集明细 · 按内容类型', subtitle: `近 24h · 平均延迟 ${avgText}` }}
          data-testid="ext-overview-by-operation"
        >
          <FetchBucketList buckets={fetchStats.byOperation} labelMap={OPERATION_LABELS} emptyHint="近 24h 无采集记录" />
        </AdminCard>
        <AdminCard
          header={{ title: '采集明细 · 按方式', subtitle: '离线 / 页面抓取 / API' }}
          data-testid="ext-overview-by-method"
        >
          <FetchBucketList buckets={fetchStats.byMethod} labelMap={METHOD_LABELS} emptyHint="近 24h 无采集记录" />
        </AdminCard>
      </div>

      <div style={SECTION_STYLE}>
        <AdminCard
          header={{ title: '富集匹配分布 · 按方式', subtitle: `video_external_refs · 共 ${fmt(enrichStats.total)} 条` }}
          data-testid="ext-overview-enrich-method"
        >
          <MatchBucketList buckets={enrichStats.byMethod} labelMap={METHOD_LABELS} emptyHint="暂无富集匹配记录" />
        </AdminCard>
      </div>

      <div style={SECTION_STYLE}>
        <AdminCard
          header={{ title: '合集新鲜度', subtitle: `${collectionFreshness.length} 个合集 · 最近同步状态` }}
          data-testid="ext-overview-freshness"
        >
          <FreshnessList rows={collectionFreshness} formatDateTime={formatDateTime} />
        </AdminCard>
      </div>

      {(PROVIDER_LINKS[provider]?.length ?? 0) > 0 && (
        <div style={SECTION_STYLE}>
          <AdminCard
            header={{ title: '官方入口', subtitle: 'API / 文档 / 归档 dump（外链）' }}
            data-testid="ext-overview-official-links"
          >
            <div style={LINKS_ROW_STYLE} data-official-links>
              {PROVIDER_LINKS[provider]!.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={LINK_PILL_STYLE}
                  data-official-link={link.href}
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  )
}

const LINKS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
}

const LINK_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: '999px',
  background: 'var(--bg-surface)',
  color: 'var(--accent-default)',
  fontSize: 'var(--font-size-xs)',
  textDecoration: 'none',
}

function FetchBucketList({
  buckets,
  labelMap,
  emptyHint,
}: {
  buckets: readonly FetchAggregateBucket[]
  labelMap: Readonly<Record<string, string>>
  emptyHint: string
}) {
  if (buckets.length === 0) {
    return <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{emptyHint}</p>
  }
  return (
    <div>
      {buckets.map((b, i) => (
        <div key={b.key} style={i === 0 ? ROW_FIRST_STYLE : ROW_STYLE}>
          <span style={{ color: 'var(--fg-default)' }}>{labelOf(labelMap, b.key)}</span>
          <span style={COUNT_CLUSTER_STYLE}>
            <span style={{ color: 'var(--state-success-fg)' }}>成功 {fmt(b.ok)}</span>
            {b.fail > 0 && <span style={{ color: 'var(--state-error-fg)' }}>失败 {fmt(b.fail)}</span>}
            {b.timeout > 0 && <span style={{ color: 'var(--state-warning-fg)' }}>超时 {fmt(b.timeout)}</span>}
            <span style={TOTAL_STYLE}>{fmt(b.total)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function MatchBucketList({
  buckets,
  labelMap,
  emptyHint,
}: {
  buckets: readonly MatchBucket[]
  labelMap: Readonly<Record<string, string>>
  emptyHint: string
}) {
  if (buckets.length === 0) {
    return <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{emptyHint}</p>
  }
  return (
    <div>
      {buckets.map((b, i) => (
        <div key={b.key} style={i === 0 ? ROW_FIRST_STYLE : ROW_STYLE}>
          <span style={{ color: 'var(--fg-default)' }}>{labelOf(labelMap, b.key)}</span>
          <span style={TOTAL_STYLE}>{fmt(b.count)}</span>
        </div>
      ))}
    </div>
  )
}

function FreshnessList({
  rows,
  formatDateTime: fmtDate,
}: {
  rows: readonly CollectionFreshness[]
  formatDateTime: (iso: string | null) => string
}) {
  if (rows.length === 0) {
    return <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>暂无合集同步记录</p>
  }
  return (
    <div>
      {rows.map((r, i) => {
        const variant: PillVariant = r.lastStatus ? (STATUS_PILL[r.lastStatus] ?? 'neutral') : 'neutral'
        return (
          <div key={r.collection} style={i === 0 ? ROW_FIRST_STYLE : ROW_STYLE}>
            <span style={{ color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums' }}>{r.collection}</span>
            <span style={COUNT_CLUSTER_STYLE}>
              <Pill variant={variant}>{r.lastStatus ?? '未同步'}</Pill>
              <span>更新 {fmtDate(r.lastSuccessAt)}</span>
              <span style={TOTAL_STYLE}>{fmt(r.itemCount)} 条</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
