'use client'

/**
 * KeywordPreviewTable.tsx — 关键词搜索预览结果表格
 * UX-08: 展示各站点匹配视频预览，含 sourceStatus 探测结果
 */

export interface KeywordPreviewItem {
  title: string
  year: number | null
  type: string | null
  sourceCount: number
  sourceStatus: 'ok' | 'error' | 'timeout' | 'unknown'
  siteKey: string
}

export interface KeywordPreviewResult {
  siteKey: string
  items: KeywordPreviewItem[]
  error: string | null
}

interface KeywordPreviewTableProps {
  results: KeywordPreviewResult[]
}

function sourceStatusLabel(status: KeywordPreviewItem['sourceStatus']) {
  if (status === 'ok') return { text: '可用', cls: 'text-green-400' }
  if (status === 'error') return { text: '不可用', cls: 'text-red-400' }
  if (status === 'timeout') return { text: '超时', cls: 'text-yellow-400' }
  return { text: '未知', cls: 'text-[var(--muted)]' }
}

export function KeywordPreviewTable({ results }: KeywordPreviewTableProps) {
  if (results.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]" data-testid="keyword-preview-empty">
        暂无预览结果
      </p>
    )
  }

  return (
    <div className="space-y-4" data-testid="keyword-preview-table">
      {results.map((siteResult) => (
        <div
          key={siteResult.siteKey}
          className="rounded-md border border-[var(--border)] bg-[var(--bg2)]"
          data-testid={`preview-site-${siteResult.siteKey}`}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
            <span className="text-sm font-medium text-[var(--text)]">{siteResult.siteKey}</span>
            {siteResult.error ? (
              <span className="text-xs text-red-400">错误: {siteResult.error}</span>
            ) : (
              <span className="text-xs text-[var(--muted)]">{siteResult.items.length} 条</span>
            )}
          </div>

          {!siteResult.error && siteResult.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                    <th className="px-4 py-2 font-normal">标题</th>
                    <th className="px-4 py-2 font-normal">年份</th>
                    <th className="px-4 py-2 font-normal">类型</th>
                    <th className="px-4 py-2 font-normal">源数</th>
                    <th className="px-4 py-2 font-normal">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {siteResult.items.map((item, idx) => {
                    const statusInfo = sourceStatusLabel(item.sourceStatus)
                    return (
                      <tr
                        key={idx}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg3)]"
                        data-testid="preview-item-row"
                      >
                        <td className="max-w-[240px] truncate px-4 py-2 text-[var(--text)]">{item.title}</td>
                        <td className="px-4 py-2 text-[var(--muted)]">{item.year ?? '—'}</td>
                        <td className="px-4 py-2 text-[var(--muted)]">{item.type ?? '—'}</td>
                        <td className="px-4 py-2 text-[var(--muted)]">{item.sourceCount}</td>
                        <td className={`px-4 py-2 ${statusInfo.cls}`}>{statusInfo.text}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!siteResult.error && siteResult.items.length === 0 && (
            <p className="px-4 py-3 text-xs text-[var(--muted)]">该站点无匹配结果</p>
          )}
        </div>
      ))}
    </div>
  )
}
