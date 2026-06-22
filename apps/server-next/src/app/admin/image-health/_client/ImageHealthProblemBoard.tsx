'use client'

/**
 * ImageHealthProblemBoard.tsx — 问题图片可视化治理板（ADR-211 / 设计 §4·§6 / IMGH-P3-4B）
 *
 * 健康概览全宽板：运营看真实缩略图人眼分诊失效图（数据信号不可靠，以实际渲染为准），
 * 点卡进 ImageGovernanceDrawer 处置（定位该 kind）。supersede ADR-210 破损样本区。
 *
 * 编排：
 *   ① kind Segment（封面/背景/台标/Banner，badge=counts）+ scope Segment（仅已发布/全部，默认已发布）
 *   ② reason 状态子筛选 Segment（全部/真破损/低质量/待复核，客户端过滤——防 low_quality 淹没真坏，H-2）
 *   ③ 响应式网格 ProblemImageCard + 「加载更多」（offset 累积追加）
 *   ④ 自带 ImageGovernanceDrawer（focusKind 深链 = 点击卡的 kind）
 *
 * offset 漂移三缓解（ADR-211 D-211-4 / Codex H-3）：
 *   ① videoId+kind 去重追加（dedupeAppend，防重复行）
 *   ② 治理动作成功 → refreshKey++ 重拉当前页 + counts（防 total 失真）
 *   ③ 切 kind/scope → 主 effect 重置 rows+offset（非追加）
 */
import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  Segment,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@resovo/admin-ui'
import { ProblemImageCard } from './ProblemImageCard'
import { ImageGovernanceDrawer } from './ImageGovernanceDrawer'
import {
  getProblemImages,
  type ProblemImageRow,
  type ProblemImageKind,
  type ProblemImageScope,
  type ProblemImageCounts,
  type MissingVideoRow,
} from '@/lib/image-health/api'

const PAGE_LIMIT = 48

const EMPTY_COUNTS: ProblemImageCounts = { poster: 0, backdrop: 0, logo: 0, banner_backdrop: 0 }

const KIND_TABS: ReadonlyArray<{ readonly value: ProblemImageKind; readonly label: string }> = [
  { value: 'poster', label: '封面' },
  { value: 'backdrop', label: '背景' },
  { value: 'logo', label: '台标' },
  { value: 'banner_backdrop', label: 'Banner' },
]

const SCOPE_ITEMS: ReadonlyArray<{ readonly value: ProblemImageScope; readonly label: string }> = [
  { value: 'published', label: '仅已发布' },
  { value: 'all', label: '全部' },
]

type ReasonFilter = 'all' | 'broken' | 'unknown' | 'low_quality' | 'pending_review'
const REASON_ITEMS: ReadonlyArray<{ readonly value: ReasonFilter; readonly label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'broken', label: '真破损' },
  { value: 'unknown', label: '未验证' }, // ADR-213 D-213-7：status=ok 但久未复检（A-SCAN 超时/未达）→ 一键筛出排查
  { value: 'low_quality', label: '低质量' },
  { value: 'pending_review', label: '待复核' },
]

// 网格：缩略按类型比例由卡片各自 aspectRatio 决定；这里只定列宽
const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '12px',
  alignItems: 'start',
}

const CONTROLS_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px 16px',
  alignItems: 'center',
  marginBottom: '12px',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  marginTop: '12px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

// ProblemImageRow → 治理抽屉消费形（MissingVideoRow 结构兼容；problem-images 无 eventId →
// 板进抽屉「标记已解决」disabled，resolve 在 Tab B 治理表完整支持，gap 见任务卡）
function toGovernanceRow(p: ProblemImageRow): MissingVideoRow {
  return {
    videoId: p.videoId,
    catalogId: p.catalogId,
    title: p.title,
    posterStatus: p.status,
    posterUrl: p.imageUrl,
    posterSource: p.source,
    lastSeenBrokenAt: p.lastSeenBrokenAt,
    brokenDomain: p.brokenDomain,
    occurrenceCount: p.occurrenceCount,
    eventType: p.eventType,
    eventId: null,
    candidateCount: 0,
    hasHighConfidenceCandidate: false,
  }
}

// ① videoId+kind 去重追加（per-video 范式对齐后端，ADR-211 D-211-4）
function dedupeAppend(
  prev: readonly ProblemImageRow[],
  next: readonly ProblemImageRow[],
): ProblemImageRow[] {
  const seen = new Set(prev.map((r) => `${r.videoId}::${r.kind}`))
  return [...prev, ...next.filter((r) => !seen.has(`${r.videoId}::${r.kind}`))]
}

