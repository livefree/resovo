'use client'

/**
 * BatchAddVideosModal.tsx — 视频批量加入运营位统一确认面板（CHG-HOME-UX-07）
 *
 * 三入口共用（计划「入口体系」）：
 *   ① 页内：slot 头部「+ 添加视频」→ VideoPicker multiple 选择（本卡）
 *   ② 他页深链：?add_ids= 落地 → initialItems 预填（CHG-HOME-UX-08）
 *   ③ 趋势导入：trending 候选 → initialItems 预填（CHG-HOME-UX-09）
 *
 * 去重职责分层（CHG-HOME-UX-07-FIX2）：
 *   - 本组件标灰/计数 = **展示层估计**（基于已加载缓存，面板打开时父级预加载刷新）
 *   - 过滤唯一真源 = onConfirm 接收**全量 selected**，由 useBatchAdd.handleBatchAdd
 *     确认时按服务端最新列表重过滤（本地预过滤不决定提交集，避免缓存陈旧旁路守卫）
 * 误操作安全：确认前零写库（硬删语义下深链静默创建被否决，用户裁定确认面板）。
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Modal, AdminButton, AdminSelect, VideoPicker, type AdminSelectOption, type PickerVideoItem } from '@resovo/admin-ui'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'
import { VIDEO_SLOTS, type HomeModuleSlot } from '@/lib/home-modules/types'

// ── 常量 ─────────────────────────────────────────────────────────

// CHG-HOME-UX-07-FIX：VIDEO_SLOTS 真源迁 lib/home-modules/types.ts（hook 消费避免反向依赖）；
// 此处 re-export 保持既有消费方零迁移
export { VIDEO_SLOTS }

const SLOT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'banner', label: '轮播广告 (banner)' },
  { value: 'featured', label: '精选推荐 (featured)' },
  { value: 'top10', label: 'TOP 10' },
]

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '12px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
  color: 'var(--fg-default)',
}

const LIST_STYLE: CSSProperties = {
  maxHeight: 280,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  margin: '8px 0',
}

const ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 10px',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
}

const ITEM_EXISTING_STYLE: CSSProperties = {
  ...ITEM_STYLE,
  opacity: 0.45,
}

const ITEM_THUMB_STYLE: CSSProperties = {
  width: 48,
  height: 27,
  objectFit: 'cover',
  borderRadius: 'var(--radius-xs)',
  background: 'var(--bg-surface-sunken)',
  flexShrink: 0,
}

const ITEM_TITLE_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const ITEM_TAG_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  flexShrink: 0,
}

const SUMMARY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  marginTop: '4px',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '14px',
}

// ── Props ─────────────────────────────────────────────────────────

export interface BatchAddVideosModalProps {
  readonly open: boolean
  /** 目标 slot 预选（页内=当前 tab；深链/趋势按入口语义） */
  readonly defaultSlot: HomeModuleSlot
  /** 预填候选（深链 / 趋势导入入口；页内入口传 []，用户经 VideoPicker 自选） */
  readonly initialItems?: readonly PickerVideoItem[]
  /** 按 slot 取已在列的 video contentRefId 集合（去重比对真源 = 已加载 modules） */
  readonly getExistingIds: (slot: HomeModuleSlot) => ReadonlySet<string>
  readonly onClose: () => void
  /**
   * 确认：提交**全量 selected**（含本地标灰项）——过滤唯一真源在父级
   * handleBatchAdd 服务端守卫（FIX2）；父级负责去重/循环创建/汇总 toast/列表刷新
   */
  readonly onConfirm: (slot: HomeModuleSlot, items: readonly PickerVideoItem[]) => Promise<void>
}

// ── 组件 ─────────────────────────────────────────────────────────

export function BatchAddVideosModal({
  open,
  defaultSlot,
  initialItems,
  getExistingIds,
  onClose,
  onConfirm,
}: BatchAddVideosModalProps) {
  // defaultSlot 可能是 type_shortcuts（不适用）→ 回落 banner
  const safeDefault: HomeModuleSlot = (VIDEO_SLOTS as readonly string[]).includes(defaultSlot) ? defaultSlot : 'banner'
  const [slot, setSlot] = useState<HomeModuleSlot>(safeDefault)
  const [selected, setSelected] = useState<readonly PickerVideoItem[]>(initialItems ?? [])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSlot(safeDefault)
      setSelected(initialItems ?? [])
    }
    // safeDefault 由 defaultSlot 派生；initialItems 仅开启时快照
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSlot, initialItems])

  // 展示层估计（缓存基线）：标灰与计数提示用；不决定提交集（FIX2）
  const existingIds = getExistingIds(slot)
  const pendingItems = useMemo(
    () => selected.filter((item) => !existingIds.has(item.id)),
    [selected, existingIds],
  )
  const skippedCount = selected.length - pendingItems.length

  async function handleConfirm() {
    if (pendingItems.length === 0) return
    setSubmitting(true)
    try {
      // FIX2：提交全量 selected——过滤唯一真源 = handleBatchAdd 服务端守卫
      // （本地预过滤决定提交集会在缓存陈旧时旁路守卫；最终去重/跳过以 toast 为准）
      await onConfirm(slot, selected)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="批量添加视频到运营位"
      size="md"
      data-testid="batch-add-videos-modal"
    >
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>目标运营位</label>
        <AdminSelect
          options={SLOT_OPTIONS as AdminSelectOption[]}
          value={slot}
          onChange={(v) => setSlot((v ?? safeDefault) as HomeModuleSlot)}
          size="md"
          data-testid="batch-add-slot"
          aria-label="目标运营位"
        />
      </div>

      <div style={FIELD_STYLE}>
        <VideoPicker
          multiple
          label="选择视频"
          value={selected}
          onChange={setSelected}
          fetcher={videoPickerFetcher}
          data-testid="batch-add-picker"
        />
      </div>

      {selected.length > 0 && (
        <div style={LIST_STYLE} data-testid="batch-add-list">
          {selected.map((item) => {
            const isExisting = existingIds.has(item.id)
            return (
              <div
                key={item.id}
                style={isExisting ? ITEM_EXISTING_STYLE : ITEM_STYLE}
                data-testid={`batch-add-item-${item.id}`}
              >
                {item.coverUrl ? (
                  // 装饰性缩略图
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverUrl} alt="" aria-hidden="true" loading="lazy" style={ITEM_THUMB_STYLE} />
                ) : (
                  <div style={ITEM_THUMB_STYLE} aria-hidden="true" />
                )}
                <span style={ITEM_TITLE_STYLE} title={item.title}>
                  {item.title}
                  {item.year ? ` (${item.year})` : ''}
                </span>
                {isExisting && (
                  <span style={ITEM_TAG_STYLE} data-testid={`batch-add-existing-${item.id}`}>
                    已在列 · 跳过
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={SUMMARY_STYLE} data-testid="batch-add-summary">
        待添加 {pendingItems.length} 个{skippedCount > 0 ? ` · 已在列跳过 ${skippedCount} 个` : ''}
      </div>

      <div style={FOOTER_STYLE}>
        <AdminButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          取消
        </AdminButton>
        <AdminButton
          variant="primary"
          size="md"
          loading={submitting}
          disabled={pendingItems.length === 0}
          onClick={() => void handleConfirm()}
          data-testid="batch-add-confirm"
        >
          添加 {pendingItems.length} 个
        </AdminButton>
      </div>
    </Modal>
  )
}
