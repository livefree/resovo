/**
 * health-badge.tsx — Topbar 健康指标徽章（ADR-103a §4.1.8）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.8 HealthBadge + HealthSnapshot
 *   - ADR-103a §4.4 4 项硬约束（Provider 不下沉 / Edge Runtime 兼容 / 零硬编码颜色 / 零图标库依赖）
 *   - 设计稿 v2.1 shell.jsx Topbar tb__health 三项指标实践
 *
 * 设计要点：
 *   - 渲染 3 项指标（采集 / 失效率 / 待审），每项含 dot + label
 *   - dot 颜色按 status 映射 semantic.status token：
 *     · ok → state-success / warn → state-warning / danger → state-error
 *   - 首项（crawler）dot 加 pulse 动画（运行中视觉暗示）；其余项静态 dot
 *   - invalidRate.rate 显示百分比（rate=0.013 → "1.3%"，1 位小数）
 *   - pulse @keyframes 通过组件内联 <style> 标签注入（React DOM 节点 / SSR 安全 / 模块顶层零副作用）
 *
 * 不做：
 *   - 不轮询数据（ADR §4.1.8 明示由消费方注入 snapshot）
 *   - 不渲染数值变化动画（仅 status 切换 dot 颜色）
 *
 * 跨域消费：本文件被 packages/admin-ui Topbar 内部消费 + server-next 应用层准备 snapshot
 *   通过 AdminShell.props.health 注入；不暴露到其他包。
 */
import type { CSSProperties } from 'react'
import type { HealthSnapshot } from './types'

export interface HealthBadgeProps {
  readonly snapshot: HealthSnapshot
}

/** status → semantic.status token slot 映射（ADR-103a §4.1.8 + semantic.state token 命名）
 *  HealthSnapshot status: 'ok' | 'warn' | 'danger'
 *  state token slots:    'success' | 'warning' | 'error' */
type Status = 'ok' | 'warn' | 'danger'
const STATE_SLOT_BY_STATUS: Record<Status, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warn: 'warning',
  danger: 'error',
}

const PULSE_KEYFRAMES = `@keyframes resovo-health-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.15); }
}`

const CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const ITEM_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
}

function dotStyle(status: Status, pulse: boolean): CSSProperties {
  const slot = STATE_SLOT_BY_STATUS[status]
  return {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: `var(--state-${slot}-border)`,
    flexShrink: 0,
    animation: pulse ? 'resovo-health-pulse 2s ease-in-out infinite' : undefined,
  }
}

function formatPercent(rate: number): string {
  // 1 位小数：0.013 → "1.3%"；0.0005 → "0.1%"；0 → "0.0%"
  return `${(rate * 100).toFixed(1)}%`
}

export function HealthBadge({ snapshot }: HealthBadgeProps) {
  const { crawler, invalidRate, moderationPending } = snapshot
  return (
    <>
      <style data-resovo-health-pulse>{PULSE_KEYFRAMES}</style>
      <div role="status" aria-label="系统健康指标" data-health-badge style={CONTAINER_STYLE}>
        <span style={ITEM_STYLE} data-health-item="crawler">
          <span aria-hidden="true" style={dotStyle(crawler.status, true)} />
          <span>采集 {crawler.running}/{crawler.total}</span>
        </span>
        <span style={ITEM_STYLE} data-health-item="invalid-rate">
          <span aria-hidden="true" style={dotStyle(invalidRate.status, false)} />
          <span>失效率 {formatPercent(invalidRate.rate)}</span>
        </span>
        <span style={ITEM_STYLE} data-health-item="moderation-pending">
          <span aria-hidden="true" style={dotStyle(moderationPending.status, false)} />
          <span>待审 {moderationPending.count}</span>
        </span>
      </div>
    </>
  )
}
