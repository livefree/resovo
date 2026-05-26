'use client'

/**
 * KeywordCrawlDrawer.tsx — 关键词采集预览 + 立即触发 Drawer（CW1-C）
 *
 * 真源：~/.claude/plans/cheerful-orbiting-hare.md §W1 拆卡 3 + §10.4.3 Fix-D6
 *
 * 端点（沿用已实装，0 新增）：
 *   - POST /admin/crawler/keyword-preview   — 预览各站点搜索结果（不写库）
 *   - POST /admin/crawler/runs              — crawlMode='keyword' / triggerType='batch'
 *
 * 交互：
 *   1) keyword 必填 1–100 字符 + 类型 select（VideoType 7 项 + 全部）
 *   2) siteKeys 多选（默认勾选所有 enabled 站点，全选/反选；至少 1 个）
 *   3) 「预览」→ 拉取预览结果（每站点 items + 可选 error）
 *   4) 「立即采集」→ 触发 run + toast deep-link「查看本次新增视频」+ close
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  Drawer,
  AdminButton,
  AdminInput,
  AdminCheckbox,
  AdminSelect,
  DataTable,
  EmptyState,
  Pill,
  useToast,
  type AdminSelectOption,
  type PillVariant,
  type TableColumn,
  type TableQuerySnapshot,
} from '@resovo/admin-ui'
import {
  previewKeyword,
  runCrawlerKeyword,
  type CrawlerSite,
  type KeywordPreviewItem,
  type KeywordPreviewResult,
  type KeywordPreviewSourceStatus,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

// ── 样式 ──────────────────────────────────────────────────────────

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  padding: '4px',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const SECTION_DIVIDER_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  paddingTop: '4px',
  borderTop: '1px solid var(--border-subtle)',
}

const SITE_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const SITE_TOOLBAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '6px',
}

const SITE_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '4px 12px',
  maxHeight: '160px',
  overflowY: 'auto',
  padding: '4px 2px',
}

const SITE_ROW_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: 'var(--font-size-sm)',
}

const RESULT_BLOCK_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  paddingTop: '4px',
}

const SUMMARY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 0 4px',
  borderTop: '1px solid var(--border-subtle)',
  marginTop: '8px',
}

// ── 常量 ──────────────────────────────────────────────────────────

/** VideoType 真源（packages/types/src/video.types.ts）— 高频 6 项，避免 sports/music/news/kids/other 过载下拉 */
const TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: '', label: '全部类型' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '连续剧' },
  { value: 'anime', label: '动画' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短剧' },
]

const SOURCE_STATUS_LABEL: Record<KeywordPreviewSourceStatus, string> = {
  ok: '可达',
  error: '错误',
  timeout: '超时',
  unknown: '未知',
}

const SOURCE_STATUS_VARIANT: Record<KeywordPreviewSourceStatus, PillVariant> = {
  ok: 'ok',
  error: 'danger',
  timeout: 'warn',
  unknown: 'neutral',
}

// ── 类型（预览结果扁平行） ────────────────────────────────────────

interface PreviewRow {
  readonly kind: 'item' | 'error'
  readonly key: string
  readonly siteKey: string
  readonly title: string
  readonly year: number | null
  readonly type: string | null
  readonly sourceCount: number
  readonly sourceStatus: KeywordPreviewSourceStatus
  readonly message: string | null
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'VALIDATION_ERROR') return { title: '参数校验失败', description: err.message }
    if (err.code === 'FORBIDDEN') return { title: '禁止操作', description: err.message }
    if (err.code === 'STATE_CONFLICT') return { title: '操作冲突', description: err.message }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

function flattenResults(results: readonly KeywordPreviewResult[]): readonly PreviewRow[] {
  const rows: PreviewRow[] = []
  results.forEach((res) => {
    if (res.error) {
      rows.push({
        kind: 'error',
        key: `err:${res.siteKey}`,
        siteKey: res.siteKey,
        title: '—',
        year: null,
        type: null,
        sourceCount: 0,
        sourceStatus: 'error',
        message: res.error,
      })
      return
    }
    res.items.forEach((item: KeywordPreviewItem, idx) => {
      rows.push({
        kind: 'item',
        key: `${res.siteKey}:${idx}:${item.title}`,
        siteKey: res.siteKey,
        title: item.title,
        year: item.year,
        type: item.type,
        sourceCount: item.sourceCount,
        sourceStatus: item.sourceStatus,
        message: null,
      })
    })
  })
  return rows
}

// ── Props ─────────────────────────────────────────────────────────

export interface KeywordCrawlDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  /** 由 CrawlerClient 透传当前已加载的站点列表（默认全选 enabled / disabled 站点不可勾） */
  readonly sites: readonly CrawlerSite[]
}

// ── Component ─────────────────────────────────────────────────────

