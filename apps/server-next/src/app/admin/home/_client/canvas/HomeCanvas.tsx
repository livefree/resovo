'use client'

/**
 * HomeCanvas.tsx — 前台同构画布容器（CHG-HOME-CANVAS-A / 方案 §3）
 *
 * 消费 GET /admin/home/preview（ADR-182 #1，正式配置预览无草稿叠加），
 * 按 7 区块前台渲染序展示。本卡只读渲染 + 区块选中高亮；
 * Inspector / 环境栏归 -B；卡片操作归 Phase 2。
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, EmptyState, ErrorState, LoadingState } from '@resovo/admin-ui'
import { getHomePreview } from '@/lib/home-curation/api'
import type { HomePreview, HomeSectionKey } from '@/lib/home-curation/types'
import { CanvasSection } from './CanvasSection'

const CANVAS_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

export interface HomeCanvasProps {
  /** 区块选中回调（-B Inspector 接线；本卡仅高亮） */
  readonly onSelectSection?: (key: HomeSectionKey) => void
}

export function HomeCanvas({ onSelectSection }: HomeCanvasProps) {
  const [preview, setPreview] = useState<HomePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<HomeSectionKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPreview(await getHomePreview())
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState variant="skeleton" />
  if (error) return <ErrorState error={error} title="画布加载失败" onRetry={() => void load()} />
  if (!preview) return <EmptyState title="暂无预览数据" />

  return (
    <div style={CANVAS_STYLE} data-testid="home-canvas">
      <div style={TOOLBAR_STYLE}>
        <span data-testid="canvas-generated-at">
          生成于 {new Date(preview.generatedAt).toLocaleString()} · 正式配置实时预览（无草稿态）
        </span>
        <AdminButton
          variant="default"
          size="sm"
          onClick={() => void load()}
          data-testid="canvas-refresh-btn"
        >
          刷新
        </AdminButton>
      </div>

      {preview.sections.map((section) => (
        <CanvasSection
          key={section.key}
          section={section}
          selected={selected === section.key}
          onSelect={(key) => {
            setSelected(key)
            onSelectSection?.(key)
          }}
        />
      ))}
    </div>
  )
}
