/**
 * ModerationList.tsx — 审核台左侧待审列表面板（CHG-222）
 * 调用 GET /admin/videos/pending-review，展示紧凑视频列表
 * 点击条目触发 onSelect 回调，选中态高亮显示
 * CHG-341: 增加类型筛选、排序（最新/最早）；修正 tv→series 映射
 * UX-10: 每行新增豆瓣状态/源健康/元数据进度 badge；新增对应筛选器
 * UX-13: 多选 checkbox + SelectionActionBar（批量通过暂存 / 批量拒绝）
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { TableImageCell } from '@/components/admin/shared/modern-table/cells'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import type { DoubanStatus, SourceCheckStatus } from '@/types'

interface PendingVideoRow {
  id: string
  shortId: string
  title: string
  type: string
  coverUrl: string | null
  year: number | null
  siteKey: string | null
  siteName: string | null
  firstSourceUrl: string | null
  createdAt: string
  doubanStatus: DoubanStatus
  sourceCheckStatus: SourceCheckStatus
  metaScore: number
  activeSourceCount: number
}

interface ModerationListProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onBatchComplete?: () => void
}

const PAGE_SIZE = 30

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'news', label: '新闻' },
  { value: 'kids', label: '少儿' },
  { value: 'other', label: '其他' },
]

const DOUBAN_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '豆瓣：全部' },
  { value: 'matched', label: '豆瓣：已匹配' },
  { value: 'candidate', label: '豆瓣：候选' },
  { value: 'unmatched', label: '豆瓣：未匹配' },
  { value: 'pending', label: '豆瓣：待检' },
]

const SOURCE_CHECK_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '源检验：全部' },
  { value: 'ok', label: '源检验：全可达' },
  { value: 'partial', label: '源检验：部分可达' },
  { value: 'all_dead', label: '源检验：全失效' },
  { value: 'pending', label: '源检验：未检验' },
]

const REJECT_PRESET_REASONS = ['片源不完整', '画质异常', '集数错误', '内容违规', '重复上传']

function getTypeLabel(type: string): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

// ── 状态 Badge ────────────────────────────────────────────────────

function DoubanBadge({ status }: { status: DoubanStatus }) {
  const map: Record<DoubanStatus, { label: string; cls: string }> = {
    matched:   { label: '✓匹配', cls: 'text-[var(--success,#22c55e)]' },
    candidate: { label: '?候选', cls: 'text-[var(--warning,#f59e0b)]' },
    unmatched: { label: '✗未匹配', cls: 'text-[var(--error,#ef4444)]' },
    pending:   { label: '○待检', cls: 'text-[var(--muted)]' },
  }
  const { label, cls } = map[status] ?? map.pending
  return <span className={`text-[10px] ${cls}`} data-testid="douban-badge">{label}</span>
}

function SourceBadge({ status, count }: { status: SourceCheckStatus; count: number }) {
  if (status === 'ok')       return <span className="text-[10px] text-[var(--success,#22c55e)]" data-testid="source-badge">●{count}可达</span>
  if (status === 'partial')  return <span className="text-[10px] text-[var(--warning,#f59e0b)]" data-testid="source-badge">⚠部分可达</span>
  if (status === 'all_dead') return <span className="text-[10px] text-[var(--error,#ef4444)]" data-testid="source-badge">✕全失效</span>
  return <span className="text-[10px] text-[var(--muted)]" data-testid="source-badge">○未检验</span>
}

function MetaScoreBadge({ score }: { score: number }) {
  const cls = score >= 80 ? 'text-[var(--success,#22c55e)]'
    : score >= 50 ? 'text-[var(--warning,#f59e0b)]'
    : 'text-[var(--muted)]'
  return <span className={`text-[10px] ${cls}`} data-testid="meta-score-badge">元{score}%</span>
}

// ── 批量拒绝弹窗 ──────────────────────────────────────────────────

interface BatchRejectDialogProps {
  count: number
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function BatchRejectDialog({ count, onConfirm, onCancel }: BatchRejectDialogProps) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="batch-reject-dialog">
      <div className="w-96 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5 shadow-xl">
        <p className="mb-3 text-sm font-medium text-[var(--text)]">批量拒绝 {count} 条视频</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {REJECT_PRESET_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason((prev) => prev ? `${prev}，${r}` : r)}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg3)]"
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="请输入拒绝原因（必填）"
          rows={3}
          data-testid="batch-reject-reason-input"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            data-testid="batch-reject-confirm-btn"
            className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            确认拒绝
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 组件 ──────────────────────────────────────────────────────────

export function ModerationList({ selectedId, onSelect, onBatchComplete }: ModerationListProps) {
  const [rows, setRows] = useState<PendingVideoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [sourceState, setSourceState] = useState<'all' | 'active' | 'missing'>('all')
  const [doubanStatusFilter, setDoubanStatusFilter] = useState('')
  const [sourceCheckFilter, setSourceCheckFilter] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [siteKeyInput, setSiteKeyInput] = useState('')
  const [siteKey, setSiteKey] = useState('')
  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)

  const fetchRows = useCallback(async (
    pageVal: number,
    type: string,
    dir: 'asc' | 'desc',
    source: 'all' | 'active' | 'missing',
    douban: string,
    sourceCheck: string,
    q: string,
    site: string
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE), sortDir: dir })
      if (type) params.set('type', type)
      if (q) params.set('q', q)
      if (site) params.set('siteKey', site)
      if (source !== 'all') params.set('sourceState', source)
      if (douban) params.set('doubanStatus', douban)
      if (sourceCheck) params.set('sourceCheckStatus', sourceCheck)
      const res = await apiClient.get<{ data: PendingVideoRow[]; total: number }>(
        `/admin/videos/pending-review?${params}`
      )
      setRows(res.data)
      setTotal(res.total)
    } catch (_err) {
      // fetch failed: list remains empty, loading ends
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRows(page, typeFilter, sortDir, sourceState, doubanStatusFilter, sourceCheckFilter, keyword, siteKey)
  }, [fetchRows, page, typeFilter, sortDir, sourceState, doubanStatusFilter, sourceCheckFilter, keyword, siteKey])

  // 翻页/筛选时清空选择
  useEffect(() => { setSelectedIds(new Set()) }, [page, typeFilter, sortDir, sourceState, doubanStatusFilter, sourceCheckFilter, keyword, siteKey])

  function handleTypeChange(newType: string) {
    setTypeFilter(newType)
    setPage(1)
  }

  function handleSortDir(newDir: 'asc' | 'desc') {
    setSortDir(newDir)
    setPage(1)
  }

  function handleApplyFilters() {
    setKeyword(keywordInput.trim())
    setSiteKey(siteKeyInput.trim())
    setPage(1)
  }

  function handleResetFilters() {
    setTypeFilter('')
    setSortDir('desc')
    setSourceState('all')
    setDoubanStatusFilter('')
    setSourceCheckFilter('')
    setKeywordInput('')
    setKeyword('')
    setSiteKeyInput('')
    setSiteKey('')
    setPage(1)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)))
    }
  }

  async function handleBatchApprove() {
    if (selectedIds.size === 0 || batchLoading) return
    setBatchLoading(true)
    try {
      const res = await apiClient.post<{ data: { approved: number; skipped: number; failed: number } }>(
        '/admin/moderation/batch-approve',
        { ids: Array.from(selectedIds) }
      )
      const { approved, skipped, failed } = res.data
      notify.success(`批量通过：成功 ${approved}，跳过 ${skipped}${failed > 0 ? `，失败 ${failed}` : ''}`)
      setSelectedIds(new Set())
      onBatchComplete?.()
    } catch (_err) {
      notify.error('批量通过失败，请重试')
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleBatchRejectConfirm(reason: string) {
    setShowRejectDialog(false)
    setBatchLoading(true)
    try {
      const res = await apiClient.post<{ data: { rejected: number; skipped: number; failed: number } }>(
        '/admin/moderation/batch-reject',
        { ids: Array.from(selectedIds), reason }
      )
      const { rejected, skipped, failed } = res.data
      notify.success(`批量拒绝：成功 ${rejected}，跳过 ${skipped}${failed > 0 ? `，失败 ${failed}` : ''}`)
      setSelectedIds(new Set())
      onBatchComplete?.()
    } catch (_err) {
      notify.error('批量拒绝失败，请重试')
    } finally {
      setBatchLoading(false)
    }
  }

  const hasMore = page * PAGE_SIZE < total
  const hasPrev = page > 1
  const allSelected = rows.length > 0 && selectedIds.size === rows.length

  return (
    <div className="flex h-full flex-col" data-testid="moderation-list">
      {/* 列表头 + 筛选 */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              data-testid="moderation-list-select-all"
              className="rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <p className="text-sm font-medium text-[var(--text)]">
              待审核列表
              {total > 0 && (
                <span className="ml-2 text-xs text-[var(--muted)]">共 {total} 条</span>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {/* 类型 + 片源状态 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              data-testid="moderation-list-type-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={sourceState}
              onChange={(e) => {
                setSourceState(e.target.value as 'all' | 'active' | 'missing')
                setPage(1)
              }}
              data-testid="moderation-list-source-state-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="all">片源状态：全部</option>
              <option value="active">片源状态：有可用源</option>
              <option value="missing">片源状态：无可用源</option>
            </select>
          </div>
          {/* 豆瓣状态 + 源检验状态 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={doubanStatusFilter}
              onChange={(e) => { setDoubanStatusFilter(e.target.value); setPage(1) }}
              data-testid="moderation-list-douban-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {DOUBAN_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={sourceCheckFilter}
              onChange={(e) => { setSourceCheckFilter(e.target.value); setPage(1) }}
              data-testid="moderation-list-source-check-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {SOURCE_CHECK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters() }}
              placeholder="搜索标题/shortId/源名"
              data-testid="moderation-list-keyword-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--muted)]"
            />
            <input
              value={siteKeyInput}
              onChange={(e) => setSiteKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters() }}
              placeholder="按站点 key 过滤"
              data-testid="moderation-list-site-filter"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--muted)]"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex rounded border border-[var(--border)] overflow-hidden shrink-0">
              <button
                type="button"
                data-testid="moderation-list-sort-desc"
                onClick={() => handleSortDir('desc')}
                className={`px-2 py-1 text-xs transition-colors ${sortDir === 'desc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
              >
                最新
              </button>
              <button
                type="button"
                data-testid="moderation-list-sort-asc"
                onClick={() => handleSortDir('asc')}
                className={`px-2 py-1 text-xs transition-colors ${sortDir === 'asc' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
              >
                最早
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleApplyFilters}
                data-testid="moderation-list-apply-filter"
                className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
              >
                应用
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                data-testid="moderation-list-reset-filter"
                className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg2)]"
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 列表内容 */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="moderation-list-scroll">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-14 animate-pulse gap-2 rounded-md bg-[var(--bg3)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-[var(--muted)]">暂无待审核视频</p>
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-2 px-1">
                {/* 多选 checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={() => toggleSelect(row.id)}
                  data-testid={`moderation-list-checkbox-${row.id}`}
                  className="mt-3 rounded border-[var(--border)] accent-[var(--accent)]"
                  onClick={(e) => e.stopPropagation()}
                />
                {/* 条目按钮 */}
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  data-testid={`moderation-list-item-${row.id}`}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    selectedId === row.id
                      ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/40'
                      : 'hover:bg-[var(--bg3)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <TableImageCell src={row.coverUrl} alt={row.title} width={32} height={48} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--text)]">{row.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span>{getTypeLabel(row.type)}</span>
                        {row.year && <span>· {row.year}</span>}
                        {row.siteName && <span>· {row.siteName}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <DoubanBadge status={row.doubanStatus} />
                        <SourceBadge status={row.sourceCheckStatus} count={row.activeSourceCount} />
                        <MetaScoreBadge score={row.metaScore} />
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{formatDate(row.createdAt)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 分页控制 */}
      {(hasPrev || hasMore) && (
        <div className="shrink-0 flex justify-between border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
            data-testid="moderation-list-prev"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            上一页
          </button>
          <span className="self-center text-xs text-[var(--muted)]">第 {page} 页</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            data-testid="moderation-list-next"
            className="rounded px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40 hover:text-[var(--text)]"
          >
            下一页
          </button>
        </div>
      )}

      {/* 批量操作栏 */}
      <SelectionActionBar
        selectedCount={selectedIds.size}
        variant="sticky-bottom"
        data-testid="moderation-batch-bar"
        actions={[
          {
            key: 'approve',
            label: '批量通过暂存',
            variant: 'success',
            disabled: batchLoading,
            testId: 'batch-approve-btn',
            onClick: () => { void handleBatchApprove() },
          },
          {
            key: 'reject',
            label: '批量拒绝',
            variant: 'danger',
            disabled: batchLoading,
            testId: 'batch-reject-btn',
            onClick: () => setShowRejectDialog(true),
          },
        ]}
      />

      {/* 批量拒绝弹窗 */}
      {showRejectDialog && (
        <BatchRejectDialog
          count={selectedIds.size}
          onConfirm={(reason) => { void handleBatchRejectConfirm(reason) }}
          onCancel={() => setShowRejectDialog(false)}
        />
      )}
    </div>
  )
}
