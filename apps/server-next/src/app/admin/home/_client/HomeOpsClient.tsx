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
  type PickerVideoItem,
} from '@resovo/admin-ui'
import {
  listHomeModules,
  createHomeModule,
  updateHomeModule,
  deleteHomeModule,
  reorderHomeModules,
  publishToggleHomeModule,
} from '@/lib/home-modules/api'
import { useTop10AutoFill } from '@/lib/home-modules/use-top10-autofill'
import { useBatchAdd } from '@/lib/home-modules/use-batch-add'
import type {
  HomeModule,
  HomeModuleSlot,
  CreateHomeModuleBody,
  UpdateHomeModuleBody,
} from '@/lib/home-modules/types'
import { useVideoMetaMap } from '@/lib/home-modules/use-video-meta-map'
import { useHomeAddEntry } from '@/lib/home-modules/use-home-add-entry'
import { HOME_ENTRY_SOURCE_META } from '@/lib/home-modules/entry'
import { VIDEO_SLOTS } from '@/lib/home-modules/types'
// CHG-HOME-EMPTY-SLOTS / 方案 §5.2：画布 banner 空位 → BannerDrawer 创建（sortOrder 服务端真源）
import { listBanners, createBanner } from '@/lib/banners/api'
import type { CreateBannerInput, UpdateBannerInput } from '@/lib/banners/types'
import type { HomeSectionKey } from '@/lib/home-curation/types'
// CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1：banner tab → home_banners 编辑器
import { BannerOpsSection } from './BannerOpsSection'
import { BannerDrawer } from './BannerDrawer'
// CHG-HOME-CANVAS-A / 方案 §3：前台同构画布（CARD-DND-B 拖拽 + EMPTY-SLOTS 添加入口已接）
import { HomeCanvas } from './canvas/HomeCanvas'
import { HomeModuleCard } from './HomeModuleCard'
import { HomeModuleDrawer } from './HomeModuleDrawer'
import { HomePreviewPanel } from './HomePreviewPanel'
import { DeleteModuleModal } from './DeleteModuleModal'
import { BatchAddVideosModal } from './BatchAddVideosModal'

// ── 常量 ─────────────────────────────────────────────────────────

// ADR-181 D-181-4（migration 094）：+3 hot slot（热门 shelf pinned 头部专用）
const SLOTS: readonly HomeModuleSlot[] = ['banner', 'featured', 'top10', 'type_shortcuts', 'hot_movies', 'hot_series', 'hot_anime']