export function ImageHealthProblemBoard() {
  const [kind, setKind] = useState<ProblemImageKind>('poster')
  const [scope, setScope] = useState<ProblemImageScope>('published')
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all')

  const [rows, setRows] = useState<readonly ProblemImageRow[]>([])
  const [counts, setCounts] = useState<ProblemImageCounts>(EMPTY_COUNTS)
  const [total, setTotal] = useState(0)
  /** 已请求到的 offset 上界（= 已请求页数 × PAGE_LIMIT），hasMore 与加载更多 offset 据此推 */
  const [requested, setRequested] = useState(PAGE_LIMIT)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [drawerRow, setDrawerRow] = useState<ProblemImageRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ③ 切 kind/scope/reasonFilter/refreshKey → 重置 rows+offset 拉第一页（非追加）
  //    reason 服务端过滤（IMGH-P4-REASON-SSF）：切子筛选触发重取，不再客户端过滤已加载行（消分页假空）
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getProblemImages({ kind, scope, offset: 0, limit: PAGE_LIMIT, reason: reasonFilter })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setCounts(res.counts)
        setTotal(res.total)
        setRequested(PAGE_LIMIT)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error('问题图片加载失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [kind, scope, reasonFilter, refreshKey])

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await getProblemImages({ kind, scope, offset: requested, limit: PAGE_LIMIT, reason: reasonFilter })
      // ① 去重追加（防边界重复行）
      setRows((prev) => dedupeAppend(prev, res.data))
      // ② 同步 counts/total（活动集随治理变化，防失真）
      setCounts(res.counts)
      setTotal(res.total)
      setRequested((r) => r + PAGE_LIMIT)
    } catch {
      // 加载更多失败不破坏已加载列表；下次重试（不弹错误态遮挡已有内容）
      setRequested((r) => r)
    } finally {
      setLoadingMore(false)
    }
  }, [kind, scope, requested, reasonFilter])

  // ② 治理动作成功 → 刷新当前页 + counts（重置子筛选不必要，rows 重拉后过滤即对）
  const handleMutated = useCallback(() => {
    setDrawerOpen(false)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleOpen = useCallback((row: ProblemImageRow) => {
    setDrawerRow(row)
    setDrawerOpen(true)
  }, [])

  // reason 子筛选已服务端化（IMGH-P4-REASON-SSF）：rows 即当前 reason 过滤后的结果，直接渲染（消客户端分页假空）

  const kindItems = useMemo(
    () => KIND_TABS.map((t) => ({ value: t.value, label: `${t.label} ${counts[t.value]}` })),
    [counts],
  )

  const hasMore = requested < total

  return (
    <AdminCard
      surface="plain"
      padding="md"
      header={{
        title: '问题图片 · 看图定夺',
        subtitle: '数据信号不可靠，以实际渲染为准；点卡进治理抽屉处置',
      }}
      data-testid="image-health-problem-board"
    >
      <div style={CONTROLS_STYLE}>
        <Segment
          items={kindItems}
          value={kind}
          onChange={(v) => setKind(v as ProblemImageKind)}
          size="sm"
          aria-label="问题图片类型"
          data-testid="problem-board-kind-segment"
        />
        <Segment
          items={SCOPE_ITEMS.map((s) => ({ value: s.value, label: s.label }))}
          value={scope}
          onChange={(v) => setScope(v as ProblemImageScope)}
          size="sm"
          aria-label="范围"
          data-testid="problem-board-scope-segment"
        />
        <Segment
          items={REASON_ITEMS.map((r) => ({ value: r.value, label: r.label }))}
          value={reasonFilter}
          onChange={(v) => setReasonFilter(v as ReasonFilter)}
          size="sm"
          aria-label="状态子筛选"
          data-testid="problem-board-reason-segment"
        />
      </div>

      {error ? (
        <ErrorState error={error} title="问题图片加载失败" onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : loading && rows.length === 0 ? (
        <LoadingState variant="skeleton" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无问题图片"
          description={reasonFilter === 'all' ? '该类型图片均健康或未配置' : '当前子筛选无命中，试试「全部」'}
        />
      ) : (
        <div style={GRID_STYLE} data-problem-grid>
          {rows.map((row) => (
            <ProblemImageCard key={`${row.videoId}::${row.kind}`} row={row} onOpen={handleOpen} />
          ))}
        </div>
      )}

      {!error && !loading && (
        <div style={FOOTER_STYLE} data-problem-footer>
          {hasMore && (
            <AdminButton
              variant="default"
              size="sm"
              loading={loadingMore}
              onClick={() => void handleLoadMore()}
              data-testid="problem-board-load-more"
            >
              加载更多
            </AdminButton>
          )}
          <span data-problem-count>
            已显示 {rows.length} · 共 {total} 条
          </span>
        </div>
      )}

      <ImageGovernanceDrawer
        open={drawerOpen}
        row={drawerRow ? toGovernanceRow(drawerRow) : null}
        focusKind={drawerRow?.kind ?? 'poster'}
        onClose={() => setDrawerOpen(false)}
        onMutated={handleMutated}
      />
    </AdminCard>
  )
}
