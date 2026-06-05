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
  useToast,
  type ColumnPreference,
  type TableColumn,
  type TableSortState,
  type FilterValue,
} from '@resovo/admin-ui'
import type { CandidateGroup, VideoStatusSetting } from '@resovo/types'
import { listCandidates, mergeVideos, unmergeVideos } from '@/lib/merge/api'
// CHG-VIR-17-PARTIAL FIX（Codex review）：合并请求成形纯函数（target∈集合守卫 + 锚点过滤）
import { buildMergeSelection } from '@/lib/merge/merge-selection'
import { describeStatusTransition } from '@/lib/merge/status-defaults'
import { rejectIdentityCandidate } from '@/lib/identity/api'
import { describeError } from './MergeClient'
import { CandidateExpand, SECONDARY_TEXT } from './MergeCandidateExpand'
// D-105a-19（CHG-VIR-16-TBL-FE）：检索接线（filters → 参数纯函数 + 工具条搜索框）
import { buildCandidateSearchParams, MergeSearchInput } from './MergeCandidatesFilters'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

// CHG-VIR-9-C：identity→legacy 降级回显提示条
const FALLBACK_NOTE_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
}

// CHG-VIR-15-UX-A（用户裁定 ①）：来源 Segment toggle 退役——请求固定 identity
//（identity 空表自动降级 legacy，CHG-VIR-9-A 降级链路保留），来源改行级列呈现
//（行级真源 = g.identity 有无：多证据评分存在 → 多证据；降级 legacy → 实时聚合）。
type CandidateSource = 'legacy' | 'identity'

/** 来源列 chip（CSS 变量零硬编码） */
const SOURCE_CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: '11px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-subtle)',
  color: 'var(--fg-muted)',
}

// ── Candidates section ────────────────────────────────────────────

