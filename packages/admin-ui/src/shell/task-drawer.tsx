'use client'

/**
 * task-drawer.tsx — 后台任务抽屉（ADR-103a §4.1.5）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.5 TaskDrawer + TaskItem
 *   - ADR-103a §4.4 4 项硬约束
 *   - 内部 base：drawer-shell.tsx（DrawerShell 共享 portal + focus trap + ESC + backdrop）
 *
 * 组件形态：
 *   章法 1C 受控浮层（消费 DrawerShell base）
 *
 * 设计要点：
 *   - 消费 DrawerShell 提供的 portal + backdrop + ESC + focus trap + close 按钮
 *   - panel header headerActions：运行中数量计数（"running 3"）
 *   - panel body：items 列表，每项含：
 *     · status 标签（pending/running/success/failed → state token slot）
 *     · title
 *     · progress bar（status='running' 且 progress 提供时；0-100）
 *     · 时间戳（startedAt + finishedAt 如有）
 *     · errorMessage（仅 status='failed'）
 *     · 行级 action：status='running' → "取消"按钮（onCancel 提供时）/ status='failed' → "重试"按钮（onRetry 提供时）
 *   - try/finally 保护行级 callback
 *
 * 不做：
 *   - 不轮询 progress（消费方 WebSocket 推送增量后注入）
 *   - 不实现取消/重试业务（仅触发 callback；消费方调用 apiClient）
 *   - 不格式化时间戳（消费方传已格式化字符串；本组件 ISO 原样显示）
 */
import type { CSSProperties } from 'react'
import { DrawerShell } from './drawer-shell'
import type { TaskItem } from './types'

export interface TaskDrawerProps {
  readonly open: boolean
  readonly items: readonly TaskItem[]
  readonly onClose: () => void
  readonly onCancel?: (taskId: string) => void
  readonly onRetry?: (taskId: string) => void
}

const ITEM_STYLE: CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
}

const ITEM_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
}

const STATUS_BADGE_STYLE: CSSProperties = {
  padding: '0 var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  lineHeight: '1.6em',
  flexShrink: 0,
}

const TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const PROGRESS_BAR_STYLE: CSSProperties = {
  height: '4px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  overflow: 'hidden',
}

const PROGRESS_FILL_STYLE: CSSProperties = {
  height: '100%',
  background: 'var(--accent-default)',
  transition: 'width var(--motion-duration-md) var(--motion-easing-standard)',
}

// fix(CHG-SN-2-10) UI/a11y 契约：indeterminate progressbar 视觉（progress=undefined 但 status='running' 时）
// 用 keyframes 在 progress bar 内左右滑动指示器（30% 宽度），表示"运行中但进度未知"
const INDETERMINATE_KEYFRAMES = `@keyframes resovo-task-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}`

const PROGRESS_FILL_INDETERMINATE_STYLE: CSSProperties = {
  height: '100%',
  width: '30%',
  background: 'var(--accent-default)',
  animation: 'resovo-task-indeterminate 1.5s ease-in-out infinite',
  willChange: 'transform',
}

const TIMESTAMP_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const ERROR_STYLE: CSSProperties = {
  color: 'var(--state-error-fg)',
  fontSize: 'var(--font-size-xs)',
  background: 'var(--state-error-bg)',
  border: '1px solid var(--state-error-border)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
}

const ACTION_BTN_STYLE: CSSProperties = {
  alignSelf: 'flex-end',
  padding: 'var(--space-1) var(--space-3)',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 'var(--font-size-xs)',
}

const COUNT_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  marginLeft: 'var(--space-2)',
  flexShrink: 0,
}

const EMPTY_STYLE: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  color: 'var(--fg-muted)',
  textAlign: 'center',
  fontSize: 'var(--font-size-sm)',
}

export function TaskDrawer({ open, items, onClose, onCancel, onRetry }: TaskDrawerProps) {
  const runningCount = items.filter((t) => t.status === 'running').length
  const headerActions = (
    <span data-task-running-count style={COUNT_STYLE}>{`运行中 ${runningCount}`}</span>
  )

  return (
    <DrawerShell open={open} onClose={onClose} title="后台任务" headerActions={headerActions} variant="tasks">
      {items.length === 0 ? (
        <div data-task-empty style={EMPTY_STYLE}>暂无任务</div>
      ) : (
        items.map((item) => (
          <TaskItemRow key={item.id} item={item} onCancel={onCancel} onRetry={onRetry} />
        ))
      )}
    </DrawerShell>
  )
}

