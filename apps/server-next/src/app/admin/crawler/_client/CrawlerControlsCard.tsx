'use client'

/**
 * CrawlerControlsCard.tsx — 全局采集开关 + 4 控制按钮（CHG-SN-6-29-PATCH-1）
 *
 * 从 CrawlerClient.tsx 拆出（H1 修复 / 原文件 862 行 → 主 ≤ 300）：
 *   - freeze 卡（CHG-SN-6-20-B）
 *   - 调度配置按钮（CHG-SN-6-27）
 *   - 重建索引按钮（CHG-SN-6-28）
 *   - 全局止血按钮（CHG-SN-6-27）
 *
 * Props：
 *   - status：当前系统状态（freeze/scheduler/orphanTask）
 *   - onStatusUpdate：局部合并 status（避免 refresh 整页 loading 抖动）
 *   - onRefreshAfterSchedulerSave：scheduler 保存后触发整体 refresh（refetch sites + status）
 */

import { useCallback, useState } from 'react'
import { AdminCard, AdminButton, useToast } from '@resovo/admin-ui'
import {
  setCrawlerFreeze,
  stopAllCrawler,
  triggerReindex,
  type CrawlerSystemStatus,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'
import { SchedulerConfigDrawer } from './SchedulerConfigDrawer'

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'DUPLICATE_KEY') return { title: 'key 重复', description: err.message }
    if (err.code === 'DUPLICATE_API_URL') return { title: 'API URL 重复', description: err.message }
    if (err.code === 'FORBIDDEN') return { title: '禁止操作', description: err.message }
    if (err.code === 'VALIDATION_ERROR') return { title: '参数校验失败', description: err.message }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export interface CrawlerControlsCardProps {
  readonly status: CrawlerSystemStatus | null
  readonly onStatusUpdate: (next: Partial<CrawlerSystemStatus>) => void
  readonly onRefreshAfterSchedulerSave: () => void
}

export function CrawlerControlsCard({
  status,
  onStatusUpdate,
  onRefreshAfterSchedulerSave,
}: CrawlerControlsCardProps) {
  const toast = useToast()
  const [freezePending, setFreezePending] = useState(false)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [stopAllPending, setStopAllPending] = useState(false)
  const [reindexPending, setReindexPending] = useState(false)

  // CHG-SN-6-27：全局止血（双重 confirm）
  const handleStopAll = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!window.confirm('确定执行全局止血？将取消所有运行中批次 + 冻结调度。')) return
    if (!window.confirm('再次确认：此操作不可逆，将立即停止所有自动采集。')) return
    setStopAllPending(true)
    try {
      const result = await stopAllCrawler({ freeze: true, removeRepeatableTick: true })
      toast.push({
        title: '全局止血完成',
        description: `取消批次 ${result.markedRuns} 个，冻结状态 ${result.freezeEnabled ? '已开启' : '未变'}`,
        level: 'success',
      })
      onStatusUpdate({ freezeEnabled: result.freezeEnabled })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setStopAllPending(false)
    }
  }, [toast, onStatusUpdate])

  // CHG-SN-6-28：reindex（双重 confirm）
  const handleReindex = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!window.confirm('确定重建 ES 索引？将全量同步 videos → ES，过程中查询可能短暂不一致。')) return
    if (!window.confirm('再次确认：根据数据量可能耗时数分钟，期间不可中断。')) return
    setReindexPending(true)
    try {
      const result = await triggerReindex()
      toast.push({
        title: 'ES 索引已重建',
        description: result.indexed != null
          ? `已索引 ${result.indexed} 条${result.duration_ms != null ? ` · 耗时 ${Math.round(result.duration_ms / 1000)}s` : ''}`
          : '完成',
        level: 'success',
      })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setReindexPending(false)
    }
  }, [toast])

  // CHG-SN-6-20-B：freeze 切换
  const handleToggleFreeze = useCallback(async () => {
    const currentEnabled = status?.freezeEnabled === true
    const nextEnabled = !currentEnabled
    const confirmMsg = nextEnabled
      ? '确定开启全局冻结？开启后将停止所有自动采集任务。'
      : '确定关闭全局冻结，恢复自动采集？'
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return
    setFreezePending(true)
    try {
      const next = await setCrawlerFreeze(nextEnabled)
      onStatusUpdate(next)
      toast.push({
        title: nextEnabled ? '已开启全局冻结' : '已关闭全局冻结',
        description: nextEnabled
          ? `游离任务 ${next.orphanTaskCount ?? 0} 个`
          : '自动采集已恢复',
        level: 'success',
      })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setFreezePending(false)
    }
  }, [status, toast, onStatusUpdate])

  if (!status || status.freezeEnabled === undefined) return null

  return (
    <>
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '全局采集开关',
          subtitle: status.freezeEnabled
            ? `● 已冻结（游离任务 ${status.orphanTaskCount ?? 0} 个）`
            : '○ 正常运行',
          actions: (
            <span style={{ display: 'inline-flex', gap: '6px' }}>
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setSchedulerOpen(true)}
                data-testid="crawler-scheduler-open"
              >
                调度配置
              </AdminButton>
              <AdminButton
                variant="ghost"
                size="sm"
                loading={reindexPending}
                disabled={reindexPending}
                onClick={() => void handleReindex()}
                data-testid="crawler-reindex"
              >
                重建索引
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                loading={stopAllPending}
                disabled={stopAllPending}
                onClick={() => void handleStopAll()}
                data-testid="crawler-stop-all"
              >
                全局止血
              </AdminButton>
              <AdminButton
                variant={status.freezeEnabled ? 'primary' : 'danger'}
                size="sm"
                loading={freezePending}
                disabled={freezePending}
                onClick={() => void handleToggleFreeze()}
                data-testid="crawler-freeze-toggle"
                data-freeze-enabled={status.freezeEnabled ? 'true' : 'false'}
              >
                {status.freezeEnabled ? '解除冻结' : '开启冻结'}
              </AdminButton>
            </span>
          ),
        }}
        status={status.freezeEnabled ? 'warn' : 'ok'}
        data-testid="crawler-freeze-card"
      >
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          {status.freezeEnabled
            ? '已停止所有自动采集；手动触发不受影响。解除后调度器恢复。'
            : '调度器与手动采集均可触发。开启冻结后将停止自动采集 tick。'}
        </div>
      </AdminCard>

      <SchedulerConfigDrawer
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onSaved={onRefreshAfterSchedulerSave}
      />
    </>
  )
}
