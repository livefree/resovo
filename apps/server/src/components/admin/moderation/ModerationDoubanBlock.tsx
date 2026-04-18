/**
 * ModerationDoubanBlock.tsx — 审核台豆瓣信息折叠块
 * UX-11: matched/candidate/unmatched/pending 四态
 * META-07: candidate 态新增字段级对比 UI + 置信度展示 + 选中字段应用
 */

'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import type { DoubanStatus } from '@/types'

interface DoubanCandidate {
  id: string
  title: string
  year: string | null
  sub_title: string | null
}

interface FieldDiff {
  field: string
  label: string
  current: string | null
  proposed: string | null
  changed: boolean
}

interface CandidateComparison {
  externalRefId: string
  externalId: string
  confidence: number | null
  matchMethod: string | null
  breakdown: Record<string, number> | null
  diffs: FieldDiff[]
}

interface ModerationDoubanBlockProps {
  videoId: string
  doubanStatus: DoubanStatus
  doubanId: string | null
  rating: number | null
  description: string | null
  directors: string[]
  cast: string[]
  onUpdated: () => void
}

// ── 子组件 ────────────────────────────────────────────────────────

function CandidateInfo({ doubanId, rating, directors, cast, description }: {
  doubanId: string | null
  rating: number | null
  directors: string[]
  cast: string[]
  description: string | null
}) {
  return (
    <div className="space-y-0.5 text-xs text-[var(--muted)]">
      {doubanId && <p>豆瓣 ID：<span className="text-[var(--text)]">{doubanId}</span></p>}
      {rating != null && <p>评分：<span className="text-[var(--text)]">{rating.toFixed(1)}</span></p>}
      {directors.length > 0 && <p>导演：<span className="text-[var(--text)]">{directors.slice(0, 3).join(' / ')}</span></p>}
      {cast.length > 0 && <p>主演：<span className="text-[var(--text)]">{cast.slice(0, 3).join(' / ')}</span></p>}
      {description && <p className="line-clamp-2">{description}</p>}
    </div>
  )
}