const SLOT_LABEL: Record<HomeModuleSlot, string> = {
  banner: '轮播广告',
  featured: '精选推荐',
  top10: 'TOP 10',
  type_shortcuts: '类型快捷',
  hot_movies: '热门电影',
  hot_series: '热播剧集',
  hot_anime: '热门动漫',
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

// CHG-HOME-UX-08：来源回链栏（仿 merge-entry-source-bar）
const ENTRY_SOURCE_BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  background: 'var(--state-info-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

// ── 主组件 ────────────────────────────────────────────────────────

export function HomeOpsClient() {
  const toast = useToast()
  const [activeSlot, setActiveSlot] = useState<HomeModuleSlot>('banner')
  // CHG-HOME-CANVAS-A：画布 / 列表双视图（画布为方案 §3 主工作区方向，列表保留既有编辑能力）
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list')
  const [modulesBySlot, setModulesBySlot] = useState<Partial<Record<HomeModuleSlot, readonly HomeModule[]>>>({})
  const [loadingSlots, setLoadingSlots] = useState<Partial<Record<HomeModuleSlot, boolean>>>({})
  const [errorSlots, setErrorSlots] = useState<Partial<Record<HomeModuleSlot, Error>>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<HomeModule | null>(null)
  // CHG-HOME-UX-04-B：删除确认 Modal（取代 window.confirm）
  const [deleteTarget, setDeleteTarget] = useState<HomeModule | null>(null)
  // CHG-HOME-UX-08：深链落地（?add_ids=&from= → 充实候选预填确认面板 + 来源回链栏）
  const addEntry = useHomeAddEntry()
  // CHG-HOME-EMPTY-SLOTS / 方案 §5.2：画布空位添加入口
  const [canvasReload, setCanvasReload] = useState(0)
  const [canvasBannerDrawer, setCanvasBannerDrawer] = useState(false)

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

  // CHG-HOME-UX-09：top10 前台自动补位可视化（isPinned=false 项；父取下传 PreviewPanel）
  const top10AutoFill = useTop10AutoFill(activeSlot === 'top10', modules.length)

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

  // ── 批量添加（CHG-HOME-UX-07/09 + 07-FIX：域逻辑抽 use-batch-add——
  //    确认时服务端真源兜底去重/ordering + 面板打开预加载未加载 video slots；
  //    FIX2：深链面板 open 信号并入预加载触发）──
  const batchAdd = useBatchAdd({
    modulesBySlot,
    setModulesBySlot,
    loadSlot,
    toast,
    externallyOpen: addEntry.items !== null,
  })

  // ── 画布空位添加入口（CHG-HOME-EMPTY-SLOTS / 方案 §5.2）──────────────

  /** 视频空位 → 切目标 slot + 打开选片面板（复用 batchAdd 全链路）；banner 空位 → BannerDrawer 创建 */
  function handleCanvasEmptySlot(key: HomeSectionKey) {
    if (key === 'banner') {
      setCanvasBannerDrawer(true)
      return
    }
    // 画布仅对视频型区块上抛（CanvasSection 文案守卫）；视频 section key ⊂ HomeModuleSlot
    setActiveSlot(key as HomeModuleSlot)
    batchAdd.openBlank()
  }

  /** 选片确认（页内/画布共用）：batchAdd 服务端兜底链路 + 画布重拉信号 */
  async function handleBatchConfirm(slot: HomeModuleSlot, items: readonly PickerVideoItem[]) {
    await batchAdd.handleBatchAdd(slot, items)
    setCanvasReload(n => n + 1)
  }

  /** 画布 banner 空位创建（sortOrder 服务端真源 max+1——画布无 banners 列表缓存） */
  async function handleCanvasBannerCreate(body: CreateBannerInput | UpdateBannerInput) {
    const result = await listBanners({ limit: 1, sortField: 'sortOrder', sortDir: 'desc' })
    const maxSort = result.data[0]?.sortOrder ?? -1
    await createBanner({ ...(body as CreateBannerInput), sortOrder: maxSort + 1 })
    toast.push({ title: 'Banner 已创建', level: 'success' })
    setCanvasReload(n => n + 1)
  }

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
              onClick={() => setViewMode(viewMode === 'list' ? 'canvas' : 'list')}
              data-testid="home-view-toggle-btn"
            >
              {viewMode === 'list' ? '同构画布' : '列表编辑'}
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => window.open(process.env.NEXT_PUBLIC_APP_URL ?? '/', '_blank', 'noopener,noreferrer')}
              data-testid="home-preview-frontend-btn"
            >
              预览前台
            </AdminButton>
            {/* CHG-HOME-BANNER-UNIFY-B：banner tab 隐藏（banner slot 已冻结 Create，
                新建走 BannerOpsSection「+ 新建 Banner」） */}
            {activeSlot !== 'banner' && (
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => { setEditingModule(null); setDrawerOpen(true) }}
                data-testid="home-module-create-btn"
              >
                + 新建模块
              </AdminButton>
            )}
          </>
        }
        data-testid="home-ops-page-header"
      />

      {/* CHG-HOME-UX-08：深链来源回链栏（仿 merge-entry-source-bar；HOME_ENTRY_SOURCE_META 真源） */}
      {addEntry.from && (
        <div style={ENTRY_SOURCE_BAR_STYLE} data-testid="home-entry-source-bar">
          <span>{HOME_ENTRY_SOURCE_META[addEntry.from].label}</span>
          {addEntry.invalidCount > 0 && (
            <span style={{ color: 'var(--fg-muted)' }}>
              （{addEntry.invalidCount} 个无效引用已忽略）
            </span>
          )}
          <a
            href={HOME_ENTRY_SOURCE_META[addEntry.from].backHref}
            style={{ marginLeft: 'auto', color: 'var(--accent-default)' }}
          >
            {HOME_ENTRY_SOURCE_META[addEntry.from].backLabel}
          </a>
        </div>
      )}

      {/* CHG-HOME-CANVAS-A：画布视图；列表视图保留全部既有编辑能力。
          EMPTY-SLOTS：空位点击 → 视频选片 / Banner 创建；添加完成 reloadToken 驱动 silent 重拉 */}
      {viewMode === 'canvas' && (
        <HomeCanvas onEmptySlot={handleCanvasEmptySlot} reloadToken={canvasReload} />
      )}

      {/* CHG-HOME-UX-04-B：手写 bottom-border tabs → 共享 Segment（设计稿 §5.7「Segment」）
          badge 仅显已加载 slot 的模块数（懒加载未访问 slot 无数据，全量计数端点为 follow-up） */}
      {viewMode === 'list' && (
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
      )}

      {viewMode === 'list' && (
      <div style={BODY_SPLIT_STYLE}>
        <div style={SLOT_SECTION_STYLE}>
          {/* CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1：banner tab → home_banners 编辑器
              （真源统一）；下方保留已冻结的 home_modules 存量清理区（若有，编辑/删除/启停
              保留但不可新建不可排序，D-181-1.2(a)） */}
          {activeSlot === 'banner' ? (
            <>
              <BannerOpsSection />
              {!loading && modules.length > 0 && (
                <AdminCard
                  surface="plain"
                  padding="md"
                  header={{
                    title: '已冻结的 home_modules 存量配置',
                    subtitle: `${modules.length} 条 · 不影响前台首屏（真源已统一为 home_banners）· 建议删除清理`,
                  }}
                  data-testid="banner-frozen-modules-card"
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
                </AdminCard>
              )}
            </>
          ) : loading
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
                              onClick={batchAdd.openBlank}
                              data-testid="home-batch-add-btn"
                            >
                              + 添加视频
                            </AdminButton>
                          )}
                          {(activeSlot === 'featured' || activeSlot === 'top10') && (
                            <AdminButton
                              variant="default"
                              size="sm"
                              onClick={() => void batchAdd.handleTrendingImport()}
                              data-testid="home-trending-import-btn"
                            >
                              从趋势导入
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
        {/* banner tab：右栏预览隐藏——PreviewPanel 预览的是 home_modules（已冻结，
            前台不消费），保留会误导运营；Hero 真实预览走「预览前台」按钮 */}
        {activeSlot !== 'banner'
          ? <HomePreviewPanel slot={activeSlot} modules={modules} videoMetaMap={metaMap} autoFillItems={top10AutoFill} />
          : <div aria-hidden="true" />}
      </div>
      )}

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
        open={batchAdd.batchAddInitial !== null}
        defaultSlot={activeSlot}
        initialItems={batchAdd.batchAddInitial ?? []}
        getExistingIds={batchAdd.getExistingIds}
        onClose={batchAdd.close}
        onConfirm={handleBatchConfirm}
      />

      {/* CHG-HOME-UX-08：深链落地确认面板（initialItems 预填；与页内面板独立实例避免状态混淆） */}
      <BatchAddVideosModal
        open={addEntry.items !== null}
        defaultSlot={activeSlot}
        initialItems={addEntry.items ?? []}
        getExistingIds={batchAdd.getExistingIds}
        onClose={addEntry.dismiss}
        onConfirm={async (slot, items) => {
          await handleBatchConfirm(slot, items)
          addEntry.dismiss()
        }}
      />

      {/* CHG-HOME-EMPTY-SLOTS：画布 banner 空位 → 创建 Drawer（与 BannerOpsSection 实例独立） */}
      <BannerDrawer
        open={canvasBannerDrawer}
        banner={null}
        onClose={() => setCanvasBannerDrawer(false)}
        onSave={handleCanvasBannerCreate}
      />
    </div>
  )
}
