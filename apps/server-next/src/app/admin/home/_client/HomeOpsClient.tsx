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
import { HomeModuleCard } from './HomeModuleCard'
import { HomeModuleDrawer } from './HomeModuleDrawer'
import { HomePreviewPanel } from './HomePreviewPanel'

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

const TAB_BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  borderBottom: '1px solid var(--border-subtle)',
  paddingBottom: '0',
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    cursor: 'pointer',
    background: 'transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: active ? '2px solid var(--fg-default)' : '2px solid transparent',
    borderRadius: 0,
    marginBottom: '-1px',
  }
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

  // ── 删除 ──────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('确认删除该运营位模块？此操作不可恢复。')) return
    setPendingId(id)
    try {
      await deleteHomeModule(id)
      setModulesBySlot(prev => ({
        ...prev,
        [activeSlot]: (prev[activeSlot] ?? []).filter(m => m.id !== id),
      }))
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
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => { setEditingModule(null); setDrawerOpen(true) }}
            data-testid="home-module-create-btn"
          >
            + 新建模块
          </AdminButton>
        }
        data-testid="home-ops-page-header"
      />

      <nav style={TAB_BAR_STYLE} aria-label="运营位类型切换" role="tablist">
        {SLOTS.map(slot => (
          <button
            key={slot}
            type="button"
            role="tab"
            style={tabStyle(slot === activeSlot)}
            onClick={() => setActiveSlot(slot)}
            data-testid={`home-slot-tab-${slot}`}
            aria-selected={slot === activeSlot}
          >
            {SLOT_LABEL[slot]}
          </button>
        ))}
      </nav>

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
                        <AdminButton
                          variant="default"
                          size="sm"
                          onClick={() => void loadSlot(activeSlot)}
                          data-testid="home-refresh-btn"
                        >
                          刷新
                        </AdminButton>
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
                              {modules.map(module => (
                                <HomeModuleCard
                                  key={module.id}
                                  module={module}
                                  pendingId={pendingId}
                                  onEdit={(m) => { setEditingModule(m); setDrawerOpen(true) }}
                                  onDelete={(id) => void handleDelete(id)}
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
        <HomePreviewPanel slot={activeSlot} modules={modules} />
      </div>

      <HomeModuleDrawer
        open={drawerOpen}
        module={editingModule}
        defaultSlot={activeSlot}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
