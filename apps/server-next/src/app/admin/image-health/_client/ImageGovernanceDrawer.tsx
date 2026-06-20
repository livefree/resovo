'use client'

/**
 * ImageGovernanceDrawer.tsx — 图片治理抽屉（IMGH-P2-3A / SEQ-20260619-02 / 设计 §6.3·§17.3.3）
 *
 * 缺图/破损行点击 → 右侧 680px 抽屉，承「预览 + 替换封面 + 补图 + 标记已解决」闭环。
 * 编排既有共享组件 + 端点（模块编排，非共享契约）：
 *   ① 图片矩阵：useVideoImages 4 类（poster/backdrop/logo/banner_backdrop）→ 点击 ImageLightbox（stills 无 hook 支撑省略）
 *   ② 破损详情：行字段 eventType/brokenDomain/occurrenceCount/lastSeenBrokenAt
 *   ③ 替换封面（聚焦 coverUrl）：ImageCandidatePicker → ImageCompare → applyImageCandidate；或手填 URL → updateVideoImage(PUT)
 *      §C 协同：持 Map<optionKey, ImageCandidate> 取回 sourceRef 构造 apply（否则 CANDIDATE_STALE 409 无从校验）
 *   ④ 标记已解决：row.eventId → resolveImageEvents（resolve 展示中的单个事件；不违反 BLOCK-2）
 *   ⑤ 成功 → toast + onMutated（父级 flash + refresh）
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  Drawer,
  AdminButton,
  AdminInput,
  Pill,
  ImageLightbox,
  ImageCompare,
  ImageCandidatePicker,
  useToast,
  type ImageStatus,
  type ImageCandidateOption,
  type ImageCompareConfirmPayload,
} from '@resovo/admin-ui'
import { useVideoImages, type VideoImageKind } from '@/lib/videos/use-images'
import {
  listImageCandidates,
  applyImageCandidate,
  resolveImageEvents,
  type ImageCandidate,
  type MissingVideoRow,
} from '@/lib/image-health/api'

// server-next ImageStatus（pending_review/ok/broken/unknown + missing）→ admin-ui ImageStatus
function toAdminImageStatus(s: string | null | undefined): ImageStatus | undefined {
  switch (s) {
    case 'ok':             return 'ok'
    case 'broken':         return 'broken'
    case 'missing':        return 'missing'
    case 'pending_review': return 'pending_review'
    case 'low_quality':    return 'low_quality'
    default:               return undefined // 'unknown' / null
  }
}

const candidateKey = (c: { source: string; sourceRef: string | null }): string =>
  `${c.source}::${c.sourceRef ?? ''}`

// ── 样式（全 token，零硬编码颜色） ────────────────────────────────

const BODY_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' }
const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--fg-default)', margin: '0 0 6px',
}
const MATRIX_STYLE: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px',
}
const MATRIX_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)', cursor: 'pointer', width: '100%',
}
const MATRIX_THUMB_STYLE: CSSProperties = {
  aspectRatio: '2 / 3', width: '100%', objectFit: 'cover',
  background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-sm)',
}
const MATRIX_FALLBACK_STYLE: CSSProperties = {
  aspectRatio: '2 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-muted)', fontSize: '20px',
}
const MATRIX_LABEL_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px',
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)',
}
const BROKEN_DETAIL_STYLE: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '8px 16px',
  fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)',
  padding: '8px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-sm)',
}
const MANUAL_ROW_STYLE: CSSProperties = { display: 'flex', gap: '8px', alignItems: 'center' }
const FOOTER_STYLE: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: '8px',
  paddingTop: '8px', borderTop: '1px solid var(--border-subtle)',
}

const MATRIX_KINDS: ReadonlyArray<{ readonly kind: VideoImageKind; readonly label: string }> = [
  { kind: 'poster', label: 'Poster' },
  { kind: 'backdrop', label: 'Backdrop' },
  { kind: 'logo', label: 'Logo' },
  { kind: 'banner_backdrop', label: 'Banner' },
]

const STATUS_PILL: Record<ImageStatus, 'ok' | 'warn' | 'danger' | 'info'> = {
  ok: 'ok', broken: 'danger', missing: 'danger', pending_review: 'warn', low_quality: 'info',
}

export interface ImageGovernanceDrawerProps {
  readonly open: boolean
  readonly row: MissingVideoRow | null
  readonly onClose: () => void
  /** apply/resolve/手填 成功后回调（父级行 flash + refresh）。 */
  readonly onMutated: (videoId: string) => void
}

