'use client'

/**
 * VideoColumns.tsx — 视频库列定义
 *
 * CHG-VSR-4-A（设计 §2.2/§2.3/§2.4/§2.5）：职责回归后的列重构。
 * - 默认可见复合列：cover / title(视频) / type / release(发行信息) / episodes(集数) /
 *   meta(元数据) / status(内容状态) / updated / actions
 * - §2.3 降级为可选列（默认隐藏，保留能力）：source_health(保留排序) / probe(占位) / image_health
 * - §2.6② 默认隐藏原子可筛选列（render-only，filter 接线留 CHG-VSR-4-B）：
 *   year / country / catalog_status(连载) / visibility / review_status / is_published /
 *   douban_status / bangumi_status / meta_score / created_at
 *
 * 排序：DataTable 以 column.id 作 sort.field（无独立 sortField 契约 / `sortable` 仅看 enableSorting）；
 * 复合列 id 语义化，排序映射到后端字段由 VideoFilterFields.buildVideoFilter COMPOSITE_SORT_MAP 承担。
 * 筛选（§0.3 阻断项 1 / §2.6）：data-kind 列默认 filterable=true（D-150-AMD2-1），故复合显示列与
 * 未接线原子列一律显式 filterable:false（"复合显示列只读不挂筛选"）；4-A 筛选面 = title/type/
 * visibility/review_status（既有可用）；其余原子列 enum/range filter 接线留 CHG-VSR-4-B。
 */

import type { CSSProperties, ReactElement } from 'react'
import {
  Pill, VisChip, Thumb, DualSignal, MetadataSourceIconCluster, CountryName,
  OVERALL_LABEL, ISSUE_LEVEL_LABEL,
  type TableColumn,
} from '@resovo/admin-ui'
import {
  VIDEO_STATUSES, DOUBAN_STATUSES, BANGUMI_STATUSES,
  METADATA_PROVIDERS, METADATA_STATUS_OVERALLS, METADATA_ISSUE_LEVELS,
  type DualSignalDisplayState, type MetadataProviderState,
} from '@resovo/types'
import type {
  VideoAdminRow, VideoType, VideoStatus, VisibilityStatus, DoubanStatus, MetadataProvider,
} from '@/lib/videos'
import type { TabKey } from './_videoEdit/types'
import { VideoRowActions } from './VideoRowActions'

// ── 探测/试播聚合 → DualSignal 显示态（SRCHEALTH-P1-1-B / B1）──────
// source_check_status / render_check_status 四态（pending/ok/partial/all_dead）映射显示五态；
// 字段缺失（旧缓存行 / 无 active 源 NULL）→ unknown
function checkStatusToSignal(s: string | undefined | null): DualSignalDisplayState {
  switch (s) {
    case 'ok':       return 'ok'
    case 'partial':  return 'partial'
    case 'all_dead': return 'dead'
    case 'pending':  return 'pending'
    default:         return 'unknown'
  }
}

// ── 中文标签映射 ──────────────────────────────────────────────────

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

// 可见性中文映射（visibility 原子列；与 VISIBILITY_OPTIONS 同义，columns 层内联避免反向依赖 FilterFields）
const VISIBILITY_LABELS: Record<VisibilityStatus, string> = {
  public: '公开',
  internal: '内部',
  hidden: '隐藏',
}

// 豆瓣/Bangumi 匹配状态中文映射（DOUBAN_STATUSES / BANGUMI_STATUSES 同集 4 态镜像）
const MATCH_STATUS_LABELS: Record<DoubanStatus, string> = {
  pending: '待匹配',
  matched: '已匹配',
  candidate: '候选',
  unmatched: '未匹配',
}

// META-36-A：元数据 provider 显示名（镜像 admin-ui enrichment-logos SOURCE_LABEL；后者未 barrel 导出，
// 仅用于 metadataProvider facet 过滤项 label，cell 图标簇命名由 -B MetadataSourceIconCluster 内部承担）。
const METADATA_PROVIDER_LABELS: Record<MetadataProvider, string> = {
  douban: '豆瓣',
  bangumi: 'Bangumi',
  tmdb: 'TMDB',
  imdb: 'IMDb',
}

// ── 样式常量 ──────────────────────────────────────────────────────

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

