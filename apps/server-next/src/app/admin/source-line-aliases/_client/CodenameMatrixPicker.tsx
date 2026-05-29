'use client'

/**
 * CodenameMatrixPicker.tsx — Layer B codename 字库矩阵选择弹层（CHG-SN-9-CODENAME-MATRIX）
 *
 * 点行级 codename 单元格触发：
 *   - 顶部展示当前选中行的 (siteKey, sourceName, displayName)
 *   - grid 显示 52 山名 + 状态色（available / occupied / cooling）
 *   - 点 available 基础名 → onPick 立即写入
 *   - 点 occupied 基础名 → 弹"该名被占用" + 一键选择 suggestedNext（如 "泰山-2"）
 *   - 点 cooling 基础名 → 显示剩余天数 / disabled
 *
 * 视觉：
 *   - 仅消费 admin-ui Modal + AdminButton 原语 / 零本地新建通用组件
 *   - 颜色 var(--state-*-fg/bg/border) / 零硬编码
 */

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Modal, AdminButton } from '@resovo/admin-ui'
import type { SourceLineRow } from '@resovo/types'
import {
  buildCodenameMatrix,
  computeMatrixStats,
  type MountainSlot,
  type CodenameSlot,
} from '@/lib/sources/codename-utils'

interface CodenameMatrixPickerProps {
  readonly open: boolean
  readonly currentRow: SourceLineRow | null
  readonly allRows: ReadonlyArray<SourceLineRow>
  readonly onPick: (codename: string) => void
  readonly onClear: () => void  // 设为 null（清除 codename）
  readonly onClose: () => void
}

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
  gap: 8,
}

const STAT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: 12,
}

const MOUNTAIN_CARD_BASE_STYLE: CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  cursor: 'pointer',
  transition: 'background 100ms ease',
}

function getMountainCardStyle(status: 'available' | 'occupied' | 'cooling'): CSSProperties {
  switch (status) {
    case 'available':
      return {
        ...MOUNTAIN_CARD_BASE_STYLE,
        background: 'var(--state-success-bg)',
        borderColor: 'var(--state-success-border)',
        color: 'var(--state-success-fg)',
      }
    case 'occupied':
      return {
        ...MOUNTAIN_CARD_BASE_STYLE,
        background: 'var(--bg-surface-raised)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--fg-muted)',
        cursor: 'pointer',  // 仍可点（弹建议后缀）
      }
    case 'cooling':
      return {
        ...MOUNTAIN_CARD_BASE_STYLE,
        background: 'var(--state-warning-bg)',
        borderColor: 'var(--state-warning-border)',
        color: 'var(--state-warning-fg)',
        cursor: 'not-allowed',
        opacity: 0.7,
      }
  }
}

function StatusBadge({ status }: { status: 'available' | 'occupied' | 'cooling' }) {
  const text =
    status === 'available' ? '可用' : status === 'occupied' ? '占用' : '冷却'
  return (
    <span style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.8 }}>{text}</span>
  )
}