export function ImageGovernanceDrawer({ open, row, onClose, onMutated }: ImageGovernanceDrawerProps) {
  return (
    <Drawer
      open={open && row != null}
      placement="right"
      width="min(680px, 90vw)"
      onClose={onClose}
      title={row ? `图片治理 · ${row.title}` : ''}
      data-testid="image-governance-drawer"
    >
      {row && <GovernanceBody key={row.videoId} row={row} onClose={onClose} onMutated={onMutated} />}
    </Drawer>
  )
}

// ── 抽屉主体（row 非空时挂载，hooks 恒有有效 videoId/catalogId） ─────

function GovernanceBody({
  row,
  onClose,
  onMutated,
}: {
  readonly row: MissingVideoRow
  readonly onClose: () => void
  readonly onMutated: (videoId: string) => void
}) {
  const toast = useToast()
  const [imagesState, imagesActions] = useVideoImages(row.videoId)

  const [candidates, setCandidates] = useState<readonly ImageCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string | null; title: string; status?: ImageStatus } | null>(null)

  // 候选拉取（聚焦 coverUrl）
  const loadCandidates = useCallback(() => {
    setCandidatesLoading(true)
    setCandidatesError(null)
    listImageCandidates(row.catalogId, 'coverUrl')
      .then((list) => setCandidates(list))
      .catch((e: unknown) => setCandidatesError(e instanceof Error ? e.message : '候选加载失败'))
      .finally(() => setCandidatesLoading(false))
  }, [row.catalogId])
  useEffect(() => { loadCandidates() }, [loadCandidates])

  // §C：候选键 → 原始候选（取回 sourceRef 构造 apply）
  const candidateMap = useMemo(
    () => new Map(candidates.map((c) => [candidateKey(c), c])),
    [candidates],
  )
  const options = useMemo<readonly ImageCandidateOption[]>(
    () => candidates.map((c) => ({
      key: candidateKey(c),
      url: c.url,
      source: c.source,
      confidence: c.confidence,
      isWinner: c.isWinner,
      applied: c.applied,
      sourceLabel: c.confidence != null ? `${c.source} ${c.confidence.toFixed(2)}` : c.source,
    })),
    [candidates],
  )
  const selectedCandidate = selectedKey ? candidateMap.get(selectedKey) ?? null : null

  const finishMutation = useCallback((title: string, description: string) => {
    toast.push({ title, description, level: 'success' })
    onMutated(row.videoId)
    onClose()
  }, [toast, onMutated, onClose, row.videoId])

  const fail = useCallback((title: string, err: unknown) => {
    toast.push({ title, description: err instanceof Error ? err.message : '请稍后重试', level: 'danger' })
  }, [toast])

  // ③ 应用候选（§C：从 map 取回 source/sourceRef）
  const handleApplyConfirm = useCallback(async (_payload: ImageCompareConfirmPayload) => {
    if (!selectedCandidate) return
    setPending(true)
    try {
      await applyImageCandidate({
        catalogId: row.catalogId,
        videoId: row.videoId,
        field: 'coverUrl',
        source: selectedCandidate.source,
        sourceRef: selectedCandidate.sourceRef,
      })
      finishMutation('已应用候选补图', '封面已置 pending_review，巡检入队中')
    } catch (err) {
      fail('应用候选失败', err)
    } finally {
      setPending(false)
    }
  }, [selectedCandidate, row.catalogId, row.videoId, finishMutation, fail])

  // ③ 手填 URL → PUT images
  const handleManualApply = useCallback(async () => {
    const url = manualUrl.trim()
    if (!url) return
    setPending(true)
    try {
      await imagesActions.update('poster', url)
      finishMutation('封面已替换', '手填 URL 已写入，置 pending_review')
    } catch (err) {
      fail('手填替换失败', err)
    } finally {
      setPending(false)
    }
  }, [manualUrl, imagesActions, finishMutation, fail])

  // ④ 标记已解决（resolve 展示中的单个事件）
  const handleResolve = useCallback(async () => {
    if (!row.eventId) return
    setPending(true)
    try {
      const { resolvedCount } = await resolveImageEvents([row.eventId])
      finishMutation('已标记解决', resolvedCount > 0 ? '破损事件已标记 resolved' : '事件已是已解决态')
    } catch (err) {
      fail('标记已解决失败', err)
    } finally {
      setPending(false)
    }
  }, [row.eventId, finishMutation, fail])

  const images = imagesState.images

  return (
    <div style={BODY_STYLE} data-governance-body>
      {/* ① 图片矩阵 */}
      <section>
        <p style={SECTION_TITLE_STYLE}>图片矩阵</p>
        <div style={MATRIX_STYLE}>
          {MATRIX_KINDS.map(({ kind, label }) => {
            const slot = images?.[kind]
            const status = toAdminImageStatus(slot?.status)
            return (
              <button
                key={kind}
                type="button"
                style={MATRIX_CELL_STYLE}
                onClick={() => setLightbox({ url: slot?.url ?? null, title: `${row.title} · ${label}`, status })}
                data-matrix-cell={kind}
              >
                {slot?.url
                  ? <img src={slot.url} alt={label} style={MATRIX_THUMB_STYLE} />
                  : <span style={MATRIX_FALLBACK_STYLE} aria-hidden>⊘</span>}
                <span style={MATRIX_LABEL_STYLE}>
                  <span>{label}</span>
                  {status && <Pill variant={STATUS_PILL[status]}>{status}</Pill>}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ② 破损详情 */}
      <section>
        <p style={SECTION_TITLE_STYLE}>破损详情</p>
        <div style={BROKEN_DETAIL_STYLE} data-broken-detail>
          <span>原因 {row.eventType ?? '—'}</span>
          <span>域 {row.brokenDomain ?? '—'}</span>
          <span>次数 {row.occurrenceCount}</span>
          <span>最近 {row.lastSeenBrokenAt ?? '—'}</span>
        </div>
      </section>

      {/* ③ 替换封面 */}
      <section>
        <p style={SECTION_TITLE_STYLE}>替换封面 · 从外部源候选</p>
        <ImageCandidatePicker
          candidates={options}
          selectedKey={selectedKey}
          onSelect={(o) => setSelectedKey(o.key)}
          loading={candidatesLoading}
          error={candidatesError ? { message: candidatesError, onRetry: loadCandidates } : undefined}
          emptyTitle="暂无跨源候选"
          emptyDescription="该作品当前无外部源补图候选；可手填 URL"
          testId="governance-candidate-picker"
        />
        {selectedCandidate && (
          <ImageCompare
            open
            current={{ url: row.posterUrl, status: toAdminImageStatus(row.posterStatus), label: '当前' }}
            candidate={{ url: selectedCandidate.url, status: 'pending_review', label: '候选' }}
            onConfirm={(p) => void handleApplyConfirm(p)}
            onCancel={() => setSelectedKey(null)}
            testId="governance-image-compare"
          />
        )}
      </section>

      {/* ③ 手填 URL */}
      <section>
        <p style={SECTION_TITLE_STYLE}>或手填封面 URL</p>
        <div style={MANUAL_ROW_STYLE}>
          <AdminInput
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://…"
            data-testid="governance-manual-url"
            style={{ flex: 1 }}
          />
          <AdminButton
            variant="default"
            size="sm"
            disabled={pending || manualUrl.trim().length === 0}
            onClick={() => void handleManualApply()}
            data-testid="governance-manual-apply"
          >
            替换
          </AdminButton>
        </div>
      </section>

      {/* ④⑤ footer：标记已解决 + 关闭 */}
      <div style={FOOTER_STYLE}>
        <AdminButton
          variant="default"
          size="sm"
          disabled={pending || !row.eventId}
          onClick={() => void handleResolve()}
          data-testid="governance-resolve"
        >
          标记已解决
        </AdminButton>
        <AdminButton variant="default" size="sm" onClick={onClose} data-testid="governance-close">
          关闭
        </AdminButton>
      </div>

      <ImageLightbox
        open={lightbox != null}
        onClose={() => setLightbox(null)}
        src={lightbox?.url ?? null}
        title={lightbox?.title}
        meta={lightbox?.status ? { status: lightbox.status } : undefined}
        testId="governance-lightbox"
      />
    </div>
  )
}
