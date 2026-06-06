'use client'

/**
 * HomeCanvas.tsx — 前台同构画布容器（CHG-HOME-CANVAS-A/-B / 方案 §3）
 *
 * 消费 GET /admin/home/preview（ADR-182 #1，正式配置预览无草稿叠加），
 * 按 7 区块前台渲染序展示。-B 接入：环境栏（brand/locale/at/device →
 * preview 重拉）+ 右侧 Inspector（区块 settings 编辑，保存后重拉）。
 * 卡片操作归 Phase 2；候选池展示归 Phase 3。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AdminButton, EmptyState, ErrorState, LoadingState } from '@resovo/admin-ui'
import { getHomePreview } from '@/lib/home-curation/api'
import type { HomePreview, HomePreviewQuery, HomeSectionKey } from '@/lib/home-curation/types'
import { CanvasSection } from './CanvasSection'
import { CanvasEnvBar } from './CanvasEnvBar'
import { SectionInspector } from './SectionInspector'

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const SPLIT_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: 12,
  alignItems: 'start',
}

const CANVAS_COL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

export interface HomeCanvasProps {
  /** 区块选中回调（外部联动可选；Inspector 已内置） */
  readonly onSelectSection?: (key: HomeSectionKey) => void
}

export function HomeCanvas({ onSelectSection }: HomeCanvasProps) {
  const [preview, setPreview] = useState<HomePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<HomeSectionKey | null>(null)
  // CHG-HOME-CANVAS-B：环境参数（环境栏「应用」驱动；ref 保证刷新/保存重拉用最新值）
  const queryRef = useRef<HomePreviewQuery>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPreview(await getHomePreview(queryRef.current))
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedSection = preview?.sections.find((s) => s.key === selected) ?? null

  return (
    <div style={WRAP_STYLE} data-testid="home-canvas-wrap">
      {/* 环境栏：四参数 → preview 重拉（方案 §3） */}
      <CanvasEnvBar
        onApply={(query) => {
          queryRef.current = query
          void load()
        }}
      />

      {loading ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState error={error} title="画布加载失败" onRetry={() => void load()} />
      ) : !preview ? (
        <EmptyState title="暂无预览数据" />
      ) : (
        <div style={SPLIT_STYLE}>
          <div style={CANVAS_COL_STYLE} data-testid="home-canvas">
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

          {/* 右侧 Inspector：settings 编辑（保存成功 → 重拉 preview 反映新槽位/模式） */}
          <SectionInspector
            section={selectedSection}
            onSaved={() => void load()}
          />
        </div>
      )}
    </div>
  )
}