/** META-07: 字段级对比表格 */
function FieldComparisonTable({
  diffs,
  selected,
  onToggle,
}: {
  diffs: FieldDiff[]
  selected: Set<string>
  onToggle: (field: string) => void
}) {
  const changedDiffs = diffs.filter((d) => d.changed)
  const sameDiffs = diffs.filter((d) => !d.changed)

  if (changedDiffs.length === 0) {
    return <p className="text-[10px] text-[var(--muted)]">候选值与当前值完全一致</p>
  }

  return (
    <div className="space-y-1" data-testid="field-comparison-table">
      <p className="text-[10px] text-[var(--muted)]">勾选要应用的字段：</p>
      <div className="rounded border border-[var(--border)] divide-y divide-[var(--border)]">
        {changedDiffs.map((d) => (
          <label
            key={d.field}
            className="flex cursor-pointer items-start gap-2 px-2 py-1.5 hover:bg-[var(--bg3)]"
            data-testid={`field-diff-${d.field}`}
          >
            <input
              type="checkbox"
              checked={selected.has(d.field)}
              onChange={() => onToggle(d.field)}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[var(--text)]">{d.label}</p>
              <p className="truncate text-[10px] text-[var(--muted)]">
                当前：<span>{d.current ?? '（空）'}</span>
              </p>
              <p className="truncate text-[10px] text-[var(--accent)]">
                候选：<span>{d.proposed ?? '（空）'}</span>
              </p>
            </div>
          </label>
        ))}
        {sameDiffs.length > 0 && (
          <div className="px-2 py-1">
            <p className="text-[10px] text-[var(--muted)]">
              {sameDiffs.map((d) => d.label).join('、')} 与当前值一致，无需应用
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function ModerationDoubanBlock({
  videoId, doubanStatus, doubanId, rating, description, directors, cast, onUpdated,
}: ModerationDoubanBlockProps) {
  const [keyword, setKeyword] = useState('')
  const [candidates, setCandidates] = useState<DoubanCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [ignoring, setIgnoring] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // META-07: 候选对比数据
  const [comparison, setComparison] = useState<CandidateComparison | null>(null)
  const [compLoading, setCompLoading] = useState(false)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())

  // 进入候选态时加载对比数据
  useEffect(() => {
    if (doubanStatus !== 'candidate') return
    setCompLoading(true)
    apiClient
      .get<{ data: CandidateComparison }>(`/admin/moderation/${videoId}/douban-candidate`)
      .then((res) => {
        setComparison(res.data)
        // 默认勾选所有有变化的字段
        setSelectedFields(new Set(res.data.diffs.filter((d) => d.changed).map((d) => d.field)))
      })
      .catch(() => { /* 无候选数据时静默，保持原有显示 */ })
      .finally(() => setCompLoading(false))
  }, [videoId, doubanStatus])

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  async function handleSearch() {
    if (!keyword.trim()) return
    setSearching(true)
    setMsg(null)
    try {
      const res = await apiClient.post<{ data: { candidates: DoubanCandidate[] } }>(
        `/admin/moderation/${videoId}/douban-search`,
        { keyword: keyword.trim() }
      )
      setCandidates(res.data.candidates)
      if (res.data.candidates.length === 0) setMsg('未找到匹配结果')
    } catch {
      setMsg('搜索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  async function handleConfirm(subjectId: string) {
    setConfirming(subjectId)
    setMsg(null)
    try {
      await apiClient.post(`/admin/moderation/${videoId}/douban-confirm`, { subjectId })
      setMsg('已成功应用豆瓣信息')
      setCandidates([])
      setKeyword('')
      onUpdated()
    } catch {
      setMsg('确认失败，请重试')
    } finally {
      setConfirming(null)
    }
  }

  async function handleConfirmFields(subjectId: string) {
    if (selectedFields.size === 0) { setMsg('请至少选择一个字段'); return }
    setConfirming(subjectId)
    setMsg(null)
    try {
      await apiClient.post(`/admin/moderation/${videoId}/douban-confirm-fields`, {
        subjectId,
        fields: [...selectedFields],
      })
      setMsg('已成功应用选中字段')
      onUpdated()
    } catch {
      setMsg('确认失败，请重试')
    } finally {
      setConfirming(null)
    }
  }

  async function handleIgnore() {
    setIgnoring(true)
    setMsg(null)
    try {
      await apiClient.post(`/admin/moderation/${videoId}/douban-ignore`, {})
      setMsg('已标记为未匹配')
      onUpdated()
    } catch {
      setMsg('操作失败，请重试')
    } finally {
      setIgnoring(false)
    }
  }

  async function handleResync() {
    setSyncing(true)
    setMsg(null)
    try {
      await apiClient.post(`/admin/videos/${videoId}/douban-sync`, {})
      setMsg('重新同步完成')
      onUpdated()
    } catch {
      setMsg('同步失败，请重试')
    } finally {
      setSyncing(false)
    }
  }

  const statusHint: Record<DoubanStatus, string> = {
    pending:   '自动匹配尚未完成，可手动搜索绑定',
    candidate: '系统找到疑似条目，请确认或忽略',
    unmatched: '未找到可靠匹配，可手动搜索',
    matched:   '已绑定豆瓣条目，可重新搜索修正',
  }

  return (
    <div className="space-y-2" data-testid="douban-block">

      {/* 状态说明 */}
      <p className="text-[10px] text-[var(--muted)]" data-testid="douban-status-hint">
        {statusHint[doubanStatus]}
      </p>

      {/* 已匹配：展示信息 + 重新同步 */}
      {doubanStatus === 'matched' && (
        <div className="space-y-1.5">
          <CandidateInfo
            doubanId={doubanId} rating={rating} directors={directors}
            cast={cast} description={description}
          />
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleResync()}
            data-testid="douban-resync-btn"
            className="rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--bg3)] disabled:opacity-50"
          >
            {syncing ? '同步中…' : '重新同步'}
          </button>
        </div>
      )}

      {/* 候选：META-07 字段级对比 UI */}
      {doubanStatus === 'candidate' && (
        <div className="space-y-2">
          {/* 置信度标签 + breakdown */}
          {comparison && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                {comparison.confidence != null && (
                  <span
                    className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
                    data-testid="douban-confidence-badge"
                  >
                    置信度 {(comparison.confidence * 100).toFixed(0)}%
                  </span>
                )}
                {comparison.matchMethod && (
                  <span className="text-[10px] text-[var(--muted)]">
                    {comparison.matchMethod === 'title' ? '标题匹配' :
                     comparison.matchMethod === 'alias' ? '别名匹配' :
                     comparison.matchMethod === 'imdb_id' ? 'IMDB 精确' :
                     comparison.matchMethod === 'network' ? '网络搜索' :
                     comparison.matchMethod}
                  </span>
                )}
              </div>
              {comparison.breakdown && Object.keys(comparison.breakdown).length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid="douban-confidence-breakdown">
                  {Object.entries(comparison.breakdown).map(([key, val]) => (
                    <span
                      key={key}
                      className="rounded px-1 py-0.5 text-[9px]"
                      style={{
                        color: 'var(--muted-foreground)',
                        background: 'color-mix(in srgb, var(--muted-foreground) 8%, transparent)',
                      }}
                    >
                      {key} +{(val * 100).toFixed(0)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 字段对比表格 */}
          {compLoading && <p className="text-[10px] text-[var(--muted)]">加载候选数据中…</p>}
          {!compLoading && comparison && (
            <FieldComparisonTable
              diffs={comparison.diffs}
              selected={selectedFields}
              onToggle={toggleField}
            />
          )}
          {/* fallback：无对比数据时显示原始候选信息 */}
          {!compLoading && !comparison && (
            <CandidateInfo
              doubanId={doubanId} rating={rating} directors={directors}
              cast={cast} description={description}
            />
          )}

          {/* 操作按钮 */}
          {comparison && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={confirming != null}
                onClick={() => void handleConfirm(comparison.externalId)}
                data-testid="douban-confirm-all-btn"
                className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
              >
                {confirming === comparison.externalId ? '确认中…' : '应用全部'}
              </button>
              <button
                type="button"
                disabled={confirming != null || selectedFields.size === 0}
                onClick={() => void handleConfirmFields(comparison.externalId)}
                data-testid="douban-confirm-fields-btn"
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--bg3)] disabled:opacity-50"
              >
                {confirming != null && confirming !== comparison.externalId ? '确认中…' : `只应用选中（${selectedFields.size}）`}
              </button>
              <button
                type="button"
                disabled={ignoring}
                onClick={() => void handleIgnore()}
                data-testid="douban-ignore-btn"
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:bg-[var(--bg3)] disabled:opacity-50"
              >
                {ignoring ? '处理中…' : '标记为不匹配'}
              </button>
            </div>
          )}
          {/* fallback 无对比数据时的操作 */}
          {!comparison && !compLoading && doubanId && (
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={confirming != null}
                onClick={() => void handleConfirm(doubanId)}
                data-testid="douban-confirm-current-btn"
                className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
              >
                {confirming === doubanId ? '确认中…' : '应用此豆瓣条目'}
              </button>
              <button
                type="button"
                disabled={ignoring}
                onClick={() => void handleIgnore()}
                data-testid="douban-ignore-btn"
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:bg-[var(--bg3)] disabled:opacity-50"
              >
                {ignoring ? '处理中…' : '标记为不匹配'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 搜索区：所有状态均可手动搜索重新匹配 */}
      <div className="space-y-1">
        {doubanStatus === 'candidate' && (
          <p className="text-[10px] text-[var(--muted)]">或搜索其他条目重新匹配</p>
        )}
        <div className="flex gap-1.5">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
            placeholder="搜索关键词"
            data-testid="douban-search-input"
            className="flex-1 rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--muted)]"
          />
          <button
            type="button"
            disabled={searching || !keyword.trim()}
            onClick={() => void handleSearch()}
            data-testid="douban-search-btn"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg3)] disabled:opacity-50"
          >
            {searching ? '搜索中…' : '搜索'}
          </button>
        </div>
        {msg && <p className="text-[10px] text-[var(--muted)]" data-testid="douban-msg">{msg}</p>}
        {candidates.length > 0 && (
          <>
            <p className="text-[10px] text-[var(--muted)]" data-testid="douban-overwrite-hint">
              确认后将覆盖：标题、简介、评分、封面（如豆瓣有相应数据）
            </p>
            <ul className="mt-1 space-y-1">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[var(--text)]">{c.title}</p>
                    <p className="text-[10px] text-[var(--muted)]">{c.year ?? '未知年份'}{c.sub_title ? ` · ${c.sub_title}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    disabled={confirming === c.id}
                    onClick={() => void handleConfirm(c.id)}
                    data-testid={`douban-confirm-btn-${c.id}`}
                    className="ml-2 shrink-0 rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                  >
                    {confirming === c.id ? '确认中…' : '应用此豆瓣条目'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
