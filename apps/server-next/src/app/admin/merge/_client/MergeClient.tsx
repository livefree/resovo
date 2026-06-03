'use client'

/**
 * MergeClient.tsx — `/admin/merge` 合并/拆分工作台主组件（CHG-SN-5-12 / ADR-105 / CHG-SN-7-MISC-MERGE-1/2）
 *
 * 范围：Segment 3 视图 + PageHeader 拆分工作台入口
 *   1. 待审候选 Segment — ./MergeCandidatesSection（CHG-VIR-9-C 拆出：DataTable + source toggle + confirm/reject）
 *   2. 已合并 Segment — AuditSection pre-filter action='merge'
 *   3. 已拆分 Segment — AuditSection pre-filter action='split'
 *   4. 拆分工作台 — PageHeader action 按钮 toggle SplitSection
 *   5. 直接合并工作区 — ?candidate_a/?candidate_b/?candidate_id 深链（identity 候选锚点透传）
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

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  Segment,
  VideoPicker,
  useToast,
  type SegmentItem,
  type PickerVideoItem,
} from '@resovo/admin-ui'
import { mergeVideos } from '@/lib/merge/api'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'
import { ApiClientError } from '@/lib/api-client'
import { SplitSection } from './MergeSplitSection'
import { AuditSection } from './MergeAuditSection'
import { BatchMergeWorkspace } from './BatchMergeWorkspace'
import { CandidatesSection } from './MergeCandidatesSection'

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

// CandidatesSection + CandidateExpand 及其样式常量已拆至 ./MergeCandidatesSection
// （CHG-VIR-9-C：500 行红线先拆分再扩展 source toggle / confirm / reject）

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
  // CHG-364-B：接收来自 BatchActionsBar 合并按钮的 ?ids=<csv> 深链
  const idsParam = searchParams.get('ids')
  const batchIds = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : []

  // showSplit 初始值：?split=:videoId 存在则自动展开 / 否则默认收起
  const [showSplit, setShowSplit] = useState<boolean>(!!splitParam)

  const dismissBatchIdsBanner = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('ids')
    p.delete('from')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])
  const dismissCandidateBanner = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('candidate_a')
    p.delete('from')
    // CHG-VIR-9-C：identity 候选锚点参数随 banner 一起清理
    p.delete('candidate_id')
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
          candidateIdFromUrl={searchParams.get('candidate_id')}
          onMergeSuccess={dismissCandidateBanner}
        />
      )}

      {/* CHG-364-B：来自审核台批量栏 ?ids=<csv> 深链 → BatchMergeWorkspace（列 ids 选 target + 提交 merge） */}
      {batchIds.length > 0 && (
        <BatchMergeWorkspace ids={batchIds} onMergeSuccess={dismissBatchIdsBanner} />
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

// ── CHG-SN-8-08-B · 直接合并工作区（候选 A 锁定 → VideoPicker 选 B → 立即合并）─

interface DirectMergeWorkspaceProps {
  readonly candidateAId: string
  /** GAPS #G-merge-candidate-b-auto：从 URL ?candidate_b 注入；mount 时 fetch 一次注入 picker.value */
  readonly candidateBIdFromUrl: string | null
  /**
   * CHG-VIR-9-C：从 URL ?candidate_id 注入 identity_candidate.id（审核台类似 Tab 深链）。
   * 仅当 picker 当前 B 仍 === candidate_b 时透传给 merge（换 B 后 pair 不再匹配，自动失效）。
   */
  readonly candidateIdFromUrl: string | null
  readonly onMergeSuccess: () => void
}

function DirectMergeWorkspace({ candidateAId, candidateBIdFromUrl, candidateIdFromUrl, onMergeSuccess }: DirectMergeWorkspaceProps) {
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
      // CHG-VIR-9-C：B 未被换选时透传 identity 候选锚点（confirm 语义 / ADR-178 D-178-3）
      const effectiveCandidateId =
        candidateIdFromUrl && candidateB.id === candidateBIdFromUrl ? candidateIdFromUrl : undefined
      const result = await mergeVideos({
        sourceVideoIds: [candidateB.id],
        targetVideoId: candidateAId,
        reason: '从视频库行级 + Merge 页直接工作区',
        ...(effectiveCandidateId ? { candidateId: effectiveCandidateId } : {}),
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
  }, [candidateAId, candidateB, candidateBIdFromUrl, candidateIdFromUrl, onMergeSuccess, toast])

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
