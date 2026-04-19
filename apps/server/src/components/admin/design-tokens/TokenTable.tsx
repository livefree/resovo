'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

interface Brand {
  id: string
  slug: string
  name: string
  overrides: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface TokenTableProps {
  onBrandSelect: (slug: string | null) => void
  selectedSlug: string | null
}

export function TokenTable({ onBrandSelect, selectedSlug }: TokenTableProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBrands = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<{ data: Brand[]; total: number }>('/admin/design-tokens')
      setBrands(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchBrands() }, [fetchBrands])

  const columns = useMemo<TableColumn<Brand>[]>(() => [
    {
      id: 'name',
      header: 'Brand 名称',
      accessor: (row) => row.name,
      width: 160,
    },
    {
      id: 'slug',
      header: 'Slug',
      accessor: (row) => row.slug,
      width: 140,
      cell: ({ row }) => (
        <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
          {row.slug}
        </span>
      ),
    },
    {
      id: 'overrides',
      header: 'Overrides',
      accessor: (row) => Object.keys(row.overrides).length,
      width: 100,
      cell: ({ value }) => (
        <span style={{ color: 'var(--fg-subtle)' }}>{String(value)} 项</span>
      ),
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      accessor: (row) => row.updatedAt,
      width: 180,
      cell: ({ value }) => (
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          {new Date(value as string).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ], [])

  if (error) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--state-error-fg)' }}>
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs px-1" style={{ color: 'var(--fg-subtle)' }}>
        点击行选择 Brand 以在右侧预览
      </p>
      <ModernDataTable
        columns={columns}
        rows={brands}
        loading={loading}
        loadingText="加载 Brand 列表…"
        emptyText="暂无 Brand 数据（默认 resovo brand 由代码定义）"
        scrollTestId="design-tokens-table"
        getRowId={(row) => row.id}
        selectedIds={selectedSlug ? brands.filter((b) => b.slug === selectedSlug).map((b) => b.id) : []}
        onSelectionChange={(ids) => {
          const brand = brands.find((b) => ids.includes(b.id))
          onBrandSelect(brand?.slug ?? null)
        }}
      />
    </div>
  )
}
