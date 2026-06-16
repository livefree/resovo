'use client'

/**
 * QueueHealthCard.tsx — Dashboard 后台任务队列健康卡（DASH-QUEUE-HEALTH-B）
 *
 * 自取数 + 轮询（仿 AutoCrawlScheduleCard 范式，隔离 live 不扰其它一次性加载卡）：
 *   getQueueHealth() → ADR-147 `/admin/system/jobs` meta.queueCounts（全 9 队列 + 4 计数）
 *   mount fetch + setInterval(POLL_MS) 轮询；Redis 不可用 → degraded 兜底条
 * 纯监控只读（无队列操作按钮）；颜色全 CSS 变量。
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Layers } from 'lucide-react'
import { getQueueHealth, type AdminQueueCounts } from '@/lib/dashboard/api'

const POLL_MS = 8_000

/** 展示顺序 + 中文 label（键与 AdminQueueCounts / queue.ts 注册一致；新增队列时此处加性扩展） */
const QUEUE_META: ReadonlyArray<{ key: keyof AdminQueueCounts; label: string }> = [
  { key: 'enrichment', label: '元数据富集' },
  { key: 'crawler', label: '采集' },
  { key: 'verify', label: '源校验' },
  { key: 'imageHealth', label: '图片健康' },
  { key: 'maintenance', label: '维护' },
  { key: 'identityCandidate', label: '同名识别' },
  { key: 'homeAutofill', label: '首页填充' },
  { key: 'doubanCollections', label: '豆瓣合集' },
  { key: 'bangumiCollections', label: 'Bangumi 合集' },
]

const CARD_STYLE: CSSProperties = {
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}
const HEAD_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
}
const HEAD_ICON_STYLE: CSSProperties = {
  display: 'inline-flex', width: '20px', height: '20px',
  alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', flexShrink: 0,
}
const HEAD_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: 'var(--fg-default)', margin: 0,
}
const HEAD_HINT_STYLE: CSSProperties = {
  marginLeft: 'auto', fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)',
}
const DEGRADED_STYLE: CSSProperties = {
  padding: '8px 14px', fontSize: 'var(--font-size-xs)',
  background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)',
}
const BODY_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column' }
const ROW_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px',
}
const NAME_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
  flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const STATS_STYLE: CSSProperties = { display: 'flex', gap: '6px', flexShrink: 0 }
const PLACEHOLDER_STYLE: CSSProperties = {
  padding: '16px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)',
}

function cellStyle(tone: 'neutral' | 'accent' | 'danger'): CSSProperties {
  // active(运行中)=success 绿 / failed=error 红 / 其余=muted 中性（仅用 SiteHealthCard 已验证 token）
  const color =
    tone === 'accent' ? 'var(--state-success-fg)' : tone === 'danger' ? 'var(--state-error-fg)' : 'var(--fg-muted)'
  return {
    minWidth: '46px', textAlign: 'center', padding: '2px 6px',
    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xxs)', color, fontVariantNumeric: 'tabular-nums',
  }
}

function StatCell({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'accent' | 'danger' }) {
  const active = value > 0 && tone !== 'neutral'
  return (
    <span style={cellStyle(active ? tone : 'neutral')} title={label}>
      {label} {value}
    </span>
  )
}

export interface QueueHealthCardProps {
  readonly className?: string
}

export function QueueHealthCard({ className }: QueueHealthCardProps) {
  const [counts, setCounts] = useState<AdminQueueCounts | null>(null)
  const [degraded, setDegraded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getQueueHealth()
      setCounts(res.queueCounts)
      setDegraded(res.degraded)
    } catch {
      // 取数失败（端点 5xx / 网络）→ 视为降级，保留上次快照不清空，不崩仪表盘
      setDegraded(true)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  return (
    <section style={CARD_STYLE} className={className} data-card="queue-health" aria-label="后台任务队列">
      <header style={HEAD_STYLE} data-card-head>
        <span aria-hidden="true" style={HEAD_ICON_STYLE}><Layers size={18} /></span>
        <h3 style={HEAD_TITLE_STYLE}>后台任务队列</h3>
        <span style={HEAD_HINT_STYLE}>每 8 秒刷新</span>
      </header>
      {degraded && (
        <div style={DEGRADED_STYLE} role="status" data-queue-degraded>
          队列状态暂不可用（Redis 降级），显示为最近一次快照
        </div>
      )}
      {!loaded && counts === null && <div style={PLACEHOLDER_STYLE}>加载队列状态…</div>}
      {counts !== null && (
        <div style={BODY_STYLE} data-card-body>
          {QUEUE_META.map(({ key, label }, idx) => {
            const c = counts[key]
            return (
              <div
                key={key}
                style={{ ...ROW_STYLE, borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                data-queue-row={key}
                data-queue-active={c.active > 0 ? 'true' : 'false'}
              >
                <span style={NAME_STYLE}>{label}</span>
                <span style={STATS_STYLE}>
                  <StatCell label="待" value={c.waiting} tone="neutral" />
                  <StatCell label="跑" value={c.active} tone="accent" />
                  <StatCell label="完" value={c.completed} tone="neutral" />
                  <StatCell label="败" value={c.failed} tone="danger" />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
