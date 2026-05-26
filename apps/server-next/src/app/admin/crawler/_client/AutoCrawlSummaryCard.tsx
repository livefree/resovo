'use client'

/**
 * AutoCrawlSummaryCard.tsx — /admin/crawler 顶部定时设置显式入口卡（ADR-155 D-155-5）
 *
 * 设计契约：
 *   - 紧邻 PageHeader 下方展示当前生效的 schedule 摘要
 *   - 提供 [立即关闭] 快捷按钮（避免必须打开 Drawer 反勾 globalEnabled）
 *   - 提供 [编辑] 按钮（触发父层 schedulerDrawer open）
 *
 * 三态渲染（精简版，不复用 Dashboard AutoCrawlScheduleCard 5 状态完整 UI）：
 *   - schedulerEnabled === false → danger 卡 "调度器进程未启动"
 *   - !config.globalEnabled → neutral 卡 "未启用 · 点击编辑配置"
 *   - globalEnabled + countdown → ok 卡 "下次: MM-DD HH:MM · 每日 HH:MM · 模式 X"
 *
 * G-155-3 评审建议抽 AutoCrawlInfoBlock 共享组件：推迟到第 3 处消费时再抽（当前仅 2 处）。
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { AdminButton, AdminCard, Pill, useToast } from '@resovo/admin-ui'
import {
  getAutoCrawlConfig,
  setAutoCrawlConfig,
  getCrawlerSystemStatus,
  type AutoCrawlConfig,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

const HEAD_ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

const BODY_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  flexWrap: 'wrap',
}

const META_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const HINT_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-sm)',
}

function formatNextAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

export interface AutoCrawlSummaryCardProps {
  /** 触发父层打开 SchedulerConfigDrawer（父层已持有 drawer state） */
  readonly onEditClick: () => void
}

type CardState = 'loading' | 'scheduler-disabled' | 'disabled' | 'countdown' | 'failed' | 'error'

interface CardData {
  readonly state: CardState
  readonly config: AutoCrawlConfig | null
  readonly nextAt: string | null
  readonly errorMessage?: string
}