// 两行复合 cell 通用容器（release）
const STACK_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, alignItems: 'flex-start',
}
const STACK_LINE1_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
}
// 单行 muted 文本（updated / created_at / 集数 / 原子列降级）
const MUTED_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', whiteSpace: 'nowrap',
}
// 集数「已播 > 收录」warn 强调（外部领先爬虫）
const EPISODES_WARN_STYLE: CSSProperties = {
  color: 'var(--state-warning-fg)', fontWeight: 600,
}
// 内容状态：VisChip + 发布 dot 横排
const STATUS_CELL_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0,
}
const PUBLISH_DOT_STYLE: CSSProperties = {
  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
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

// ── 派生 helper ───────────────────────────────────────────────────

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

// 连载状态（mc.status）→ 完结(ok) / 连载(warn) / 未知(neutral)（§2.4）
function catalogStatusVariant(status: VideoStatus | undefined): 'ok' | 'warn' | 'neutral' {
  if (status === 'completed') return 'ok'
  if (status === 'ongoing') return 'warn'
  return 'neutral'
}
function catalogStatusLabel(status: VideoStatus | undefined): string {
  if (status === 'completed') return '完结'
  if (status === 'ongoing') return '连载'
  return '未知'
}

// ── 复合列 render（§2.2 / §2.4）─────────────────────────────────────

// 发行信息：① {year} · {country} ② Pill{完结/连载/未知}（取 mc.status）
function ReleaseCell({ row }: { row: VideoAdminRow }): ReactElement {
  const yearText = row.year != null ? String(row.year) : '—'
  return (
    <div style={STACK_CELL_STYLE} data-testid="release-cell">
      <span style={STACK_LINE1_STYLE}>
        {yearText} · <CountryName code={row.country} muted />
      </span>
      <Pill variant={catalogStatusVariant(row.status)}>{catalogStatusLabel(row.status)}</Pill>
    </div>
  )
}

// 集数降级（§2.4）：
//  - 电影 → '—'
//  - 三值齐全 → 收录 N · 已播 M / 共 K（已播>收录 → 已播染 warn + hover 提示）
//  - 仅收录（已播 / 共 任一缺失）→ 收录 N
//  - 全空 → '—'
function EpisodesCell({ row }: { row: VideoAdminRow }): ReactElement {
  if (row.type === 'movie') {
    return <span style={MUTED_TEXT_STYLE} data-testid="episodes-cell">—</span>
  }
  const recorded = row.episode_count
  if (recorded == null) {
    return <span style={MUTED_TEXT_STYLE} data-testid="episodes-cell">—</span>
  }
  const current = row.current_episodes
  const total = row.total_episodes
  if (current == null || total == null) {
    return <span style={MUTED_TEXT_STYLE} data-testid="episodes-cell">收录 {recorded}</span>
  }
  const aired = current > recorded
  return (
    <span
      style={MUTED_TEXT_STYLE}
      data-testid="episodes-cell"
      title={aired ? '外部数据领先于已收录' : undefined}
    >
      收录 {recorded} · <span style={aired ? EPISODES_WARN_STYLE : undefined}>已播 {current}</span> / 共 {total}
    </span>
  )
}

// 内容状态：VisChip（visibility × review 复合）+ 发布 dot（已上架 ok / 草稿 muted）
function StatusCell({ row }: { row: VideoAdminRow }): ReactElement | null {
  if (!row.visibility_status || !row.review_status) return null
  return (
    <span style={STATUS_CELL_STYLE} data-testid="status-cell">
      <VisChip visibility={row.visibility_status} review={row.review_status} />
      <span
        aria-hidden="true"
        style={{
          ...PUBLISH_DOT_STYLE,
          background: row.is_published ? 'var(--state-success-fg)' : 'var(--fg-muted)',
        }}
      />
      <span style={MUTED_TEXT_STYLE}>{row.is_published ? '已上架' : '草稿'}</span>
    </span>
  )
}

// ── 原子可筛选列静态选项（CHG-VSR-4-B / 设计 §2.6②）──────────────────
// 值域取 @resovo/types SSOT 常量，label 复用本文件中文映射（避免与列 cell 文案漂移）。
// country 列无静态选项（走 distinctFetcher / media_catalog.country，CHG-VSR-2 白名单已加）。
const CATALOG_STATUS_OPTIONS: readonly { value: string; label: string }[] =
  VIDEO_STATUSES.map((s) => ({ value: s, label: catalogStatusLabel(s) }))
const DOUBAN_STATUS_OPTIONS: readonly { value: string; label: string }[] =
  DOUBAN_STATUSES.map((s) => ({ value: s, label: MATCH_STATUS_LABELS[s] }))
const BANGUMI_STATUS_OPTIONS: readonly { value: string; label: string }[] =
  BANGUMI_STATUSES.map((s) => ({ value: s, label: MATCH_STATUS_LABELS[s] }))
const IS_PUBLISHED_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'published', label: '已上架' },
  { value: 'draft', label: '草稿' },
]

