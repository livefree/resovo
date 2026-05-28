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
import { useRouter, useSearchParams } from 'next/navigation'
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
  VideoPicker,
  useToast,
  type TableColumn,
  type TableSortState,
  type SegmentItem,
  type PickerVideoItem,
} from '@resovo/admin-ui'
import type { CandidateGroup, VideoSummaryForMerge } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos } from '@/lib/merge/api'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'
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

  // CHG-SN-8-08：接收来自视频库的 ?candidate_a 深链
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidateAParam = searchParams.get('candidate_a')
  const fromParam = searchParams.get('from')
  // CHG-363-B：接收来自 PendingCenter 拆分按钮的 ?split=:videoId 深链
  const splitParam = searchParams.get('split')

  // showSplit 初始值：?split=:videoId 存在则自动展开 / 否则默认收起
  const [showSplit, setShowSplit] = useState<boolean>(!!splitParam)
  const dismissCandidateBanner = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('candidate_a')
    p.delete('from')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

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

      {/* CHG-SN-8-08：来自视频库行级「发起合并」深链 banner */}
      {candidateAParam && (
        <AdminCard
          surface="subtle"
          status="ok"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px' }}
          data-testid="merge-candidate-a-banner"
        >
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              已锁定候选 A：<code style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '11px' }}>{candidateAParam.slice(0, 8)}</code>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
              {fromParam === 'videos' ? '来自视频库行级操作；' : ''}请在下方候选列表中选择 B 完成合并（或在拆分工作台内手动操作）
            </span>
          </span>
          <AdminButton size="sm" variant="default" onClick={dismissCandidateBanner} data-testid="merge-candidate-a-clear">
            清除
          </AdminButton>
        </AdminCard>
      )}

      {/* CHG-SN-8-08-B：直接合并工作区（candidate_a 锁定后 VideoPicker 选 B + 立即合并）
          GAPS #G-merge-candidate-b-auto：URL ?candidate_b 自动填入 picker（来自审核台类似 tab 深链）*/}
      {candidateAParam && (
        <DirectMergeWorkspace
          candidateAId={candidateAParam}
          candidateBIdFromUrl={searchParams.get('candidate_b')}
          onMergeSuccess={dismissCandidateBanner}
        />
      )}

      {showSplit && (
        <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px' }}>
            <SplitSection initialVideoId={splitParam ?? undefined} />
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
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge sort 全栈打通 / Service 层 sort
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'desc' })
  const [data, setData] = useState<readonly CandidateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单守卫 + URL 透传
    const sortFieldGuarded: 'score' | 'videoCount' | 'year' | 'titleNormalized' | undefined =
      sort.field === 'score' || sort.field === 'videoCount' || sort.field === 'year' || sort.field === 'titleNormalized'
        ? sort.field
        : undefined
    listCandidates({
      minScore, limit: pageSize, page,
      ...(sortFieldGuarded ? { sortField: sortFieldGuarded, sortDir: sort.direction } : {}),
    })
      .then((res) => {
        setData(res.data)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [minScore, page, pageSize, sort])

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

  // EP-3-D（2026-05-24）+ ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：3 列 sort 全栈打通
  //   - 保留 kind: 'computed'（score/videoCount/title 都是 Service 派生 / 业务无 filter 意义）
  //   - 显式 enableSorting: true（kind='computed' 默认 false / AMD2 D-150-AMD2-2 灵活组合）
  //   - 后端 listCandidates 扩 sortField + sortDir 白名单 4 字段（Service 层 sort / 跨页不严格稳定）
  const columns = useMemo<TableColumn<CandidateGroup>[]>(() => [
    {
      id: 'titleNormalized',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈打通
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
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈打通
      header: '候选数',
      accessor: (g) => g.videos.length,
      cell: ({ row }) => <span>{row.videos.length} 条</span>,
    },
    {
      id: 'score',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈打通（默认 score DESC / 切 ASC 看低重合度）
      header: '重合度',
      accessor: (g) => g.score,
      cell: ({ row }) => <span style={SCORE_BADGE_STYLE}>{(row.score * 100).toFixed(1)}%</span>,
    },
  ], [])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 真 state 接通（非 hardcode）
    sort,
    filters: new Map(),
    columns: new Map(),
    selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
  }), [page, pageSize, sort])

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
          // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort patch 接通
          if (patch.sort) setSort(patch.sort)
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

