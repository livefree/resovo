'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { SortableList } from '@/components/admin/shared/SortableList'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import type { Banner } from '@resovo/types'

// ── 类型 ─────────────────────────────────────────────────────────────────────

interface SortItem {
  id: string
  title: string
  imageUrl: string
  isActive: boolean
}

interface BannerDragSortProps {
  initialBanners: Pick<Banner, 'id' | 'title' | 'imageUrl' | 'isActive' | 'sortOrder'>[]
  onClose: () => void
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

function getDisplayTitle(title: Banner['title']): string {
  return title['zh-CN'] ?? title['en'] ?? Object.values(title)[0] ?? '（无标题）'
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

export function BannerDragSort({ initialBanners, onClose }: BannerDragSortProps) {
  const [items, setItems] = useState<SortItem[]>(() =>
    initialBanners.map((b) => ({
      id: b.id,
      title: getDisplayTitle(b.title),
      imageUrl: b.imageUrl,
      isActive: b.isActive,
    }))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const orders = items.map((item, index) => ({ id: item.id, sortOrder: index }))
      await apiClient.patch('/admin/banners/reorder', { orders })
      notify.success('排序已保存')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      notify.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="banner-drag-sort" className="space-y-3">
      <p className="text-sm text-[var(--muted)]">拖拽调整顺序，完成后点击保存。</p>

      <SortableList
        items={items}
        onReorder={setItems}
        disabled={saving}
        data-testid="banner-sortable-list"
        renderItem={(item) => (
          <div
            className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 cursor-grab active:cursor-grabbing select-none"
            data-testid={`banner-sort-item-${item.id}`}
          >
            <span className="text-[var(--muted)] text-xs">⠿</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-10 w-16 rounded object-cover shrink-0 border border-[var(--border)]"
            />
            <span className="flex-1 truncate text-sm text-[var(--text)]">{item.title}</span>
            {!item.isActive && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] border border-[var(--border)] text-[var(--muted)]">
                已停用
              </span>
            )}
          </div>
        )}
      />

      <div className="flex justify-end gap-2 pt-2">
        <AdminButton variant="secondary" onClick={onClose} disabled={saving}>
          取消
        </AdminButton>
        <AdminButton
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          data-testid="banner-drag-sort-save"
        >
          {saving ? '保存中…' : '保存排序'}
        </AdminButton>
      </div>
    </div>
  )
}