// META-36-A（ADR-201 §视频库 过滤）：元数据状态多维过滤项（卡面范围 overall/provider/issue/updatedAt；
// score 由既有 meta_score 列承担；providerState 后端已就绪但本卡 UI 不接，留 follow-up）。
// 值域取 @resovo/types SSOT 常量，label 复用 admin-ui metadata-status barrel 文案（OVERALL/ISSUE_LEVEL）
// + 本地 provider 显示名，避免与图标簇 tooltip 文案漂移。
const METADATA_OVERALL_OPTIONS: readonly { value: string; label: string }[] =
  METADATA_STATUS_OVERALLS.map((v) => ({ value: v, label: OVERALL_LABEL[v] }))
const METADATA_PROVIDER_OPTIONS: readonly { value: string; label: string }[] =
  METADATA_PROVIDERS.map((v) => ({ value: v, label: METADATA_PROVIDER_LABELS[v] }))
const METADATA_ISSUE_LEVEL_OPTIONS: readonly { value: string; label: string }[] =
  METADATA_ISSUE_LEVELS.map((v) => ({ value: v, label: ISSUE_LEVEL_LABEL[v] }))

// provider「有数据」判定（state ∈ applied/candidate/problem，与后端 metadataProvider facet 谓词同口径）；
// 仅用于 metadata_provider 列被取消隐藏时的 cell 显示提示（哪些来源已有数据）。
const METADATA_PRESENT_STATES: ReadonlySet<MetadataProviderState> = new Set(['applied', 'candidate', 'problem'])

