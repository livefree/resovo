/**
 * NotificationStreamService.ts — SSE 未读推送连接编排（ADR-196 D-196-3 分层项 / NTLG-P2-c-B-1）
 *
 * 守 Route→Service 分层（黄线分层项）：route handler 仅 auth + 建流 + 委托，连接注册表 / scope
 *   路由 / 心跳 / 单实例共享 Redis subscribe / 连接数 metric/上限 全沉淀本 Service。
 *
 * 连接治理（黄线 3，全平台首个 SSE 关键护栏）：
 *   - 单一共享 `redis.duplicate()` subscribe 连接（**非每条 SSE 一个 duplicate**——否则 N 标签页=N Redis 连接放大）。
 *   - 内存连接注册表 `Map<scope, Set<conn>>`：Redis 信号到达后按 scope 路由 fan-out 到本实例持有的连接。
 *   - 连接数 metric（connectionCount）+ 软上限（isAtCapacity）：超限路由拒新连接 → client 回落轮询。
 *   - Redis 不可用时 `isAvailable()=false` → 路由立即 503 优雅失败（不挂半开连接，client 走 D-196-6 轮询降级）。
 *
 * 与 Fastify 解耦：经 `StreamSink { write }` 抽象——Service 不 import Fastify，route 注入 reply.raw 写回。
 */

import type Redis from 'ioredis'
import { redis } from '@/api/lib/redis'
import { baseLogger } from '@/api/lib/logger'
import { NOTIFICATIONS_CHANGED_CHANNEL, decodeNotificationSignal } from '@/api/lib/notification-pubsub'

/** SSE 帧写回抽象（route 注入 reply.raw.write，Service 不感知 Fastify/Node 类型）。 */
export interface StreamSink {
  write(chunk: string): void
}

export interface RegisterConnectionParams {
  readonly userId: string
  readonly role: string
  readonly sink: StreamSink
}

/** 已注册连接（不可变元数据 + 写回 sink）。 */
export interface StreamConnection {
  readonly id: number
  readonly userId: string
  readonly role: string
  /** 订阅的 scope 集合：broadcast + role:<role> + user:<id>（与 NotificationService.unreadCount 同源派生）。 */
  readonly scopes: readonly string[]
  readonly sink: StreamSink
}

export interface NotificationStreamServiceOptions {
  /** 重算指定用户未读计数（注入 NotificationService.unreadCount，避免 Service→Service 硬耦合）。 */
  readonly getUnreadCount: (userId: string, role: string) => Promise<number>
  /** 单实例 SSE 连接软上限（超限拒新连接 → client 回落轮询）。默认 500。 */
  readonly maxConnections?: number
  /** 心跳间隔 ms（默认 25s，keep-alive 防代理断连 + 检测死连接）。 */
  readonly heartbeatMs?: number
  /** 测试注入：替代 `redis.duplicate()` 的 subscribe 连接工厂。 */
  readonly subscriberFactory?: () => Redis
}

const DEFAULT_MAX_CONNECTIONS = 500
const HEARTBEAT_MS = 25_000

/** scope 集合派生（与 NotificationService.list/unreadCount 同源：broadcast + role + user）。 */
function scopesFor(userId: string, role: string): string[] {
  return ['broadcast', `role:${role}`, `user:${userId}`]
}

/** SSE `unread` 事件帧。 */
export function unreadFrame(count: number): string {
  return `event: unread\ndata: ${JSON.stringify({ count })}\n\n`
}

/** SSE 心跳注释帧（keep-alive，客户端忽略 `:` 起始行）。 */
export const PING_FRAME = ': ping\n\n'

export class NotificationStreamService {
  /** scope → 订阅该 scope 的连接集合（fan-out 路由表）。 */
  private readonly registry = new Map<string, Set<StreamConnection>>()
  /** 本实例全部活跃连接（心跳遍历 + 连接数）。 */
  private readonly connections = new Set<StreamConnection>()
  private subscriber: Redis | null = null
  private available = false
  private heartbeatTimer: NodeJS.Timeout | null = null
  private nextId = 1
  private readonly maxConnections: number
  private readonly heartbeatMs: number

  constructor(private readonly opts: NotificationStreamServiceOptions) {
    this.maxConnections = opts.maxConnections ?? DEFAULT_MAX_CONNECTIONS
    this.heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS
  }

  /**
   * 启动单实例共享 subscribe 连接（非阻塞，Redis-down 不抛）。
   * 连接失败 / subscribe 失败 → available 留 false → 路由 503 降级（client 走轮询 fallback）。
   * 重连后 ioredis 自动重订阅且重发 'ready' → 恢复 available。
   */
  init(): void {
    if (this.subscriber) return
    try {
      const sub = this.opts.subscriberFactory ? this.opts.subscriberFactory() : redis.duplicate()
      this.subscriber = sub
      sub.on('message', (_channel: string, message: string) => { this.onSignal(message) })
      sub.on('error', (err: unknown) => {
        this.available = false
        baseLogger.warn({ err }, '[NotificationStreamService] subscriber error; SSE degraded to polling')
      })
      sub.on('end', () => { this.available = false })
      sub.on('ready', () => { void this.doSubscribe(sub) })
      // lazyConnect → 主动触发连接；失败不抛（available 留 false → 路由 503 降级）
      sub.connect().catch((err: unknown) => {
        this.available = false
        baseLogger.warn({ err }, '[NotificationStreamService] subscriber connect failed; SSE degraded to polling')
      })
    } catch (err) {
      // duplicate()/事件绑定同步抛（Redis 基建 boot 不可用）→ 降级不阻塞 route 注册（available 留 false）
      this.available = false
      baseLogger.warn({ err }, '[NotificationStreamService] subscriber init failed; SSE degraded to polling')
    }
  }

