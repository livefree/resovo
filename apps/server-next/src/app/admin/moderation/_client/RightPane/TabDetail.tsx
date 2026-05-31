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
import React, { useCallback, useEffect, useState } from 'react'
import { AdminButton, CountryName, useToast, EnrichmentBadgeCluster, ExternalMetaPanel } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import type { VideoAdminDetail } from '@/lib/videos'
import { listVideoSources, getVideo } from '@/lib/videos/api'
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
  /** ReactNode 兼容旧 string 调用；CHG-366 允许 `<CountryName>` 等 cell 原语作为 value */
  value: React.ReactNode
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

  // META-18 / ADR-172 AMENDMENT 3：懒加载扩展详情（externalRefs + bangumiInfo），
  // 复用 GET /admin/videos/:id（不污染 queue list query）。失败仅降级，不阻断其余详情。
  const [extDetail, setExtDetail] = useState<VideoAdminDetail | null>(null)
  const [extError, setExtError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setExtDetail(null)
    setExtError(null)
    getVideo(v.id)
      .then((d) => { if (!cancelled) setExtDetail(d) })
      .catch((err: unknown) => {
        if (!cancelled) setExtError(err instanceof Error ? err.message : '加载失败')
      })
    return () => { cancelled = true }
  }, [v.id])

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

      {/* META-12-B / feature-2：富集徽标簇（density='header'）；下方 DetailRow 保留文字态明细 */}
      {v.enrichmentSummary && (
        <>
          <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>富集</div>
          <div style={{ padding: '4px 8px' }} data-right-detail-enrichment>
            <EnrichmentBadgeCluster
              summary={v.enrichmentSummary}
              type={v.type}
              density="header"
              enrichedAtLabel={
                v.enrichmentSummary.enrichedAt
                  ? `富集 ${v.enrichmentSummary.enrichedAt.slice(0, 10)}`
                  : undefined
              }
            />
          </div>
        </>
      )}

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>{M.detail.doubanStatus}</div>
      <DetailRow label="douban_status" value={String(doubanLabel)} ok={v.doubanStatus === 'matched'} />

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>信息</div>
      <DetailRow label="type" value={v.type} />
      <DetailRow label="year" value={String(v.year ?? '—')} />
      <DetailRow label="country" value={<CountryName code={v.country} />} />
      <DetailRow label={M.detail.episodesTriad} value={formatEpisodesTriad(v)} />
      <DetailRow label="meta_score" value={String(v.metaScore)} />
      <DetailRow label="source_check" value={v.sourceCheckStatus} />

      {/* META-18 / ADR-172 AMENDMENT 3：外部元数据真源并集（懒加载详情，density='compact'） */}
      {extDetail?.enrichmentSummary && (
        <div style={{ marginTop: 12 }} data-right-detail-external-meta>
          <div style={SECTION_HEADER_STYLE}>外部元数据</div>
          <ExternalMetaPanel
            summary={extDetail.enrichmentSummary}
            type={extDetail.type}
            externalRefs={extDetail.externalRefs}
            bangumiInfo={extDetail.bangumiInfo}
            characters={extDetail.bangumiCharacters}
            catalogFields={{
              titleOriginal: extDetail.title_original,
              rating: extDetail.rating,
              ratingVotes: extDetail.rating_votes,
              metadataSource: extDetail.metadata_source,
            }}
            density="compact"
            testId="moderation-detail-external-meta"
          />
        </div>
      )}
      {extError && (
        <div style={{ marginTop: 8, fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>
          外部元数据加载失败：{extError}
        </div>
      )}
    </div>
  )
}

/**
 * CHG-367-B-B / ADR-163 §6 显示规约 + Y1 防御：
 *   三层集数语义渲染 "已收 X / 已播 Y / 共 Z"，按字段 NULL 状态降级。
 *   Y1：currentEpisodes > totalEpisodes 时仅显示 currentEpisodes + 数据异常标记
 *       （DB 层不强制 total >= current 不变式 / 外部源时序不一致可能触发）。
 *   movie 类型仅显示"已收"维度（电影无 total/current 语义 / D-163-3）。
 */
function formatEpisodesTriad(v: {
  type: string
  episodeCount: number
  totalEpisodes: number | null
  currentEpisodes: number | null
}): React.ReactNode {
  const received = `${M.detail.received} ${v.episodeCount}`
  // 电影类型不显示 total/current（NULL 语义 + 单一来源）
  if (v.type === 'movie') return received

  const current = v.currentEpisodes
  const total = v.totalEpisodes
  const aired = current != null ? `${M.detail.aired} ${current}` : null
  const totalText = total != null ? `${M.detail.total} ${total}` : null

  // Y1 防御：current > total → 仅显示 current + 数据异常标记
  if (current != null && total != null && current > total) {
    return (
      <>
        {received} / {aired}{' '}
        <span style={{ color: 'var(--state-warning-fg)' }}>({M.detail.anomaly})</span>
      </>
    )
  }

  const parts = [received, aired, totalText].filter((p): p is string => p != null)
  return parts.join(' / ')
}
