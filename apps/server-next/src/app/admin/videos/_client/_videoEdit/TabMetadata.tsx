'use client'

/**
 * TabMetadata.tsx — 视频编辑抽屉「元数据」tab（META-35 / ADR-201 §视频编辑抽屉）
 *
 * 统一原 `豆瓣·元数据` + `外部元数据` 两顶级 tab 为单一「元数据」tab（四源同级，不孤岛）：
 *   ① `MetadataStatusPanel variant="drawer"` 消费 `video.metadataStatus`（overall + 四源图标 +
 *      完整度 + 四来源卡 + 问题）。**不传 onAction** —— Phase 1 无「重新增强 / 跨源应用字段」端点，
 *      `missing→run_enrichment` / `partial→improve_fields` 主按钮无支撑，传 onAction 会生死按钮
 *      （违反 META-33-B 无死按钮原则）；对齐 META-34 detail 只读先例。
 *   ② `sourceEvidence` = `MetaSourceEvidence`（真源字段 / Bangumi 条目 / 角色·声优；不含四源总览）。
 *   ③ 「Douban 来源关系」区 = 原样复用 `TabDouban`（search / confirm / diff 富交互，零回归；
 *      douban confirm/ignore 经其原生按钮承载 —— Douban 去顶级 IA 但操作不丢）。
 *
 * 三态降级：`metadataStatus` 缺失（尚未富集 / 派生缺失）→ 兜底文案，不阻断证据区与 Douban 区。
 */
import React from 'react'
import { MetadataStatusPanel } from '@resovo/admin-ui'
import type { VideoAdminDetail } from '@/lib/videos'
import { MetaSourceEvidence, hasMetaSourceEvidence } from './MetaSourceEvidence'
import { TabDouban } from './TabDouban'

const ROOT_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' }
const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: 'var(--fg-default)', marginBottom: '10px',
}
const EVIDENCE_TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px',
}
const FALLBACK_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }

export interface TabMetadataProps {
  readonly videoId: string
  readonly video: VideoAdminDetail
  readonly onRefresh: () => void
}

export function TabMetadata({ videoId, video, onRefresh }: TabMetadataProps): React.ReactElement {
  const status = video.metadataStatus
  const enrichedAtLabel = status?.enrichedAt ? status.enrichedAt.slice(0, 10) : undefined

  const evidenceProps = {
    type: video.type,
    catalogFields: {
      titleOriginal: video.title_original,
      rating: video.rating,
      ratingVotes: video.rating_votes,
      metadataSource: video.metadata_source,
    },
    bangumiInfo: video.bangumiInfo,
    characters: video.bangumiCharacters,
  }
  const evidenceNode = hasMetaSourceEvidence(evidenceProps)
    ? <MetaSourceEvidence {...evidenceProps} testId="data-video-meta-evidence" />
    : undefined

  return (
    <div style={ROOT_STYLE} data-testid="data-video-tab-metadata">
      {/* ① 统一元数据状态（纯展示，无 onAction → 无死按钮） + ② 来源证据子区 */}
      {status ? (
        <MetadataStatusPanel
          summary={status}
          variant="drawer"
          enrichedAtLabel={enrichedAtLabel}
          sourceEvidence={evidenceNode}
          testId="data-video-metadata-status"
        />
      ) : (
        <div data-testid="data-video-metadata-empty">
          <p style={FALLBACK_STYLE}>暂无元数据状态（尚未富集或派生缺失）。</p>
          {evidenceNode && (
            <div data-meta-source-evidence-standalone style={{ marginTop: '12px' }}>
              <div style={EVIDENCE_TITLE_STYLE}>来源证据</div>
              {evidenceNode}
            </div>
          )}
        </div>
      )}

      {/* ③ Douban 来源关系（保留原有富交互；不再占顶级 IA） */}
      <div data-meta-douban-relation>
        <div style={SECTION_TITLE_STYLE}>Douban 来源关系</div>
        <TabDouban
          videoId={videoId}
          doubanStatus={video.douban_status}
          doubanId={video.douban_id}
          reviewStatus={video.review_status}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  )
}
