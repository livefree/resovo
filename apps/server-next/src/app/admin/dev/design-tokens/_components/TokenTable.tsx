'use client'

/**
 * TokenTable — 左栏 Brand 选择列表。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：原用冻结的 ModernDataTable，
 * server-next 禁止复用 v1 表组件；280px 窄列 picker 也不宜套重型 admin-ui DataTable，
 * 故重写为原生可选列表（点击行选中 Brand）。
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

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

const HINT_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  paddingInline: 4,
  color: 'var(--fg-subtle)',
}

const ITEM_BASE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  cursor: 'pointer',
}

const ITEM_SELECTED_STYLE: React.CSSProperties = {
  border: '1px solid var(--accent-default)',
  background: 'var(--accent-muted)',
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

  if (error) {
    return (
      <div style={{ padding: 16, fontSize: 'var(--font-size-sm)', color: 'var(--state-error-fg)' }}>
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 16, fontSize: 'var(--font-size-sm)', color: 'var(--fg-subtle)' }}>
        加载 Brand 列表…
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 'var(--font-size-sm)', color: 'var(--fg-subtle)' }}>
        暂无 Brand 数据（默认 resovo brand 由代码定义）
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="design-tokens-table">
      <p style={HINT_STYLE}>点击选择 Brand 以在右侧预览</p>
      {brands.map((brand) => {
        const isSelected = brand.slug === selectedSlug
        return (
          <button
            key={brand.id}
            type="button"
            onClick={() => onBrandSelect(isSelected ? null : brand.slug)}
            aria-pressed={isSelected}
            style={isSelected ? { ...ITEM_BASE_STYLE, ...ITEM_SELECTED_STYLE } : ITEM_BASE_STYLE}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--fg-default)' }}>
              {brand.name}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--fg-muted)' }}>
              {brand.slug}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-subtle)' }}>
              {Object.keys(brand.overrides).length} 项 override · 更新于{' '}
              {new Date(brand.updatedAt).toLocaleString('zh-CN')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
