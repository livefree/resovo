'use client'

/**
 * PublishConfirmModal.tsx — 发布确认弹层（CHG-HOME-DRAFT-PUBLISH-B / ADR-185 D-185-3.2）
 *
 * 发布前确认：变更摘要（counts + 基线版本）+ 可选发布备注 + **横图三类警告标记**
 * （ERRATA 移交验收项：尺寸/比例/探测失败——草稿内全部 banner 逐条探测，
 * §6 警告级口径**不阻断发布**）+ 草稿陈旧显著提示（双信号，D-185-2.2）。
 * 探测复用 lib/banners/image-guard（BannerImageGuard 同源 probeImageSize/evaluate）。
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { Modal, AdminButton, AdminInput, Pill } from '@resovo/admin-ui'
import {
  evaluateBannerImage,
  probeImageSize,
  type BannerImageWarning,
} from '@/lib/banners/image-guard'
import type { HomeDraftStaleness, HomePageConfig } from '@/lib/home-curation/types'

// ── 样式 ─────────────────────────────────────────────────────────

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

const SUMMARY_STYLE: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  color: 'var(--fg-muted)',
}

const WARN_BLOCK_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--state-warning-border, var(--border-subtle))',
  background: 'var(--state-warning-bg)',
  fontSize: 'var(--font-size-2xs)',
}

const WARN_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const STALE_STYLE: CSSProperties = {
  ...WARN_BLOCK_STYLE,
  border: '1px solid var(--state-danger-border, var(--border-subtle))',
  background: 'var(--state-danger-bg, var(--state-warning-bg))',
}

const FOOT_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
}

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

// ── banner 横图警告聚合（三类：尺寸/比例 = evaluate；探测失败独立态）────────

interface BannerWarningRow {
  readonly bannerKey: string
  readonly label: string
  readonly kind: 'probe_failed' | BannerImageWarning['code']
  readonly message: string
}

function bannerLabel(title: Record<string, string>, index: number): string {
  return title['zh-CN'] ?? title.en ?? Object.values(title)[0] ?? `Banner ${index + 1}`
}

async function collectBannerWarnings(config: HomePageConfig): Promise<BannerWarningRow[]> {
  const rows: BannerWarningRow[] = []
  await Promise.all(config.banners.map(async (banner, index) => {
    const key = banner.id ?? `idx-${index}`
    const label = bannerLabel(banner.title, index)
    try {
      const { width, height } = await probeImageSize(banner.imageUrl)
      for (const warning of evaluateBannerImage(width, height)) {
        rows.push({ bannerKey: key, label, kind: warning.code, message: warning.message })
      }
    } catch {
      rows.push({
        bannerKey: key,
        label,
        kind: 'probe_failed',
        message: '横图探测失败——无法读取尺寸，请人工确认显示效果',
      })
    }
  }))
  return rows
}

// ── Props ─────────────────────────────────────────────────────────

export interface PublishConfirmModalProps {
  /** null = 关闭；非 null = 待发布草稿配置 */
  readonly config: HomePageConfig | null
  readonly baseVersionNo: number | null
  readonly staleness: HomeDraftStaleness | null
  readonly busy: boolean
  readonly onConfirm: (note?: string) => void
  readonly onCancel: () => void
}

// ── 组件 ─────────────────────────────────────────────────────────

export function PublishConfirmModal({ config, baseVersionNo, staleness, busy, onConfirm, onCancel }: PublishConfirmModalProps) {
  const [note, setNote] = useState('')
  const [probing, setProbing] = useState(false)
  const [warnings, setWarnings] = useState<readonly BannerWarningRow[]>([])

  // 打开时探测草稿内全部 banner 横图（警告级，探测中不阻塞确认按钮）
  useEffect(() => {
    if (!config) {
      setNote('')
      setWarnings([])
      return
    }
    let cancelled = false
    setProbing(true)
    void collectBannerWarnings(config).then((rows) => {
      if (cancelled) return
      setWarnings(rows)
      setProbing(false)
    })
    return () => {
      cancelled = true
    }
  }, [config])

  if (!config) return null

  return (
    <Modal
      open
      title="发布首页配置"
      onClose={busy ? () => undefined : onCancel}
      data-testid="publish-confirm-modal"
    >
      <div style={BODY_STYLE}>
        <div style={SUMMARY_STYLE} data-testid="publish-summary">
          <Pill variant="neutral">{`Banner ×${config.banners.length}`}</Pill>
          <Pill variant="neutral">{`模块 ×${config.modules.length}`}</Pill>
          <span>基于版本 {baseVersionNo ?? '—（冷启动首发）'}</span>
        </div>

        {/* 草稿陈旧显著提示（D-185-2.2 双信号；发布将被 409 拒绝） */}
        {staleness?.stale && (
          <div style={STALE_STYLE} data-testid="publish-stale-warning">
            <div style={WARN_ROW_STYLE}>
              <Pill variant="danger">草稿基线已过时</Pill>
            </div>
            <span>
              {staleness.baseMismatch && `正式配置已发布新版本（当前 v${staleness.latestVersionNo ?? '—'}）。`}
              {staleness.tablesNewer && '正式配置在草稿保存后被直写通道修改。'}
              发布将被拒绝——请丢弃草稿后基于最新配置重建。
            </span>
          </div>
        )}

        {/* ERRATA 移交验收项：横图三类警告（尺寸/比例/探测失败），警告级不阻断 */}
        {probing && <span style={HINT_STYLE} data-testid="publish-banner-probing">横图校验中…</span>}
        {!probing && warnings.length > 0 && (
          <div style={WARN_BLOCK_STYLE} data-testid="publish-banner-warnings">
            {warnings.map((w, i) => (
              <div key={`${w.bannerKey}-${w.kind}-${i}`} style={WARN_ROW_STYLE} data-testid={`publish-banner-warning-${w.kind}`}>
                <Pill variant="warn">{w.kind === 'probe_failed' ? '探测失败' : '警告'}</Pill>
                <span>「{w.label}」{w.message}</span>
              </div>
            ))}
            <span style={HINT_STYLE}>以上为警告级提示，不阻断发布（方案 §6 / D-052-9 口径）</span>
          </div>
        )}
        {!probing && warnings.length === 0 && config.banners.length > 0 && (
          <span style={HINT_STYLE} data-testid="publish-banner-ok">横图校验通过（{config.banners.length} 条 Banner）</span>
        )}

        <AdminInput
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="发布备注（可选，记入版本历史）"
          size="sm"
          data-testid="publish-note-input"
        />

        <div style={FOOT_STYLE}>
          <AdminButton variant="ghost" size="sm" onClick={onCancel} disabled={busy} data-testid="publish-cancel-btn">
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            loading={busy}
            onClick={() => onConfirm(note.trim() || undefined)}
            data-testid="publish-confirm-btn"
          >
            确认发布
          </AdminButton>
        </div>
      </div>
    </Modal>
  )
}
