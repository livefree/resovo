'use client'

/**
 * crawler-site-columns.tsx — CrawlerSite 表列定义（CHG-SN-6-29-PATCH-1 拆出）
 *
 * 从 CrawlerSitesTab.tsx 拆出（H1 修复延伸）：纯函数 + 8 列定义，无业务状态。
 */

import { CodeText, type TableColumn } from '@resovo/admin-ui'
import type { CrawlerSite } from '@/lib/crawler/api'

export function buildCrawlerSiteColumns(): readonly TableColumn<CrawlerSite>[] {
  return [
    {
      id: 'key',
      header: 'Key',
      accessor: (r) => r.key,
      width: 160,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => <CodeText value={row.key} dataAttr={{ 'data-site-key': row.key }} />,
    },
    {
      id: 'name',
      header: '名称',
      accessor: (r) => r.name,
      minWidth: 180,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
          <span>{row.name}</span>
          {row.displayName ? (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
              显示名：{row.displayName}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'apiUrl',
      header: 'API URL',
      accessor: (r) => r.apiUrl,
      minWidth: 240,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.apiUrl} muted dataAttr={{ 'data-api-url': row.apiUrl }} />,
    },
    {
      id: 'sourceType',
      header: '类型',
      accessor: (r) => r.sourceType,
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.sourceType} />,
    },
    {
      id: 'format',
      header: '格式',
      accessor: (r) => r.format,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.format} muted />,
    },
    {
      id: 'weight',
      header: '权重',
      accessor: (r) => r.weight,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => <span data-weight>{row.weight}</span>,
    },
    {
      id: 'status',
      header: '状态',
      accessor: (r) => (r.disabled ? 'disabled' : 'enabled'),
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => {
        const enabled = !row.disabled
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill, 12px)',
              fontSize: 'var(--font-size-xs)',
              background: enabled ? 'var(--state-success-bg)' : 'var(--state-warning-bg)',
              color: enabled ? 'var(--state-success-fg)' : 'var(--state-warning-fg)',
            }}
            data-site-status={enabled ? 'enabled' : 'disabled'}
          >
            {enabled ? '启用' : '禁用'}
          </span>
        )
      },
    },
    {
      id: 'fromConfig',
      header: '来源',
      accessor: (r) => (r.fromConfig ? 'config' : 'admin'),
      width: 90,
      defaultVisible: true,
      cell: ({ row }) => (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: row.fromConfig ? 'var(--fg-muted)' : 'var(--fg-default)',
          }}
          data-from-config={String(row.fromConfig)}
        >
          {row.fromConfig ? 'config 文件' : '管理员创建'}
        </span>
      ),
    },
  ]
}