  private async doSubscribe(sub: Redis): Promise<void> {
    try {
      await sub.subscribe(NOTIFICATIONS_CHANGED_CHANNEL)
      this.available = true
    } catch (err) {
      this.available = false
      baseLogger.warn({ err }, '[NotificationStreamService] subscribe failed; SSE degraded to polling')
    }
  }

  /** Redis subscribe 是否就绪（false → 路由 503 优雅降级）。 */
  isAvailable(): boolean {
    return this.available
  }

  /** 本实例当前活跃 SSE 连接数（metric）。 */
  connectionCount(): number {
    return this.connections.size
  }

  /** 是否已达软上限（超限路由拒新连接 → client 回落轮询）。 */
  isAtCapacity(): boolean {
    return this.connections.size >= this.maxConnections
  }

  /**
   * 注册新 SSE 连接：入注册表 + 启心跳 + 推一次初始未读（建连即同步当前计数）。
   * 路由在 hijack + writeHead 后调用；连接关闭须配对 unregister（防泄漏）。
   */
  register(params: RegisterConnectionParams): StreamConnection {
    const conn: StreamConnection = {
      id: this.nextId++,
      userId: params.userId,
      role: params.role,
      scopes: scopesFor(params.userId, params.role),
      sink: params.sink,
    }
    this.connections.add(conn)
    for (const scope of conn.scopes) {
      let set = this.registry.get(scope)
      if (!set) {
        set = new Set<StreamConnection>()
        this.registry.set(scope, set)
      }
      set.add(conn)
    }
    this.startHeartbeat()
    // 初始同步：建连即推一次当前未读（fire-and-forget）
    void this.pushUnread(conn)
    return conn
  }

  /** 注销连接（连接关闭 / 写失败时调用）：出注册表 + 空时停心跳。幂等。 */
  unregister(conn: StreamConnection): void {
    if (!this.connections.has(conn)) return
    this.connections.delete(conn)
    for (const scope of conn.scopes) {
      const set = this.registry.get(scope)
      if (set) {
        set.delete(conn)
        if (set.size === 0) this.registry.delete(scope)
      }
    }
    if (this.connections.size === 0) this.stopHeartbeat()
  }

  /** Redis 信号到达：按 scope fan-out 到本实例订阅该 scope 的连接，各自重算 unread 推送。 */
  private onSignal(message: string): void {
    const signal = decodeNotificationSignal(message)
    if (signal == null) return
    const targets = this.registry.get(signal.scope)
    if (!targets || targets.size === 0) return
    // 快照成数组：pushUnread 异步，写失败 unregister 会改 targets → 先快照避并发修改迭代器
    for (const conn of [...targets]) {
      void this.pushUnread(conn)
    }
  }

  /** 重算单连接未读并推 `unread` 帧；计数失败仅 warn（连接存活），写失败 → unregister 防泄漏。 */
  private async pushUnread(conn: StreamConnection): Promise<void> {
    let count: number
    try {
      count = await this.opts.getUnreadCount(conn.userId, conn.role)
    } catch (err) {
      baseLogger.warn({ err, userId: conn.userId }, '[NotificationStreamService] unread recompute failed')
      return
    }
    this.safeWrite(conn, unreadFrame(count))
  }

  /** 写 SSE 帧；失败（连接已断/背压崩溃）→ unregister 防泄漏。 */
  private safeWrite(conn: StreamConnection, chunk: string): void {
    try {
      conn.sink.write(chunk)
    } catch {
      this.unregister(conn)
    }
  }

  /** 单 timer 心跳（首连接启、空时停）：遍历全连接写 `: ping`，写失败连接被剔除。 */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return
    this.heartbeatTimer = setInterval(() => {
      for (const conn of [...this.connections]) {
        this.safeWrite(conn, PING_FRAME)
      }
    }, this.heartbeatMs)
    // 不阻止进程退出（测试 / 优雅关闭）
    this.heartbeatTimer.unref()
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /** 优雅关闭（Fastify onClose hook）：停心跳 + 清连接表 + 关 subscribe 连接。 */
  async shutdown(): Promise<void> {
    this.stopHeartbeat()
    this.connections.clear()
    this.registry.clear()
    this.available = false
    const sub = this.subscriber
    this.subscriber = null
    if (sub) {
      try {
        await sub.quit()
      } catch {
        sub.disconnect()
      }
    }
  }
}
