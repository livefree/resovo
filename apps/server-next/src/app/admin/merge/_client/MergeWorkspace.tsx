'use client'

/**
 * MergeWorkspace.tsx — 统一合并工作区（CHG-VIR-13-WS / 设计 §10.2 增强 #1 + §11.3）
 *
 * 吸收并取代 DirectMergeWorkspace（2→1 / target 锁死为 A）与 BatchMergeWorkspace
 * （N→1 / 纯 uuid 列表 / 集合不可编辑）：**视频集合编辑器** — 成员经 VideoPicker
 * 随时增删、target 列内单选可任意切换；2→1 与 N→1 同构（N=2 只是特例）。
 *
 * 深链预填（经 MergeClient 升级映射注入）：
 *   - ?ids=<csv>（审核台/视频库批量）→ initialIds
 *   - ?candidate_a=A[&candidate_b=B]（行级/TabSimilar）→ initialIds=[A,B?] + initialTargetId=A
 *   - ?candidate_id（identity 候选锚点）→ 仅当成员集合恰为 {A,B} 原 pair 时透传
 *     confirm（成员增删后 pair 失配自动失效 / 沿 DirectMergeWorkspace 既有语义）
 *
 * 上限：MergeSchema source ≤ 10 + target = 11（超限禁用执行 + 提示移除成员）。
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  AdminInput,
  VideoPicker,
  useToast,
  type PickerVideoItem,
} from '@resovo/admin-ui'
import { mergeVideos, unmergeVideos } from '@/lib/merge/api'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'
import { describeError } from './MergeClient'
// CHG-VIR-13-PLAY（§11.3 工作区预览嵌入）：结构级线路预览 + 播放抽验（{id,title} 最小输入）
import { StructurePreview } from './StructurePreview'

/** 单次 merge 成员上限 = sourceVideoIds max 10 + target 1（MergeSchema / ADR-105） */
const MAX_MERGE_MEMBERS = 11

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const MEMBER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-row)',
}

const MEMBER_ROW_TARGET_STYLE: CSSProperties = {
  ...MEMBER_ROW_STYLE,
  border: '1px solid var(--state-success-border)',
  background: 'var(--state-success-bg)',
}

export interface MergeWorkspaceProps {
  /** 深链预填成员 ids（去重；进入后可继续增删） */
  readonly initialIds?: readonly string[]
  /** 深链预填 target（须 ∈ initialIds；缺省 = 首个成员） */
  readonly initialTargetId?: string
  /**
   * identity_candidate.id 锚点（?candidate_id）。仅当当前成员集合恰为初始 pair
   * {initialIds[0], initialIds[1]}（N=2）且 target 未变更集合时透传 confirm。
   */
  readonly candidateIdFromUrl?: string
  /** 合并成功后回调（MergeClient 清深链参数） */
  readonly onMergeSuccess?: () => void
}

