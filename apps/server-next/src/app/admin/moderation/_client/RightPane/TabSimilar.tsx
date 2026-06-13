'use client'

/**
 * TabSimilar — 审核台 RightPane 类似视频 Tab（CHG-SN-8-04-VIEW / ADR-137 实装 / CHG-VIR-9-C identity 消费）
 *
 * 真源：ADR-137 AMENDMENT 2.0（GET /admin/moderation/:id/similar ?source=identity|legacy）
 *
 * 行为：
 *  - 切到此 Tab 时调 `listSimilarVideos(videoId, { limit: 10, source })`（默认 identity，空表服务端降级）
 *  - source toggle（合并候选 / 相关推荐）+ 降级回显提示（请求 identity 实际 legacy）
 *  - 渲染 top-N 列表（标题 + meta + 相似度/相似分 pill + 拦截原因 chips + 拒绝/发起合并按钮）
 *  - 拒绝（identity pending 候选）→ POST /admin/identity-candidates/:id/reject → 本地移除行
 *  - 发起合并 → router.push(/admin/merge?candidate_a=..&candidate_b=..&from=moderation[&candidate_id=..])
 *  - 空结果显示 EmptyState；错误显示 ErrorState + 重试
 *
 * 历史：
 *  - CHG-SN-4-FIX-C 占位实装；CHG-SN-8-04-VIEW 2026-05-21 真实化；CHG-VIR-9-C 2026-06-03 identity 来源消费
 */

import React, { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AdminButton, EmptyState, ErrorState, LoadingState, Segment, useToast, type SegmentItem } from '@resovo/admin-ui'
import { listSimilarVideos, type SimilarVideoItem } from '@/lib/moderation/api'
import { rejectIdentityCandidate } from '@/lib/identity/api'
import { EVIDENCE_LABELS } from '@/lib/identity/evidence-labels'
import { buildMergeHref } from '@/lib/merge/entry'

export interface TabSimilarProps {
  readonly videoId: string
}

type CandidateSource = 'identity' | 'legacy'

// 来源语义命名（MODUX）：
//   identity = 多证据离线候选，召回的是「疑似相同」视频 → 合并候选（可拒绝 / 发起合并）
//   legacy   = 实时 4 维加权算法，召回更接近「相关推荐」（兜底，无离线候选时降级到此）
const SOURCE_ITEMS: readonly SegmentItem[] = [
  { value: 'identity', label: '合并候选' },
  { value: 'legacy', label: '相关推荐' },
]

// MODUX-P3-3：相关度阈值（客户端折叠）。两源 similarityScore 统一 0-100 量纲
//   （identity = round(identityScore×100) / legacy = 4 维加权 clamp 0-100），单一阈值统一适用。
const THRESHOLD_ITEMS: readonly SegmentItem[] = [
  { value: '0', label: '全部' },
  { value: '40', label: '≥40%' },
  { value: '60', label: '≥60%' },
  { value: '80', label: '≥80%' },
]
const DEFAULT_THRESHOLD = 60

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '4px',
}

const LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

// MODUX：行改为「标题整行 + 底部 meta 行」两段式纵向布局。
//   旧 grid '1fr auto auto' 在窄右栏下，相似度 pill + 拒绝/发起合并双按钮的 auto 列
//   会把 1fr 标题列压到近 0 宽，视频信息无法显示；纵向分行后标题恒占满整行。
const ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
}

// 底部 meta 行：相似度 pill 居左、操作按钮居右；窄栏下按钮可换行不挤压标题
const ROW_FOOT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
}

const TITLE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
}

const TITLE_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const META_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const SCORE_PILL: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  fontWeight: 500,
  background: 'var(--state-info-bg, var(--state-info-soft))',
  color: 'var(--state-info-fg, var(--state-info))',
}

