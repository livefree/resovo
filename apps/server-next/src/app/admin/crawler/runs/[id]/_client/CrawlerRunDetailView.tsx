'use client'

/**
 * CrawlerRunDetailView.tsx — /admin/crawler/runs/[id] 批次详情视图（CHG-SN-6-17 / ADR-155 D-155-1）
 *
 * 设计契约：本视图只在 deep link / 分享链接打开 `/admin/crawler/runs/[id]` 时使用。
 * 行内展开场景由 CrawlerRunsView 直接消费 RunInlinePanel（不经过本视图）。
 *
 * EP-1A 瘦身后职责：
 *   - 渲染 PageHeader（仅静态 ID 标题；详情数据由 RunInlinePanel 内部自治拉）
 *   - 包裹 <RunInlinePanel runId={runId} />
 *
 * 历史范围（已挪到 RunInlinePanel.tsx，2026-05-26）：
 *   - meta grid（基础信息 9 字段）
 *   - tasks DataTable（含行级 cancel / batch cancel）
 *   - TaskLogsDrawer 弹层
 *   - useEffect 拉 run + tasks
 */

import { type CSSProperties } from 'react'
import { PageHeader } from '@resovo/admin-ui'
import { RunInlinePanel } from './RunInlinePanel'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

export interface CrawlerRunDetailViewProps {
  readonly runId: string
}

export function CrawlerRunDetailView({ runId }: CrawlerRunDetailViewProps) {
  return (
    <div data-crawler-run-detail style={SECTION_STYLE}>
      <PageHeader
        title={`批次 ${runId.slice(0, 8)}…`}
        subtitle="批次执行详情（含基础信息与任务列表）"
      />
      <RunInlinePanel runId={runId} />
    </div>
  )
}
