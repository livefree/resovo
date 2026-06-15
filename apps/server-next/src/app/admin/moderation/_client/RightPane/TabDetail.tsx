'use client'

/**
 * TabDetail — 审核台 RightPane 详情 Tab
 *
 * CHG-SN-4-FIX-C：从 ModerationConsole.tsx 迁移 RightPaneDetail 函数到独立文件，
 *                 作为 RightPane 三 Tab 的 detail 槽位。
 * CHG-SN-8-05（2026-05-21）：顶部加 actions row「重测此视频线路」批量按钮
 *                 （W1 金票反例 #4 部分修复；per-line inline 重测推 -05-B follow-up）
 * META-34 / ADR-201 §审核详情（2026-06-14）：元数据散落 4 处收敛为单一「元数据状态」section
 *                 （`MetadataStatusPanel variant="detail"` 消费 `extDetail.metadataStatus`）——
 *                 删 triad 内 douban pill / 「富集」section / 裸 meta_score 行 / 独立「外部元数据」section；
 *                 triad 仅留发布/审核/可见性业务边界。只读展示不接 onAction（增强动作归 META-35）。
 *
 * 信息密度对齐设计稿：DetailRow 单行 < 28px，紧凑（label 等宽字符 + value 右对齐）。
 */
import React, { useCallback, useEffect, useState } from 'react'
import { AdminButton, CountryName, Pill, useToast, MetadataStatusPanel } from '@resovo/admin-ui'
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

// MODUX-P2-2：内容治理 triad 1 行 Pill 组（META-34 后仅发布/可见性/审核，豆瓣移入元数据状态）
const STATUS_PILL_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginBottom: 3,
}

// META-34：元数据状态 section 加载/空/错误态提示文字（懒加载未就绪时降级，不阻断其余详情）
const META_HINT_STYLE: React.CSSProperties = {
  marginTop: 8,
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
}

export function TabDetail({ v }: TabDetailProps): React.ReactElement {
  const toast = useToast()
  const [reprobePending, setReprobePending] = useState(false)

  // META-18 / ADR-172 AMD3 + META-34 / ADR-201：懒加载扩展详情，消费 `metadataStatus`（META-32-A 注入）
  // 渲染统一「元数据状态」section。复用 GET /admin/videos/:id（不污染 queue list query）。失败仅降级，不阻断其余详情。
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
      {/* MODUX-P2-2：内容治理 triad（发布/可见性/审核）1 行 Pill 组；META-34：豆瓣移入「元数据状态」section（去特化） */}
      <div style={SECTION_HEADER_STYLE}>{M.detail.statusTriad}</div>
      <div style={STATUS_PILL_ROW_STYLE} data-status-triad>
        <Pill
          variant={v.isPublished ? 'ok' : 'warn'}
          ariaLabel={`${M.detail.isPublished}: ${v.isPublished ? '已发布' : '未发布'}`}
        >
          {v.isPublished ? '已发布' : '未发布'}
        </Pill>
        <Pill
          variant={v.visibilityStatus === 'public' ? 'ok' : 'warn'}
          ariaLabel={`${M.detail.visibility}: ${v.visibilityStatus}`}
        >
          {v.visibilityStatus}
        </Pill>
        <Pill
          variant={v.reviewStatus === 'approved' ? 'ok' : 'warn'}
          ariaLabel={`${M.detail.reviewStatus}: ${v.reviewStatus}`}
        >
          {v.reviewStatus}
        </Pill>
      </div>

      {/* META-34 / ADR-201 §审核详情：单一「元数据状态」section（取代 douban pill / 富集 / 裸 meta_score / 外部元数据并列展示）。
          数据源 = 懒加载 extDetail.metadataStatus（getVideo→adminFindById，META-32-A 注入）。只读展示不接 onAction（增强动作归 META-35）。 */}
      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>元数据状态</div>
      {extError ? (
        <div style={META_HINT_STYLE}>元数据状态加载失败：{extError}</div>
      ) : extDetail ? (
        extDetail.metadataStatus ? (
          <div data-right-detail-metadata-status>
            <MetadataStatusPanel
              summary={extDetail.metadataStatus}
              variant="detail"
              enrichedAtLabel={
                extDetail.metadataStatus.enrichedAt
                  ? extDetail.metadataStatus.enrichedAt.slice(0, 10)
                  : undefined
              }
              testId="moderation-detail-metadata-status"
            />
          </div>
        ) : (
          <div style={META_HINT_STYLE}>暂无元数据状态</div>
        )
      ) : (
        <div style={META_HINT_STYLE}>加载中…</div>
      )}

      <div style={{ ...SECTION_HEADER_STYLE, marginTop: 12 }}>信息</div>
      <DetailRow label="type" value={v.type} />
      <DetailRow label="year" value={String(v.year ?? '—')} />
      <DetailRow label="country" value={<CountryName code={v.country} />} />
      <DetailRow label={M.detail.episodesTriad} value={formatEpisodesTriad(v)} />
      <DetailRow label="source_check" value={v.sourceCheckStatus} />
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
