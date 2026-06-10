'use client'

/**
 * notification-drawer.tsx — 通知抽屉（ADR-103a §4.1.5）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.5 NotificationDrawer + NotificationItem
 *   - ADR-103a §4.4 4 项硬约束
 *   - 内部 base：drawer-shell.tsx（DrawerShell 共享 portal + focus trap + ESC + backdrop）
 *
 * 组件形态：
 *   章法 1C 受控浮层（消费 DrawerShell base）
 *
 * 设计要点：
 *   - 消费 DrawerShell 提供的 portal + backdrop + ESC + focus trap + close 按钮
 *   - panel header headerActions：items.length 计数 + "全部已读" button（仅 onMarkAllRead 提供时）
 *   - panel body：items 列表，每项含 level 颜色条 + title + body + createdAt
 *   - 已读项 opacity 降低（通过 var(--fg-muted) 颜色基调）
 *   - 点击项触发 onItemClick(item)；href 由消费方决定 router.push
 *   - try/finally 保护行级 callback（与 UserMenu/DrawerShell 一致）
 *
 * 不做：
 *   - 不轮询数据（消费方 SWR / 真端点 / WebSocket 注入 items）
 *   - 不持久化已读状态（消费方在 onItemClick / onMarkAllRead 内部处理）
 *   - 不实现 router.push（onItemClick 触发，消费方决定）
 *   - 不格式化 createdAt（消费方传已格式化字符串；本组件 UTC 字符串原样显示）
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DrawerShell } from './drawer-shell'
import type { NotificationItem } from './types'

export interface NotificationDrawerProps {
  readonly open: boolean
  readonly items: readonly NotificationItem[]
  readonly onClose: () => void
  readonly onItemClick?: (item: NotificationItem) => void
  readonly onMarkAllRead?: () => void
}

const MARK_ALL_READ_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 'var(--space-1) var(--space-2)',
  color: 'var(--accent-default)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
}

// NTLG-NTF-UNREAD-FILTER：「只看未读 / 显示全部」切换。激活态（unreadOnly）走 accent，非激活走 muted。
const UNREAD_TOGGLE_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
}

const ITEM_STYLE: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  background: 'transparent',
  // CHG-SN-6-RETRO-4：拆 border:0 + borderBottom 冲突
  borderTop: 0,
  borderLeft: 0,
  borderRight: 0,
  borderBottom: '1px solid var(--border-subtle)',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'var(--fg-default)',
}

const LEVEL_BAR_STYLE: CSSProperties = {
  width: '4px',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
}

const META_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  minWidth: 0,
}

const TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const BODY_TEXT_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  // NTLG-P2-c-UI-1：解除单行截断——让采集 digest 摘要（"新增 N 视频 · M 线路 · K 站点失败 · E 错误"）
  // 完整显示，不再 ellipsis 截断多 metric 文案。
  whiteSpace: 'normal',
  wordBreak: 'break-word',
}

const TIMESTAMP_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
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

// NTLG-P2-c-UI-1：按既有 NotificationItem.category 分组渲染（general=系统通知 / background=后台动态）。
// general 在前；category 缺省（undefined）归 general 默认组（与 types.ts 注释「'general'（默认）」一致）。
const GROUP_ORDER = ['general', 'background'] as const
type NotificationGroupKey = (typeof GROUP_ORDER)[number]

const GROUP_LABEL: Record<NotificationGroupKey, string> = {
  general: '系统通知',
  background: '后台动态',
}

const GROUP_TITLE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  background: 'var(--bg-surface-row)',
  borderBottom: '1px solid var(--border-subtle)',
}

/** 按 category 分组（general 在前 / background 在后）；undefined → general；空组剔除。 */
function groupItems(
  items: readonly NotificationItem[],
): ReadonlyArray<readonly [NotificationGroupKey, readonly NotificationItem[]]> {
  const buckets: Record<NotificationGroupKey, NotificationItem[]> = { general: [], background: [] }
  for (const item of items) {
    const key: NotificationGroupKey = item.category === 'background' ? 'background' : 'general'
    buckets[key].push(item)
  }
  return GROUP_ORDER.map((key) => [key, buckets[key]] as const).filter(([, group]) => group.length > 0)
}

