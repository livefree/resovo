'use client'

/**
 * VersionHistoryPanel.tsx — 发布版本历史 Drawer（CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-3.3/-3.4/-4.2）
 *
 * 端点 #5 列表（轻量行）+ #6 详情（diff 数据源）+ #7 回滚。
 * diff 消费端计算（version-diff.ts 纯函数）：「对比上一版」按列表序取相邻
 * 较旧版本两份详情本地比对（version_no serial 可留空洞，不可按 n-1 推算）。
 * 回滚 roll-forward（恢复三表 + 拍新版本）：最新版本即当前发布态，回滚按钮禁用。
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, Drawer, EmptyState, ErrorState, LoadingState, Modal, Pill, useToast } from '@resovo/admin-ui'
import { getHomeVersion, listHomeVersions, rollbackHomeVersion } from '@/lib/home-curation/api'
import { computeVersionDiff, type SectionDiff } from '@/lib/home-curation/version-diff'
import type { HomePublishVersionSummary } from '@/lib/home-curation/types'
import { SECTION_TITLE } from './section-meta'

// ── 样式 ─────────────────────────────────────────────────────────

const LIST_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  fontSize: 'var(--font-size-xs)',
}

const ROW_HEAD_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
const META_STYLE: CSSProperties = { color: 'var(--fg-muted)', fontSize: 'var(--font-size-2xs)' }
const ACTIONS_STYLE: CSSProperties = { display: 'flex', gap: 6, marginLeft: 'auto' }

const DIFF_BOX_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-sunken)',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-default)',
}

function diffLine(d: SectionDiff): string {
  const parts: string[] = []
  if (d.added) parts.push(`+${d.added} 新增`)
  if (d.removed) parts.push(`−${d.removed} 移除`)
  if (d.changed) parts.push(`~${d.changed} 变更`)
  if (d.settingsChanged) parts.push('设置变更')
  return `${SECTION_TITLE[d.section] ?? d.section}：${parts.join(' / ')}`
}

// ── Props ─────────────────────────────────────────────────────────

export interface VersionHistoryPanelProps {
  readonly open: boolean
  readonly onClose: () => void
  /** 回滚成功（roll-forward 新版本已生效）→ 父级重拉 preview / 草稿双信号 */
  readonly onRolledBack: (versionNo: number) => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function VersionHistoryPanel({ open, onClose, onRolledBack }: VersionHistoryPanelProps) {
  const toast = useToast()
  const [rows, setRows] = useState<HomePublishVersionSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  // 展开的 diff：versionNo → 行集（null 哨兵 = 计算中）
  const [diffs, setDiffs] = useState<ReadonlyMap<number, readonly SectionDiff[] | null>>(new Map())
  const [rollbackTarget, setRollbackTarget] = useState<HomePublishVersionSummary | null>(null)
  const [rollingBack, setRollingBack] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setDiffs(new Map())
    try {
      const result = await listHomeVersions({ limit: 50 })
      setRows(result.rows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  /** 对比上一版：列表序取相邻较旧版本（serial 可留空洞，不可按 n-1 推算） */
  async function toggleDiff(versionNo: number) {
    if (diffs.has(versionNo)) {
      setDiffs((prev) => {
        const next = new Map(prev)
        next.delete(versionNo)
        return next
      })
      return
    }
    const index = rows?.findIndex((r) => r.versionNo === versionNo) ?? -1
    const prevRow = index >= 0 ? rows?.[index + 1] : undefined
    if (!prevRow) return
    setDiffs((prev) => new Map(prev).set(versionNo, null))
    try {
      const [from, to] = await Promise.all([
        getHomeVersion(prevRow.versionNo),
        getHomeVersion(versionNo),
      ])
      setDiffs((prev) => new Map(prev).set(versionNo, computeVersionDiff(from.config, to.config)))
    } catch (err: unknown) {
      setDiffs((prev) => {
        const next = new Map(prev)
        next.delete(versionNo)
        return next
      })
      toast.push({
        title: 'diff 加载失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    }
  }

  async function confirmRollback() {
    if (!rollbackTarget) return
    setRollingBack(true)
    try {
      const { versionNo } = await rollbackHomeVersion(rollbackTarget.versionNo)
      toast.push({ title: `已回滚至 v${rollbackTarget.versionNo}（新版本 v${versionNo}）`, level: 'success' })
      setRollbackTarget(null)
      await load()
      onRolledBack(versionNo)
    } catch (err: unknown) {
      toast.push({
        title: '回滚失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setRollingBack(false)
    }
  }

  const latestNo = rows?.[0]?.versionNo ?? null

  return (
    <Drawer
      open={open}
      placement="right"
      onClose={onClose}
      title="发布版本历史"
      width={440}
      data-testid="version-history-panel"
    >
      {loading ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState error={error} title="版本列表加载失败" onRetry={() => void load()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="暂无发布版本" description="首次发布后此处展示版本链（冷启动期直写配置即事实发布态）" />
      ) : (
        <div style={LIST_STYLE} data-testid="version-list">
          {rows.map((row, index) => (
            <div key={row.id} style={ROW_STYLE} data-testid={`version-row-${row.versionNo}`}>
              <div style={ROW_HEAD_STYLE}>
                <Pill variant={row.source === 'rollback' ? 'warn' : 'accent'} testId={`version-source-${row.versionNo}`}>
                  {`v${row.versionNo} · ${row.source === 'rollback' ? '回滚' : '发布'}`}
                </Pill>
                {row.versionNo === latestNo && <Pill variant="neutral">当前版本</Pill>}
                <div style={ACTIONS_STYLE}>
                  {index < rows.length - 1 && (
                    <AdminButton
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleDiff(row.versionNo)}
                      data-testid={`version-diff-btn-${row.versionNo}`}
                    >
                      对比上一版
                    </AdminButton>
                  )}
                  <AdminButton
                    variant="default"
                    size="sm"
                    disabled={row.versionNo === latestNo}
                    title={row.versionNo === latestNo ? '最新版本即当前发布态' : undefined}
                    onClick={() => setRollbackTarget(row)}
                    data-testid={`version-rollback-btn-${row.versionNo}`}
                  >
                    回滚
                  </AdminButton>
                </div>
              </div>
              <div style={META_STYLE}>
                {new Date(row.publishedAt).toLocaleString()}
                {row.note ? ` · ${row.note}` : ''}
              </div>
              {diffs.has(row.versionNo) && (
                <div style={DIFF_BOX_STYLE} data-testid={`version-diff-${row.versionNo}`}>
                  {diffs.get(row.versionNo) === null ? (
                    <span>对比计算中…</span>
                  ) : (diffs.get(row.versionNo) ?? []).length === 0 ? (
                    <span data-testid={`version-diff-empty-${row.versionNo}`}>与上一版无内容差异</span>
                  ) : (
                    (diffs.get(row.versionNo) ?? []).map((d) => (
                      <span key={d.section} data-testid={`version-diff-line-${row.versionNo}-${d.section}`}>
                        {diffLine(d)}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 回滚确认（roll-forward：不删不改历史，回滚本身可再回滚） */}
      <Modal
        open={rollbackTarget !== null}
        onClose={rollingBack ? () => undefined : () => setRollbackTarget(null)}
        title="回滚首页配置"
        size="sm"
        data-testid="rollback-confirm-modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--font-size-xs)' }}>
          <span>
            将整页配置恢复至 v{rollbackTarget?.versionNo}（roll-forward 记为新版本，
            历史链不变；现存草稿将被标记为基线过时）。
          </span>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <AdminButton variant="ghost" size="sm" disabled={rollingBack} onClick={() => setRollbackTarget(null)}>
              取消
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              loading={rollingBack}
              onClick={() => void confirmRollback()}
              data-testid="rollback-confirm-btn"
            >
              确认回滚
            </AdminButton>
          </div>
        </div>
      </Modal>
    </Drawer>
  )
}
