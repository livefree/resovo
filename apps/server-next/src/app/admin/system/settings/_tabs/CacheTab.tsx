'use client'

/**
 * CacheTab — 缓存管理 Tab（CHG-SN-6-04 / M-SN-6 第 4 张主体卡）
 *
 * 范围：
 *   - GET /admin/cache/stats   → 5 业务前缀 KPI 卡片（search / video / danmaku / analytics / home）
 *   - DELETE /admin/cache/:type → 单类型清空 / 全部清空（运维动作 audit 豁免，与 image-health backfill 同模式）
 *
 * 共享原语（≥ 80% 占比硬清单 / quality-gates §7 第 2 项）：
 *   AdminCard / AdminButton / ErrorState / LoadingState / useToast
 */

import React, { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  ErrorState,
  LoadingState,
  useToast,
} from '@resovo/admin-ui'
import {
  getCacheStats,
  clearCache,
  type CacheStat,
  type CacheType,
} from '@/lib/system/api'

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

const HEADER_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
}

const STAT_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
}

const STAT_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xl, 20px)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const STAT_SUB_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '4px',
  marginBottom: '12px',
}

const CACHE_LABEL: Record<string, string> = {
  search:    '搜索缓存',
  video:     '视频缓存',
  danmaku:   '弹幕缓存',
  analytics: '统计缓存',
  home:      '首页缓存',
}

function formatSize(sizeKb: number): string {
  if (sizeKb < 1024) return `${sizeKb.toFixed(1)} KB`
  return `${(sizeKb / 1024).toFixed(2)} MB`
}

export function CacheTab() {
  const toast = useToast()
  const [stats, setStats] = useState<readonly CacheStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [clearingType, setClearingType] = useState<CacheType | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCacheStats()
      .then((res) => { if (!cancelled) setStats(res) })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('缓存统计加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleClear = useCallback(async (type: CacheType) => {
    setClearingType(type)
    try {
      const result = await clearCache(type)
      toast.push({
        title: type === 'all' ? '已清空全部缓存' : `已清空 ${CACHE_LABEL[type] ?? type}`,
        description: `删除 ${result.deleted.toLocaleString()} 条 key`,
        level: 'success',
      })
      // 刷新（统计会更新）
      setRetryKey((k) => k + 1)
    } catch (err: unknown) {
      toast.push({
        title: '清空缓存失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setClearingType(null)
    }
  }, [toast])

  if (loading && stats.length === 0) {
    return (
      <div style={SECTION_STYLE} data-testid="cache-tab">
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="cache-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  const businessStats = stats.filter((s) => s.type !== 'all')

  return (
    <div style={SECTION_STYLE} data-testid="cache-tab">
      <div style={HEADER_STYLE}>
        <span style={HEADER_TITLE_STYLE} data-testid="cache-total-label">
          共 {businessStats.length} 个业务前缀 ·{' '}
          {businessStats.reduce((sum, s) => sum + s.count, 0).toLocaleString()} 条 key ·{' '}
          {formatSize(businessStats.reduce((sum, s) => sum + s.sizeKb, 0))}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton
            variant="danger"
            size="sm"
            loading={clearingType === 'all'}
            onClick={() => void handleClear('all')}
            data-testid="cache-clear-all"
          >
            全部清空
          </AdminButton>
          <AdminButton
            variant="default"
            size="sm"
            onClick={refresh}
            data-testid="cache-refresh"
          >
            刷新
          </AdminButton>
        </span>
      </div>

      <div style={GRID_STYLE} data-testid="cache-stat-grid">
        {businessStats.map((stat) => (
          <AdminCard key={stat.type} surface="plain" padding="md" data-testid={`cache-card-${stat.type}`}>
            <div style={STAT_LABEL_STYLE}>{CACHE_LABEL[stat.type] ?? stat.type}</div>
            <div style={STAT_VALUE_STYLE}>{stat.count.toLocaleString()}</div>
            <div style={STAT_SUB_STYLE}>
              <code>{stat.type}:*</code> · {formatSize(stat.sizeKb)}
            </div>
            <AdminButton
              variant="default"
              size="sm"
              loading={clearingType === stat.type}
              disabled={stat.count === 0}
              onClick={() => void handleClear(stat.type)}
              data-testid={`cache-clear-${stat.type}`}
            >
              清空
            </AdminButton>
          </AdminCard>
        ))}
      </div>
    </div>
  )
}
