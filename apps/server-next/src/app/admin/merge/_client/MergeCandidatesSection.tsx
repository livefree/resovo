'use client'

/**
 * MergeCandidatesSection.tsx — `/admin/merge` 待审候选 Segment（CHG-VIR-9-C 拆自 MergeClient 500 行红线）
 *
 * 范围：CandidatesSection — DataTable 一体化 + source toggle（legacy 实时聚合 / identity 多证据）
 *   + 降级回显提示 + merge（identity 来源透传 candidateId / ADR-178 D-178-3 confirm 语义）
 *   + reject（POST /admin/identity-candidates/:id/reject）。
 *   行展开 panel 见 ./MergeCandidateExpand（500 行 budget 再拆）。
 *
 * 历史：CHG-SN-5-12 初版（MergeClient 内）→ CHG-SN-7-MISC-MERGE-2 card 形态
 *       → ADR-150 EP-4 sort 打通 → CHG-VIR-7 identity pill → CHG-VIR-9-C 拆出 + source 切换
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import {
  AdminButton,
  AdminInput,
  LoadingState,
  ErrorState,
  EmptyState,
  DataTable,
  Segment,
  useToast,
  type ColumnPreference,
  type TableColumn,
  type TableSortState,
  type SegmentItem,
} from '@resovo/admin-ui'
import type { CandidateGroup } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos } from '@/lib/merge/api'
import { rejectIdentityCandidate } from '@/lib/identity/api'
import { describeError } from './MergeClient'
import { CandidateExpand, SECONDARY_TEXT } from './MergeCandidateExpand'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

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

// CHG-VIR-9-C：identity→legacy 降级回显提示条
const FALLBACK_NOTE_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
}

// CHG-VIR-9-C：候选来源 toggle（merge 默认 legacy / 用户裁定 (a)，shadow 稳定后再翻默认）
type CandidateSource = 'legacy' | 'identity'

const SOURCE_ITEMS: readonly SegmentItem[] = [
  { value: 'legacy', label: '实时聚合' },
  { value: 'identity', label: '多证据' },
]

// ── Candidates section ────────────────────────────────────────────

export function CandidatesSection() {
  const [minScore, setMinScore] = useState(0.6)
  const [pendingMinScore, setPendingMinScore] = useState('0.6')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge sort 全栈打通 / Service 层 sort
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'desc' })
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  const [data, setData] = useState<readonly CandidateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  // CHG-VIR-9-C：候选来源（请求值）+ 服务端回显（identity 空表降级 legacy 时不一致）
  const [source, setSource] = useState<CandidateSource>('legacy')
  const [effectiveSource, setEffectiveSource] = useState<CandidateSource | null>(null)
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
      minScore, limit: pageSize, page, source,
      ...(sortFieldGuarded ? { sortField: sortFieldGuarded, sortDir: sort.direction } : {}),
    })
      .then((res) => {
        setData(res.data)
        setTotal(res.total)
        setEffectiveSource(res.source ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [minScore, page, pageSize, sort, source])

  useEffect(() => { load() }, [load])

  const handleMerge = useCallback(
    async (group: CandidateGroup, targetVideoId: string) => {
      const sourceVideoIds = group.videos.map((v) => v.id).filter((id) => id !== targetVideoId)
      try {
        // CHG-VIR-9-C：identity 来源透传 candidateId（confirm 语义 / 单事务挂 decision，ADR-178 D-178-3）
        const result = await mergeVideos({
          sourceVideoIds, targetVideoId,
          ...(group.candidateId ? { candidateId: group.candidateId } : {}),
        })
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

  // CHG-VIR-9-C：人工拒绝 identity 候选（pending→rejected）→ 刷新列表
  const handleReject = useCallback(
    async (group: CandidateGroup) => {
      if (!group.candidateId) return
      if (!confirm(`确认拒绝候选「${group.titleNormalized}」？\n\n拒绝后该候选不再出现在列表（复活由离线 job 在证据变化时重建）。`)) {
        return
      }
      try {
        await rejectIdentityCandidate(group.candidateId, '合并工作台人工拒绝')
        toast.push({ level: 'success', title: '已拒绝候选', description: group.titleNormalized })
        load()
      } catch (err: unknown) {
        toast.push({
          level: 'danger',
          title: '拒绝失败',
          description: err instanceof Error ? err.message : '未知错误',
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
      minWidth: 240, // 仅 minWidth（无 width）→ 列宽可调时作 flex 列吸收余量
      enableResizing: true,
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
      width: 110, minWidth: 90,
      enableResizing: true,
      cell: ({ row }) => <span>{row.videos.length} 条</span>,
    },
    {
      id: 'score',
      kind: 'computed',
      enableSorting: true, // ADR-150 阶段 5 EP-4 follow-up sort 全栈打通（默认 score DESC / 切 ASC 看低重合度）
      header: '重合度',
      accessor: (g) => g.score,
      width: 110, minWidth: 90,
      enableResizing: true,
      cell: ({ row }) => <span style={SCORE_BADGE_STYLE}>{(row.score * 100).toFixed(1)}%</span>,
    },
  ], [])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 真 state 接通（非 hardcode）
    sort,
    filters: new Map(),
    columns: columnPrefs,
    selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
  }), [page, pageSize, sort, columnPrefs])

  // CHG-VIR-9-C：source toggle 头部（所有状态可见，空态/错误态下也可切换）
  const sourceToolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={SECONDARY_TEXT}>候选来源</span>
      <Segment
        items={SOURCE_ITEMS}
        value={source}
        onChange={(v) => { setSource(v as CandidateSource); setPage(1) }}
        size="sm"
        aria-label="候选来源"
      />
      {source === 'identity' && effectiveSource === 'legacy' && !loading && (
        <span style={FALLBACK_NOTE_STYLE} data-testid="merge-source-fallback-note">
          多证据候选为空，已降级实时聚合
        </span>
      )}
      {/* identity 来源后端不消费 minScore（按 identity_score 排序）→ 仅 legacy 显示 */}
      {source === 'legacy' && (
        <>
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
        </>
      )}
      <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>共 {total} 组</span>
    </div>
  )

  if (loading && data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sourceToolbar}
        <LoadingState variant="skeleton" skeletonRows={6} />
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sourceToolbar}
        <ErrorState error={error} onRetry={load} />
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sourceToolbar}
        <EmptyState
          title="无合并候选"
          description={source === 'identity'
            ? '当前没有 pending 多证据候选；可切回实时聚合或等待离线 job 生成。'
            : '当前没有符合条件的候选组；调整 minScore 重试。'}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sourceToolbar}

      <DataTable<CandidateGroup>
        rows={data}
        columns={columns}
        rowKey={(g) => g.groupKey}
        mode="server"
        enableColumnResizing
        query={query}
        onQueryChange={(patch) => {
          if (patch.pagination) {
            if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
            if (patch.pagination.pageSize !== undefined) { setPageSize(patch.pagination.pageSize); setPage(1) }
          }
          // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort patch 接通
          if (patch.sort) setSort(patch.sort)
          if (patch.columns) setColumnPrefs(patch.columns)
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
          <CandidateExpand
            group={group}
            onMerge={(targetId) => handleMerge(group, targetId)}
            onReject={group.candidateId ? () => void handleReject(group) : undefined}
          />
        )}
        pagination={{ pageSizeOptions: [20, 50, 100] }}
      />
    </div>
  )
}
