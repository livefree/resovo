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
import type { CandidateGroup, VideoSummaryForMerge, LineMatrixRow, VideoType, MergeAuditRow } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos, splitVideo, listAudit } from '@/lib/merge/api'
import { getVideoMatrix } from '@/lib/sources/api'
import { ApiClientError } from '@/lib/api-client'

// ── 错误码差异化 description（ADR-105 §错误码 + CHG-SN-5-12-PATCH P0/P2-1）─────

function describeError(err: unknown, context: 'merge' | 'split'): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'STATE_CONFLICT') {
      return context === 'merge'
        ? `${err.message}（建议先到 /admin/sources 处理冲突）`
        : `${err.message}（视频可能已被合并，请先 unmerge）`
    }
    if (err.code === 'NOT_FOUND') {
      return context === 'merge'
        ? `${err.message}（请刷新候选列表后重试）`
        : `${err.message}（videoId 可能已删除）`
    }
    if (err.code === 'VALIDATION_ERROR') {
      return context === 'merge'
        ? `参数校验失败：${err.message}`
        : `groups 校验失败：${err.message}`
    }
    return err.message
  }
  return err instanceof Error ? err.message : '未知错误'
}

// ── VideoType 枚举（ADR-105 §端点契约 SplitSchema newVideoMeta.type）──────────