// ── column definitions（设计 §2.2 默认可见 + §2.3/§2.6② 默认隐藏）────
// CHG-VSR-4-B：onEditRequest 扩 tab 参（图片/外部元数据/查看播放线路 深链 VideoEditDrawer tab）。
export function buildVideoColumns(
  isAdmin: boolean,
  onRowUpdate: (id: string, patch: Partial<VideoAdminRow>) => void,
  onEditRequest: (id: string, tab?: TabKey) => void,
  typeOptions: readonly { value: string; label?: string }[] = [],
  visibilityOptions: readonly { value: string; label?: string }[] = [],
  reviewOptions: readonly { value: string; label?: string }[] = [],
): readonly TableColumn<VideoAdminRow>[] {
  return [
    // ════ 默认可见列（§2.2）════
    // cover：Thumb poster-md 48×72；width 72 = Thumb 48 + cell padding 24 已贴合内容
    // （设计 §2.2 标 56 沿用旧 poster-sm，poster-md 需 72；e2e dt-resize-handle-cover 依赖保留）
    {
      id: 'cover', kind: 'media', header: '封面', accessor: (r) => r.cover_url,
      width: 72, minWidth: 56, defaultVisible: true,
      cell: ({ row }) => <Thumb src={row.cover_url} size="poster-md" />,
    },
    // title「视频」：① 标题 ② {title_en ?? title_original} · {short_id}（§2.2）
    // pinned 静态锁定（§1.1-3）；保留 q text filter（搜索入口；搜索框 q 多列扩面留 4-B）
    {
      id: 'title', header: '视频', accessor: (r) => r.title,
      minWidth: 220, enableResizing: true, enableSorting: true, defaultVisible: true, pinned: true,
      filterable: true, filterFieldName: 'q', filterKind: 'text',
      cell: ({ row }) => (
        <div style={TITLE_CELL_STYLE}>
          <span style={TITLE_TEXT_STYLE}>{row.title}</span>
          <span style={TITLE_META_STYLE}>{row.title_en ?? row.title_original ?? '—'} · {row.short_id}</span>
        </div>
      ),
    },
    // type：Pill neutral + 中文映射；保留 enum filter
    {
      id: 'type', header: '类型', accessor: (r) => r.type,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: true, filterFieldName: 'type', filterKind: 'enum', filterOptions: typeOptions,
      cell: ({ row }) => (
        <Pill variant="neutral">{TYPE_LABELS[row.type] ?? row.type}</Pill>
      ),
    },
    // release 发行信息（复合，§2.6 只读不挂筛选）：sortable→year（COMPOSITE_SORT_MAP）
    {
      id: 'release', header: '发行信息', accessor: (r) => r.year ?? '',
      width: 150, minWidth: 130, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: false,
      cell: ({ row }) => <ReleaseCell row={row} />,
    },
    // episodes 集数（复合，§2.6 只读不挂筛选）：sortable→episode_count；§2.4 降级
    {
      id: 'episodes', header: '集数', accessor: (r) => r.episode_count ?? '',
      width: 140, minWidth: 120, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: false,
      cell: ({ row }) => <EpisodesCell row={row} />,
    },
    // meta 元数据（复合，§2.6 只读不挂筛选）：sortable→metadata_status（META-36-A 运营优先级）
    // META-36-B（D-201-3）：四来源图标簇 density='table'（固定顺序四源、空态四灰图标 + tooltip，
    // 取代退役 EnrichmentBadgeCluster）；metadataStatus 缺省（旧行/未派生）→ 不渲染兜底。
    {
      id: 'meta', header: '元数据', accessor: (r) => r.meta_score ?? '',
      width: 170, minWidth: 140, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: false,
      cell: ({ row }) => row.metadataStatus
        ? <MetadataSourceIconCluster summary={row.metadataStatus} density="table" />
        : null,
    },
    // status 内容状态（复合，§2.6 只读不挂筛选）：sortable→review_status
    {
      id: 'status', header: '内容状态', accessor: (r) => r.review_status ?? '',
      width: 150, minWidth: 130, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: false,
      cell: ({ row }) => <StatusCell row={row} />,
    },
    // updated 更新时间（默认可见，§2.2）：sortable→updated_at（直通）；date-range filter 留 4-B
    {
      id: 'updated_at', header: '更新时间', accessor: (r) => r.updated_at ?? '',
      width: 110, minWidth: 90, enableResizing: true, enableSorting: true, defaultVisible: true,
      filterable: false,
      cell: ({ row }) => <span style={MUTED_TEXT_STYLE}>{row.updated_at ?? '—'}</span>,
    },
    // actions 操作：VideoRowActions（溢出菜单内容扩展留 4-B）；action opt-in resize
    {
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

    // ════ 默认隐藏可选列（§2.3 职责回归降级）════
    // source_health 源活跃：§2.3 降级可选列但保留排序能力（sortable→source_health 直通）
    {
      id: 'source_health', header: '源活跃', accessor: (r) => r.active_source_count ?? r.source_count,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: true, defaultVisible: false,
      filterable: false,
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
    // probe 探测/播放：SRCHEALTH-P1-1-B（B1）接真数据——probe=source_check_status / render=render_check_status
    // （listAdminVideos 聚合，SRCHEALTH-P1-1-A）；排序经 COMPOSITE_SORT_MAP probe→source_check_status
    {
      id: 'probe', header: '探测/播放',
      accessor: (r) => `${r.source_check_status ?? '-'}/${r.render_check_status ?? '-'}`,
      width: 110, minWidth: 100, enableResizing: true, enableSorting: true, defaultVisible: false,
      filterable: false,
      cell: ({ row }) => (
        <DualSignal
          probe={checkStatusToSignal(row.source_check_status)}
          render={checkStatusToSignal(row.render_check_status)}
        />
      ),
    },
    // image_health 图片：§2.3 P0 复合派生（poster + backdrop），无对应复合 SQL 排序字段 → 禁排序
    {
      id: 'image_health', header: '图片', accessor: (r) => `${r.poster_status ?? '-'}/${r.backdrop_status ?? '-'}`,
      width: 100, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: false,
      cell: ({ row }) => {
        const variant = imageHealthVariant(row)
        return (
          <Pill variant={variant} testId="image-health">
            P0 {variant === 'ok' ? '活跃' : '失效'}
          </Pill>
        )
      },
    },

    // ════ 默认隐藏原子可筛选列（§2.6②；CHG-VSR-4-B filter 接线）════
    // year 年份：number-range 筛选（→ yearMin/yearMax）；排序由 release 复合列承担 → 禁排序避免冗余
    {
      id: 'year', header: '年份', accessor: (r) => r.year ?? '',
      width: 100, minWidth: 80, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'year', filterKind: 'number',
      cell: ({ row }) => <span style={MUTED_TEXT_STYLE}>{row.year ?? '—'}</span>,
    },
    // country 出品地区：CountryName（ISO→中文）；enum filter 走 distinct（media_catalog.country，CHG-VSR-2 白名单已加）
    {
      id: 'country', header: '出品地区', accessor: (r) => r.country ?? '',
      width: 110, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'country', filterKind: 'enum', filterDistinctTable: 'media_catalog',
      cell: ({ row }) => <CountryName code={row.country} muted />,
    },
    // ADR-206 D-206-9（3B-3）：原名独立列（默认隐藏，按需显示；title 副行已含 title_original 兜底）
    {
      id: 'title_original', header: '原名', accessor: (r) => r.title_original ?? '',
      width: 160, minWidth: 120, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: false,
      cell: ({ row }) => <span style={TITLE_META_STYLE}>{row.title_original ?? '—'}</span>,
    },
    // catalog_status 连载状态：Pill 完结/连载/未知（mc.status）；enum filter（→ catalogStatus[]）
    {
      id: 'catalog_status', header: '连载状态', accessor: (r) => r.status ?? '',
      width: 100, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'catalogStatus', filterKind: 'enum', filterOptions: CATALOG_STATUS_OPTIONS,
      cell: ({ row }) => (
        <Pill variant={catalogStatusVariant(row.status)}>{catalogStatusLabel(row.status)}</Pill>
      ),
    },
    // visibility 可见性：原子单值（status 复合列已承担 VisChip）；保留既有 enum filter 避免回归
    {
      id: 'visibility', header: '可见性', accessor: (r) => r.visibility_status ?? '',
      width: 100, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'visibilityStatus', filterKind: 'enum', filterOptions: visibilityOptions,
      cell: ({ row }) => row.visibility_status
        ? <Pill variant="neutral">{VISIBILITY_LABELS[row.visibility_status]}</Pill>
        : null,
    },
    // review_status 审核：单 review pill；保留既有 enum filter 避免回归
    {
      id: 'review_status', header: '审核', accessor: (r) => r.review_status ?? '',
      width: 90, minWidth: 80, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'reviewStatus', filterKind: 'enum', filterOptions: reviewOptions,
      cell: ({ row }) => row.review_status
        ? <Pill variant={reviewPillVariant(row.review_status)}>{reviewPillLabel(row.review_status)}</Pill>
        : null,
    },
    // is_published 发布：Pill 已上架/草稿；enum filter（单值 → isPublished bool）
    {
      id: 'is_published', header: '发布', accessor: (r) => (r.is_published ? 'published' : 'draft'),
      width: 90, minWidth: 80, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'isPublished', filterKind: 'enum', filterOptions: IS_PUBLISHED_OPTIONS,
      cell: ({ row }) => (
        <Pill variant={row.is_published ? 'ok' : 'neutral'}>{row.is_published ? '已上架' : '草稿'}</Pill>
      ),
    },
    // douban_status 豆瓣状态：4 态中文；enum filter（→ doubanStatus[]）
    {
      id: 'douban_status', header: '豆瓣状态', accessor: (r) => r.douban_status ?? '',
      width: 110, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'doubanStatus', filterKind: 'enum', filterOptions: DOUBAN_STATUS_OPTIONS,
      cell: ({ row }) => (
        <span style={MUTED_TEXT_STYLE}>{row.douban_status ? MATCH_STATUS_LABELS[row.douban_status] : '—'}</span>
      ),
    },
    // bangumi_status Bangumi 状态（仅 anime）：4 态中文；enum filter（→ bangumiStatus[]）
    {
      id: 'bangumi_status', header: 'Bangumi', accessor: (r) => r.bangumi_status ?? '',
      width: 110, minWidth: 90, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'bangumiStatus', filterKind: 'enum', filterOptions: BANGUMI_STATUS_OPTIONS,
      cell: ({ row }) => (
        <span style={MUTED_TEXT_STYLE}>
          {row.type === 'anime' && row.bangumi_status ? MATCH_STATUS_LABELS[row.bangumi_status] : '—'}
        </span>
      ),
    },
    // meta_score 元数据完整度：number-range 筛选（→ metaScoreMin/metaScoreMax）；
    // META-36-A：解禁排序 → 完整度数值专用排序字段（COMPOSITE_SORT_MAP meta_score→metadata_score，
    // ADR-201「完整度数值排序保留为独立字段」；与 meta 复合列的运营优先级 metadata_status 排序分离）
    {
      id: 'meta_score', header: '元数据完整度', accessor: (r) => r.meta_score ?? '',
      width: 140, minWidth: 120, enableResizing: true, enableSorting: true, defaultVisible: false,
      filterable: true, filterFieldName: 'metaScore', filterKind: 'number',
      cell: ({ row }) => <span style={MUTED_TEXT_STYLE}>{row.meta_score ?? '—'}</span>,
    },
    // ════ META-36-A：元数据状态多维过滤列（默认隐藏、filter-only；ADR-201 §视频库 过滤）════
    // metadata_overall 整体状态：enum 多选（→ metadataOverall[]，经 md.metadata_status_rank 服务端过滤）
    {
      id: 'metadata_overall', header: '元数据状态', accessor: (r) => r.metadataStatus?.overall ?? '',
      width: 120, minWidth: 100, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'metadataOverall', filterKind: 'enum', filterOptions: METADATA_OVERALL_OPTIONS,
      cell: ({ row }) => (
        <span style={MUTED_TEXT_STYLE}>{row.metadataStatus ? OVERALL_LABEL[row.metadataStatus.overall] : '—'}</span>
      ),
    },
    // metadata_provider 来源 facet：enum 多选（→ metadataProvider[]，选中 provider 任一有数据 OR 合流）
    {
      id: 'metadata_provider', header: '元数据来源', accessor: (r) => r.metadataStatus?.primaryProvider ?? '',
      width: 130, minWidth: 110, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'metadataProvider', filterKind: 'enum', filterOptions: METADATA_PROVIDER_OPTIONS,
      cell: ({ row }) => {
        const s = row.metadataStatus
        if (!s) return <span style={MUTED_TEXT_STYLE}>—</span>
        const present = METADATA_PROVIDERS.filter((p) => METADATA_PRESENT_STATES.has(s.providers[p].state))
        return (
          <span style={MUTED_TEXT_STYLE}>
            {present.length ? present.map((p) => METADATA_PROVIDER_LABELS[p]).join('·') : '—'}
          </span>
        )
      },
    },
    // metadata_issue_level 问题等级：enum 多选（→ metadataIssueLevel[]，经 md.metadata_issue_rank 服务端过滤）
    {
      id: 'metadata_issue_level', header: '元数据问题', accessor: (r) => r.metadataStatus?.issueLevel ?? '',
      width: 120, minWidth: 100, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'metadataIssueLevel', filterKind: 'enum', filterOptions: METADATA_ISSUE_LEVEL_OPTIONS,
      cell: ({ row }) => (
        <span style={MUTED_TEXT_STYLE}>{row.metadataStatus ? ISSUE_LEVEL_LABEL[row.metadataStatus.issueLevel] : '—'}</span>
      ),
    },
    // metadata_updated 最近增强：date-range 筛选（→ metadataUpdatedFrom/To，enriched_at 服务端范围）
    {
      id: 'metadata_updated', header: '元数据更新', accessor: (r) => r.metadataStatus?.enrichedAt ?? '',
      width: 120, minWidth: 100, enableResizing: true, enableSorting: false, defaultVisible: false,
      filterable: true, filterFieldName: 'metadataUpdated', filterKind: 'date',
      cell: ({ row }) => (
        <span style={MUTED_TEXT_STYLE}>{row.metadataStatus?.enrichedAt ? row.metadataStatus.enrichedAt.slice(0, 10) : '—'}</span>
      ),
    },
    // created_at 创建时间：§2.3 既有隐藏列保留排序（sortable→created_at 直通）
    {
      id: 'created_at', header: '创建时间', accessor: (r) => r.created_at,
      width: 110, minWidth: 90, enableResizing: true, enableSorting: true, defaultVisible: false,
      filterable: false,
      cell: ({ row }) => <span style={MUTED_TEXT_STYLE}>{row.created_at}</span>,
    },
  ]
}