export function CodenameMatrixPicker({
  open,
  currentRow,
  allRows,
  onPick,
  onClear,
  onClose,
}: CodenameMatrixPickerProps) {
  const matrix = useMemo(() => buildCodenameMatrix(allRows), [allRows])
  const stats = useMemo(() => computeMatrixStats(matrix), [matrix])
  // 占用基础名时弹建议确认浮层
  const [confirmSuggest, setConfirmSuggest] = useState<MountainSlot | null>(null)

  function handleClickMountain(m: MountainSlot) {
    const baseSlot = m.slots[0]
    if (baseSlot.status === 'cooling') return  // disabled
    if (baseSlot.status === 'available') {
      onPick(baseSlot.value)
      return
    }
    // occupied → 弹确认 + 一键采纳后缀建议
    setConfirmSuggest(m)
  }

  function handleClickSuffix(slot: CodenameSlot) {
    if (slot.status === 'available') {
      onPick(slot.value)
    }
  }

  function handleAcceptSuggest() {
    if (confirmSuggest) {
      onPick(confirmSuggest.suggestedNext.value)
      setConfirmSuggest(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setConfirmSuggest(null)
        onClose()
      }}
      title={
        currentRow
          ? `选择代号：${currentRow.sourceSiteKey} / ${currentRow.sourceName}`
          : '选择代号'
      }
      size="lg"
      data-testid="codename-matrix-picker"
    >
      <div style={{ padding: 16 }}>
        {/* 字库总览 */}
        <div style={STAT_ROW_STYLE}>
          <span>
            字库总数 <strong style={{ color: 'var(--fg-default)' }}>{stats.mountainTotal}</strong>
          </span>
          <span style={{ color: 'var(--state-success-fg)' }}>
            可用基础名 <strong>{stats.mountainAvailable}</strong>
          </span>
          <span style={{ color: 'var(--fg-muted)' }}>
            已占用 slots <strong>{stats.slotsOccupied}</strong>
          </span>
          <span style={{ color: 'var(--state-warning-fg)' }}>
            冷却中 <strong>{stats.slotsCooling}</strong>
          </span>
        </div>

        {/* 字库矩阵 grid */}
        <div style={GRID_STYLE} data-testid="codename-matrix-grid">
          {matrix.map((m) => {
            const baseSlot = m.slots[0]
            const isCurrentBase =
              currentRow?.codename !== null &&
              currentRow?.codename !== undefined &&
              currentRow.codename === baseSlot.value
            return (
              <button
                key={m.base}
                type="button"
                onClick={() => handleClickMountain(m)}
                disabled={baseSlot.status === 'cooling'}
                style={{
                  ...getMountainCardStyle(baseSlot.status),
                  outline: isCurrentBase ? '2px solid var(--accent-default)' : undefined,
                  outlineOffset: isCurrentBase ? 1 : undefined,
                }}
                title={
                  baseSlot.status === 'occupied' && baseSlot.assignedTo
                    ? `已被占用：${baseSlot.assignedTo.sourceSiteKey} / ${baseSlot.assignedTo.sourceName}`
                    : baseSlot.status === 'cooling' && baseSlot.coolingDaysLeft !== undefined
                      ? `冷却中：剩 ${baseSlot.coolingDaysLeft} 天可复用`
                      : `点击使用 "${baseSlot.value}"`
                }
                data-testid={`codename-slot-${m.base}`}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  {m.base}
                </span>
                <StatusBadge status={baseSlot.status} />
                {/* 后缀变种 chip 列表（如果有） */}
                {m.slots.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    {m.slots.slice(1).map((s) => (
                      <span
                        key={s.value}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (s.status === 'available') handleClickSuffix(s)
                        }}
                        style={{
                          fontSize: 'var(--font-size-2xs)',
                          padding: '1px 4px',
                          borderRadius: 4,
                          background:
                            s.status === 'available'
                              ? 'var(--state-success-bg)'
                              : s.status === 'cooling'
                                ? 'var(--state-warning-bg)'
                                : 'var(--bg-surface-elevated)',
                          color:
                            s.status === 'available'
                              ? 'var(--state-success-fg)'
                              : s.status === 'cooling'
                                ? 'var(--state-warning-fg)'
                                : 'var(--fg-muted)',
                          cursor: s.status === 'available' ? 'pointer' : 'default',
                        }}
                        title={
                          s.status === 'occupied' && s.assignedTo
                            ? `${s.value} 已被 ${s.assignedTo.sourceSiteKey} / ${s.assignedTo.sourceName} 占用`
                            : s.status === 'cooling' && s.coolingDaysLeft !== undefined
                              ? `${s.value} 冷却中 / 剩 ${s.coolingDaysLeft} 天`
                              : `点击使用 ${s.value}`
                        }
                      >
                        -{s.suffix}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* 底部操作行：清除当前 codename / 取消 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <AdminButton
            size="sm"
            variant="ghost"
            onClick={() => {
              onClear()
            }}
            disabled={currentRow?.codename === null || currentRow?.codename === undefined}
          >
            清除代号
          </AdminButton>
          <AdminButton size="sm" variant="secondary" onClick={onClose}>
            取消
          </AdminButton>
        </div>
      </div>

      {/* 占用名 → 后缀建议确认浮层 */}
      {confirmSuggest && (
        <Modal
          open={true}
          onClose={() => setConfirmSuggest(null)}
          title={`"${confirmSuggest.base}" 已被占用`}
          size="sm"
          data-testid="codename-suggest-modal"
        >
          <div style={{ padding: 16, fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
            <p style={{ marginTop: 0 }}>
              基础名 <strong>{confirmSuggest.base}</strong> 已被{' '}
              <code>
                {confirmSuggest.slots[0].assignedTo?.sourceSiteKey} /{' '}
                {confirmSuggest.slots[0].assignedTo?.sourceName}
              </code>{' '}
              占用。
            </p>
            <p style={{ color: 'var(--fg-muted)' }}>
              是否使用建议的扩容编号{' '}
              <strong style={{ color: 'var(--accent-default)' }}>
                {confirmSuggest.suggestedNext.value}
              </strong>
              ？
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <AdminButton size="sm" variant="ghost" onClick={() => setConfirmSuggest(null)}>
                取消
              </AdminButton>
              <AdminButton size="sm" variant="primary" onClick={handleAcceptSuggest}>
                使用 {confirmSuggest.suggestedNext.value}
              </AdminButton>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