// CHG-VIR-9-C：强负拦截原因 chip（与 merge EvidencePanel CHIP_NEGATIVE 同语义色）
const VETO_CHIP: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  marginRight: '4px',
  background: 'var(--state-danger-bg)',
  color: 'var(--state-danger-fg)',
  border: '1px solid var(--state-danger-border)',
}

// CHG-VIR-9-C：identity→legacy 降级回显提示条
const FALLBACK_NOTE_STYLE: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 'var(--radius-md)',
  fontSize: '11px',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
}

// MODUX-P3-3：阈值控制行 + 低相关折叠展开器
const THRESHOLD_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const LOW_TOGGLE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: '100%',
  padding: '6px 10px',
  background: 'transparent',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '11px',
}

const LOW_HINT_STYLE: CSSProperties = {
  padding: '6px 10px',
  fontSize: '11px',
  color: 'var(--fg-muted)',
  textAlign: 'center',
}

export function TabSimilar({ videoId }: TabSimilarProps): React.ReactElement {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState<readonly SimilarVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // CHG-VIR-9-C：候选来源切换（请求值）+ 服务端回显（identity 空表降级 legacy 时二者不一致）
  const [source, setSource] = useState<CandidateSource>('identity')
  const [effectiveSource, setEffectiveSource] = useState<CandidateSource | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  // MODUX-P3-3：相关度阈值（客户端折叠，不触发 refetch）+ 低相关展开态
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [showLow, setShowLow] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShowLow(false) // 新数据回来折叠低相关区
    listSimilarVideos(videoId, { limit: 10, source })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setEffectiveSource(res.source)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('召回失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [videoId, source, retryKey])

  // CHG-VIR-9-C：人工拒绝 identity 候选（pending→rejected）→ 本地移除行
  const handleReject = useCallback(
    async (item: SimilarVideoItem) => {
      if (!item.candidateId) return
      if (!confirm(`确认拒绝候选「${item.title}」？\n\n拒绝后该候选不再出现在召回列表（复活由离线 job 在证据变化时重建）。`)) {
        return
      }
      setRejectingId(item.candidateId)
      try {
        await rejectIdentityCandidate(item.candidateId, '审核台类似 Tab 人工拒绝')
        setItems((prev) => prev.filter((it) => it.candidateId !== item.candidateId))
        toast.push({ level: 'success', title: '已拒绝候选', description: item.title })
      } catch (err: unknown) {
        toast.push({
          level: 'danger',
          title: '拒绝失败',
          description: err instanceof Error ? err.message : '未知错误',
        })
      } finally {
        setRejectingId(null)
      }
    },
    [toast],
  )

  // MODUX-P3-3：按统一 similarityScore（0-100）切高/低相关；high 直显，low 折叠
  const { highItems, lowItems } = useMemo(() => {
    if (threshold <= 0) return { highItems: items, lowItems: [] as readonly SimilarVideoItem[] }
    const high: SimilarVideoItem[] = []
    const low: SimilarVideoItem[] = []
    for (const it of items) (it.similarityScore >= threshold ? high : low).push(it)
    return { highItems: high, lowItems: low }
  }, [items, threshold])

  const renderRow = useCallback((it: SimilarVideoItem): React.ReactElement => (
    <div key={it.id} style={ROW_STYLE} data-testid={`tab-similar-row-${it.id}`}>
      <span style={TITLE_STYLE}>
        <span style={TITLE_TEXT}>{it.title}</span>
        <span style={META_STYLE}>
          {it.type} · {it.year ?? '—'} · {it.country ?? '—'}
        </span>
        {it.strongNegativeReasons && it.strongNegativeReasons.length > 0 && (
          <span data-testid={`tab-similar-veto-${it.id}`}>
            {it.strongNegativeReasons.map((t) => (
              <span key={t} style={VETO_CHIP}>{EVIDENCE_LABELS[t]}</span>
            ))}
          </span>
        )}
      </span>
      <div style={ROW_FOOT_STYLE}>
        {it.identityScore != null ? (
          <span style={SCORE_PILL} title={`identityScore = ${it.identityScore}`}>
            相似度 {(it.identityScore * 100).toFixed(0)}%
          </span>
        ) : (
          <span style={SCORE_PILL} title={`similarityScore = ${it.similarityScore}`}>
            {it.similarityScore}
          </span>
        )}
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {it.candidateId && (it.status ?? 'pending') === 'pending' && (
            <AdminButton
              size="sm"
              variant="danger"
              loading={rejectingId === it.candidateId}
              onClick={() => void handleReject(it)}
              data-testid={`tab-similar-reject-${it.id}`}
            >
              拒绝
            </AdminButton>
          )}
          {/* MODUX-P3-3：「发起合并」升为主操作（primary）*/}
          <AdminButton
            size="sm"
            variant="primary"
            onClick={() => {
              // CHG-VIR-13-A1：buildMergeHref 收口（参数顺序契约见 entry.ts，禁内联拼接）
              router.push(buildMergeHref({
                kind: 'merge-pair',
                candidateA: videoId,
                candidateB: it.id,
                ...(it.candidateId ? { candidateId: it.candidateId } : {}),
                from: 'moderation',
              }))
            }}
            data-testid={`tab-similar-merge-${it.id}`}
          >
            发起合并
          </AdminButton>
        </span>
      </div>
    </div>
  ), [router, videoId, rejectingId, handleReject])

  const body = loading ? (
    <LoadingState variant="spinner" />
  ) : error ? (
    <div data-testid="tab-similar-error">
      <ErrorState
        title="召回失败"
        error={error}
        onRetry={() => setRetryKey((k) => k + 1)}
      />
    </div>
  ) : items.length === 0 ? (
    <div data-testid="tab-similar-empty">
      <EmptyState
        title="未找到类似视频"
        description="该视频在同类型 / 年份范围内无相似召回；可考虑直接审核或检查元数据是否完整"
      />
    </div>
  ) : (
    <div style={LIST_STYLE} data-testid="tab-similar-list">
      {highItems.map(renderRow)}
      {highItems.length === 0 && lowItems.length > 0 && (
        <div style={LOW_HINT_STYLE} data-testid="tab-similar-no-high">
          当前阈值（≥{threshold}%）下无高相关候选
        </div>
      )}
      {lowItems.length > 0 && (
        <>
          <button
            type="button"
            style={LOW_TOGGLE_STYLE}
            onClick={() => setShowLow((s) => !s)}
            aria-expanded={showLow}
            data-testid="tab-similar-low-toggle"
          >
            {showLow ? '收起低相关' : `显示 ${lowItems.length} 条低相关候选`} {showLow ? '▴' : '▾'}
          </button>
          {showLow && <div style={LIST_STYLE} data-testid="tab-similar-low-list">{lowItems.map(renderRow)}</div>}
        </>
      )}
    </div>
  )

  return (
    <div style={WRAP_STYLE} data-right-tab="similar">
      {/* CHG-VIR-9-C：候选来源 toggle（所有状态可见，空态下也可切换）*/}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segment
          items={SOURCE_ITEMS}
          value={source}
          onChange={(v) => setSource(v as CandidateSource)}
          size="sm"
          aria-label="候选来源"
        />
        {source === 'identity' && effectiveSource === 'legacy' && !loading && !error && (
          <span style={FALLBACK_NOTE_STYLE} data-testid="tab-similar-fallback-note">
            暂无合并候选，已展示相关推荐
          </span>
        )}
      </div>
      {/* MODUX-P3-3：相关度阈值（客户端折叠，低于阈值折进展开器）*/}
      <div style={THRESHOLD_ROW_STYLE}>
        <span>相关度</span>
        <Segment
          items={THRESHOLD_ITEMS}
          value={String(threshold)}
          onChange={(v) => { setThreshold(Number(v)); setShowLow(false) }}
          size="sm"
          aria-label="相关度阈值"
        />
      </div>
      {body}
    </div>
  )
}
