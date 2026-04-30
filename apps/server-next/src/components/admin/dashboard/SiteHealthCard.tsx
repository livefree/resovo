/**
 * SiteHealthCard.tsx — Dashboard 第 3 行右：站点健康（CHG-DESIGN-07 7C）
 *
 * 真源：reference.md §5.1.2 SiteHealthCard mock 蓝图
 *   - head: heart icon + 标题「站点健康」
 *   - 前 8 站，每行 8×14：18×18 radius 4 health 数字（>80 ok / >50 warn / else danger）
 *     + name (12/600) + type · format · last (11 muted) + Spark 60×18 + xs btn
 *   - 开机时显示「增量」/ 关机时显示「重启」
 */
import React from 'react'
import { Activity } from 'lucide-react'
import { Spark } from '@resovo/admin-ui'
import type { DashboardSiteHealth } from '@/lib/dashboard-data'

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
}

const HEAD_ICON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  width: '20px',
  height: '20px',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fg-muted)',
  flexShrink: 0,
}

const HEAD_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 14px',
}

const HEALTH_BOX_BASE_STYLE: React.CSSProperties = {
  width: '18px',
  height: '18px',
  borderRadius: '4px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--fg-on-accent)',
  flexShrink: 0,
}

const META_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
  minWidth: 0,
}

const NAME_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const META_TEXT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  margin: 0,
}

const SPARK_SLOT_STYLE: React.CSSProperties = {
  width: '60px',
  height: '18px',
  flexShrink: 0,
  opacity: 0.4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
}

const ROW_ACTION_STYLE: React.CSSProperties = {
  height: '22px',
  padding: '0 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  flexShrink: 0,
}

function healthBg(score: number): string {
  if (score > 80) return 'var(--state-success-fg)'
  if (score > 50) return 'var(--state-warning-fg)'
  return 'var(--state-error-fg)'
}

function healthSparkColor(score: number): string {
  if (score > 80) return 'var(--state-success-fg)'
  if (score > 50) return 'var(--state-warning-fg)'
  return 'var(--state-error-fg)'
}

export interface SiteHealthCardProps {
  readonly sites: readonly DashboardSiteHealth[]
}

export function SiteHealthCard({ sites }: SiteHealthCardProps) {
  // reference §5.1.2: "前 8 站"
  const top8 = sites.slice(0, 8)
  return (
    <section style={CARD_STYLE} data-card="site-health" aria-label="站点健康">
      <header style={HEAD_STYLE} data-card-head>
        <span aria-hidden="true" style={HEAD_ICON_STYLE}>
          <Activity size={18} />
        </span>
        <h3 style={HEAD_TITLE_STYLE}>站点健康</h3>
      </header>
      <div style={BODY_STYLE} data-card-body>
        {top8.map((site, idx) => (
          <div
            key={site.key}
            style={{
              ...ROW_STYLE,
              borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}
            data-site-row={site.key}
            data-online={site.online ? 'true' : 'false'}
          >
            <span
              aria-hidden="true"
              style={{ ...HEALTH_BOX_BASE_STYLE, background: healthBg(site.score) }}
            >
              {site.score}
            </span>
            <div style={META_STYLE}>
              <p style={NAME_STYLE}>{site.name}</p>
              <p style={META_TEXT_STYLE}>
                {site.type} · {site.format} · {site.lastSeen}
              </p>
            </div>
            <span style={SPARK_SLOT_STYLE} aria-hidden="true">
              <Spark
                data={site.sparkData}
                color={healthSparkColor(site.score)}
                ariaLabel={`${site.name} 7 天健康趋势`}
              />
            </span>
            <button type="button" style={ROW_ACTION_STYLE} data-site-action={site.online ? 'incr' : 'restart'}>
              {site.online ? '增量' : '重启'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
