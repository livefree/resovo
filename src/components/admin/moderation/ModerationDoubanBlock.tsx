/**
 * ModerationDoubanBlock.tsx — 审核台豆瓣信息折叠块（UX-11）
 * matched:   显示已匹配信息 + [重新同步]
 * candidate: 显示当前候选信息 + [确认当前候选] + [忽略] + 手动搜索框
 * unmatched/pending: 显示手动搜索框
 * P2 fix: candidate 态补充确认/忽略动作
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { DoubanStatus } from '@/types'

interface DoubanCandidate {
  id: string
  title: string
  year: string | null
  sub_title: string | null
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

  // CHG-407: 状态说明文案
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

      {/* 候选：展示当前候选信息 + 确认 + 标记不匹配 + 重新搜索 */}
      {doubanStatus === 'candidate' && (
        <div className="space-y-1.5">
          <CandidateInfo
            doubanId={doubanId} rating={rating} directors={directors}
            cast={cast} description={description}
          />
          <div className="flex gap-1.5">
            {doubanId && (
              <button
                type="button"
                disabled={confirming != null}
                onClick={() => void handleConfirm(doubanId)}
                data-testid="douban-confirm-current-btn"
                className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
              >
                {confirming === doubanId ? '确认中…' : '应用此豆瓣条目'}
              </button>
            )}
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
            {/* CHG-407: 写入提示 */}
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
