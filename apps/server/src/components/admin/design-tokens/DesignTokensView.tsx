'use client'

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
    <div className="flex flex-1 gap-0 border rounded overflow-hidden" style={{ borderColor: 'var(--border-default)', minHeight: '600px' }}>
      {/* 左栏：Brand 列表 */}
      <div className="w-[280px] shrink-0 overflow-y-auto border-r p-3" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
        <TokenTable onBrandSelect={setSelectedSlug} selectedSlug={selectedSlug} />
      </div>

      {/* 中栏：Token 覆写编辑器 */}
      <div className="w-[380px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-canvas)' }}>
        {loadingDetail ? (
          <LoadingPlaceholder text="加载中…" />
        ) : hasEditorContent ? (
          <div className="flex flex-col h-full p-3 gap-2">
            <h3 className="text-sm font-medium shrink-0" style={{ color: 'var(--fg-default)' }}>
              {brandDetail.name} — Brand Overrides
            </h3>
            <div className="flex-1 overflow-hidden">
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
      <div className="flex flex-col flex-1 overflow-hidden">
        {selectedSlug && brandDetail && (
          <div className="h-[320px] border-b shrink-0" style={{ borderColor: 'var(--border-default)' }}>
            <DiffPanel
              slug={selectedSlug}
              baselineOverrides={brandDetail.overrides}
              workingFlat={workingFlat}
              isProduction={isProduction}
              onSave={handleSave}
            />
          </div>
        )}
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-sunken)' }}>
          <LivePreviewFrame selectedBrandSlug={selectedSlug} webBaseUrl={webBaseUrl} iframeRef={iframeRef} />
        </div>
      </div>
    </div>
  )
}

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-sm" style={{ color: 'var(--fg-subtle)' }}>{text}</span>
    </div>
  )
}
