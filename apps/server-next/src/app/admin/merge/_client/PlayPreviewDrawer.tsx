'use client'

/**
 * PlayPreviewDrawer.tsx — 播放抽验抽屉（CHG-VIR-13-PLAY / 设计 §10.5-2 + §11.9）
 *
 * 核心交互 = **同集对比切换**：判断「是否同一作品/版本」靠同一集画面对比——
 * 同 episodeNumber 下 chips 秒切组内各成员/线路的 source，画面一致 → 合并/归同组；
 * 不同 → 拒绝候选 / 拆分归不同组 / edition 留实例层。
 *
 * 复用：admin-ui `Drawer`（right placement）+ moderation `AdminPlayer`
 * （props 自足 videoId+sourceUrl+sourceId；独立 admin 播放器不接 GlobalPlayerHost；
 * 跨模块导入沿 VideoEditDrawer 先例——第 3 消费方出现再上提共享层）。
 * 播放 feedback 上报沿用 AdminPlayer 内建（不另加）。
 */

import { useMemo, type CSSProperties } from 'react'
import { Drawer, AdminButton } from '@resovo/admin-ui'
import { AdminPlayer } from '../../moderation/_client/AdminPlayer'

/** 可播放格（结构预览矩阵格 / 拆分分配表行 → 抽屉目标） */
export interface PlayTarget {
  readonly videoId: string
  readonly videoTitle: string
  readonly sourceId: string
  readonly sourceUrl: string
  readonly episodeNumber: number
  /** 线路标识（displayName ?? sourceName） */
  readonly lineLabel: string
}

const MUTED_SM: CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)' }
const SECTION_LABEL: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
}

const CHIP_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: '11px',
  cursor: 'pointer',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
}

const CHIP_ACTIVE: CSSProperties = {
  ...CHIP_BASE,
  border: '1px solid var(--state-success-border)',
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  fontWeight: 600,
}

export interface PlayPreviewDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  /** 当前播放格（null = 抽屉关闭态占位） */
  readonly current: PlayTarget | null
  /** 全部可播格（同集 chips 与集数条从中推导） */
  readonly targets: readonly PlayTarget[]
  readonly onSelect: (t: PlayTarget) => void
}

export function PlayPreviewDrawer({ open, onClose, current, targets, onSelect }: PlayPreviewDrawerProps) {
  // 同集成员切换 chips：同 episodeNumber 的全部格（含 current；§11.9 核心交互）
  const sameEpisodePeers = useMemo(() => {
    if (!current) return []
    return targets.filter((t) => t.episodeNumber === current.episodeNumber)
  }, [targets, current])

  // 集数条：当前（videoId, lineLabel）线路的全部集（快速换集）
  const lineEpisodes = useMemo(() => {
    if (!current) return []
    return targets
      .filter((t) => t.videoId === current.videoId && t.lineLabel === current.lineLabel)
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
  }, [targets, current])

  return (
    <Drawer
      open={open}
      placement="right"
      width={440}
      onClose={onClose}
      title="播放抽验"
      data-testid="play-preview-drawer"
    >
      {current ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* key=sourceId：切换 source 时 remount AdminPlayer 重载（沿 AdminPlayer key-bump 范式） */}
          <AdminPlayer
            key={current.sourceId}
            videoId={current.videoId}
            sourceUrl={current.sourceUrl}
            sourceId={current.sourceId}
            title={current.videoTitle}
            testId="play-preview-player"
          />

          <div style={MUTED_SM} data-testid="play-preview-current">
            正在播放：{current.videoTitle} · {current.lineLabel} · E{current.episodeNumber}
          </div>

          {/* §11.9 核心交互：同集成员切换（秒切对比画面是否同一内容） */}
          {sameEpisodePeers.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={SECTION_LABEL}>同集切换（E{current.episodeNumber}）— 对比画面是否同一内容</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-testid="play-preview-peers">
                {sameEpisodePeers.map((t) => {
                  const active = t.sourceId === current.sourceId
                  return (
                    <button
                      key={t.sourceId}
                      type="button"
                      style={active ? CHIP_ACTIVE : CHIP_BASE}
                      onClick={() => { if (!active) onSelect(t) }}
                      data-testid={`play-peer-${t.sourceId}`}
                    >
                      {active ? '◉ ' : '○ '}{t.videoTitle} · {t.lineLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 集数条：当前线路快速换集 */}
          {lineEpisodes.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={SECTION_LABEL}>集数（{current.lineLabel}）</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid="play-preview-episodes">
                {lineEpisodes.map((t) => {
                  const active = t.sourceId === current.sourceId
                  return (
                    <button
                      key={t.sourceId}
                      type="button"
                      style={active ? CHIP_ACTIVE : CHIP_BASE}
                      onClick={() => { if (!active) onSelect(t) }}
                      data-testid={`play-ep-${t.sourceId}`}
                    >
                      E{t.episodeNumber}{active ? '●' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AdminButton size="sm" variant="default" onClick={onClose}>
              关闭
            </AdminButton>
          </div>
        </div>
      ) : (
        <span style={MUTED_SM}>未选择播放源</span>
      )}
    </Drawer>
  )
}