const VIDEO_TYPES: readonly { value: VideoType; label: string }[] = [
  { value: 'movie',       label: '电影' },
  { value: 'series',      label: '剧集' },
  { value: 'anime',       label: '动漫' },
  { value: 'variety',     label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short',       label: '短片' },
  { value: 'sports',      label: '体育' },
  { value: 'music',       label: '音乐' },
  { value: 'news',        label: '资讯' },
  { value: 'kids',        label: '少儿' },
  { value: 'other',       label: '其他' },
]

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
  // CHG-SN-5-13-PATCH-2：删 `font: 'inherit'` shorthand（与 fontWeight longhand 冲突；React 警告）
  return {
    padding: '8px 16px',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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

// CHG-SN-5-12-PATCH P2-2：推荐 target 显式 badge（替代仅 bg 颜色识别弱）
const RECOMMENDED_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  marginLeft: '8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

// ── 主组件 ─────────────────────────────────────────────────────────

// CHG-SN-6-AUDIT-TIMELINE-B (RETRO 4/7-B)：加 audit timeline tab
type Tab = 'candidates' | 'split' | 'audit'

export function MergeClient() {
  const [tab, setTab] = useState<Tab>('candidates')

  return (
    <div style={PAGE_STYLE}>
      <PageHeader
        title="合并 / 拆分工作台"
        subtitle="ADR-105 视图卡：candidate 预览 + merge / unmerge / split + audit timeline 5 端点消费"
      />

      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div style={{ ...TAB_BAR_STYLE, padding: '0 16px' }}>
          <button type="button" style={tabStyle(tab === 'candidates')} onClick={() => setTab('candidates')}>
            合并候选
          </button>
          <button type="button" style={tabStyle(tab === 'split')} onClick={() => setTab('split')}>
            拆分工作台
          </button>
          <button type="button" style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>
            审计历史
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
          {tab === 'candidates' ? <CandidatesSection />
            : tab === 'split' ? <SplitSection />
            : <AuditSection />}
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
        // CHG-SN-5-12-PATCH P0：用 ApiClientError.code 而非 message 字符串匹配（err.message 是中文文案不含 STATE_CONFLICT）
        toast.push({
          level: 'danger',
          title: '合并失败',
          description: describeError(err, 'merge'),
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
              <td style={{ padding: '6px 8px' }}>
                {v.title}
                {v.id === group.recommendedTargetVideoId && (
                  <span style={RECOMMENDED_BADGE_STYLE} aria-label="推荐合并目标">推荐</span>
                )}
              </td>
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
  // CHG-SN-5-12-PATCH P2：每组独立 title + type（替代 type 硬编码 'movie'）
  const [groupMetas, setGroupMetas] = useState<{ title: string; type: VideoType }[]>([
    { title: '分集 A', type: 'movie' },
    { title: '分集 B', type: 'movie' },
  ])
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
    // 按 assignments 构造 groups（CHG-SN-5-12-PATCH P2：type 来自 groupMetas[i].type 而非硬编码）
    const groups = Array.from({ length: groupCount }, (_, i) => {
      const meta = groupMetas[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType }
      return {
        sourceIds: Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id),
        newVideoMeta: { title: meta.title, type: meta.type },
      }
    }).filter((g) => g.sourceIds.length > 0)

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
      // CHG-SN-5-12-PATCH P0 + P2：按 ApiClientError.code 差异化（NOT_FOUND / STATE_CONFLICT / VALIDATION_ERROR）
      toast.push({
        level: 'danger',
        title: '拆分失败',
        description: describeError(err, 'split'),
      })
    }
  }, [activeVideoId, lines, groupCount, assignments, groupMetas, toast])

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
                setGroupMetas((prev) => Array.from({ length: n }, (_, i) =>
                  prev[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType },
                ))
              }}
              style={{ width: '80px' }}
            />
            <span style={SECONDARY_TEXT}>每组 source 必须 ≥ 1 且全 source 必须有分配</span>
          </div>

          {/* 每组 title + type 输入（CHG-SN-5-12-PATCH P2：type select 替代硬编码 movie）*/}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupCount}, 1fr)`, gap: '8px' }}>
            {Array.from({ length: groupCount }).map((_, i) => {
              const meta = groupMetas[i] ?? { title: '', type: 'movie' as VideoType }
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <AdminInput
                    size="sm"
                    placeholder={`分集 ${String.fromCharCode(65 + i)} 标题`}
                    value={meta.title}
                    onChange={(e) => {
                      setGroupMetas((prev) => {
                        const next = [...prev]
                        next[i] = { ...meta, title: e.target.value }
                        return next
                      })
                    }}
                  />
                  <select
                    aria-label={`分集 ${String.fromCharCode(65 + i)} 类型`}
                    value={meta.type}
                    onChange={(e) => {
                      setGroupMetas((prev) => {
                        const next = [...prev]
                        next[i] = { ...meta, type: e.target.value as VideoType }
                        return next
                      })
                    }}
                    style={{
                      padding: '4px 6px',
                      background: 'var(--bg-surface)',
                      color: 'var(--fg-default)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '4px',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {VIDEO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
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
                          <option key={i} value={i}>{groupMetas[i]?.title ?? `分集 ${String.fromCharCode(65 + i)}`}</option>
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

// ── Audit timeline section（CHG-SN-6-AUDIT-TIMELINE-B / RETRO 4/7-B）─────────

function AuditSection() {
  const [actionFilter, setActionFilter] = useState<'all' | 'merge' | 'split'>('all')
  const [rows, setRows] = useState<readonly MergeAuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listAudit({
      action: actionFilter === 'all' ? undefined : actionFilter,
      limit: PAGE_SIZE,
      page,
    })
      .then((res) => {
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [actionFilter, page])

  useEffect(() => { load() }, [load])

  if (loading && rows.length === 0) return <LoadingState variant="skeleton" skeletonRows={6} />
  if (error) return <ErrorState error={error} onRetry={load} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={SECONDARY_TEXT}>过滤：</span>
        {(['all', 'merge', 'split'] as const).map((a) => (
          <AdminButton
            key={a}
            size="sm"
            variant={actionFilter === a ? 'primary' : 'secondary'}
            onClick={() => { setActionFilter(a); setPage(1) }}
          >
            {a === 'all' ? '全部' : a === 'merge' ? '合并' : '拆分'}
          </AdminButton>
        ))}
        <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>共 {total} 条</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="无审计记录" description="当前过滤无匹配；切换过滤或清空数据库后无 merge/split 操作。" />
      ) : (
        <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--fg-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '6px 8px', width: '80px' }}>操作</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>操作人</th>
              <th style={{ padding: '6px 8px' }}>涉及 video</th>
              <th style={{ padding: '6px 8px', width: '160px' }}>时间</th>
              <th style={{ padding: '6px 8px', width: '100px' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: row.action === 'merge' ? 'var(--state-info-fg)' : 'var(--state-warning-fg)' }}>
                  {row.action === 'merge' ? '合并' : '拆分'}
                </td>
                <td style={{ padding: '6px 8px' }}>{row.performedByUsername ?? row.performedBy.slice(0, 8)}</td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: '11px' }}>
                  {row.action === 'merge'
                    ? `${row.sourceVideoIds.length} → ${row.targetVideoIds.length}`
                    : `${row.sourceVideoIds.length} → ${row.targetVideoIds.length}（拆分）`}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>
                  {row.performedAt.slice(0, 19).replace('T', ' ')}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {row.revertedAt
                    ? <span style={SCORE_BADGE_STYLE}>已撤销</span>
                    : <span style={SECONDARY_TEXT}>有效</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 分页 */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={SECONDARY_TEXT}>第 {page} / {Math.ceil(total / PAGE_SIZE)} 页</span>
          <AdminButton size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</AdminButton>
          <AdminButton size="sm" variant="secondary" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>下一页</AdminButton>
        </div>
      )}
    </div>
  )
}