export function MergeWorkspace({ initialIds, initialTargetId, candidateIdFromUrl, onMergeSuccess }: MergeWorkspaceProps) {
  const toast = useToast()
  const [members, setMembers] = useState<readonly PickerVideoItem[]>([])
  const [targetId, setTargetId] = useState<string | null>(initialTargetId ?? null)
  const [pickerValue, setPickerValue] = useState<PickerVideoItem | null>(null)
  const [reason, setReason] = useState('')
  const [merging, setMerging] = useState(false)
  const [prefilling, setPrefilling] = useState(false)

  // 深链 ids 一次性并行 fetch 注入成员（标题/shortId 充实；fetch 失败的 id 以占位行保留可移除）
  const initialIdsKey = (initialIds ?? []).join('|')
  useEffect(() => {
    const ids = Array.from(new Set(initialIds ?? [])).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    const ctrl = new AbortController()
    setPrefilling(true)
    Promise.all(
      ids.map(async (id): Promise<PickerVideoItem> => {
        try {
          const res = await videoPickerFetcher({ q: id, limit: 1, signal: ctrl.signal })
          const found = res.items.find((it) => it.id === id)
          if (found) return found
        } catch {
          // 单 id fetch 失败 → 走占位行（可移除/可重选），不阻塞整体预填
        }
        return { id, shortId: id.slice(0, 8), title: '(加载失败，请确认 id)' } as PickerVideoItem
      }),
    )
      .then((items) => {
        if (cancelled) return
        setMembers(items)
        setTargetId((prev) => (prev && items.some((it) => it.id === prev) ? prev : items[0]?.id ?? null))
      })
      .finally(() => { if (!cancelled) setPrefilling(false) })
    return () => { cancelled = true; ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids 内容键控（数组引用每 render 变）
  }, [initialIdsKey])

  const addMember = useCallback((item: PickerVideoItem | null) => {
    setPickerValue(null)
    if (!item) return
    setMembers((prev) => {
      if (prev.some((m) => m.id === item.id)) {
        toast.push({ title: '该视频已在成员列表中', level: 'warn' })
        return prev
      }
      const next = [...prev, item]
      setTargetId((t) => t ?? item.id)
      return next
    })
  }, [toast])

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== id)
      setTargetId((t) => (t === id ? next[0]?.id ?? null : t))
      return next
    })
  }, [])

  // candidate_id 透传守卫：成员集合恰为初始 pair（无序相等）时才有效（pair 失配自动失效）
  const effectiveCandidateId = useMemo(() => {
    if (!candidateIdFromUrl) return undefined
    const initial = Array.from(new Set(initialIds ?? []))
    if (initial.length !== 2 || members.length !== 2) return undefined
    const memberIds = new Set(members.map((m) => m.id))
    return initial.every((id) => memberIds.has(id)) ? candidateIdFromUrl : undefined
  }, [candidateIdFromUrl, initialIds, members])

  const exceedsLimit = members.length > MAX_MERGE_MEMBERS
  const canMerge = members.length >= 2 && targetId !== null && !exceedsLimit && !merging

  const handleMerge = useCallback(async () => {
    if (!targetId || members.length < 2) return
    const sourceVideoIds = members.filter((m) => m.id !== targetId).map((m) => m.id)
    const targetMember = members.find((m) => m.id === targetId)
    if (!confirm(`确认合并？\n\n以「${targetMember?.title ?? targetId.slice(0, 8)}」为主体保留；\n其余 ${sourceVideoIds.length} 个视频将合并到它后软删除。\n\n此操作可在操作记录撤销。`)) {
      return
    }
    setMerging(true)
    try {
      const result = await mergeVideos({
        sourceVideoIds,
        targetVideoId: targetId,
        reason: reason.trim() || undefined,
        ...(effectiveCandidateId ? { candidateId: effectiveCandidateId } : {}),
      })
      toast.push({
        title: '合并成功',
        description: `已将 ${sourceVideoIds.length} 个视频合并到「${result.targetVideo.title}」（auditId: ${result.auditId.slice(0, 8)}）`,
        level: 'success',
        action: {
          label: '撤销',
          onClick: () => {
            unmergeVideos(result.auditId, '用户撤销合并')
              .then(() => toast.push({ level: 'success', title: '已撤销合并' }))
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
      setMembers([])
      setTargetId(null)
      setReason('')
      onMergeSuccess?.()
    } catch (err: unknown) {
      toast.push({ title: '合并失败', description: describeError(err, 'merge'), level: 'danger' })
    } finally {
      setMerging(false)
    }
  }, [members, targetId, reason, effectiveCandidateId, onMergeSuccess, toast])

  return (
    <AdminCard style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }} data-testid="merge-workspace">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>合并工作区</span>
        <span style={SECONDARY_TEXT} data-testid="merge-workspace-count">
          成员 {members.length} / 上限 {MAX_MERGE_MEMBERS}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
        选择 1 个成员作为合并目标（target）保留，其余成员的播放源将转入 target 后软删除；可随时增删成员。
      </div>

      <VideoPicker
        label="添加成员"
        value={pickerValue}
        onChange={addMember}
        fetcher={videoPickerFetcher}
        data-testid="merge-workspace-picker"
      />

      {prefilling && <span style={SECONDARY_TEXT}>正在载入深链成员…</span>}

      {members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="merge-workspace-members">
          {members.map((m) => (
            <label
              key={m.id}
              style={m.id === targetId ? MEMBER_ROW_TARGET_STYLE : MEMBER_ROW_STYLE}
              data-testid={`merge-member-${m.id}`}
            >
              <input
                type="radio"
                name="merge-workspace-target"
                checked={targetId === m.id}
                onChange={() => setTargetId(m.id)}
                aria-label={`选择 ${m.title} 为合并目标`}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: m.id === targetId ? 600 : 400, flex: 1 }}>
                {m.title}
              </span>
              <code style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '11px', color: 'var(--fg-muted)' }}>
                {m.shortId ?? m.id.slice(0, 8)}
              </code>
              {m.id === targetId && (
                <span style={{ fontSize: '11px', color: 'var(--state-success-fg)', fontWeight: 600 }}>★ target</span>
              )}
              <AdminButton size="sm" variant="default" onClick={() => removeMember(m.id)} data-testid={`merge-member-remove-${m.id}`}>
                移除
              </AdminButton>
            </label>
          ))}
        </div>
      )}

      {/* CHG-VIR-13-PLAY（§11.3）：成员 ≥2 时结构级线路 × 集数预览 + 播放抽验（同集对比切换） */}
      {members.length >= 2 && <StructurePreview videos={members} />}

      <AdminInput
        size="sm"
        placeholder="合并原因（可选 / ≤ 500 字符）"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        data-testid="merge-workspace-reason"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {exceedsLimit && (
          <span style={SECONDARY_TEXT} data-testid="merge-workspace-limit-note">
            成员超过单次合并上限（{MAX_MERGE_MEMBERS}），请移除部分成员分批合并
          </span>
        )}
        {members.length === 1 && (
          <span style={SECONDARY_TEXT}>至少需要 2 个成员才能合并</span>
        )}
        <AdminButton
          size="sm"
          variant="primary"
          loading={merging}
          disabled={!canMerge}
          onClick={() => void handleMerge()}
          data-testid="merge-workspace-execute"
        >
          执行合并（{Math.max(members.length - 1, 0)} → target）
        </AdminButton>
      </div>
    </AdminCard>
  )
}
