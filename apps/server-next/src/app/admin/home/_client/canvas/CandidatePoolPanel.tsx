'use client'

/**
 * CandidatePoolPanel.tsx — 候选池面板（CHG-HOME-AUTOFILL-UI / 方案 §2.3 + §7.3.5 + §12）
 *
 * SectionInspector 内嵌，填充 Phase 3 预留接入位。消费三端点：
 *   #4 GET  autofill-candidates（include_filtered=true 恒开——解释展示 + gaps）
 *   #5 POST apply-autofill（选中候选转 pinned；全有或全无 409，D-182-4.5）
 *   #7 POST refresh-candidates（202 异步入队 / 429 进行中 / 422 manual_only）
 *
 * 区块分支：
 *   - banner：端点 #5 对 banner 恒 422（横版大图须人工提供，D-182-4.5）——
 *     应用动作降级为「预填」上抛（onBannerPrefill → BannerDrawer 创建模式）。
 *   - type_shortcuts：无自动候选源（worker skip 'no_candidate_source'），纯提示。
 *   - manual_only：候选仅供参考，立即刷新禁用（端点 #7 会 422）。
 * origin / filterReason 为开放字符串（D-182-4.4）：已知值中文映射，未知值
 * 原样降级展示（同 audit-action-labels fallback 范式）。
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'
import { AdminButton, AdminCheckbox, Pill, useToast } from '@resovo/admin-ui'
import { ApiClientError } from '@/lib/api-client'
import { applyAutofillCandidates, getAutofillCandidates, refreshSectionCandidates } from '@/lib/home-curation/api'
import type {
  AutofillCandidate,
  AutofillCandidatesResult,
  HomeSectionKey,
  HomeSectionSettings,
} from '@/lib/home-curation/types'

// ── 解释展示映射（开放字符串降级范式：未知值显示原始 key）────────────

const ORIGIN_LABEL: Record<string, string> = {
  douban: '豆瓣',
  bangumi: 'Bangumi',
  trending: '站内趋势',
  rating: '站内评分',
}

const FILTER_REASON_LABEL: Record<string, string> = {
  not_published: '未发布',
  not_visible: '前台不可见',
  adult_content: '成人内容',
  no_playable_source: '无可播源',
  missing_image: '缺图且无回退',
  brand_restricted: '品牌限制',
}

const GAP_PROVIDER_LABEL: Record<string, string> = {
  douban: '豆瓣',
  bangumi: 'Bangumi',
}

/** 无自动候选源区块（worker recalculate skip 'no_candidate_source'） */
const NO_CANDIDATE_SOURCE: ReadonlySet<HomeSectionKey> = new Set<HomeSectionKey>(['type_shortcuts'])

// ── 样式 ─────────────────────────────────────────────────────────

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  borderTop: '1px solid var(--border-subtle)',
  paddingTop: 10,
}

const HEAD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const HEAD_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--fg-default)',
}

const META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.5,
}

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.5,
}

const LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 320,
  overflowY: 'auto',
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
}

const ROW_FILTERED_STYLE: CSSProperties = {
  ...ROW_STYLE,
  opacity: 0.55,
  background: 'var(--bg-surface-sunken)',
}

const THUMB_STYLE: CSSProperties = {
  width: 28,
  height: 40,
  flexShrink: 0,
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  background: 'var(--bg-surface-sunken)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fg-subtle)',
}

const THUMB_IMG_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const ROW_MAIN_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const ROW_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const ROW_META_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 4,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const FOOT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const GAPS_TOGGLE_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-link, var(--fg-default))',
}

const GAP_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  padding: '2px 0',
}

// ── Props ─────────────────────────────────────────────────────────

export interface CandidatePoolPanelProps {
  readonly section: HomeSectionKey
  readonly autofillMode: HomeSectionSettings['autofillMode']
  /** 应用成功 → 父级重拉 preview（pinned 变化） */
  readonly onApplied: () => void
  /** banner 候选「预填」上抛（BannerDrawer 创建模式；仅 banner 区块出现该动作） */
  readonly onBannerPrefill?: (candidate: AutofillCandidate) => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function CandidatePoolPanel({ section, autofillMode, onApplied, onBannerPrefill }: CandidatePoolPanelProps) {
  const toast = useToast()
  const [result, setResult] = useState<AutofillCandidatesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showGaps, setShowGaps] = useState(false)

  const noSource = NO_CANDIDATE_SOURCE.has(section)

