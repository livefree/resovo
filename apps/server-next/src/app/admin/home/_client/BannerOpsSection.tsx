'use client'

/**
 * BannerOpsSection.tsx — `/admin/home` Banner tab 的 home_banners 编辑器
 * （CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1）
 *
 * home_banners 为 Hero 首屏唯一真源（D-181-1.1）；本组件是 server-next
 * 唯一推荐运营入口（D-181-1.3）。自管列表/拖拽排序/启停/删除/编辑 Drawer，
 * 消费 lib/banners 桥接层（既有 /admin/banners 6 端点，零新端点）。
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AdminButton, AdminCard, EmptyState, ErrorState, LoadingState, Modal, useToast } from '@resovo/admin-ui'
import type { Banner, CreateBannerInput, UpdateBannerInput } from '@/lib/banners/types'
import { listBanners, createBanner, updateBanner, deleteBanner, reorderBanners } from '@/lib/banners/api'
import { BannerCard, deriveBannerTitle } from './BannerCard'
import { BannerDrawer } from './BannerDrawer'

// ── 删除确认 Modal 样式（DeleteModuleModal 同范式）────────────────

const MODAL_BODY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  lineHeight: 1.6,
}

const MODAL_TARGET_STYLE: CSSProperties = {
  margin: '10px 0',
  padding: '8px 12px',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const MODAL_WARN_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-error-fg)',
}

const MODAL_FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
}

// ── 组件 ─────────────────────────────────────────────────────────

export function BannerOpsSection() {
  const toast = useToast()
  const [banners, setBanners] = useState<readonly Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listBanners({ limit: 100, sortField: 'sortOrder', sortDir: 'asc' })
      setBanners(result.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // ── 拖拽排序（HomeOpsClient handleDragEnd 同范式；body 键 orders+sortOrder）──

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = banners.findIndex(b => b.id === active.id)
    const newIndex = banners.findIndex(b => b.id === over.id)
    const reordered = arrayMove([...banners], oldIndex, newIndex)
    setBanners(reordered)

    try {
      await reorderBanners(reordered.map((b, i) => ({ id: b.id, sortOrder: i })))
      toast.push({ title: '排序已保存', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '排序保存失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
      void load()
    }
  }

  // ── 启停 ──────────────────────────────────────────────────────────

  const handleActiveToggle = useCallback(async (id: string, isActive: boolean) => {
    setPendingId(id)
    try {
      const updated = await updateBanner(id, { isActive })
      setBanners(prev => prev.map(b => (b.id === id ? updated : b)))
      toast.push({ title: isActive ? '已启用' : '已停用', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '操作失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setPendingId(null)
    }
  }, [toast])

  // ── 删除（Modal 确认，DeleteModuleModal 同范式）────────────────────

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBanner(deleteTarget.id)
      setBanners(prev => prev.filter(b => b.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.push({ title: '已删除', level: 'success' })
    } catch (err: unknown) {
      toast.push({
        title: '删除失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast])

  // ── 创建/编辑保存（创建注入末尾 sortOrder）─────────────────────────

  const handleSave = useCallback(async (body: CreateBannerInput | UpdateBannerInput, id: string | null) => {
    if (id) {
      const updated = await updateBanner(id, body)
      setBanners(prev => prev.map(b => (b.id === id ? updated : b)))
      toast.push({ title: '已保存', level: 'success' })
    } else {
      const created = await createBanner({ ...(body as CreateBannerInput), sortOrder: banners.length })
      setBanners(prev => [...prev, created])
      toast.push({ title: '已创建', level: 'success' })
    }
  }, [banners.length, toast])

  // ── 渲染 ──────────────────────────────────────────────────────────

  if (loading) return <LoadingState variant="skeleton" />
  if (error) {
    return <ErrorState error={error} title="Banner 加载失败" onRetry={() => void load()} />
  }

  return (
    <>
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '首屏 Banner（home_banners 真源）',
          subtitle: `${banners.length} 条 · 拖拽调整排序 · 前台 HeroBanner 实时消费`,
          actions: (
            <>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => { setEditingBanner(null); setDrawerOpen(true) }}
                data-testid="banner-create-btn"
              >
                + 新建 Banner
              </AdminButton>
              <AdminButton
                variant="default"
                size="sm"
                onClick={() => void load()}
                data-testid="banner-refresh-btn"
              >
                刷新
              </AdminButton>
            </>
          ),
        }}
        data-testid="banner-ops-section"
      >
        {banners.length === 0
          ? (
              <EmptyState
                title="暂无 Banner"
                description="点击「新建 Banner」添加首屏横幅（强烈建议 1920×1080 横版大图）"
              />
            )
          : (
              <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
                <SortableContext items={banners.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {banners.map((banner, index) => (
                    <BannerCard
                      key={banner.id}
                      banner={banner}
                      index={index}
                      pendingId={pendingId}
                      onEdit={(b) => { setEditingBanner(b); setDrawerOpen(true) }}
                      onDelete={(b) => setDeleteTarget(b)}
                      onActiveToggle={(id, isActive) => void handleActiveToggle(id, isActive)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )
        }
      </AdminCard>

      <BannerDrawer
        open={drawerOpen}
        banner={editingBanner}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        title="删除 Banner"
        size="sm"
        data-testid="banner-delete-modal"
      >
        {deleteTarget && (
          <div style={MODAL_BODY_STYLE}>
            <p>确认删除以下 Banner？</p>
            <div style={MODAL_TARGET_STYLE}>{deriveBannerTitle(deleteTarget)}</div>
            <p style={MODAL_WARN_STYLE}>硬删除不可恢复；前台首屏将立即不再展示该 Banner。</p>
            <div style={MODAL_FOOTER_STYLE}>
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                data-testid="banner-delete-cancel"
              >
                取消
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                loading={deleting}
                onClick={() => void handleDeleteConfirmed()}
                data-testid="banner-delete-confirm"
              >
                确认删除
              </AdminButton>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
