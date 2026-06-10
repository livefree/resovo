/**
 * notification-stream-client.ts — SSE 未读推送 fetch-stream 客户端（ADR-196 D-196-1 / NTLG-P2-c-B-2）
 *
 * 全平台首个 SSE 消费侧。否决原生 EventSource（无法设 Authorization header，W3C 限制，D-196-1）→
 *   用 fetch + ReadableStream + TextDecoder 携 Bearer 直连 B-1 的 `GET /admin/notifications/stream`，
 *   读 `text/event-stream` 帧。代价 = 失去原生自动重连 → 本模块手动指数退避重连。
 *
 * 消费 B-1 wire 契约（D-196-3）：`event: unread\ndata: {"count":N}\n\n` + `: ping\n\n` 心跳（忽略）。
 * 非 200（503 Redis-down/上限降级）/ 流断 → 退避重连；上层 admin-shell 据 onStateChange 切 60s 轮询 fallback（D-196-6）。
 *
 * framework-agnostic（纯 TS，无 React）：parseSSEEvent/parseUnreadCount 可单测；connect 经 deps 注入 fetch/token/baseUrl 供测试。
 */

import { useAuthStore } from '@/stores/authStore'
import { API_BASE_URL } from '@/lib/api-client'

const STREAM_PATH = '/admin/notifications/stream'
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000

export type NotificationStreamState = 'connecting' | 'open' | 'closed'

export interface NotificationStreamHandlers {
  /** 收到 `unread` 事件（含 count）。 */
  readonly onUnread: (count: number) => void
  /** 连接状态变更（上层据此切轮询 fallback：open→停轮询 / closed→起轮询）。 */
  readonly onStateChange?: (state: NotificationStreamState) => void
}

export interface NotificationStreamDeps {
  readonly fetchImpl?: typeof fetch
  readonly getToken?: () => string | null
  readonly baseUrl?: string
  /** 退避基数 ms（测试可缩短）。 */
  readonly backoffBaseMs?: number
}

export interface NotificationStreamController {
  /** 主动断连（unmount）：中止 fetch + 清退避计时 + 停重连循环。 */
  close: () => void
}

/**
 * 解析单个 SSE 事件块（`\n\n` 分隔的一段，可多 data 行）。
 * `:` 起始为注释/心跳行（忽略）；无 data 行 → null（如纯心跳块）。
 */
export function parseSSEEvent(block: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

/** 解析 `unread` 事件 data（`{"count":N}`）→ 有限数 count，非法 → null。 */
export function parseUnreadCount(data: string): number | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (typeof parsed === 'object' && parsed !== null) {
      const count = (parsed as Record<string, unknown>).count
      if (typeof count === 'number' && Number.isFinite(count)) return count
    }
    return null
  } catch {
    return null
  }
}

/** 增量读取 SSE 流：按 `\n\n` 切帧，`unread` 事件回调 onUnread。流结束 return（上层重连）。 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  onUnread: (count: number) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const evt = parseSSEEvent(block)
      if (evt?.event === 'unread') {
        const count = parseUnreadCount(evt.data)
        if (count != null) onUnread(count)
      }
    }
  }
}

/**
 * 建立 SSE 连接 + 手动指数退避重连。返回 controller.close() 主动断连。
 * 连接成功推首帧未读；非 200/流断 → 退避重连（attempt 累加 1s→cap 30s）；close 后停循环。
 */
export function connectNotificationStream(
  handlers: NotificationStreamHandlers,
  deps: NotificationStreamDeps = {},
): NotificationStreamController {
  const fetchImpl = deps.fetchImpl ?? fetch
  const getToken = deps.getToken ?? (() => useAuthStore.getState().accessToken ?? null)
  const baseUrl = deps.baseUrl ?? API_BASE_URL
  const backoffBase = deps.backoffBaseMs ?? BACKOFF_BASE_MS

  let closed = false
  let attempt = 0
  let abort: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryResolve: (() => void) | null = null

  const setState = (s: NotificationStreamState): void => { handlers.onStateChange?.(s) }

  async function loop(): Promise<void> {
    while (!closed) {
      setState('connecting')
      abort = new AbortController()
      try {
        const token = getToken()
        const res = await fetchImpl(`${baseUrl}${STREAM_PATH}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abort.signal,
          // SSE 长连接不走缓存
          cache: 'no-store',
        })
        if (!res.ok || res.body == null) {
          // 503（Redis-down/上限降级）/ 4xx → 退避重连（轮询 fallback 接管期间）
          throw new Error(`stream status ${res.status}`)
        }
        attempt = 0
        setState('open')
        await readStream(res.body, handlers.onUnread)
        // 流正常结束 → 落 closed 后重连
      } catch {
        if (closed) break
        // 连接/读取失败：吞错走重连（上层据 closed 态启轮询 fallback）
      }
      setState('closed')
      if (closed) break
      // 指数退避重连（close 可中断 sleep）
      const delay = Math.min(backoffBase * 2 ** attempt, BACKOFF_MAX_MS)
      attempt += 1
      await new Promise<void>((resolve) => {
        retryResolve = resolve
        retryTimer = setTimeout(resolve, delay)
      })
      retryTimer = null
      retryResolve = null
    }
    setState('closed')
  }

  void loop()

  return {
    close: () => {
      closed = true
      abort?.abort()
      if (retryTimer != null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      // 唤醒可能正在退避 sleep 的循环 → 检测 closed 退出
      retryResolve?.()
    },
  }
}
