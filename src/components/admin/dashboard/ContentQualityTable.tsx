/**
 * ContentQualityTable.tsx — 内容质量统计表格（ADMIN-06）
 * 按来源站点展示字段覆盖率与源存活率，辅助管理员判断批量发布范围
 */

'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface ContentQualityRow {
  siteKey: string
  total: number
  published: number
  hasCover: number
  hasDescription: number
  hasYear: number
  activeSources: number
  totalSources: number
}

function pct(n: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round((n / total) * 100)}%`
}

export function ContentQualityTable() {
  const [rows, setRows] = useState<ContentQualityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<{ data: ContentQualityRow[] }>('/admin/analytics/content-quality')
      .then((res) => setRows(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--muted)' }}>加载中…</p>
  }

  if (rows.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--muted)' }}>暂无数据，请先运行爬虫采集内容。</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm" data-testid="content-quality-table">
        <thead>
          <tr style={{ background: 'var(--bg3)', color: 'var(--muted)' }} className="text-left">
            <th className="px-4 py-2 font-medium">来源站点</th>
            <th className="px-4 py-2 font-medium text-right">视频数</th>
            <th className="px-4 py-2 font-medium text-right">已发布</th>
            <th className="px-4 py-2 font-medium text-right">有封面</th>
            <th className="px-4 py-2 font-medium text-right">有简介</th>
            <th className="px-4 py-2 font-medium text-right">有年份</th>
            <th className="px-4 py-2 font-medium text-right">源存活率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.siteKey}
              className="border-t"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                {row.siteKey}
              </td>
              <td className="px-4 py-2 text-right">{row.total}</td>
              <td className="px-4 py-2 text-right">{pct(row.published, row.total)}</td>
              <td className="px-4 py-2 text-right">{pct(row.hasCover, row.total)}</td>
              <td className="px-4 py-2 text-right">{pct(row.hasDescription, row.total)}</td>
              <td className="px-4 py-2 text-right">{pct(row.hasYear, row.total)}</td>
              <td className="px-4 py-2 text-right">{pct(row.activeSources, row.totalSources)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