export function CandidatesSection() {
  const [minScore, setMinScore] = useState(0.6)
  const [pendingMinScore, setPendingMinScore] = useState('0.6')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：Merge sort 全栈打通 / Service 层 sort
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'desc' })
  const [columnPrefs, setColumnPrefs] = useState<ReadonlyMap<string, ColumnPreference>>(new Map())
  // D-105a-19（CHG-VIR-16-TBL-FE）：组级筛选/搜索（相似度区间 / 候选数区间 / q）
  const [filters, setFilters] = useState<ReadonlyMap<string, FilterValue>>(new Map())
  const [data, setData] = useState<readonly CandidateGroup[]>([])
  const [total, setTotal] = useState(0)
  // D-105a-19：identity 路径 cap 截断回显（警示条消费）
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  // CHG-VIR-15-UX-A：请求固定 identity（toggle 退役）；服务端回显（空表降级 legacy 时不一致）
  const [effectiveSource, setEffectiveSource] = useState<CandidateSource | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单守卫 + URL 透传
    // CHG-VIR-14-SCORE-UI：score 列退役（legacyScore 误导展示），守卫白名单同步去 score
    // D-105a-19（CHG-VIR-16-TBL-FE）：白名单扩 identityScore（相似度列排序）
    const sortFieldGuarded: 'videoCount' | 'year' | 'titleNormalized' | 'identityScore' | undefined =
      sort.field === 'videoCount' || sort.field === 'year' || sort.field === 'titleNormalized'
        || sort.field === 'identityScore'
        ? sort.field
        : undefined
    listCandidates({
      minScore, limit: pageSize, page, source: 'identity',
      ...(sortFieldGuarded ? { sortField: sortFieldGuarded, sortDir: sort.direction } : {}),
      // D-105a-19：filters Map → 检索参数（相似度 % → 0..1；候选数整数 ≥2；q 文本）
      ...buildCandidateSearchParams(filters),
    })
      .then((res) => {
        setData(res.data)
        setTotal(res.total)
        setTruncated(res.truncated === true)
        setEffectiveSource(res.source ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [minScore, page, pageSize, sort, filters])

  useEffect(() => { load() }, [load])

  const handleMerge = useCallback(
    async (
      group: CandidateGroup,
      targetVideoId: string,
      targetStatus?: VideoStatusSetting | null,
      // CHG-VIR-17-PARTIAL（D-105a-18 遗留 ① 兑现）：部分合并选中集合（含 target；
      // 缺省 = 整组，快捷合并路径不传）
      selectedVideoIds?: readonly string[],
    ) => {
      // CHG-VIR-17-PARTIAL FIX（Codex review）：请求成形收敛纯函数 buildMergeSelection——
      // target ∉ 选中集合 → null 结构性拒绝（被排除视频不得作为合并保留者，语义反转守卫；
      // 不再仅依赖 CandidateExpand target 转移 effect 时序）
      const selection = buildMergeSelection(group, targetVideoId, selectedVideoIds)
      if (!selection) {
        toast.push({
          level: 'danger',
          title: '合并未发起',
          description: '合并目标不在选中集合内，请重新选择目标或调整勾选',
        })
        return
      }
      const { sourceVideoIds, candidateIds } = selection
      try {
        const result = await mergeVideos({
          sourceVideoIds, targetVideoId,
          ...(candidateIds ? { candidateIds } : {}),
          // CHG-VIR-13-D2 / D-105-9：操作内状态设置（null/undefined = 不传字段零行为变更）
          ...(targetStatus ? { targetStatus } : {}),
        })
        // D-105-10 / R-105-T3：post-COMMIT 状态写入失败可观测 → 人工处理路径提示
        const transitionNote = describeStatusTransition(result.statusTransition)
        if (transitionNote) {
          toast.push({ level: transitionNote.level, title: '状态未变更', description: transitionNote.text })
        }
        toast.push({
          level: 'success',
          title: '合并成功',
          description: `已合并 ${sourceVideoIds.length} 个源到 ${result.targetVideo.title}`
            + (result.dedupedCount ? `（自动去重 ${result.dedupedCount} 条重复线路）` : ''),
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
  // CHG-VIR-9-D / D-105a-18：折叠后逐 pair reject（per-candidate 端点，K 次独立调用，
  // 不提供"拒绝整组"——前端循环非原子且分量内 pair 证据异质不应一刀切）
  const handleReject = useCallback(
    async (candidateId: string, label: string) => {
      if (!confirm(`确认拒绝候选「${label}」？\n\n拒绝后该候选对不再出现在列表（复活由离线 job 在证据变化时重建）。`)) {
        return
      }
      try {
        await rejectIdentityCandidate(candidateId, '合并工作台人工拒绝')
        toast.push({ level: 'success', title: '已拒绝候选', description: label })
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
      // D-105a-19 遗留 ③：text filter 复用 q 通道（VideoColumns title 列先例，与工具条搜索同源）
      filterable: true, filterFieldName: 'q', filterKind: 'text',
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
      // D-105a-19（CHG-VIR-16-TBL-FE）：候选数区间筛选（→ videoCountMin/Max，组级精确）
      filterable: true, filterFieldName: 'videoCount', filterKind: 'number',
      cell: ({ row }) => <span>{row.videos.length} 条</span>,
    },
    // CHG-VIR-15-UX-A（用户裁定 ①）：来源列——tab 退役后行级呈现。
    // 判定真源 = 服务端回显 effectiveSource（Codex review FIX：legacy 分支也实时填
    // identity 评分〔CHG-VIR-7 scoreGroup〕，按 row.identity 有无判定会把降级行
    // 全部误标「多证据」；单查询单来源，回显即行级真值）。
    {
      id: 'source',
      kind: 'computed',
      header: '来源',
      accessor: () => effectiveSource ?? '',
      width: 110, minWidth: 90,
      cell: ({ row }) => (
        <span style={SOURCE_CHIP_STYLE} data-testid={`candidate-source-${row.groupKey}`}>
          {effectiveSource === 'legacy' ? '实时聚合' : '多证据'}
        </span>
      ),
    },
    // CHG-VIR-15-UX-A（用户裁定 ②）：相似度列（identityScore；legacy 行无评分 '—'）
    // D-105a-19（CHG-VIR-16-TBL-FE）：开 sort（后端白名单扩 identityScore）+ 区间筛选
    // （accessor/筛选 UI 均百分比口径与 cell 显示一致，请求映射 ÷100 → identityScoreMin/Max）
    {
      id: 'identityScore',
      kind: 'computed',
      enableSorting: true,
      header: '相似度',
      accessor: (g) => (g.identity ? Math.round(g.identity.identityScore * 1000) / 10 : null),
      width: 100, minWidth: 80,
      filterable: true, filterFieldName: 'identityScore', filterKind: 'number',
      cell: ({ row }) => row.identity
        ? <span style={{ fontWeight: 600 }}>{(row.identity.identityScore * 100).toFixed(1)}%</span>
        : <span style={SECONDARY_TEXT}>—</span>,
    },
    // CHG-VIR-14-SCORE-UI：「重合度」列退役——identity 默认来源下 legacy_score 全 NULL → 恒 0% 误导；
    // legacyScore 仅余 legacy 降级链路后端过滤/排序消费（minScore 控件保留），不再展示
    // CHG-VIR-15-UX-A（用户裁定 ②）：操作列——快捷合并（推荐 target + confirm）/ 拒绝（identity 行）
    {
      id: 'actions',
      kind: 'computed',
      header: '操作',
      accessor: () => null,
      width: 150, minWidth: 130,
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <AdminButton
            size="sm"
            variant="primary"
            disabled={row.videos.length > 11}
            title={row.videos.length > 11 ? '超过单次合并上限（11），请展开后分批' : undefined}
            onClick={() => {
              const target = row.videos.find((v) => v.id === row.recommendedTargetVideoId)
              if (!confirm(`确认合并「${row.titleNormalized}」组？\n\n以推荐目标「${target?.title ?? '—'}」为主体保留，其余 ${row.videos.length - 1} 个视频合并后软删除（可在操作记录撤销）。\n\n如需调整目标或状态，请点击行展开。`)) return
              void handleMerge(row, row.recommendedTargetVideoId)
            }}
            data-testid={`candidate-quick-merge-${row.groupKey}`}
          >
            合并
          </AdminButton>
          {row.candidateId && (
            <AdminButton
              size="sm"
              variant="danger"
              onClick={() => void handleReject(row.candidateId!, row.titleNormalized)}
              data-testid={`candidate-quick-reject-${row.groupKey}`}
            >
              拒绝
            </AdminButton>
          )}
        </span>
      ),
    },
  ], [handleMerge, handleReject, effectiveSource])

  // D-105a-19：筛选/搜索 commit（翻页重置 page=1）
  const handleFiltersChange = useCallback((next: ReadonlyMap<string, FilterValue>) => {
    setFilters(next)
    setPage(1)
  }, [])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 真 state 接通（非 hardcode）
    sort,
    // D-105a-19：filters 真 state 接通（列头菜单 number/text filter → 检索参数）
    filters,
    columns: columnPrefs,
    selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
  }), [page, pageSize, sort, filters, columnPrefs])

  // D-105a-19：筛选/搜索激活判定（激活时空结果保持 DataTable 渲染，chip/搜索框可清除条件）
  const hasActiveCriteria = filters.size > 0

  // CHG-VIR-15-UX-A：toggle 退役后的工具条（降级提示 + 降级态 minScore 控件 + 计数）
  // CHG-VIR-16-TBL-FE：+搜索框（→ filters['q']）+ truncated 警示条
  const sourceToolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <MergeSearchInput filters={filters} onCommit={handleFiltersChange} />
      {effectiveSource === 'legacy' && !loading && (
        <span style={FALLBACK_NOTE_STYLE} data-testid="merge-source-fallback-note">
          多证据候选为空，已降级实时聚合
        </span>
      )}
      {/* D-105a-19：cap 截断警示（仅 identity 路径 pending 超折叠上限时回显） */}
      {truncated && !loading && (
        <span style={FALLBACK_NOTE_STYLE} data-testid="merge-truncated-note">
          pending 候选超折叠上限，仅展示最高分候选对的折叠结果
        </span>
      )}
      {/* identity 来源后端不消费 minScore（按 identity_score 排序）→ 仅降级 legacy 后显示 */}
      {effectiveSource === 'legacy' && (
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
      {/* D-105a-19：total 语义 = 过滤后组数（identity/legacy 统一；曾为 pending pair 数「共 N 对候选」） */}
      <span style={{ ...SECONDARY_TEXT, marginLeft: 'auto' }}>
        共 {total} 组
      </span>
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
  // D-105a-19：仅「无任何检索条件」时整体 EmptyState；筛选/搜索空结果走 DataTable emptyState
  // （否则筛选 chip / 列头菜单随表格消失，无法清除条件）
  if (data.length === 0 && !hasActiveCriteria) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sourceToolbar}
        <EmptyState
          title="无合并候选"
          description={effectiveSource === 'legacy'
            ? '当前没有符合条件的实时聚合候选组；调整 minScore 重试。'
            : '当前没有 pending 多证据候选；等待离线 job 生成或在视频库发起合并。'}
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
        // D-105a-19：筛选/搜索空结果的表内空态（表格骨架保留，chip/列头菜单可清除条件）
        emptyState={<EmptyState title="无匹配候选" description="调整筛选或搜索条件后重试。" />}
        query={query}
        onQueryChange={(patch) => {
          if (patch.pagination) {
            if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
            if (patch.pagination.pageSize !== undefined) { setPageSize(patch.pagination.pageSize); setPage(1) }
          }
          // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort patch 接通
          if (patch.sort) setSort(patch.sort)
          // D-105a-19：列头菜单筛选 patch 接通（commit 即翻页重置）
          if (patch.filters) handleFiltersChange(patch.filters)
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
            // CHG-VIR-17-PARTIAL：选中集合透传（部分合并 sourceVideoIds/candidateIds 子集计算在 handleMerge）
            onMerge={(targetId, targetStatus, selectedVideoIds) =>
              handleMerge(group, targetId, targetStatus, selectedVideoIds)}
            onReject={group.candidateId
              ? () => void handleReject(group.candidateId!, group.titleNormalized)
              : undefined}
            // CHG-VIR-9-D：折叠组逐 pair reject（EvidencePanel pair 明细行内按钮）
            onRejectPair={(candidateId, label) => void handleReject(candidateId, label)}
          />
        )}
        pagination={{ pageSizeOptions: [20, 50, 100] }}
      />
    </div>
  )
}
