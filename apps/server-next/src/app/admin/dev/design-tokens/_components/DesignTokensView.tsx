'use client'

/**
 * DesignTokensView — Brand Token 预览/编辑三栏容器（左 Brand 列表 / 中 override 编辑 / 右 diff + 实时预览）。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：Tailwind 类转内联样式（server-next 无 Tailwind）。
 * API `/admin/design-tokens/*` 在 apps/api 共享后端，经 apiClient 直接调用。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { TokenTable } from './TokenTable'
import { LivePreviewFrame } from './LivePreviewFrame'
import { TokenEditor } from './TokenEditor'
import { DiffPanel } from './DiffPanel'
import { flattenOverrides, unflattenOverrides } from './_paths'
import type { FlatOverrides } from './_paths'

interface BrandDetail {
  id: string
  slug: string
  name: string
  overrides: unknown
  updatedAt: string
}

interface DesignTokensViewProps {
  webBaseUrl: string
  isProduction?: boolean
}

const SHELL_STYLE: React.CSSProperties = {
  display: 'flex',
  flex: '1 1 0%',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  overflow: 'hidden',
  minHeight: 600,
}

const LEFT_COL_STYLE: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  overflowY: 'auto',
  borderRight: '1px solid var(--border-default)',
  padding: 12,
  backgroundColor: 'var(--bg-surface)',
}

const MID_COL_STYLE: React.CSSProperties = {
  width: 380,
  flexShrink: 0,
  borderRight: '1px solid var(--border-default)',
  overflow: 'hidden',
  backgroundColor: 'var(--bg-canvas)',
}

const RIGHT_COL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0%',
  overflow: 'hidden',
}

export function DesignTokensView({ webBaseUrl, isProduction = false }: DesignTokensViewProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [brandDetail, setBrandDetail] = useState<BrandDetail | null>(null)
  const [overrideMap, setOverrideMap] = useState<Record<string, 'base' | 'brand-override'>>({})
  const [workingFlat, setWorkingFlat] = useState<FlatOverrides>({})
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const loadBrandDetail = useCallback(async (slug: string) => {
    setLoadingDetail(true)
    try {
      const res = await apiClient.get<{
        data: {
          brand: BrandDetail
          overrideMap: Record<string, 'base' | 'brand-override'>
        }
      }>(`/admin/design-tokens/${slug}`)
      const { brand, overrideMap: om } = res.data
      setBrandDetail(brand)
      setOverrideMap(om)
      setWorkingFlat(flattenOverrides(brand.overrides))
      setDirtyPaths(new Set())
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSlug) void loadBrandDetail(selectedSlug)
    else {
      setBrandDetail(null)
      setWorkingFlat({})
      setDirtyPaths(new Set())
    }
  }, [selectedSlug, loadBrandDetail])

  const handleWorkingChange = useCallback((flat: FlatOverrides, dirty: Set<string>) => {
    setWorkingFlat(flat)
    setDirtyPaths(dirty)
  }, [])

  const handleSave = useCallback(async (commitMessage: string) => {
    if (!brandDetail) return
    const newOverrides = unflattenOverrides(workingFlat)
    await apiClient.put(`/admin/design-tokens/${brandDetail.slug}`, {
      overrides: newOverrides,
      expectedUpdatedAt: brandDetail.updatedAt,
      commitMessage,
    })
    await loadBrandDetail(brandDetail.slug)
    iframeRef.current?.contentWindow?.location.reload()
  }, [brandDetail, workingFlat, loadBrandDetail])

  const hasEditorContent = selectedSlug && brandDetail

  return (
    <div style={SHELL_STYLE}>
      {/* 左栏：Brand 列表 */}
      <div style={LEFT_COL_STYLE}>
        <TokenTable onBrandSelect={setSelectedSlug} selectedSlug={selectedSlug} />
      </div>

      {/* 中栏：Token 覆写编辑器 */}
      <div style={MID_COL_STYLE}>
        {loadingDetail ? (
          <LoadingPlaceholder text="加载中…" />
        ) : hasEditorContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8 }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, flexShrink: 0, color: 'var(--fg-default)' }}>
              {brandDetail.name} — Brand Overrides
            </h3>
            <div style={{ flex: '1 1 0%', overflow: 'hidden' }}>
              <TokenEditor
                overrideMap={overrideMap}
                workingFlat={workingFlat}
                dirtyPaths={dirtyPaths}
                onWorkingChange={handleWorkingChange}
              />
            </div>
          </div>
        ) : (
          <LoadingPlaceholder text={selectedSlug ? '无可编辑 Token' : '请从左侧选择一个 Brand'} />
        )}
      </div>

      {/* 右侧：Diff 面板 + 预览 */}
      <div style={RIGHT_COL_STYLE}>
        {selectedSlug && brandDetail && (
          <div style={{ height: 320, borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
            <DiffPanel
              slug={selectedSlug}
              baselineOverrides={brandDetail.overrides}
              workingFlat={workingFlat}
              isProduction={isProduction}
              onSave={handleSave}
            />
          </div>
        )}
        <div style={{ flex: '1 1 0%', overflow: 'hidden', backgroundColor: 'var(--bg-surface-sunken)' }}>
          <LivePreviewFrame selectedBrandSlug={selectedSlug} webBaseUrl={webBaseUrl} iframeRef={iframeRef} />
        </div>
      </div>
    </div>
  )
}

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-subtle)' }}>{text}</span>
    </div>
  )
}