  // 切区竞态防御（Codex review FIX）：迟到的前一区块响应不得污染当前区块；
  // handler 持有的过期闭包 load（如 apply 后重拉）同样以此短路。
  const activeSectionRef = useRef<HomeSectionKey>(section)

  const load = useCallback(async () => {
    if (noSource) {
      setLoading(false)
      return
    }
    const target = section
    // 过期闭包：区块已切换 → 不发请求不触状态
    if (activeSectionRef.current !== target) return
    setLoading(true)
    setError(null)
    try {
      const r = await getAutofillCandidates(target, { includeFiltered: true })
      if (activeSectionRef.current !== target) return  // 迟到响应：丢弃
      setResult(r)
    } catch (err: unknown) {
      if (activeSectionRef.current !== target) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (activeSectionRef.current === target) setLoading(false)
    }
  }, [section, noSource])

  // 区块切换 → 标记当前区块 + 重拉 + 清空选择/折叠态
  useEffect(() => {
    activeSectionRef.current = section
    setResult(null)
    setSelected(new Set())
    setShowGaps(false)
    void load()
  }, [section, load])

  function toggleSelect(candidateId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(candidateId)
      else next.delete(candidateId)
      return next
    })
  }

  async function handleApply() {
    if (selected.size === 0) return
    const target = section
    setApplying(true)
    try {
      const { applied } = await applyAutofillCandidates(target, [...selected])
      toast.push({ title: `已应用 ${applied} 个候选为固定位`, level: 'success' })
      // 切区竞态：已切走则不动新区块的选择态（effect 已重置）；load 自带过期闭包短路
      if (activeSectionRef.current === target) setSelected(new Set())
      onApplied()
      void load()
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        // D-182-4.5 全有或全无：任一失效整体拒绝（快照轮换/已应用/重校验失效）
        toast.push({ title: '应用被整体拒绝（候选已失效或已应用）', description: err.message, level: 'danger' })
        void load() // 重拉获取最新快照态
      } else {
        toast.push({
          title: '应用失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
    } finally {
      setApplying(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshSectionCandidates(section)
      toast.push({
        title: '已加入重算队列',
        description: '重算为异步任务，稍后点击候选池刷新查看新快照',
        level: 'success',
      })
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 429) {
        toast.push({ title: '已有进行中的重算任务', description: '请等待当前重算完成', level: 'warn' })
      } else {
        toast.push({
          title: '触发重算失败',
          description: err instanceof Error ? err.message : '请稍后重试',
          level: 'danger',
        })
      }
    } finally {
      setRefreshing(false)
    }
  }

  // ── 无候选源区块：纯提示（不发请求）─────────────────────────────
  if (noSource) {
    return (
      <div style={WRAP_STYLE} data-testid="candidate-pool-no-source">
        <div style={HEAD_STYLE}>
          <span style={HEAD_TITLE_STYLE}>候选池</span>
        </div>
        <div style={HINT_STYLE}>该区块无自动候选源（角标按类型可见视频数派生，无需候选）</div>
      </div>
    )
  }

  const isBanner = section === 'banner'
  const candidates = result?.candidates ?? []
  const gaps = result?.gaps ?? []
  const selectableCount = candidates.filter((c) => !c.filtered && !c.appliedAt).length

  return (
    <div style={WRAP_STYLE} data-testid={`candidate-pool-${section}`}>
      <div style={HEAD_STYLE}>
        <span style={HEAD_TITLE_STYLE}>候选池</span>
        <AdminButton
          variant="default"
          size="sm"
          loading={refreshing}
          disabled={autofillMode === 'manual_only'}
          onClick={() => void handleRefresh()}
          data-testid="candidate-pool-refresh-btn"
        >
          立即刷新
        </AdminButton>
      </div>

      {autofillMode === 'manual_only' && (
        <div style={HINT_STYLE} data-testid="candidate-pool-manual-only-hint">
          纯人工模式：自动重算与补位不生效，候选仅供参考（立即刷新不可用）
        </div>
      )}
      {isBanner && (
        <div style={HINT_STYLE} data-testid="candidate-pool-banner-hint">
          Banner 不能直接应用候选（横版大图须人工提供）——点击「预填」打开横幅编辑器创建
        </div>
      )}

      {loading ? (
        <div style={HINT_STYLE} data-testid="candidate-pool-loading">候选加载中…</div>
      ) : error ? (
        <div style={HINT_STYLE} role="alert" data-testid="candidate-pool-error">
          候选加载失败：{error.message}{' '}
          <button type="button" style={GAPS_TOGGLE_STYLE} onClick={() => void load()}>重试</button>
        </div>
      ) : !result || result.snapshotAt === null ? (
        <div style={HINT_STYLE} data-testid="candidate-pool-no-snapshot">
          尚未生成候选快照——可点击「立即刷新」触发首次重算
        </div>
      ) : (
        <>
          <div style={META_STYLE} data-testid="candidate-pool-meta">
            快照生成于 {new Date(result.snapshotAt).toLocaleString()}
            {result.policyVersion ? ` · 策略 ${result.policyVersion}` : ''}
            {` · 候选 ${candidates.length} 条`}
          </div>

          {candidates.length === 0 ? (
            <div style={HINT_STYLE} data-testid="candidate-pool-empty">本次快照无候选</div>
          ) : (
            <div style={LIST_STYLE} data-testid="candidate-pool-list">
              {candidates.map((c) => {
                const applied = Boolean(c.appliedAt)
                const v = c.videoSummary
                return (
                  <div key={c.id} style={c.filtered ? ROW_FILTERED_STYLE : ROW_STYLE} data-testid={`candidate-row-${c.id}`}>
                    {!isBanner && !c.filtered && !applied && (
                      <AdminCheckbox
                        checked={selected.has(c.id)}
                        onChange={(e) => toggleSelect(c.id, e.target.checked)}
                        aria-label={`选择候选 ${v.title}`}
                        data-testid={`candidate-check-${c.id}`}
                      />
                    )}
                    <div style={THUMB_STYLE} aria-hidden="true">
                      {v.coverUrl ? (
                        // 封面为装饰性（标题承载语义），alt 留空
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.coverUrl} alt="" loading="lazy" style={THUMB_IMG_STYLE} />
                      ) : (
                        <ImageOff size={12} />
                      )}
                    </div>
                    <div style={ROW_MAIN_STYLE}>
                      <span style={ROW_TITLE_STYLE} title={v.title}>
                        {c.rank > 0 ? `${c.rank}. ` : ''}{v.title}
                      </span>
                      <div style={ROW_META_STYLE}>
                        <Pill variant="info" testId={`candidate-origin-${c.id}`}>
                          {ORIGIN_LABEL[c.origin] ?? c.origin}
                        </Pill>
                        <span>分 {c.score.toFixed(3)}</span>
                        {v.year != null && <span>· {v.year}</span>}
                        {c.filtered && (
                          <Pill variant="warn" testId={`candidate-filter-reason-${c.id}`}>
                            {(c.filterReason && FILTER_REASON_LABEL[c.filterReason]) ?? c.filterReason ?? '已过滤'}
                          </Pill>
                        )}
                        {applied && (
                          <Pill variant="ok" testId={`candidate-applied-${c.id}`}>已应用</Pill>
                        )}
                      </div>
                    </div>
                    {isBanner && !c.filtered && (
                      <AdminButton
                        variant="default"
                        size="sm"
                        onClick={() => onBannerPrefill?.(c)}
                        data-testid={`candidate-prefill-${c.id}`}
                      >
                        预填
                      </AdminButton>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!isBanner && selectableCount > 0 && (
            <div style={FOOT_STYLE}>
              <span style={META_STYLE} data-testid="candidate-pool-selected-count">
                已选 {selected.size} / 可选 {selectableCount}
              </span>
              <AdminButton
                variant="primary"
                size="sm"
                loading={applying}
                disabled={selected.size === 0}
                onClick={() => void handleApply()}
                data-testid="candidate-pool-apply-btn"
              >
                应用为固定位
              </AdminButton>
            </div>
          )}

          {gaps.length > 0 && (
            <div>
              <button
                type="button"
                style={GAPS_TOGGLE_STYLE}
                onClick={() => setShowGaps((s) => !s)}
                data-testid="candidate-pool-gaps-toggle"
              >
                {showGaps ? '▾' : '▸'} 内容缺口 {gaps.length}（外部热门未映射站内，仅供选题参考）
              </button>
              {showGaps && (
                <div data-testid="candidate-pool-gaps-list">
                  {gaps.map((g) => (
                    <div key={`${g.provider}-${g.externalId}`} style={GAP_ROW_STYLE}>
                      <Pill variant="neutral">{GAP_PROVIDER_LABEL[g.provider] ?? g.provider}</Pill>
                      <span style={{ ...ROW_TITLE_STYLE, flex: 1 }} title={g.title}>{g.title}</span>
                      <span>分 {g.score.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
