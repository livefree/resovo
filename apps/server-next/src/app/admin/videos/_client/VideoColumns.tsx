'use client'

/**
 * VideoColumns.tsx — 视频库列定义（CHG-VSR-PRE-1 从 VideoListClient 抽出，零行为变化）
 *
 * reference §6.1 视频库标杆列；列 helper / 样式常量 / buildVideoColumns 全部内聚于此。
 */

import type { CSSProperties } from 'react'
import {
  Pill, VisChip, Thumb, DualSignal, EnrichmentBadgeCluster,
  type TableColumn,
} from '@resovo/admin-ui'
import type { VideoAdminRow, VideoType } from '@/lib/videos'
import { VideoRowActions } from './VideoRowActions'

// ── column definitions（reference §6.1 视频库标杆 10 列）─────────────

// 类型中文映射（CHG-DESIGN-08 8A 内联到 columns 层；原 VideoTypeChip 已由 Pill 取代）
const TYPE_LABELS: Record<VideoType, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
  sports: '体育',
  music: '音乐',
  news: '新闻',
  kids: '少儿',
  other: '其他',
}

// 标题列 cell 样式（thumb 与 title 分列，title 仅含标题 + meta）
const TITLE_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0,
}
const TITLE_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const TITLE_META_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)',
  // mono 字体用浏览器默认 stack（design-tokens 暂未定义 --font-mono；reference.md §6.1 仅
  // 描述 .tbl-meta.mono 视觉，未规定 token；保留扩展位由 STATS-EXTEND-VIDEOS follow-up 决定）
  fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

// 源活跃 cell 样式（reference §6.1 sources 列：dot + 数字 + 活跃/一般/稀少 文案）
const SOURCES_CELL_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
}
const SOURCES_DOT_STYLE: CSSProperties = {
  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
}
const SOURCES_NUM_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
}
const SOURCES_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
}

function sourcesDotColor(active: number): string {
  if (active > 10) return 'var(--state-success-fg)'
  if (active > 3) return 'var(--state-warning-fg)'
  return 'var(--state-error-fg)'
}

function sourcesLabel(active: number): string {
  if (active > 10) return '活跃'
  if (active > 3) return '一般'
  return '稀少'
}

// 图片健康 P0 pill：poster 或 backdrop 任一 broken → P0 失效（danger）；都 ok → P0 活跃（ok）
function imageHealthVariant(row: VideoAdminRow): 'ok' | 'danger' {
  const broken =
    row.poster_status === 'broken' || row.poster_status === 'fallback' ||
    row.backdrop_status === 'broken' || row.backdrop_status === 'fallback'
  return broken ? 'danger' : 'ok'
}

// review pill：approved=ok / pending_review=warn / rejected=danger
function reviewPillVariant(status: VideoAdminRow['review_status']): 'ok' | 'warn' | 'danger' | 'neutral' {
  switch (status) {
    case 'approved': return 'ok'
    case 'pending_review': return 'warn'
    case 'rejected': return 'danger'
    default: return 'neutral'
  }
}

function reviewPillLabel(status: VideoAdminRow['review_status']): string {
  switch (status) {
    case 'approved': return '已通过'
    case 'pending_review': return '待审'
    case 'rejected': return '已拒'
    default: return '—'
  }
}

