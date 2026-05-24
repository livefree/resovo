'use client'

/**
 * CrawlerAdvancedMenu.tsx — PageHeader 第 4 槽位"高级" dropdown
 *
 * 真源：M-SN-7-redo-01-contract.md §1.6 + §2.4 裁决 A
 *      + CHG-SN-8-01（W1 金票 §3 反例 #1：全站全量从主按钮移入高级 dropdown 并双重 confirm）
 *
 * 5 项菜单（全部复用现有 API，无新端点）：
 *   - run_all_full 全站全量采集    → 委托 props.onRunAllFull（client 内含双重 confirm）
 *   - scheduler    调度配置        → 打开 SchedulerConfigDrawer
 *   - reindex      重建 ES 索引     → triggerReindex() + 双重 confirm
 *   - stop_all     全局止血         → stopAllCrawler({ freeze: true }) + 双重 confirm
 *   - freeze       开启冻结/解除冻结 → setCrawlerFreeze(next) + 单次 confirm（动态 label）
 */

import { useCallback, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AdminButton, AdminDropdown, useToast, type AdminDropdownItem } from '@resovo/admin-ui'
import { setCrawlerFreeze, stopAllCrawler, triggerReindex } from '@/lib/crawler/api'
import type { CrawlerSystemStatus } from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

export interface CrawlerAdvancedMenuProps {
  readonly frozen: boolean
  readonly onSchedulerConfig: () => void
  readonly onStatusUpdate: (next: Partial<CrawlerSystemStatus>) => void
  readonly onRefresh: () => void
  /** CHG-SN-8-01：全站全量采集委托回调（双重 confirm 在 client 内）；pending 由 client 管 */
  readonly onRunAllFull: () => void
  readonly runAllFullPending: boolean
}

const TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'STATE_CONFLICT') return { title: '操作冲突', description: err.message }
    if (err.code === 'FORBIDDEN') return { title: '禁止操作', description: '该操作仅 admin 角色可执行' }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function CrawlerAdvancedMenu({
  frozen,
  onSchedulerConfig,
  onStatusUpdate,
  onRefresh,
  onRunAllFull,
  runAllFullPending,
}: CrawlerAdvancedMenuProps) {
  const toast = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const close = useCallback(() => setOpen(false), [])

  // EP-4.5-HOTFIX-2 / 问题 1：采集批次入口（采集结果次级路径）
  const handleViewRuns = useCallback(() => {
    close()
    router.push('/admin/crawler/runs')
  }, [close, router])

  const handleRunAllFull = useCallback(() => {
    close()
    onRunAllFull()
  }, [close, onRunAllFull])

  const handleScheduler = useCallback(() => {
    close()
    onSchedulerConfig()
  }, [close, onSchedulerConfig])

  const handleReindex = useCallback(async () => {
    close()
    if (!confirm('确定重建 ES 索引？该操作会全量重建搜索索引（耗时较长）。')) return
    if (!confirm('再次确认：执行后无法中断，是否继续？')) return
    setPendingKey('reindex')
    try {
      const result = await triggerReindex()
      toast.push({
        title: 'ES 索引已重建',
        description: `索引 ${result.indexed ?? 0} 条 · 耗时 ${Math.round((result.duration_ms ?? 0) / 1000)}s`,
        level: 'success',
      })
      onRefresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPendingKey(null)
    }
  }, [close, onRefresh, toast])

  const handleStopAll = useCallback(async () => {
    close()
    if (!confirm('确定全局止血？该操作会：1) 开启采集冻结 2) 取消所有待处理任务 3) 信号现有运行任务终止')) return
    if (!confirm('再次确认：该操作不可撤销（任务已 cancel）。是否继续？')) return
    setPendingKey('stop_all')
    try {
      const result = await stopAllCrawler({ freeze: true, removeRepeatableTick: true })
      toast.push({
        title: '全局止血完成',
        description: `冻结=${result.freezeEnabled} · 标记 ${result.markedRuns} 个 run / 取消 ${result.pendingCancelled} 个 pending / 信号 ${result.runningSignaled} 个 running`,
        level: 'success',
      })
      onStatusUpdate({ freezeEnabled: true })
      onRefresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPendingKey(null)
    }
  }, [close, onRefresh, onStatusUpdate, toast])

  const handleToggleFreeze = useCallback(async () => {
    close()
    const next = !frozen
    if (!confirm(next ? '确定开启全局冻结？所有采集 / 重探 / 行级写操作将被拒绝。' : '确定解除全局冻结？')) return
    setPendingKey('freeze')
    try {
      const result = await setCrawlerFreeze(next)
      toast.push({
        title: next ? '已开启全局冻结' : '已关闭全局冻结',
        description: `freeze=${result.freezeEnabled} · orphan 任务 ${result.orphanTaskCount ?? 0}`,
        level: 'success',
      })
      onStatusUpdate({ freezeEnabled: result.freezeEnabled, orphanTaskCount: result.orphanTaskCount })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setPendingKey(null)
    }
  }, [close, frozen, onStatusUpdate, toast])

  const items: readonly AdminDropdownItem[] = [
    {
      key: 'view_runs',
      label: '查看采集批次',
      onClick: handleViewRuns,
    },
    {
      key: 'run_all_full',
      label: runAllFullPending ? '全站全量采集 …' : '全站全量采集',
      danger: true,
      separator: true,
      disabled: runAllFullPending,
      onClick: handleRunAllFull,
    },
    {
      key: 'scheduler',
      label: '调度配置',
      onClick: handleScheduler,
    },
    {
      key: 'reindex',
      label: pendingKey === 'reindex' ? '重建 ES 索引 …' : '重建 ES 索引',
      disabled: pendingKey === 'reindex',
      onClick: () => void handleReindex(),
    },
    {
      key: 'stop_all',
      label: pendingKey === 'stop_all' ? '全局止血 …' : '全局止血',
      danger: true,
      separator: true,
      disabled: pendingKey === 'stop_all',
      onClick: () => void handleStopAll(),
    },
    {
      key: 'freeze',
      label: pendingKey === 'freeze'
        ? (frozen ? '解除冻结 …' : '开启冻结 …')
        : (frozen ? '解除冻结' : '开启冻结'),
      disabled: pendingKey === 'freeze',
      onClick: () => void handleToggleFreeze(),
    },
  ]

  return (
    <AdminDropdown
      open={open}
      onOpenChange={setOpen}
      align="right"
      items={items}
      trigger={
        <AdminButton
          variant="default"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          data-testid="crawler-advanced-trigger"
          data-frozen={frozen ? '' : undefined}
        >
          <span style={TRIGGER_STYLE}>
            高级 <span aria-hidden style={{ fontSize: '10px' }}>▾</span>
          </span>
        </AdminButton>
      }
      data-testid="crawler-advanced-dropdown"
    />
  )
}