export function AutoCrawlSummaryCard({ onEditClick }: AutoCrawlSummaryCardProps) {
  const toast = useToast()
  const [data, setData] = useState<CardData>({ state: 'loading', config: null, nextAt: null })
  const [closing, setClosing] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    setData((prev) => ({ ...prev, state: 'loading' }))
    const run = async () => {
      try {
        const [config, status] = await Promise.all([
          getAutoCrawlConfig(),
          getCrawlerSystemStatus().catch(() => null),
        ])
        if (cancelled) return
        const nextAt = status?.autoCrawlNext ?? null
        // schedulerEnabled === false 优先（HOTFIX-C 范式 / autoCrawlNext stale 数据遮蔽）
        const state: CardState = status?.schedulerEnabled === false
          ? 'scheduler-disabled'
          : !config.globalEnabled
            ? 'disabled'
            : nextAt
              ? 'countdown'
              : 'failed'
        setData({ state, config, nextAt })
      } catch (err: unknown) {
        if (cancelled) return
        setData({
          state: 'error',
          config: null,
          nextAt: null,
          errorMessage: err instanceof Error ? err.message : '加载失败',
        })
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const handleClose = useCallback(async () => {
    if (!data.config) return
    if (typeof window !== 'undefined' && !window.confirm('确认关闭自动调度？已配置的定时任务将不再触发，重新打开后恢复。')) return
    setClosing(true)
    try {
      await setAutoCrawlConfig({ ...data.config, globalEnabled: false })
      toast.push({ title: '已关闭自动调度', description: '所有定时任务已停止触发', level: 'success' })
      load()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '请重试')
      toast.push({ title: '关闭失败', description: msg, level: 'danger' })
    } finally {
      setClosing(false)
    }
  }, [data.config, load, toast])

  // ── loading / error：不渲染占位（避免页面闪烁；data flux 内自治） ──
  if (data.state === 'loading' || data.state === 'error') {
    return null
  }

  // ── scheduler-disabled 优先：HOTFIX-C 范式 ──────────────────────
  if (data.state === 'scheduler-disabled') {
    return (
      <AdminCard
        surface="elevated"
        padding="md"
        data-testid="auto-crawl-summary-card"
        header={{
          title: '自动采集',
          actions: (
            <span style={HEAD_ACTIONS_STYLE}>
              <AdminButton
                variant="default"
                size="sm"
                onClick={onEditClick}
                data-testid="auto-crawl-summary-edit"
              >
                编辑
              </AdminButton>
            </span>
          ),
        }}
      >
        <div style={BODY_STYLE} data-testid="auto-crawl-summary-scheduler-disabled">
          <Pill variant="warn">调度器进程未启动</Pill>
          <span style={HINT_STYLE}>
            即使配置已保存，定时也不会触发；请联系 dev / 运维设 <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>CRAWLER_SCHEDULER_ENABLED=true</code> 并重启 api server
          </span>
        </div>
      </AdminCard>
    )
  }

  // ── disabled：globalEnabled=false ───────────────────────────────
  if (data.state === 'disabled') {
    return (
      <AdminCard
        surface="elevated"
        padding="md"
        data-testid="auto-crawl-summary-card"
        header={{
          title: '自动采集',
          actions: (
            <span style={HEAD_ACTIONS_STYLE}>
              <AdminButton
                variant="default"
                size="sm"
                onClick={onEditClick}
                data-testid="auto-crawl-summary-edit"
              >
                配置定时
              </AdminButton>
            </span>
          ),
        }}
      >
        <div style={BODY_STYLE} data-testid="auto-crawl-summary-disabled">
          <Pill variant="neutral">未启用</Pill>
          <span style={HINT_STYLE}>未开启自动调度；点击右上角「配置定时」启用</span>
        </div>
      </AdminCard>
    )
  }

  // ── failed：globalEnabled=true 但 autoCrawlNext=null ────────────
  if (data.state === 'failed') {
    return (
      <AdminCard
        surface="elevated"
        padding="md"
        data-testid="auto-crawl-summary-card"
        header={{
          title: '自动采集',
          actions: (
            <span style={HEAD_ACTIONS_STYLE}>
              <AdminButton
                variant="ghost"
                size="sm"
                loading={closing}
                disabled={closing || !data.config}
                onClick={() => void handleClose()}
                data-testid="auto-crawl-summary-close"
              >
                立即关闭
              </AdminButton>
              <AdminButton
                variant="default"
                size="sm"
                onClick={onEditClick}
                data-testid="auto-crawl-summary-edit"
              >
                编辑
              </AdminButton>
            </span>
          ),
        }}
      >
        <div style={BODY_STYLE} data-testid="auto-crawl-summary-failed">
          <Pill variant="warn">调度配置异常</Pill>
          <span style={HINT_STYLE}>已启用但无下次触发时间；请检查配置 / 站点</span>
        </div>
      </AdminCard>
    )
  }

  // ── countdown：正常态 ───────────────────────────────────────────
  const config = data.config!
  const nextAt = data.nextAt!
  const modeLabel = config.defaultMode === 'full' ? '全量' : '增量'
  // ADR-155 D-155-6 / EP-1C-2b：daily 分支显示多 dailyTime 列表
  const dailyTimesList = config.dailyTimes && config.dailyTimes.length > 0
    ? Array.from(config.dailyTimes)
    : [config.dailyTime || '03:00']
  const scheduleSummary = config.scheduleType === 'interval'
    ? `每 ${config.intervalMinutes} 分钟`
    : `每日 ${dailyTimesList.join(', ')}`

  return (
    <AdminCard
      surface="elevated"
      padding="md"
      data-testid="auto-crawl-summary-card"
      header={{
        title: '自动采集',
        actions: (
          <span style={HEAD_ACTIONS_STYLE}>
            <AdminButton
              variant="ghost"
              size="sm"
              loading={closing}
              disabled={closing}
              onClick={() => void handleClose()}
              data-testid="auto-crawl-summary-close"
            >
              立即关闭
            </AdminButton>
            <AdminButton
              variant="default"
              size="sm"
              onClick={onEditClick}
              data-testid="auto-crawl-summary-edit"
            >
              编辑
            </AdminButton>
          </span>
        ),
      }}
    >
      <div style={BODY_STYLE} data-testid="auto-crawl-summary-countdown">
        <Pill variant="ok">{`下次: ${formatNextAt(nextAt)}`}</Pill>
        <span data-testid="auto-crawl-summary-schedule" style={META_STYLE}>
          {scheduleSummary} · 模式 {modeLabel}
        </span>
      </div>
    </AdminCard>
  )
}