// ── CHG-SN-8-08-B · 直接合并工作区（候选 A 锁定 → VideoPicker 选 B → 立即合并）─

interface DirectMergeWorkspaceProps {
  readonly candidateAId: string
  /** GAPS #G-merge-candidate-b-auto：从 URL ?candidate_b 注入；mount 时 fetch 一次注入 picker.value */
  readonly candidateBIdFromUrl: string | null
  readonly onMergeSuccess: () => void
}

function DirectMergeWorkspace({ candidateAId, candidateBIdFromUrl, onMergeSuccess }: DirectMergeWorkspaceProps) {
  const toast = useToast()
  const [candidateB, setCandidateB] = useState<PickerVideoItem | null>(null)
  const [merging, setMerging] = useState(false)

  // GAPS #G-merge-candidate-b-auto：URL 含 ?candidate_b 时一次性 fetch 注入 picker
  useEffect(() => {
    if (!candidateBIdFromUrl) return
    if (candidateB?.id === candidateBIdFromUrl) return
    if (candidateBIdFromUrl === candidateAId) return // B === A 时不自动注入（picker 校验也会拦）
    const ctrl = new AbortController()
    let cancelled = false
    videoPickerFetcher({ q: candidateBIdFromUrl, limit: 1, signal: ctrl.signal })
      .then((res) => {
        if (cancelled) return
        const found = res.items.find((it) => it.id === candidateBIdFromUrl)
        if (found) setCandidateB(found)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        // eslint-disable-next-line no-console
        console.error('DirectMergeWorkspace: candidate_b auto-fill fetch failed', err)
      })
    return () => { cancelled = true; ctrl.abort() }
  }, [candidateBIdFromUrl, candidateAId, candidateB?.id])

  const handleMerge = useCallback(async () => {
    if (!candidateB) {
      toast.push({ title: '请先选择候选 B', level: 'warn' })
      return
    }
    if (candidateB.id === candidateAId) {
      toast.push({ title: '候选 A 和 B 不能是同一视频', level: 'warn' })
      return
    }
    if (!confirm(`确认合并？\n\n以 A（${candidateAId.slice(0, 8)}）为主体保留；\nB（${candidateB.shortId} · ${candidateB.title}）将被合并到 A 后软删除。\n\n此操作可在审计日志撤销。`)) {
      return
    }
    setMerging(true)
    try {
      const result = await mergeVideos({
        sourceVideoIds: [candidateB.id],
        targetVideoId: candidateAId,
        reason: '从视频库行级 + Merge 页直接工作区',
      })
      toast.push({
        title: '合并成功',
        description: `auditId=${result.auditId.slice(0, 8)} · 已合并到 ${candidateAId.slice(0, 8)}`,
        level: 'success',
      })
      setCandidateB(null)
      onMergeSuccess()
    } catch (err: unknown) {
      toast.push({
        title: '合并失败',
        description: describeError(err, 'merge'),
        level: 'danger',
      })
    } finally {
      setMerging(false)
    }
  }, [candidateAId, candidateB, onMergeSuccess, toast])

  return (
    <AdminCard
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}
      data-testid="merge-direct-workspace"
    >
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--fg-default)' }}>
        直接合并工作区
      </div>
      <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
        以 A 为主体保留；选择 B 后点「立即合并」将 B 软删除并合并到 A
      </div>
      <VideoPicker
        label="候选 B（被合并到 A）"
        value={candidateB}
        onChange={setCandidateB}
        fetcher={videoPickerFetcher}
        required
        data-testid="merge-candidate-b-picker"
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <AdminButton
          size="sm"
          variant="primary"
          loading={merging}
          disabled={!candidateB || candidateB.id === candidateAId}
          onClick={() => void handleMerge()}
          data-testid="merge-direct-execute"
        >
          立即合并
        </AdminButton>
      </div>
    </AdminCard>
  )
}