export function NotificationDrawer({ open, items, onClose, onItemClick, onMarkAllRead }: NotificationDrawerProps) {
  // NTLG-NTF-UNREAD-FILTER：抽屉内部「只看未读」过滤态（复用既有 read，不改 Props）。
  const [unreadOnly, setUnreadOnly] = useState(false)
  const visibleItems = unreadOnly ? items.filter((item) => !item.read) : items
  const headerActions = (
    <>
      <span data-notification-count style={COUNT_STYLE}>{items.length}</span>
      <button
        type="button"
        data-notification-unread-toggle
        data-active={unreadOnly ? 'true' : 'false'}
        onClick={() => setUnreadOnly((v) => !v)}
        style={{ ...UNREAD_TOGGLE_BTN_STYLE, color: unreadOnly ? 'var(--accent-default)' : 'var(--fg-muted)' }}
      >
        {unreadOnly ? '显示全部' : '只看未读'}
      </button>
      {onMarkAllRead && (
        <button
          type="button"
          data-notification-mark-all-read
          onClick={() => {
            try {
              onMarkAllRead()
            } finally {
              // intentionally empty: 不自动关闭抽屉，与 ADR §4.1.5 "标记全部已读后用户可继续浏览" 语义一致
            }
          }}
          style={MARK_ALL_READ_BTN_STYLE}
        >
          全部已读
        </button>
      )}
    </>
  )

  return (
    <DrawerShell open={open} onClose={onClose} title="通知" headerActions={headerActions} variant="notifications">
      {items.length === 0 ? (
        <div data-notification-empty style={EMPTY_STYLE}>暂无通知</div>
      ) : visibleItems.length === 0 ? (
        <div data-notification-empty-unread style={EMPTY_STYLE}>暂无未读通知</div>
      ) : (
        groupItems(visibleItems).map(([groupKey, group]) => (
          <NotificationGroup key={groupKey} groupKey={groupKey} items={group} onItemClick={onItemClick} />
        ))
      )}
    </DrawerShell>
  )
}

interface NotificationGroupProps {
  readonly groupKey: NotificationGroupKey
  readonly items: readonly NotificationItem[]
  readonly onItemClick: ((item: NotificationItem) => void) | undefined
}

/** 分组区：区头（文案 + 区内计数）+ 该 category 的 item 列表。 */
function NotificationGroup({ groupKey, items, onItemClick }: NotificationGroupProps) {
  return (
    <section data-notification-group={groupKey}>
      <div data-notification-group-title style={GROUP_TITLE_STYLE}>
        <span>{GROUP_LABEL[groupKey]}</span>
        <span data-notification-group-count style={COUNT_STYLE}>{items.length}</span>
      </div>
      {items.map((item) => (
        <NotificationItemRow key={item.id} item={item} onItemClick={onItemClick} />
      ))}
    </section>
  )
}

interface NotificationItemRowProps {
  readonly item: NotificationItem
  readonly onItemClick: ((item: NotificationItem) => void) | undefined
}

function NotificationItemRow({ item, onItemClick }: NotificationItemRowProps) {
  const slot = LEVEL_TO_SLOT[item.level]
  const interactive = onItemClick !== undefined
  // fix(CHG-SN-2-10) UI/a11y 契约：onItemClick 缺省时渲染为 article（非 button），避免视觉暗示可点击但 no-op
  const itemStyle: CSSProperties = {
    ...ITEM_STYLE,
    opacity: item.read ? 0.6 : 1,
    cursor: interactive ? 'pointer' : 'default',
  }
  const innerNodes = (
    <>
      <span aria-hidden="true" style={{ ...LEVEL_BAR_STYLE, background: `var(--state-${slot}-border)` }} />
      <span style={META_STYLE}>
        <span style={TITLE_STYLE} data-notification-item-title>{item.title}</span>
        {item.body && <span style={BODY_TEXT_STYLE} data-notification-item-body>{item.body}</span>}
        <span style={TIMESTAMP_STYLE} data-notification-item-time>{item.createdAt}</span>
      </span>
    </>
  )

  if (!interactive) {
    return (
      <article
        data-notification-item={item.id}
        data-notification-item-level={item.level}
        data-notification-item-read={item.read ? 'true' : 'false'}
        data-notification-item-interactive="false"
        style={itemStyle}
      >
        {innerNodes}
      </article>
    )
  }

  return (
    <button
      type="button"
      data-notification-item={item.id}
      data-notification-item-level={item.level}
      data-notification-item-read={item.read ? 'true' : 'false'}
      data-notification-item-interactive="true"
      onClick={() => {
        try {
          onItemClick(item)
        } finally {
          // 不自动关闭抽屉（消费方决定是否关闭）
        }
      }}
      style={itemStyle}
    >
      {innerNodes}
    </button>
  )
}

const LEVEL_TO_SLOT: Record<NotificationItem['level'], 'info' | 'warning' | 'error'> = {
  info: 'info',
  warn: 'warning',
  danger: 'error',
}