export function KeywordCrawlDrawer({ open, onClose, sites }: KeywordCrawlDrawerProps) {
  const toast = useToast()
  const router = useRouter()

  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<string>('')
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<ReadonlySet<string>>(new Set())
  const [results, setResults] = useState<readonly KeywordPreviewResult[] | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 默认全选 enabled 站点（disabled 不参与采集）
  const enabledSites = useMemo(() => sites.filter((s) => !s.disabled), [sites])

  useEffect(() => {
    if (!open) return
    setKeyword('')
    setType('')
    setResults(null)
    setSelectedSiteKeys(new Set(enabledSites.map((s) => s.key)))
  }, [open, enabledSites])

  const toggleSite = useCallback((siteKey: string) => {
    setSelectedSiteKeys((prev) => {
      const next = new Set(prev)
      if (next.has(siteKey)) next.delete(siteKey)
      else next.add(siteKey)
      return next
    })
    setResults(null)
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedSiteKeys(new Set(enabledSites.map((s) => s.key)))
    setResults(null)
  }, [enabledSites])

  const handleInvertSelection = useCallback(() => {
    setSelectedSiteKeys((prev) => {
      const next = new Set<string>()
      enabledSites.forEach((s) => {
        if (!prev.has(s.key)) next.add(s.key)
      })
      return next
    })
    setResults(null)
  }, [enabledSites])

  const trimmedKeyword = keyword.trim()
  const keywordInvalid = trimmedKeyword.length === 0 || trimmedKeyword.length > 100
  const siteCount = selectedSiteKeys.size

  const handlePreview = useCallback(async () => {
    if (keywordInvalid) {
      toast.push({ title: '请输入 keyword', description: '1–100 字符', level: 'warn' })
      return
    }
    if (siteCount === 0) {
      toast.push({ title: '请至少选 1 个站点', level: 'warn' })
      return
    }
    setPreviewing(true)
    try {
      const data = await previewKeyword(
        trimmedKeyword,
        Array.from(selectedSiteKeys),
        type || undefined,
      )
      setResults(data)
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPreviewing(false)
    }
  }, [keywordInvalid, siteCount, trimmedKeyword, selectedSiteKeys, type, toast])

  const previewRows = useMemo(() => (results ? flattenResults(results) : []), [results])
  const hasAnyItem = previewRows.some((r) => r.kind === 'item')

  const handleRunCrawl = useCallback(async () => {
    if (!hasAnyItem) return
    setSubmitting(true)
    try {
      const result = await runCrawlerKeyword(trimmedKeyword, Array.from(selectedSiteKeys))
      toast.push({
        title: '已发起关键词采集',
        description: `runId=${result.runId.slice(0, 8)} · 入队 ${result.enqueuedSiteKeys.length} 个站点`,
        level: 'success',
        action: {
          label: '查看本次新增视频',
          onClick: () => {
            router.push(`/admin/moderation?run_id=${encodeURIComponent(result.runId)}`)
          },
        },
      })
      onClose()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }, [hasAnyItem, trimmedKeyword, selectedSiteKeys, toast, router, onClose])

  // ── DataTable v2 columns（kind: 'data' / 不开 sort+filter） ──────
  const columns: readonly TableColumn<PreviewRow>[] = useMemo(
    () => [
      {
        id: 'siteKey',
        kind: 'data',
        header: '站点',
        accessor: (r) => r.siteKey,
        filterable: false,
        enableSorting: false,
        width: 110,
        cell: ({ row }) => (
          <span style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 'var(--font-size-xs)' }}>
            {row.siteKey}
          </span>
        ),
      },
      {
        id: 'title',
        kind: 'data',
        header: '标题',
        accessor: (r) => r.title,
        filterable: false,
        enableSorting: false,
        cell: ({ row }) => {
          if (row.kind === 'error') {
            return (
              <span style={{ color: 'var(--state-error-fg, var(--fg-danger))' }} title={row.message ?? ''}>
                ⚠ 站点失败：{row.message}
              </span>
            )
          }
          return <span>{row.title}</span>
        },
      },
      {
        id: 'year',
        kind: 'data',
        header: '年份',
        accessor: (r) => r.year ?? '',
        filterable: false,
        enableSorting: false,
        width: 60,
        cell: ({ row }) => <span>{row.year ?? '—'}</span>,
      },
      {
        id: 'type',
        kind: 'data',
        header: '类型',
        accessor: (r) => r.type ?? '',
        filterable: false,
        enableSorting: false,
        width: 80,
        cell: ({ row }) => <span>{row.type ?? '—'}</span>,
      },
      {
        id: 'sourceCount',
        kind: 'data',
        header: '线路数',
        accessor: (r) => r.sourceCount,
        filterable: false,
        enableSorting: false,
        width: 70,
        cell: ({ row }) => <span>{row.kind === 'error' ? '—' : row.sourceCount}</span>,
      },
      {
        id: 'sourceStatus',
        kind: 'data',
        header: 'source 状态',
        accessor: (r) => r.sourceStatus,
        filterable: false,
        enableSorting: false,
        width: 100,
        cell: ({ row }) => (
          <Pill variant={SOURCE_STATUS_VARIANT[row.sourceStatus]}>
            {SOURCE_STATUS_LABEL[row.sourceStatus]}
          </Pill>
        ),
      },
    ],
    [],
  )

  const query: TableQuerySnapshot = useMemo(
    () => ({
      pagination: { page: 1, pageSize: 200 },
      sort: { field: undefined, direction: 'desc' },
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' },
    }),
    [],
  )

  // ── 立即采集按钮 disabled 文案 ───────────────────────────────────
  const runDisabledTitle =
    results === null ? '请先预览' : !hasAnyItem ? '预览无结果，无法采集' : undefined

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={680}
      title="关键词采集"
      data-testid="keyword-crawl-drawer"
    >
      <div style={BODY_STYLE} data-keyword-crawl-form>
        <div style={FIELD_STYLE}>
          <span style={LABEL_STYLE}>关键词（1–100 字符）</span>
          <AdminInput
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setResults(null) }}
            placeholder="输入视频名 / 关键词"
            maxLength={100}
            data-testid="keyword-crawl-keyword"
            aria-label="关键词"
          />
        </div>

        <div style={FIELD_STYLE}>
          <span style={LABEL_STYLE}>类型筛选</span>
          <AdminSelect
            options={TYPE_OPTIONS}
            value={type || ''}
            onChange={(v) => { setType(v ?? ''); setResults(null) }}
            data-testid="keyword-crawl-type"
            aria-label="视频类型筛选"
          />
        </div>

        {/* ── 站点选择 ──────────────────────────────────────────── */}
        <div style={SITE_HEADER_STYLE}>
          <span>已选 {siteCount} / {enabledSites.length} 个站点</span>
          <span style={SITE_TOOLBAR_STYLE}>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              data-testid="keyword-crawl-select-all"
            >
              全选
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={handleInvertSelection}
              data-testid="keyword-crawl-invert"
            >
              反选
            </AdminButton>
          </span>
        </div>

        {enabledSites.length === 0 ? (
          <span style={SUMMARY_STYLE} data-testid="keyword-crawl-no-sites">
            无 enabled 站点 — 请先在站点列表启用至少一个站点
          </span>
        ) : (
          <div style={SITE_GRID_STYLE} data-testid="keyword-crawl-sites">
            {enabledSites.map((s) => (
              <label key={s.key} style={SITE_ROW_STYLE} title={s.key}>
                <AdminCheckbox
                  checked={selectedSiteKeys.has(s.key)}
                  onChange={() => toggleSite(s.key)}
                  aria-label={`选择站点 ${s.key}`}
                  data-testid={`keyword-crawl-site-${s.key}`}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.displayName ?? s.name}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* ── 预览结果 ──────────────────────────────────────────── */}
        <div style={SECTION_DIVIDER_STYLE}>预览结果</div>

        {results === null ? (
          <span style={SUMMARY_STYLE} data-testid="keyword-crawl-preview-hint">
            点击「预览」拉取各站点搜索结果
          </span>
        ) : previewRows.length === 0 ? (
          <div data-testid="keyword-crawl-preview-empty">
            <EmptyState title="无匹配结果" description="尝试调整关键词或扩大站点选择" />
          </div>
        ) : (
          <div style={RESULT_BLOCK_STYLE} data-testid="keyword-crawl-preview-result">
            <span style={SUMMARY_STYLE}>
              共 {previewRows.filter((r) => r.kind === 'item').length} 条匹配
              {previewRows.some((r) => r.kind === 'error')
                ? ` · ${previewRows.filter((r) => r.kind === 'error').length} 站点失败`
                : ''}
            </span>
            <DataTable<PreviewRow>
              rows={previewRows}
              columns={columns}
              rowKey={(r) => r.key}
              mode="client"
              query={query}
              onQueryChange={() => { /* noop — 预览表无交互态 */ }}
              density="compact"
              pagination={{ hidden: true }}
              data-testid="keyword-crawl-preview-table"
            />
          </div>
        )}

        <div style={FOOTER_STYLE}>
          <AdminButton
            variant="ghost"
            onClick={onClose}
            disabled={previewing || submitting}
            data-testid="keyword-crawl-cancel"
          >
            取消
          </AdminButton>
          <AdminButton
            variant="default"
            onClick={() => void handlePreview()}
            loading={previewing}
            disabled={previewing || submitting || keywordInvalid || siteCount === 0}
            data-testid="keyword-crawl-preview-btn"
          >
            预览
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => void handleRunCrawl()}
            loading={submitting}
            disabled={previewing || submitting || !hasAnyItem}
            title={runDisabledTitle}
            data-testid="keyword-crawl-run-btn"
          >
            立即采集
          </AdminButton>
        </div>
      </div>
    </Drawer>
  )
}
