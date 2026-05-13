'use client'

/**
 * MergeClient.tsx — `/admin/merge` 合并/拆分工作台主组件（CHG-SN-5-12 / ADR-105）
 *
 * 范围：2 tab 单页
 *   1. Candidates tab — DataTable 一体化 + 行展开（组内 videos + target 选择）+ merge action
 *   2. Split tab — videoId 输入 + 拉 sources matrix + 多组分配 + split action
 *
 * 端点消费（ADR-105 §端点契约 4 端点）：
 *   GET  /admin/video-merges/candidates   — candidate 预览
 *   POST /admin/video-merges              — merge 执行
 *   POST /admin/video-merges/:auditId/unmerge — unmerge 撤销（merge 成功后 toast action）
 *   POST /admin/videos/:id/split          — split 拆分
 *
 * 原语消费（≥ 6 件，ADR-105 §验证）：
 *   PageHeader / AdminButton / AdminInput / AdminCard / DataTable / LoadingState /
 *   ErrorState / EmptyState / useToast = 9 件
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminCard,
  LoadingState,
  ErrorState,
  EmptyState,
  DataTable,
  useToast,
  type TableColumn,
} from '@resovo/admin-ui'
import type { CandidateGroup, VideoSummaryForMerge, LineMatrixRow } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos, splitVideo } from '@/lib/merge/api'
import { getVideoMatrix } from '@/lib/sources/api'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const TAB_BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  borderBottom: '1px solid var(--border-subtle)',
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    font: 'inherit',
  }
}

const SCORE_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

// ── 主组件 ─────────────────────────────────────────────────────────

type Tab = 'candidates' | 'split'

export function MergeClient() {
  const [tab, setTab] = useState<Tab>('candidates')

  return (
    <div style={PAGE_STYLE}>
      <PageHeader
        title="合并 / 拆分工作台"
        subtitle="ADR-105 视图卡：candidate 预览 + merge / unmerge / split 4 端点消费"
      />

      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div style={{ ...TAB_BAR_STYLE, padding: '0 16px' }}>
          <button type="button" style={tabStyle(tab === 'candidates')} onClick={() => setTab('candidates')}>
            合并候选
          </button>
          <button type="button" style={tabStyle(tab === 'split')} onClick={() => setTab('split')}>
            拆分工作台
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
          {tab === 'candidates' ? <CandidatesSection /> : <SplitSection />}
        </div>
      </AdminCard>
    </div>
  )
}

// ── Candidates section ────────────────────────────────────────────

function CandidatesSection() {
  const [minScore, setMinScore] = useState(0.6)
  const [pendingMinScore, setPendingMinScore] = useState('0.6')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<readonly CandidateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listCandidates({ minScore, limit: pageSize, page })
      .then((res) => {
        setData(res.data)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [minScore, page, pageSize])

  useEffect(() => { load() }, [load])

  const handleMerge = useCallback(
    async (group: CandidateGroup, targetVideoId: string) => {
      const sourceVideoIds = group.videos.map((v) => v.id).filter((id) => id !== targetVideoId)
      try {
        const result = await mergeVideos({ sourceVideoIds, targetVideoId })
        toast.push({
          level: 'success',
          title: '合并成功',
          description: `已合并 ${sourceVideoIds.length} 个源到 ${result.targetVideo.title}`,
          action: {
            label: '撤销',
            onClick: () => {
              unmergeVideos(result.auditId, '用户撤销')
                .then(() => {
                  toast.push({ level: 'success', title: '已撤销合并' })
                  load()
                })
                .catch((err: unknown) => {
                  toast.push({
                    level: 'danger',
                    title: '撤销失败',
                    description: err instanceof Error ? err.message : '未知错误',
                  })
                })
            },
          },
        })
        load()
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误'
        toast.push({
          level: 'danger',
          title: '合并失败',
          description: msg.includes('STATE_CONFLICT') ? `${msg}（建议先到 /admin/sources 处理冲突）` : msg,
        })
      }
    },
    [toast, load],
  )

  const columns = useMemo<TableColumn<CandidateGroup>[]>(() => [
    {
      id: 'titleNormalized',
      header: '作品',
      accessor: (g) => g.titleNormalized,
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.titleNormalized}</div>
          <div style={SECONDARY_TEXT}>{row.year ?? '—'} · {row.type}</div>
        </div>
      ),
    },
    {
      id: 'videoCount',
      header: '候选数',
      accessor: (g) => g.videos.length,
      cell: ({ row }) => <span>{row.videos.length} 条</span>,
    },
    {
      id: 'score',
      header: '重合度',
      accessor: (g) => g.score,
      cell: ({ row }) => <span style={SCORE_BADGE_STYLE}>{(row.score * 100).toFixed(1)}%</span>,
    },
  ], [])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    sort: { field: undefined, direction: 'desc' as const },
    filters: new Map(),
    columns: new Map(),
    selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
  }), [page, pageSize])

  if (loading && data.length === 0) return <LoadingState variant="skeleton" skeletonRows={6} />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (data.length === 0) {
    return (
      <EmptyState
        title="无合并候选"
        description="当前没有符合条件的候选组；调整 minScore 重试。"
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={SECONDARY_TEXT}>minScore</span>
        <AdminInput
          size="sm"
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={pendingMinScore}
          onChange={(e) => setPendingMinScore(e.target.value)}
          style={{ width: '100px' }}
        />
        <AdminButton
          size="sm"
          variant="secondary"
          onClick={() => {
            const v = parseFloat(pendingMinScore)
            if (!Number.isNaN(v) && v >= 0 && v <= 1) {
              setMinScore(v)
              setPage(1)
            }
          }}
        >
          应用
        </AdminButton>
        <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>共 {total} 组</span>
      </div>

      <DataTable<CandidateGroup>
        rows={data}
        columns={columns}
        rowKey={(g) => g.groupKey}
        mode="server"
        query={query}
        onQueryChange={(patch) => {
          if (patch.pagination) {
            if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
            if (patch.pagination.pageSize !== undefined) { setPageSize(patch.pagination.pageSize); setPage(1) }
          }
        }}
        totalRows={total}
        loading={loading}
        onRowClick={(group) => {
          setExpandedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(group.groupKey)) next.delete(group.groupKey)
            else next.add(group.groupKey)
            return next
          })
        }}
        expandedKeys={expandedKeys}
        renderExpandedRow={(group) => (
          <CandidateExpand group={group} onMerge={(targetId) => handleMerge(group, targetId)} />
        )}
        pagination={{ pageSizeOptions: [20, 50, 100] }}
      />
    </div>
  )
}

// ── Candidate 行展开 panel ────────────────────────────────────────

interface CandidateExpandProps {
  group: CandidateGroup
  onMerge: (targetVideoId: string) => void
}

function CandidateExpand({ group, onMerge }: CandidateExpandProps) {
  const [targetId, setTargetId] = useState(group.recommendedTargetVideoId)

  return (
    <div style={{ padding: '12px 16px', background: 'var(--bg-surface-elevated)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={SECONDARY_TEXT}>选择 合并目标（target video）：推荐 source 最多的 video。</div>
      <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--fg-muted)' }}>
            <th style={{ padding: '4px 8px', width: '40px' }}>选</th>
            <th style={{ padding: '4px 8px' }}>title</th>
            <th style={{ padding: '4px 8px', width: '80px' }}>sources</th>
            <th style={{ padding: '4px 8px' }}>site keys</th>
            <th style={{ padding: '4px 8px', width: '140px' }}>created at</th>
          </tr>
        </thead>
        <tbody>
          {group.videos.map((v: VideoSummaryForMerge) => (
            <tr
              key={v.id}
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: v.id === group.recommendedTargetVideoId ? 'var(--state-success-bg)' : undefined,
              }}
            >
              <td style={{ padding: '6px 8px' }}>
                <input
                  type="radio"
                  name={`target-${group.groupKey}`}
                  checked={targetId === v.id}
                  onChange={() => setTargetId(v.id)}
                />
              </td>
              <td style={{ padding: '6px 8px' }}>{v.title}</td>
              <td style={{ padding: '6px 8px' }}>{v.sourceCount}</td>
              <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                {v.sourceSiteKeys.join(', ') || '—'}
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                {v.createdAt.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <AdminButton size="sm" variant="primary" onClick={() => onMerge(targetId)}>
          执行合并（{group.videos.length - 1} → target）
        </AdminButton>
      </div>
    </div>
  )
}

// ── Split section ─────────────────────────────────────────────────

function SplitSection() {
  const [videoIdInput, setVideoIdInput] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineMatrixRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [groupCount, setGroupCount] = useState(2)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [titles, setTitles] = useState<string[]>(['分集 A', '分集 B'])
  const toast = useToast()

  const loadMatrix = useCallback(() => {
    if (!videoIdInput.trim()) return
    setLoading(true)
    setError(null)
    setActiveVideoId(videoIdInput.trim())
    getVideoMatrix(videoIdInput.trim())
      .then((data) => {
        setLines(data)
        // 初始化 assignments：默认所有 sources → group 0
        const init: Record<string, number> = {}
        for (const line of data) {
          for (const ep of line.episodes) init[ep.sourceId] = 0
        }
        setAssignments(init)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [videoIdInput])

  const handleSplit = useCallback(async () => {
    if (!activeVideoId || !lines) return
    // 按 assignments 构造 groups
    const groups = Array.from({ length: groupCount }, (_, i) => ({
      sourceIds: Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id),
      newVideoMeta: { title: titles[i] ?? `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as const },
    })).filter((g) => g.sourceIds.length > 0)

    if (groups.length < 2) {
      toast.push({ level: 'warn', title: '拆分必须 ≥ 2 组', description: '每组至少 1 个 source' })
      return
    }

    try {
      const result = await splitVideo({ videoId: activeVideoId, groups })
      toast.push({
        level: 'success',
        title: '拆分成功',
        description: `已创建 ${result.newVideoIds.length} 个新 video（auditId: ${result.auditId.slice(0, 8)}）`,
        action: {
          label: '撤销',
          onClick: () => {
            unmergeVideos(result.auditId, '用户撤销拆分')
              .then(() => {
                toast.push({ level: 'success', title: '已撤销拆分' })
                setLines(null)
                setActiveVideoId(null)
              })
              .catch((err: unknown) => {
                toast.push({
                  level: 'danger',
                  title: '撤销失败',
                  description: err instanceof Error ? err.message : '未知错误',
                })
              })
          },
        },
      })
      setLines(null)
      setActiveVideoId(null)
    } catch (err) {
      toast.push({
        level: 'danger',
        title: '拆分失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }, [activeVideoId, lines, groupCount, assignments, titles, toast])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <AdminInput
          size="sm"
          placeholder="输入要拆分的 videoId (uuid)"
          value={videoIdInput}
          onChange={(e) => setVideoIdInput(e.target.value)}
          style={{ width: '320px' }}
        />
        <AdminButton size="sm" variant="primary" onClick={loadMatrix} disabled={!videoIdInput.trim()}>
          加载 sources
        </AdminButton>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" skeletonRows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={loadMatrix} />
      ) : !lines ? (
        <EmptyState title="尚未加载" description="输入 videoId 后点击 '加载 sources'" />
      ) : lines.length === 0 ? (
        <EmptyState title="无 sources" description="该视频暂无播放线路" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={SECONDARY_TEXT}>组数：</span>
            <AdminInput
              size="sm"
              type="number"
              min="2"
              max="20"
              value={String(groupCount)}
              onChange={(e) => {
                const n = Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2))
                setGroupCount(n)
                setTitles((prev) => Array.from({ length: n }, (_, i) =>
                  prev[i] ?? `分集 ${String.fromCharCode(65 + i)}`,
                ))
              }}
              style={{ width: '80px' }}
            />
            <span style={SECONDARY_TEXT}>每组 source 必须 ≥ 1 且全 source 必须有分配</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupCount}, 1fr)`, gap: '8px' }}>
            {Array.from({ length: groupCount }).map((_, i) => (
              <AdminInput
                key={i}
                size="sm"
                placeholder={`分集 ${String.fromCharCode(65 + i)} 标题`}
                value={titles[i] ?? ''}
                onChange={(e) => {
                  setTitles((prev) => {
                    const next = [...prev]
                    next[i] = e.target.value
                    return next
                  })
                }}
              />
            ))}
          </div>

          <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-muted)' }}>
                <th style={{ padding: '4px 8px' }}>线路</th>
                <th style={{ padding: '4px 8px' }}>集</th>
                <th style={{ padding: '4px 8px' }}>URL</th>
                <th style={{ padding: '4px 8px', width: '120px' }}>分配到</th>
              </tr>
            </thead>
            <tbody>
              {lines.flatMap((line) =>
                line.episodes.map((ep) => (
                  <tr key={ep.sourceId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px 8px' }}>{line.displayName ?? line.sourceName}</td>
                    <td style={{ padding: '6px 8px' }}>E{ep.episodeNumber}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: '11px', wordBreak: 'break-all' }}>
                      {ep.sourceUrl.slice(0, 60)}{ep.sourceUrl.length > 60 ? '…' : ''}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <select
                        value={assignments[ep.sourceId] ?? 0}
                        onChange={(e) =>
                          setAssignments((prev) => ({ ...prev, [ep.sourceId]: parseInt(e.target.value, 10) }))
                        }
                        style={{
                          padding: '2px 6px',
                          background: 'var(--bg-surface)',
                          color: 'var(--fg-default)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '4px',
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        {Array.from({ length: groupCount }).map((_, i) => (
                          <option key={i} value={i}>{titles[i] ?? `分集 ${String.fromCharCode(65 + i)}`}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <AdminButton size="sm" variant="primary" onClick={handleSplit}>
              执行拆分（{groupCount} 组）
            </AdminButton>
          </div>
        </>
      )}
    </div>
  )
}
