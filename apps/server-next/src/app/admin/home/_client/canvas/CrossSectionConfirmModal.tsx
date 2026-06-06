'use client'

/**
 * CrossSectionConfirmModal.tsx — 跨区块落位确认弹层（CHG-HOME-CARD-DND-B / 方案 §5.3）
 *
 * 视频卡在视频型区块间拖动时，语义随区块改变（featured → top10 / hot shelf
 * 排序策略不同），落位必须人工确认。确认后由 HomeCanvas 执行：
 * PATCH /admin/home-modules/:id { slot } + 端点 #6 重排目标区块。
 */

import type { CSSProperties } from 'react'
import { AdminButton, Modal } from '@resovo/admin-ui'
import type { HomeSectionKey } from '@/lib/home-curation/types'
import { SECTION_TITLE } from './section-meta'

export interface CrossSectionMove {
  /** home_modules 行 id（拖拽卡 refId） */
  readonly refId: string
  readonly title: string | null
  readonly from: HomeSectionKey
  readonly to: HomeSectionKey
  /** 确认后目标区块的 pinned 全序（含落位行，端点 #6 载荷） */
  readonly items: ReadonlyArray<{ id: string; ordering: number }>
}

const BODY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  lineHeight: 1.6,
}

const HINT_STYLE: CSSProperties = {
  marginTop: 8,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
}

export interface CrossSectionConfirmModalProps {
  /** null = 关闭 */
  readonly move: CrossSectionMove | null
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function CrossSectionConfirmModal({ move, busy, onConfirm, onCancel }: CrossSectionConfirmModalProps) {
  return (
    <Modal
      open={move !== null}
      onClose={() => { if (!busy) onCancel() }}
      title="跨区块移动"
      size="sm"
      data-testid="cross-section-confirm-modal"
    >
      {move && (
        <div style={BODY_STYLE}>
          将「{move.title ?? move.refId}」从 <strong>{SECTION_TITLE[move.from]}</strong> 移至{' '}
          <strong>{SECTION_TITLE[move.to]}</strong>？
          <div style={HINT_STYLE}>
            区块语义随落位改变：排序策略与自动填充规则按目标区块生效（方案 §5.3）；
            该卡将作为目标区块的人工置顶（pinned）项。
          </div>
          <div style={FOOTER_STYLE}>
            <AdminButton variant="default" size="sm" disabled={busy} onClick={onCancel} data-testid="cross-section-cancel-btn">
              取消
            </AdminButton>
            <AdminButton variant="primary" size="sm" loading={busy} onClick={onConfirm} data-testid="cross-section-confirm-btn">
              确认移动
            </AdminButton>
          </div>
        </div>
      )}
    </Modal>
  )
}
