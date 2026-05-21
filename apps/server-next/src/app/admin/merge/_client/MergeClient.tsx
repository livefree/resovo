'use client'

/**
 * MergeClient.tsx — `/admin/merge` 合并/拆分工作台主组件（CHG-SN-5-12 / ADR-105 / CHG-SN-7-MISC-MERGE-1/2）
 *
 * 范围：Segment 3 视图 + PageHeader 拆分工作台入口
 *   1. 待审候选 Segment — DataTable 一体化 + 行展开（card 形态左右对比 + 影响预览 + 置信度 pill）+ merge action
 *   2. 已合并 Segment — AuditSection pre-filter action='merge'
 *   3. 已拆分 Segment — AuditSection pre-filter action='split'
 *   4. 拆分工作台 — PageHeader action 按钮 toggle SplitSection
 *
 * 端点消费（ADR-105 §端点契约 4 端点）：
 *   GET  /admin/video-merges/candidates   — candidate 预览
 *   POST /admin/video-merges              — merge 执行
 *   POST /admin/video-merges/:auditId/unmerge — unmerge 撤销（merge 成功后 toast action）
 *   POST /admin/videos/:id/split          — split 拆分
 *
 * 原语消费（≥ 6 件，ADR-105 §验证）：
 *   PageHeader / AdminButton / AdminInput / AdminCard / DataTable / LoadingState /
 *   ErrorState / EmptyState / Segment / useToast = 10 件
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
  Segment,
  useToast,
  type TableColumn,
  type SegmentItem,
} from '@resovo/admin-ui'
import type { CandidateGroup, VideoSummaryForMerge } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos } from '@/lib/merge/api'
import { ApiClientError } from '@/lib/api-client'
import { SplitSection } from './MergeSplitSection'
import { AuditSection } from './MergeAuditSection'

// ── 错误码差异化 description（ADR-105 §错误码 + CHG-SN-5-12-PATCH P0/P2-1）─────

export function describeError(err: unknown, context: 'merge' | 'split'): string {
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

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const SEGMENT_ITEMS: readonly SegmentItem[] = [
  { value: 'candidates', label: '待审候选' },
  { value: 'merged',     label: '已合并' },
  { value: 'split',      label: '已拆分' },
]

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

// CHG-SN-5-12-PATCH P2-2：推荐 target 显式 badge
const RECOMMENDED_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  marginLeft: '6px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

// CHG-SN-7-MISC-MERGE-2：CandidateExpand card 形态样式
const EXPAND_PANEL_STYLE: CSSProperties = {
  padding: '12px 16px',
  background: 'var(--bg-surface-elevated)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const CONFIDENCE_PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

const VIDEO_CARD_STYLE: CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  cursor: 'pointer',
}

const VIDEO_CARD_SELECTED_STYLE: CSSProperties = {
  border: '1px solid var(--state-success-border)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  cursor: 'pointer',
  background: 'var(--state-success-bg)',
}

const IMPACT_PREVIEW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px 10px',
  borderRadius: '6px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}

// ── 主组件 ─────────────────────────────────────────────────────────

type SegmentTab = 'candidates' | 'merged' | 'split'

export function MergeClient() {
  const [tab, setTab] = useState<SegmentTab>('candidates')
  const [showSplit, setShowSplit] = useState(false)

  return (
    <div style={PAGE_STYLE}>
      <PageHeader
        title="合并 / 拆分工作台"
        subtitle="ADR-105 视图卡：candidate 预览 + merge / unmerge / split + audit timeline 5 端点消费"
        actions={
          <AdminButton size="sm" variant="secondary" onClick={() => setShowSplit((v) => !v)}>
            {showSplit ? '收起拆分' : '拆分工作台'}
          </AdminButton>
        }
      />

      {showSplit && (
        <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px' }}>
            <SplitSection />
          </div>
        </AdminCard>
      )}

      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div style={{ padding: '12px 16px 0' }}>
          <Segment
            items={SEGMENT_ITEMS}
            value={tab}
            onChange={(v) => setTab(v as SegmentTab)}
            size="md"
            aria-label="合并视图"
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
          {tab === 'candidates' ? <CandidatesSection />
            : tab === 'merged' ? <AuditSection initialAction="merge" />
            : <AuditSection initialAction="split" />}
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
        // CHG-SN-5-12-PATCH P0：用 ApiClientError.code 而非 message 字符串匹配
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

// ── Candidate 行展开 panel（card 形态，CHG-SN-7-MISC-MERGE-2）─────

interface CandidateExpandProps {
  group: CandidateGroup
  onMerge: (targetVideoId: string) => void
}

function CandidateExpand({ group, onMerge }: CandidateExpandProps) {
  const [targetId, setTargetId] = useState(group.recommendedTargetVideoId)
  const targetVideo = group.videos.find((v) => v.id === targetId)
  const sourceVideos = group.videos.filter((v) => v.id !== targetId)

  return (
    <div style={EXPAND_PANEL_STYLE}>
      {/* 置信度 pill + 候选数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={CONFIDENCE_PILL_STYLE} data-testid="confidence-pill">
          {(group.score * 100).toFixed(1)}% 置信度
        </span>
        <span style={SECONDARY_TEXT}>{group.videos.length} 个候选视频</span>
      </div>

      {/* 视频卡片网格（左右对比） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        {group.videos.map((v: VideoSummaryForMerge) => (
          <div
            key={v.id}
            style={v.id === targetId ? VIDEO_CARD_SELECTED_STYLE : VIDEO_CARD_STYLE}
            onClick={() => setTargetId(v.id)}
            data-testid={`candidate-card-${v.id}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <input
                type="radio"
                name={`target-${group.groupKey}`}
                checked={targetId === v.id}
                onChange={() => setTargetId(v.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`选择 ${v.title} 为合并目标`}
              />
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{v.title}</span>
              {v.id === group.recommendedTargetVideoId && (
                <span style={RECOMMENDED_BADGE_STYLE} aria-label="推荐合并目标">推荐</span>
              )}
            </div>
            <div style={SECONDARY_TEXT}>{v.sourceCount} 个源</div>
            <div style={{ ...SECONDARY_TEXT, fontSize: '11px' }}>
              {v.sourceSiteKeys.join(' · ') || '—'}
            </div>
            <div style={{ ...SECONDARY_TEXT, fontSize: '11px' }}>{v.createdAt.slice(0, 10)}</div>
          </div>
        ))}
      </div>

      {/* 影响预览 */}
      {sourceVideos.length > 0 && (
        <div style={IMPACT_PREVIEW_STYLE} data-testid="impact-preview">
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            影响预览：{sourceVideos.length} 个源视频将合并到 {targetVideo?.title ?? '—'}
          </span>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {sourceVideos.map((v) => (
              <li key={v.id}>
                {v.title}（{v.sourceCount} 个源{v.sourceSiteKeys.length > 0 ? `，${v.sourceSiteKeys.join('、')}` : ''}）
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AdminButton size="sm" variant="primary" onClick={() => onMerge(targetId)}>
          执行合并（{group.videos.length - 1} → target）
        </AdminButton>
      </div>
    </div>
  )
}
