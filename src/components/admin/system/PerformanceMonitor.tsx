/**
 * PerformanceMonitor.tsx — 性能监控面板（Client Component）
 * CHG-32: 每 10 秒自动刷新，展示 4 张指标卡片 + 慢请求列表
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface PerformanceStats {
  requests: { perMinute: number; total24h: number }
  latency: { avgMs: number; p95Ms: number }
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number }
  uptime: number
  slowRequests: Array<{
    timestamp: number
    durationMs: number
    method: string
    url: string
    statusCode: number
  }>
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4"
      data-testid={`stat-card-${label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <p className="mb-1 text-xs text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: PerformanceStats }>('/admin/performance/stats')
      setStats(res.data)
      setLastUpdated(new Date())
    } catch {
      // silent — keep showing old data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 10_000)
    return () => clearInterval(timer)
  }, [fetchStats])

  return (
    <div data-testid="performance-monitor">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {lastUpdated ? `上次更新：${lastUpdated.toLocaleTimeString()}` : '加载中…'}
          {loading && ' · 刷新中…'}
        </p>
        <span className="text-xs text-[var(--muted)]">每 10 秒自动刷新</span>
      </div>

      {/* 4 张指标卡片 */}
      {stats && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="请求/分钟"
              value={stats.requests.perMinute.toString()}
              sub={`24h: ${stats.requests.total24h.toLocaleString()}`}
            />
            <StatCard
              label="平均响应时间"
              value={`${stats.latency.avgMs} ms`}
              sub={`P95: ${stats.latency.p95Ms} ms`}
            />
            <StatCard
              label="堆内存占用"
              value={`${stats.memory.heapUsedMb} MB`}
              sub={`总: ${stats.memory.heapTotalMb} MB / RSS: ${stats.memory.rssMb} MB`}
            />
            <StatCard
              label="运行时长"
              value={formatUptime(stats.uptime)}
            />
          </div>

          {/* 慢请求列表（>500ms）*/}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
              最近慢请求（&gt;500ms）
            </h2>
            {stats.slowRequests.length === 0 ? (
              <p className="text-sm text-[var(--muted)]" data-testid="no-slow-requests">
                暂无慢请求
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg2)] text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left">时间</th>
                      <th className="px-3 py-2 text-left">方法</th>
                      <th className="px-3 py-2 text-left">URL</th>
                      <th className="px-3 py-2 text-left">状态码</th>
                      <th className="px-3 py-2 text-left">耗时</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.slowRequests.map((req, i) => (
                      <tr
                        key={i}
                        className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
                        style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                        data-testid={`slow-request-row-${i}`}
                      >
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--text)]">{req.method}</td>
                        <td className="px-3 py-2 font-mono text-[var(--muted)] max-w-48 truncate">
                          {req.url}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">{req.statusCode}</td>
                        <td className="px-3 py-2 text-yellow-400 font-medium">{req.durationMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
