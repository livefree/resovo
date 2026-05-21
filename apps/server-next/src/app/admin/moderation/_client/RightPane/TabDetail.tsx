'use client'

/**
 * TabDetail — 审核台 RightPane 详情 Tab
 *
 * CHG-SN-4-FIX-C：从 ModerationConsole.tsx 迁移 RightPaneDetail 函数到独立文件，
 *                 作为 RightPane 三 Tab 的 detail 槽位。
 * CHG-SN-8-05（2026-05-21）：顶部加 actions row「重测此视频线路」批量按钮
 *                 （W1 金票反例 #4 部分修复；per-line inline 重测推 -05-B follow-up）
 *
 * 信息密度对齐设计稿：DetailRow 单行 < 28px，紧凑（label 等宽字符 + value 右对齐）。
 */
import React, { useCallback, useState } from 'react'
import { AdminButton, useToast } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { listVideoSources } from '@/lib/videos/api'
import { reprobeRoute } from '@/lib/sources/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 8px',
  background: 'var(--bg-surface-raised)',
  borderRadius: 4,
  marginBottom: 3,
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'monospace',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xxs)',
}

const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
}

interface DetailRowProps {
  label: string
  value: string
  ok?: boolean
}

function DetailRow({ label, value, ok }: DetailRowProps): React.ReactElement {
  const valueColor = ok === true
    ? 'var(--state-success-fg)'
    : ok === false
      ? 'var(--state-warning-fg)'
      : 'var(--fg-muted)'
  return (
    <div style={ROW_STYLE}>
      <code style={LABEL_STYLE}>{label}</code>
      <span style={{ color: valueColor, fontSize: 'var(--font-size-xs)' }}>{value}</span>
    </div>
  )
}

export interface TabDetailProps {
  readonly v: VideoQueueRow
}

const ACTIONS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 10,
  flexWrap: 'wrap',
}

export function TabDetail({ v }: TabDetailProps): React.ReactElement {
  const toast = useToast()
  const doubanLabel = M.detail[v.doubanStatus as keyof typeof M.detail] ?? v.doubanStatus
  const [reprobePending, setReprobePending] = useState(false)

  // CHG-SN-8-05：批量重测此视频所有线路
  const handleReprobeAll = useCallback(async () => {
    setReprobePending(true)
    try {
      const sources = await listVideoSources(v.id)
      // 去重 (siteKey, sourceName) 组合（一个线路可能对应多集 → 同一线路只触发一次 reprobe）
      const lineKeys = new Map<string, { siteKey: string; sourceName: string }>()
      for (const s of sources) {
        const siteKey = s.source_site_key ?? s.site_key
        if (!siteKey || !s.source_name) continue
        const key = `${siteKey}::${s.source_name}`
        if (!lineKeys.has(key)) {
          lineKeys.set(key, { siteKey, sourceName: s.source_name })
        }
      }
      if (lineKeys.size === 0) {
        toast.push({
          title: '无可重测线路',
          description: '此视频暂未关联任何 (site_key, source_name) 线路',
          level: 'warn',
        })
        return
      }
      const results = await Promise.allSettled(
        [...lineKeys.values()].map((l) => reprobeRoute(l.siteKey, l.sourceName)),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - ok
      toast.push({
        title: failed === 0 ? '已重测全部线路' : '部分重测失败',
        description: `${results.length} 条线路 · 成功 ${ok} / 失败 ${failed}`,
        level: failed === 0 ? 'success' : 'warn',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载线路失败'
      toast.push({ title: '重测失败', description: message, level: 'danger' })
    } finally {
      setReprobePending(false)
    }
  }, [v.id, toast])

  return (
    <div style={{ fontSize: 'var(--font-size-xs)' }} data-right-tab="detail">
      <div style={ACTIONS_ROW_STYLE} data-right-detail-actions>
        <AdminButton
          size="sm"
          variant="default"
          loading={reprobePending}
          onClick={() => void handleReprobeAll()}
          data-testid="moderation-detail-reprobe-all"
        >
          重测此视频线路
        </AdminButton>
      </div>
      <div style={SECTION_HEADER_STYLE}>{M.detail.statusTriad}</div>
      <DetailRow label={M.detail.isPublished} value={String(v.isPublished)} ok={v.isPublished} />
      <DetailRow label={M.detail.visibility} value={v.visibilityStatus} ok={v.visibilityStatus === 'public'} />
      <DetailRow label={M.detail.reviewStatus} value={v.reviewStatus} ok={v.reviewStatus === 'approved'} />

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>{M.detail.doubanStatus}</div>
      <DetailRow label="douban_status" value={String(doubanLabel)} ok={v.doubanStatus === 'matched'} />

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>信息</div>
      <DetailRow label="type" value={v.type} />
      <DetailRow label="year" value={String(v.year ?? '—')} />
      <DetailRow label="country" value={v.country ?? '—'} />
      <DetailRow label="episodeCount" value={String(v.episodeCount)} />
      <DetailRow label="meta_score" value={String(v.metaScore)} />
      <DetailRow label="source_check" value={v.sourceCheckStatus} />
    </div>
  )
}
