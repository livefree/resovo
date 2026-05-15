'use client'

/**
 * MonitorTab — 系统监控 Tab（CHG-SN-6-03 / M-SN-6 第 3 张主体卡）
 *
 * 范围：GET /admin/system/scheduler-status 消费（4 maintenance schedulers + 全局开关）
 *
 * 共享原语（≥ 80% 占比硬清单 / quality-gates §7 第 2 项）：
 *   AdminCard / AdminButton / EmptyState / ErrorState / LoadingState
 *
 * 设计：仪表盘风格，4 scheduler 卡片网格 + 顶部全局 enabled 标识 + 刷新按钮
 */

import React, { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  ErrorState,
  LoadingState,
} from '@resovo/admin-ui'
import { getSchedulerStatus, type SchedulerStatusResult, type SchedulerInfo } from '@/lib/system/api'

// ── 常量 ──────────────────────────────────────────────────────────

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
}

const GLOBAL_BADGE_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
}

const GLOBAL_BADGE_ON: CSSProperties = {
  ...GLOBAL_BADGE_BASE,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
}

const GLOBAL_BADGE_OFF: CSSProperties = {
  ...GLOBAL_BADGE_BASE,
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
}

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
}

const SCH_NAME_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 500,
  color: 'var(--fg-default)',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const SCH_META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

// ── scheduler 中文 label 映射（plan v1.4 §3.0.5 写入位点 + maintenanceScheduler.ts） ──

const SCHEDULER_LABEL: Record<string, string> = {
  'auto-publish-staging':     'Staging 自动发布',
  'verify-published-sources': 'Published 源验证',
  'verify-staging-sources':   'Staging 源验证',
  'reconcile-search-index':   '搜索索引重建',
}

// ── 工具：interval 人话格式化 ──

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = (min / 60).toFixed(1)
  return `${hr}h`
}

// ── Scheduler Card ─────────────────────────────────────────────────

interface SchedulerCardProps {
  readonly info: SchedulerInfo
}

function SchedulerCard({ info }: SchedulerCardProps) {
  const label = SCHEDULER_LABEL[info.name] ?? info.name
  return (
    <AdminCard surface="plain" padding="md" data-testid={`scheduler-${info.name}`}>
      <div style={SCH_NAME_STYLE} data-scheduler-label>{label}</div>
      <div style={{ marginBottom: '8px' }}>
        <span
          style={info.enabled ? GLOBAL_BADGE_ON : GLOBAL_BADGE_OFF}
          data-scheduler-enabled={String(info.enabled)}
        >
          {info.enabled ? '● 运行中' : '○ 已停止'}
        </span>
      </div>
      <div style={SCH_META_STYLE}>
        <div>调度间隔：{formatInterval(info.intervalMs)}</div>
        <div>name: <code>{info.name}</code></div>
      </div>
    </AdminCard>
  )
}

// ── MonitorTab 主组件 ──────────────────────────────────────────────

export function MonitorTab() {
  const [result, setResult] = useState<SchedulerStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSchedulerStatus()
      .then((res) => { if (!cancelled) setResult(res) })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('scheduler 状态加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  if (loading && !result) {
    return (
      <div style={SECTION_STYLE} data-testid="monitor-tab">
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="monitor-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!result) return null

  return (
    <div style={SECTION_STYLE} data-testid="monitor-tab">
      <div style={HEADER_STYLE}>
        <span
          style={result.enabled ? GLOBAL_BADGE_ON : GLOBAL_BADGE_OFF}
          data-testid="monitor-global-status"
          data-monitor-enabled={String(result.enabled)}
        >
          {result.enabled ? '全局调度：已启用' : '全局调度：已禁用'}
        </span>
        <AdminButton variant="default" size="sm" onClick={refresh} data-testid="monitor-refresh">
          刷新
        </AdminButton>
      </div>
      <div style={GRID_STYLE} data-testid="monitor-scheduler-grid">
        {result.schedulers.map((info) => (
          <SchedulerCard key={info.name} info={info} />
        ))}
      </div>
    </div>
  )
}