interface TaskItemRowProps {
  readonly item: TaskItem
  readonly onCancel: ((taskId: string) => void) | undefined
  readonly onRetry: ((taskId: string) => void) | undefined
}

function TaskItemRow({ item, onCancel, onRetry }: TaskItemRowProps) {
  const slot = STATUS_TO_SLOT[item.status]
  const statusBadgeStyle: CSSProperties = {
    ...STATUS_BADGE_STYLE,
    background: `var(--state-${slot}-bg)`,
    color: `var(--state-${slot}-fg)`,
  }
  // fix(CHG-SN-2-10) UI/a11y 契约：status='running' 时始终渲染 progressbar
  // - progress 提供 → determinate（aria-valuenow + width%）
  // - progress 缺省 → indeterminate（无 aria-valuenow + 滑动动画 + aria-label="进度未知"）
  // ARIA 1.1 progressbar 规范：aria-valuenow 缺省即表示 indeterminate
  const isRunning = item.status === 'running'
  const isDeterminate = isRunning && item.progress !== undefined
  const isIndeterminate = isRunning && item.progress === undefined
  const cancelVisible = item.status === 'running' && onCancel !== undefined
  const retryVisible = item.status === 'failed' && onRetry !== undefined

  return (
    <div data-task-item={item.id} data-task-item-status={item.status} style={ITEM_STYLE}>
      <div style={ITEM_HEADER_STYLE}>
        <span data-task-item-status-badge style={statusBadgeStyle}>{STATUS_LABEL[item.status]}</span>
        <span style={TITLE_STYLE} data-task-item-title>{item.title}</span>
      </div>
      {isRunning && (
        <>
          {isIndeterminate && (
            <style data-resovo-task-indeterminate>{INDETERMINATE_KEYFRAMES}</style>
          )}
          <div data-task-item-progress style={{ ...PROGRESS_BAR_STYLE, position: 'relative', overflow: 'hidden' }}>
            {isDeterminate ? (
              <div
                data-task-item-progress-fill
                data-task-item-progress-mode="determinate"
                role="progressbar"
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ ...PROGRESS_FILL_STYLE, width: `${item.progress}%` }}
              />
            ) : (
              <div
                data-task-item-progress-fill
                data-task-item-progress-mode="indeterminate"
                role="progressbar"
                aria-label="进度未知"
                aria-valuemin={0}
                aria-valuemax={100}
                style={PROGRESS_FILL_INDETERMINATE_STYLE}
              />
            )}
          </div>
        </>
      )}
      <span style={TIMESTAMP_STYLE} data-task-item-startedat>开始 {item.startedAt}</span>
      {item.finishedAt && (
        <span style={TIMESTAMP_STYLE} data-task-item-finishedat>结束 {item.finishedAt}</span>
      )}
      {item.status === 'failed' && item.errorMessage && (
        <span style={ERROR_STYLE} data-task-item-error>{item.errorMessage}</span>
      )}
      {cancelVisible && (
        <button
          type="button"
          data-task-item-cancel
          onClick={() => {
            try {
              onCancel?.(item.id)
            } finally {
              // 不自动关闭 drawer
            }
          }}
          style={ACTION_BTN_STYLE}
        >
          取消
        </button>
      )}
      {retryVisible && (
        <button
          type="button"
          data-task-item-retry
          onClick={() => {
            try {
              onRetry?.(item.id)
            } finally {
              // 不自动关闭 drawer
            }
          }}
          style={ACTION_BTN_STYLE}
        >
          重试
        </button>
      )}
    </div>
  )
}

const STATUS_TO_SLOT: Record<TaskItem['status'], 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'info',
  running: 'warning',
  success: 'success',
  failed: 'error',
}

const STATUS_LABEL: Record<TaskItem['status'], string> = {
  pending: '待处理',
  running: '运行中',
  success: '成功',
  failed: '失败',
}
