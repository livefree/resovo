'use client'

/**
 * MergeClient.tsx — `/admin/merge` 合并/拆分工作台骨架（CHG-VIR-13-WS mode 模型重构）
 *
 * 单一活动工作区（设计 §10.2 增强 #1 + §11.1）：`?mode=<candidates|merge|split|records>`
 * Segment 4 区与 URL 双向同步，同一时刻只渲染一个工作区——废除旧「深链 banner +
 * 直接合并区 + 批量区 + 拆分 toggle 可同时堆叠」形态。
 *
 *   - candidates（默认）: ./MergeCandidatesSection（identity/legacy 候选 + 行展开就地合并）
 *   - merge:              ./MergeWorkspace（Direct/Batch 合一：集合编辑 + target 单选）
 *   - split:              ./SplitWorkspace（拆分工作台；13-B2B 重命名兑现 + VideoPicker ×2）
 *   - records:            ./MergeAuditSection（合并/拆分操作记录；决策记录子视图留 13-C2）
 *
 * 旧参数升级映射（5+1 处既有深链不破 / buildMergeHref 真源在 @/lib/merge/entry）：
 *   ?candidate_a=A[&candidate_b=B][&candidate_id=]  → mode=merge（成员 [A,B?] / target=A）
 *   ?ids=<csv>                                       → mode=merge（成员 csv）
 *   ?split=<videoId>                                 → mode=split（预填自动加载）
 *   ?tab=merged|split                                → mode=records（AuditSection 预过滤）
 *   ?tab=candidates                                  → mode=candidates
 *   ?from=<MergeEntrySource>                         → 来源回链栏（CHG-VIR-13-A1）
 *
 * 端点消费（ADR-105 §端点契约）：candidates / merge / unmerge / split / audit。
 */

import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  Segment,
  type SegmentItem,
} from '@resovo/admin-ui'
import { ApiClientError } from '@/lib/api-client'
import { isMergeEntrySource, MERGE_ENTRY_SOURCE_META } from '@/lib/merge/entry'
import { SplitWorkspace } from './SplitWorkspace'
import { AuditSection } from './MergeAuditSection'
// CHG-VIR-13-C2：records mode 第二子视图（identity 裁定记录 + revive）
import { DecisionsSection } from './MergeDecisionsSection'
import { MergeWorkspace } from './MergeWorkspace'
import { CandidatesSection } from './MergeCandidatesSection'

// ── 错误码差异化 description（ADR-105 §错误码 + CHG-SN-5-12-PATCH P0/P2-1）─────
// （多消费方共享：MergeCandidatesSection / SplitWorkspace / MergeWorkspace）

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

// ── mode 模型 ──────────────────────────────────────────────────────

export type WorkspaceMode = 'candidates' | 'merge' | 'split' | 'records'

const WORKSPACE_MODES: readonly WorkspaceMode[] = ['candidates', 'merge', 'split', 'records']

const SEGMENT_ITEMS: readonly SegmentItem[] = [
  { value: 'candidates', label: '待审候选' },
  { value: 'merge',      label: '合并工作区' },
  { value: 'split',      label: '拆分工作区' },
  { value: 'records',    label: '操作记录' },
]

// CHG-VIR-13-C2：records mode 内层两子视图（audit 时间线 / identity 裁定记录）
const RECORDS_VIEW_ITEMS: readonly SegmentItem[] = [
  { value: 'audit',     label: '操作时间线' },
  { value: 'decisions', label: '决策记录' },
]

interface DerivedWorkspace {
  readonly mode: WorkspaceMode
  /** records 预过滤（旧 ?tab=merged|split 升级映射） */
  readonly auditFilter?: 'merge' | 'split'
}

/**
 * mode 推导（升级映射真源）：显式 ?mode= > 旧工作流参数 > 旧 ?tab= > 默认 candidates。
 * 不重写 URL（旧深链保持原参数形态，内部推导；规范化 URL 留消费侧自然演进）。
 */
