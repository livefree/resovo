'use client'

/**
 * HomeOpsClient.tsx — `/admin/home` 首页运营位编辑器主组件（CHG-SN-5-07）
 *
 * 范围：4 类 slot tab + 拖拽排序（@dnd-kit）+ CRUD + 发布切换。
 * 端点：apps/api/src/routes/admin/home-modules.ts（ADR-104），6 端点首次消费。
 *
 * 原语消费：PageHeader / AdminButton / AdminCard / LoadingState / ErrorState /
 *           EmptyState / useToast / Drawer（via HomeModuleDrawer）
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  LoadingState,
  ErrorState,
  EmptyState,
  Segment,
  useToast,
} from '@resovo/admin-ui'
import {
  listHomeModules,
  createHomeModule,
  updateHomeModule,
  deleteHomeModule,
  reorderHomeModules,
  publishToggleHomeModule,
} from '@/lib/home-modules/api'
import type {
  HomeModule,
  HomeModuleSlot,
  CreateHomeModuleBody,
  UpdateHomeModuleBody,
} from '@/lib/home-modules/types'
import { useVideoMetaMap } from '@/lib/home-modules/use-video-meta-map'
import { HomeModuleCard } from './HomeModuleCard'
import { HomeModuleDrawer } from './HomeModuleDrawer'
import { HomePreviewPanel } from './HomePreviewPanel'
import { DeleteModuleModal } from './DeleteModuleModal'
import { BatchAddVideosModal, VIDEO_SLOTS } from './BatchAddVideosModal'
import type { PickerVideoItem } from '@resovo/admin-ui'

// ── 常量 ─────────────────────────────────────────────────────────

const SLOTS: readonly HomeModuleSlot[] = ['banner', 'featured', 'top10', 'type_shortcuts']

const SLOT_LABEL: Record<HomeModuleSlot, string> = {
  banner: '轮播广告',
  featured: '精选推荐',
  top10: 'TOP 10',
  type_shortcuts: '类型快捷',
}

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const BODY_SPLIT_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 360px',
  gap: '12px',
  flex: '1 1 auto',
  minHeight: 0,
  alignItems: 'start',
}

const SLOT_SECTION_STYLE: CSSProperties = {
  overflowY: 'auto',
  minHeight: 0,
}

// ── 主组件 ────────────────────────────────────────────────────────

export function HomeOpsClient() {
  const toast = useToast()
  const [activeSlot, setActiveSlot] = useState<HomeModuleSlot>('banner')
  const [modulesBySlot, setModulesBySlot] = useState<Partial<Record<HomeModuleSlot, readonly HomeModule[]>>>({})
  const [loadingSlots, setLoadingSlots] = useState<Partial<Record<HomeModuleSlot, boolean>>>({})
  const [errorSlots, setErrorSlots] = useState<Partial<Record<HomeModuleSlot, Error>>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<HomeModule | null>(null)
  // CHG-HOME-UX-04-B：删除确认 Modal（取代 window.confirm）
  const [deleteTarget, setDeleteTarget] = useState<HomeModule | null>(null)
  // CHG-HOME-UX-07：批量添加统一确认面板
  const [batchAddOpen, setBatchAddOpen] = useState(false)

  const loadSlot = useCallback(async (slot: HomeModuleSlot) => {
    setLoadingSlots(prev => ({ ...prev, [slot]: true }))
    setErrorSlots(prev => { const next = { ...prev }; delete next[slot]; return next })
    try {
      const result = await listHomeModules({ slot, limit: 100 })
      setModulesBySlot(prev => ({ ...prev, [slot]: result.data }))
    } catch (err: unknown) {
      setErrorSlots(prev => ({
        ...prev,
        [slot]: err instanceof Error ? err : new Error(String(err)),
      }))
    } finally {
      setLoadingSlots(prev => ({ ...prev, [slot]: false }))
    }
  }, [])

  useEffect(() => {
    void loadSlot(activeSlot)
  }, [activeSlot, loadSlot])

  const modules = modulesBySlot[activeSlot] ?? []
  const loading = loadingSlots[activeSlot] ?? false
  const error = errorSlots[activeSlot]

  // CHG-HOME-UX-04-B：video 引用充实（顶层一次，metaMap 下传 Card / PreviewPanel 共用）
  const { metaMap } = useVideoMetaMap(modules)

  // ── 拖拽排序 ──────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = modules.findIndex(m => m.id === active.id)
    const newIndex = modules.findIndex(m => m.id === over.id)
    const reordered = arrayMove([...modules], oldIndex, newIndex)

    setModulesBySlot(prev => ({ ...prev, [activeSlot]: reordered }))

    const items = reordered.map((m, i) => ({ id: m.id, ordering: i }))
    try {
      await reorderHomeModules(items)
      toast.push({ title: '排序已保存', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '排序保存失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
      void loadSlot(activeSlot)
    }
  }

  // ── 发布切换 ──────────────────────────────────────────────────────

  const handlePublishToggle = useCallback(async (id: string, enabled: boolean) => {
    setPendingId(id)
    try {
      const updated = await publishToggleHomeModule(id, enabled)
      setModulesBySlot(prev => ({
        ...prev,
        [activeSlot]: (prev[activeSlot] ?? []).map(m => m.id === id ? updated : m),
      }))
      toast.push({ title: enabled ? '已发布' : '已隐藏', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '操作失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [activeSlot, toast])

  // ── 删除（CHG-HOME-UX-04-B：Modal 确认取代 window.confirm）──────────

  const handleDeleteConfirmed = useCallback(async (id: string) => {
    setPendingId(id)
    try {
      await deleteHomeModule(id)
      setModulesBySlot(prev => ({
        ...prev,
        [activeSlot]: (prev[activeSlot] ?? []).filter(m => m.id !== id),
      }))
      setDeleteTarget(null)
      toast.push({ title: '已删除', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '删除失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [activeSlot, toast])

  // ── 批量添加（CHG-HOME-UX-07：统一确认面板编排）────────────────────

  /** 去重比对真源 = 已加载 modules 的 video contentRefId 集合（未加载 slot 返回空集，确认前 loadSlot 兜底） */
  const getExistingIds = useCallback((slot: HomeModuleSlot): ReadonlySet<string> => {
    const ids = new Set<string>()
    for (const m of modulesBySlot[slot] ?? []) {
      if (m.contentRefType === 'video') ids.add(m.contentRefId)
    }
    return ids
  }, [modulesBySlot])

  const handleBatchAdd = useCallback(async (slot: HomeModuleSlot, items: readonly PickerVideoItem[]) => {
    // ordering 末尾追加：现有最大 ordering + 1 起步
    const existing = modulesBySlot[slot] ?? []
    const baseOrdering = existing.reduce((max, m) => Math.max(max, m.ordering), -1) + 1

    let created = 0
    let failed = 0
    for (const [i, item] of items.entries()) {
      try {
        const module = await createHomeModule({
          slot,
          brandScope: 'all-brands',
          contentRefType: 'video',
          contentRefId: item.id,
          ordering: baseOrdering + i,
        })
        created += 1
        setModulesBySlot(prev => ({
          ...prev,
          [slot]: [...(prev[slot] ?? []), module],
        }))
      } catch {
        failed += 1
      }
    }

    setBatchAddOpen(false)
    toast.push({
      title: failed === 0 ? `已添加 ${created} 个模块` : `已添加 ${created} 个 · 失败 ${failed} 个`,
      level: failed === 0 ? 'success' : 'warn',
    })
    // 目标 slot 非当前已加载视图时重载兜底（确保 ordering/顺序与服务端一致）
    if (slot !== activeSlot) void loadSlot(slot)
  }, [modulesBySlot, activeSlot, loadSlot, toast])

  // ── 编辑/创建保存 ──────────────────────────────────────────────────

  const handleSave = useCallback(async (data: CreateHomeModuleBody | UpdateHomeModuleBody, id: string | null) => {
    if (id) {
      const updated = await updateHomeModule(id, data as UpdateHomeModuleBody)
      setModulesBySlot(prev => ({
        ...prev,
        [activeSlot]: (prev[activeSlot] ?? []).map(m => m.id === id ? updated : m),
      }))
      toast.push({ title: '已保存', level: 'success' })
    } else {
      const created = await createHomeModule(data as CreateHomeModuleBody)
      setModulesBySlot(prev => ({
        ...prev,
        [created.slot]: [...(prev[created.slot] ?? []), created],
      }))
      toast.push({ title: '已创建', level: 'success' })
    }
  }, [activeSlot, toast])

  // ── 渲染 ──────────────────────────────────────────────────────────

  return (
    <div data-home-ops-client style={PAGE_STYLE}>
      <PageHeader
        title="首页运营位"
        subtitle={`共 ${modules.length} 个模块`}
        actions={
          <>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => window.open(process.env.NEXT_PUBLIC_APP_URL ?? '/', '_blank', 'noopener,noreferrer')}
              data-testid="home-preview-frontend-btn"
            >
              预览前台
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => { setEditingModule(null); setDrawerOpen(true) }}
              data-testid="home-module-create-btn"
            >
              + 新建模块
            </AdminButton>
          </>
        }
        data-testid="home-ops-page-header"
      />

      {/* CHG-HOME-UX-04-B：手写 bottom-border tabs → 共享 Segment（设计稿 §5.7「Segment」）
          badge 仅显已加载 slot 的模块数（懒加载未访问 slot 无数据，全量计数端点为 follow-up） */}
      <Segment
        items={SLOTS.map(slot => ({
          value: slot,
          label: SLOT_LABEL[slot],
          badge: modulesBySlot[slot]?.length,
        }))}
        value={activeSlot}
        onChange={(next) => setActiveSlot(next as HomeModuleSlot)}
        size="md"
        aria-label="运营位类型切换"
        data-testid="home-slot-segment"
      />

      <div style={BODY_SPLIT_STYLE}>
        <div style={SLOT_SECTION_STYLE}>
          {loading
            ? <LoadingState variant="skeleton" />
            : error
              ? (
                  <ErrorState
                    error={error}
                    title="加载失败"
                    onRetry={() => void loadSlot(activeSlot)}
                  />
                )
              : (
                  <AdminCard
                    surface="plain"
                    padding="md"
                    header={{
                      title: SLOT_LABEL[activeSlot],
                      subtitle: `${modules.length} 个模块 · 拖拽调整排序`,
                      actions: (
                        <>
                          {(VIDEO_SLOTS as readonly string[]).includes(activeSlot) && (
                            <AdminButton
                              variant="default"
                              size="sm"
                              onClick={() => setBatchAddOpen(true)}
                              data-testid="home-batch-add-btn"
                            >
                              + 添加视频
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="default"
                            size="sm"
                            onClick={() => void loadSlot(activeSlot)}
                            data-testid="home-refresh-btn"
                          >
                            刷新
                          </AdminButton>
                        </>
                      ),
                    }}
                    data-testid={`home-slot-card-${activeSlot}`}
                  >
                    {modules.length === 0
                      ? (
                          <EmptyState
                            title="暂无模块"
                            description="点击「新建模块」添加首个运营位"
                          />
                        )
                      : (
                          <DndContext
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => void handleDragEnd(event)}
                          >
                            <SortableContext
                              items={modules.map(m => m.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {modules.map((module, index) => (
                                <HomeModuleCard
                                  key={module.id}
                                  module={module}
                                  index={index}
                                  videoMeta={module.contentRefType === 'video' ? metaMap.get(module.contentRefId) : undefined}
                                  pendingId={pendingId}
                                  onEdit={(m) => { setEditingModule(m); setDrawerOpen(true) }}
                                  onDelete={(id) => setDeleteTarget(modules.find(m => m.id === id) ?? null)}
                                  onPublishToggle={(id, enabled) => void handlePublishToggle(id, enabled)}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        )
                    }
                  </AdminCard>
                )
          }
        </div>
        <HomePreviewPanel slot={activeSlot} modules={modules} videoMetaMap={metaMap} />
      </div>

      <HomeModuleDrawer
        open={drawerOpen}
        module={editingModule}
        defaultSlot={activeSlot}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />

      <DeleteModuleModal
        module={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />

      <BatchAddVideosModal
        open={batchAddOpen}
        defaultSlot={activeSlot}
        getExistingIds={getExistingIds}
        onClose={() => setBatchAddOpen(false)}
        onConfirm={handleBatchAdd}
      />
    </div>
  )
}