// sub C（2026-05-24）：ADR-150 D-150-1 双轨 — 4 列加 filterable
//   title (text/q) / type (enum) / visibility (enum/visibilityStatus) / review_status (enum/reviewStatus)
//   options 由消费方注入（VIDEO_TYPE_OPTIONS / VISIBILITY_OPTIONS / REVIEW_STATUS_OPTIONS）
export function buildVideoColumns(
  isAdmin: boolean,
  onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void,
  onEditRequest: (id: string) => void,
  typeOptions: readonly { value: string; label?: string }[] = [],
  visibilityOptions: readonly { value: string; label?: string }[] = [],
  reviewOptions: readonly { value: string; label?: string }[] = [],
): readonly TableColumn<VideoAdminRow>[] {
  return [
    // ── thumb 列：CHG-UX2-03 升级 poster-sm 32×48 → poster-md 48×72（解决"视频库列表过小"）──
    // CHG-UX2-03d：cover width = Thumb 48 + cell padding 24 = 72，贴合 cell content；
    // 不再用 wrapper div（CHG-UX2-03c 的 wrapper 让 Thumb 成为 flex item，破坏 flex-shrink:0）
    {
      // DTR-F：解禁列宽（去 enableResizing:false）；width 72 = Thumb 48 + padding 24 已贴合内容 +
      // 容下表头「封面」2 字；minWidth 56 给 handle/截断呼吸。auto-fit 测得仍约 72。
      id: 'cover', kind: 'media', header: '封面', accessor: (r) => r.cover_url,
      width: 72, minWidth: 56, defaultVisible: true,
      cell: ({ row }) => <Thumb src={row.cover_url} size="poster-md" />,
    },
    // ── title 列：标题 + meta（shortId · year）──
    // CHG-UX2-03 改弹性：删 width 保留 minWidth → buildGridTemplate 走 minmax(220px, 1fr) 撑满，
    // 消除右侧空白 + 消除横向溢出（frame "圆角右直角"根因连锁修复）
    // sub C：text filter / filterFieldName='q'（D-150-4 业务 key 桥接 / 后端搜 title）
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      minWidth: 220, enableResizing: true, enableSorting: true, defaultVisible: true, pinned: true,
      filterable: true, filterFieldName: 'q', filterKind: 'text',
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE}>{row.title}</span>
          <span style={TITLE_META_STYLE}>{row.short_id} · {row.year ?? '—'}</span>
        </div>
      ),
    },
    // ── type 列：Pill neutral + 中文映射（reference §6.1 中性映射）──
    // sub C：enum filter / filterFieldName='type'
    {
      id: 'type', header: '类型', accessor: (r) => r.type,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: true, filterFieldName: 'type', filterKind: 'enum', filterOptions: typeOptions,
      cell: ({ row }) => (
        <Pill variant="neutral">{TYPE_LABELS[row.type] ?? row.type}</Pill>
      ),
    },
    // ── year 列（默认隐藏；title 列 meta 已显示 year）──
    {
      id: 'year', header: '年份', accessor: (r) => r.year ?? '',
      width: 100, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    // ── sources 列：reference §6.1 dot + 数字 + 活跃/一般/稀少 文案 ──
    // CHG-UX2-03b 收窄 100 → 90（消除横滚 → frame 圆角完整）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'source_health' → ORDER BY active_source_count
    // 撤回 PATCH-1 错误"enableSorting: false"反范式（违反 AMD2 D-150-AMD2-1 默认全开）
    {
      id: 'source_health', header: '源活跃', accessor: (r) => r.active_source_count ?? r.source_count,
      width: 90, minWidth: 80, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => {
        const active = parseInt(row.active_source_count ?? row.source_count ?? '0', 10)
        return (
          <span style={SOURCES_CELL_STYLE} data-testid="source-health">
            <span aria-hidden="true" style={{ ...SOURCES_DOT_STYLE, background: sourcesDotColor(active) }} />
            <strong style={SOURCES_NUM_STYLE}>{active}</strong>
            <span style={SOURCES_LABEL_STYLE}>{sourcesLabel(active)}</span>
          </span>
        )
      },
    },
    // ── probe 列：reference §6.1 DualSignal 探测/播放双信号 ──
    // 后端暂未提供 probe / render 字段；先传 'unknown' / 'unknown' 占位（STATS-EXTEND-VIDEOS follow-up）
    // CHG-UX2-03b 收窄 140 → 110（消除横滚）
    // AMD2-PATCH-2：保留 enableSorting: false — 后端 schema 真无 probe / render 字段（placeholder
    //   accessor 返回固定字符串 / 排序无意义）/ 待 STATS-EXTEND-VIDEOS 补字段后启用
    {
      id: 'probe', header: '探测/播放', accessor: () => 'probe-render',
      width: 110, minWidth: 100, enableResizing: true, enableSorting: false, defaultVisible: true,
      cell: () => <DualSignal probe="unknown" render="unknown" />,
    },
    // ── image 列：reference §6.1 P0 失效|活跃 Pill ──
    // CHG-UX2-03b 默认隐藏（消除横滚 → 用户可手动开）
    // AMD2-PATCH-2：保留 enableSorting: false — image_health 是 poster_status + backdrop_status
    //   复合派生（accessor 拼字符串）/ 后端无对应复合 SQL 排序字段 / 拆分排序 UX 不清晰
    //   后续补 image_health enum 字段（如 'ok' / 'partial' / 'broken'）后端 ORDER BY 后启用
    {
      id: 'image_health', header: '图片', accessor: (r) => `${r.poster_status ?? '-'}/${r.backdrop_status ?? '-'}`,
      width: 100, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      cell: ({ row }) => {
        const variant = imageHealthVariant(row)
        return (
          <Pill variant={variant} testId="image-health">
            P0 {variant === 'ok' ? '活跃' : '失效'}
          </Pill>
        )
      },
    },
    // ── visibility 列：reference §6.1 VisChip（visibility + review 复合）──
    // sub C：enum filter / filterFieldName='visibilityStatus'（D-150-4 业务 key 桥接 column.id ≠ filterFieldName）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'visibility' → ORDER BY v.visibility_status
    {
      id: 'visibility', header: '可见性', accessor: (r) => r.visibility_status ?? '',
      width: 120, minWidth: 110, enableResizing: true, defaultVisible: true,
      filterable: true, filterFieldName: 'visibilityStatus', filterKind: 'enum', filterOptions: visibilityOptions,
      cell: ({ row }) => (row.visibility_status && row.review_status)
        ? <VisChip visibility={row.visibility_status} review={row.review_status} />
        : null,
    },
    // ── review 列：reference §6.1 单 review pill（不复用 VisChip，因 visibility 列已承担复合状态）──
    // sub C：enum filter / filterFieldName='reviewStatus'（D-150-4 业务 key 桥接）
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'review_status' → ORDER BY v.review_status
    {
      id: 'review_status', header: '审核', accessor: (r) => r.review_status ?? '',
      width: 90, minWidth: 80, enableResizing: true, defaultVisible: true,
      filterable: true, filterFieldName: 'reviewStatus', filterKind: 'enum', filterOptions: reviewOptions,
      cell: ({ row }) => row.review_status
        ? <Pill variant={reviewPillVariant(row.review_status)}>{reviewPillLabel(row.review_status)}</Pill>
        : null,
    },
    // ── enrichment 列：META-11 / feature-2 富集徽标簇（EnrichmentBadgeCluster density='row'）──
    // 合并展示豆瓣/Bangumi(anime)/源活性/元数据完整度/拼音警告；消费 ADR-170 enrichmentSummary（admin 注入）
    // anime-only bangumi 门控由 Cluster 内部依 row.type 处理；enrichmentSummary 缺省（旧行/未注入）→ 不渲染
    {
      id: 'enrichment', header: '富集', accessor: (r) => r.enrichmentSummary ? String(r.enrichmentSummary.metaScore) : '',
      width: 150, minWidth: 120, enableResizing: true, enableSorting: false, defaultVisible: true,
      cell: ({ row }) => row.enrichmentSummary
        ? <EnrichmentBadgeCluster summary={row.enrichmentSummary} type={row.type} density="row" />
        : null,
    },
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'douban_status' → ORDER BY v.douban_status
    {
      id: 'douban_status', header: '豆瓣状态', accessor: (r) => r.douban_status ?? '',
      width: 180, minWidth: 160, enableResizing: true, defaultVisible: false,
    },
    // AMD2-PATCH-2：后端 SORT_FIELDS 扩展 'meta_score' → ORDER BY v.meta_score
    {
      id: 'meta_score', header: '元数据完整度', accessor: (r) => r.meta_score ?? '',
      width: 160, minWidth: 140, enableResizing: true, defaultVisible: false,
    },
    {
      id: 'created_at', header: '创建时间', accessor: (r) => r.created_at,
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    {
      id: 'updated_at', header: '更新时间', accessor: (r) => r.updated_at ?? '',
      width: 160, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: false,
    },
    // ── actions 列：reference §6.1 ──
    // 8A 第一阶段保留 VideoRowActions（AdminDropdown 形态）；inline xs btn ×5 重构留 8A 第二阶段
    // CHG-UX2-03b 收窄 170 → 150（消除横滚）
    {
      // DTR-F：解禁列宽（action 列 opt-in：enableResizing:true 才可调）；width 150→120 贴合
      // VideoRowActions(AdminDropdown) 实宽 + 容下表头「操作」2 字。
      id: 'actions', kind: 'action', header: '操作', accessor: () => null,
      width: 120, minWidth: 100, enableResizing: true, defaultVisible: true,
      cell: ({ row }) => (
        <VideoRowActions
          row={row}
          isAdmin={isAdmin}
          onRowUpdate={onRowUpdate}
          onEditRequest={onEditRequest}
        />
      ),
    },
  ]
}