function deriveWorkspace(searchParams: URLSearchParams): DerivedWorkspace {
  const modeParam = searchParams.get('mode')
  if (modeParam && (WORKSPACE_MODES as readonly string[]).includes(modeParam)) {
    return { mode: modeParam as WorkspaceMode }
  }
  if (searchParams.get('candidate_a') || searchParams.get('ids')) return { mode: 'merge' }
  if (searchParams.get('split')) return { mode: 'split' }
  const tab = searchParams.get('tab')
  if (tab === 'merged') return { mode: 'records', auditFilter: 'merge' }
  if (tab === 'split') return { mode: 'records', auditFilter: 'split' }
  return { mode: 'candidates' }
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

// ── 主组件 ─────────────────────────────────────────────────────────

export function MergeClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const { mode, auditFilter } = useMemo(
    () => deriveWorkspace(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // CHG-VIR-13-C2（records mode 两子视图）：audit 时间线 / 决策记录内层切换
  const [recordsView, setRecordsView] = useState<'audit' | 'decisions'>('audit')

  // 深链工作流参数（merge 工作区预填）
  const candidateAParam = searchParams.get('candidate_a')
  const candidateBParam = searchParams.get('candidate_b')
  const candidateIdParam = searchParams.get('candidate_id')
  const idsParam = searchParams.get('ids')
  const splitParam = searchParams.get('split')
  const fromParam = searchParams.get('from')

  const mergeInitialIds = useMemo<readonly string[]>(() => {
    if (idsParam) return idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    if (candidateAParam) return [candidateAParam, ...(candidateBParam ? [candidateBParam] : [])]
    return []
  }, [idsParam, candidateAParam, candidateBParam])

  // mode 切换 → URL ?mode= 同步（replace 不入历史栈；保留其余参数 = 深链上下文可回切）
  const handleModeChange = useCallback((next: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('mode', next)
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams])

  // CHG-VIR-13-A1：来源回链栏（from 合法值才渲染；关闭仅清 from，不动工作流参数）
  const entrySource = isMergeEntrySource(fromParam) ? fromParam : null
  const dismissEntrySourceBar = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('from')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  // merge 工作区成功 → 清工作流参数（保留 from 供回链返回；保留 mode=merge 续用工作区）
  const handleMergeSuccess = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('candidate_a')
    p.delete('candidate_b')
    p.delete('candidate_id')
    p.delete('ids')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  return (
    <div style={PAGE_STYLE}>
      <PageHeader
        title="合并 / 拆分工作台"
        subtitle="候选审阅 · 合并 · 拆分 · 操作记录 — 单一活动工作区（ADR-105 五端点消费）"
      />

      {/* CHG-VIR-13-A1：来源回链栏（深链进入时渲染；label/backHref 真源 = entry.ts） */}
      {entrySource && (
        <AdminCard
          surface="subtle"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px' }}
          data-testid="merge-entry-source-bar"
        >
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>
            ◂ {MERGE_ENTRY_SOURCE_META[entrySource].label}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <AdminButton
              size="sm"
              variant="secondary"
              onClick={() => router.push(MERGE_ENTRY_SOURCE_META[entrySource].backHref)}
              data-testid="merge-entry-source-back"
            >
              {MERGE_ENTRY_SOURCE_META[entrySource].backLabel}
            </AdminButton>
            <AdminButton size="sm" variant="default" onClick={dismissEntrySourceBar} data-testid="merge-entry-source-dismiss">
              ×
            </AdminButton>
          </span>
        </AdminCard>
      )}

      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div style={{ padding: '12px 16px 0' }}>
          <Segment
            items={SEGMENT_ITEMS}
            value={mode}
            onChange={handleModeChange}
            size="md"
            aria-label="工作区"
            data-testid="merge-mode-segment"
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
          {mode === 'candidates' ? (
            <CandidatesSection />
          ) : mode === 'merge' ? (
            <MergeWorkspace
              key={`${mergeInitialIds.join('|')}|${candidateIdParam ?? ''}`}
              initialIds={mergeInitialIds}
              initialTargetId={candidateAParam ?? undefined}
              candidateIdFromUrl={candidateIdParam ?? undefined}
              onMergeSuccess={handleMergeSuccess}
            />
          ) : mode === 'split' ? (
            <SplitWorkspace initialVideoId={splitParam ?? undefined} />
          ) : (
            /* CHG-VIR-13-C2：records mode 两子视图（audit 时间线 / 决策记录） */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Segment
                items={RECORDS_VIEW_ITEMS}
                value={recordsView}
                onChange={(v) => setRecordsView(v as 'audit' | 'decisions')}
                size="sm"
                aria-label="记录视图"
                data-testid="records-view-segment"
              />
              {recordsView === 'audit'
                ? <AuditSection initialAction={auditFilter} />
                : <DecisionsSection />}
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  )
}
