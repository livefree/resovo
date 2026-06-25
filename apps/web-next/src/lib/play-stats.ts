/**
 * play-stats.ts — 视频级 Qualified Play 上报前端 helper（ADR-216 / SEQ-20260624-02 STATS-03-B）
 *
 * 单一真源：Qualified Play 阈值常量（与 apps/api VideoPlayEventService 同名，D-216-1）、
 * play_session_id 生成、**真实观看时长累加器**、确定性 idempotency_key 构造（D-216-8）、上报封装。
 * 消费方：PlayerShell（full）与 useMiniPlayerVideo（mini）——两独立 <video> 实例共用同一口径。
 *
 * 设计要点：
 * - 纯函数 + 浏览器原生 crypto（零新依赖）；client 侧调用。crypto 能力检测，SSR/非 secure context 安全。
 * - watchSeconds 取**真实观看时长**（detector 累计正向小增量），非播放位置 currentTime——
 *   否则断点续播 / seek 到 20s 即误判 qualified（Codex BLOCK-2）。
 * - apiClient 依赖注入（PlayEventApiClient 接口）便于单测 mock，不直接耦合实例。
 */

// ── D-216-1：Qualified Play 阈值常量（前端 helper 与 API service 同名真源，禁止散落各组件）──
export const QUALIFIED_PLAY_MIN_SECONDS = 20
export const SHORT_MEDIA_MAX_SECONDS = 25
export const SHORT_MEDIA_QUALIFY_RATIO = 0.8
export const QUALIFIED_PLAY_EVENT_TYPE = 'qualified_play' as const

// detector 单 tick 最大累加增量（s）：正常 timeupdate 间隔 ~0.25–1s；> 2s 视为 seek/续播跳跃，不计入观看时长。
const DEFAULT_MAX_TICK_GAP_SECONDS = 2

/**
 * D-216-1：基于**真实累计观看时长** watchSeconds 判定 qualified play。
 * 长媒体 watchSeconds≥20s；短媒体（0<duration<25s）watchSeconds≥0.8×duration。
 */
export function isQualifiedPlay({
  watchSeconds,
  duration,
}: {
  watchSeconds: number
  duration: number | null
}): boolean {
  if (watchSeconds >= QUALIFIED_PLAY_MIN_SECONDS) return true
  if (duration !== null && duration > 0 && duration < SHORT_MEDIA_MAX_SECONDS) {
    return watchSeconds >= SHORT_MEDIA_QUALIFY_RATIO * duration
  }
  return false
}

export interface QualifiedPlayDetector {
  /** 输入当前播放位置 + 时长，累计真实观看增量，返回累计观看秒与是否已达 qualified 阈值。 */
  track(currentTime: number, duration: number | null): { watchSeconds: number; qualified: boolean }
  /** 切集 / 切视频清零（同一 detector 实例复用、重新累计）。 */
  reset(): void
}

/**
 * 单实例观看时长累加器（真实观看时长真源）。仅累计正向小增量（0<delta≤maxGap），
 * 排除 seek / 断点续播跳跃 → watchSeconds 不被播放位置污染（Codex BLOCK-2）。
 */
export function createQualifiedPlayDetector(
  maxGapSeconds = DEFAULT_MAX_TICK_GAP_SECONDS,
): QualifiedPlayDetector {
  let watchSeconds = 0
  let lastTime = -1
  return {
    track(currentTime, duration) {
      if (lastTime >= 0) {
        const delta = currentTime - lastTime
        if (delta > 0 && delta <= maxGapSeconds) watchSeconds += delta
      }
      lastTime = currentTime
      return { watchSeconds, qualified: isQualifiedPlay({ watchSeconds, duration }) }
    },
    reset() {
      watchSeconds = 0
      lastTime = -1
    },
  }
}

/** 浏览器原生 crypto（能力检测；SSR / 非 secure context 返回 null，调用方降级）。 */
function getCrypto(): Crypto | null {
  const c = (globalThis as { crypto?: Crypto }).crypto
  return c ?? null
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * play_session_id：24-hex 随机串（命中端点 zod min16/max32）。
 * crypto.getRandomValues 不可用时退回 Math.random 拼接（仅 SSR/无 crypto 环境，正常路径不走）。
 */
export function buildPlaySessionId(): string {
  const crypto = getCrypto()
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    return toHex(bytes)
  }
  const fallback = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).replace(/[^0-9a-f]/g, '')
  return fallback.slice(0, 24).padEnd(24, '0')
}

/**
 * D-216-8：确定性 idempotency_key = sha256Hex(playSessionId|shortId|episode|eventType)（64 hex）。
 * 同一 qualified play retry 同值；前端构造、API 原样存。crypto.subtle 不可用 → 返回 null（放弃上报，不抛错）。
 */
export async function buildPlayEventIdempotencyKey(input: {
  playSessionId: string
  shortId: string
  episodeNumber: number | null
  eventType?: string
}): Promise<string | null> {
  const crypto = getCrypto()
  if (!crypto?.subtle) return null
  const eventType = input.eventType ?? QUALIFIED_PLAY_EVENT_TYPE
  const material = `${input.playSessionId}|${input.shortId}|${String(input.episodeNumber ?? 0)}|${eventType}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return toHex(new Uint8Array(digest))
}

/** apiClient 最小注入接口（解耦实例、便于单测 mock；真实 apiClient.post 结构兼容）。 */
export interface PlayEventApiClient {
  post<T = unknown>(path: string, body?: unknown, options?: { skipAuth?: boolean }): Promise<T>
}

export interface ReportPlayEventInput {
  shortId: string
  sourceId?: string | null
  /** 前端口径统一用当前 currentEpisode（line-matrix 归一，电影=1）；恒 ≥1。 */
  episodeNumber: number | null
  playSessionId: string
  /** 真实累计观看时长（detector 输出），上报前取整。 */
  watchSeconds: number
  durationSeconds?: number | null
  locale?: string | null
}

/**
 * 上报 qualified play（fire-and-forget）。内部构造确定性 key + POST `/videos/:short/play-events`，
 * 失败吞错不影响播放（端点 202、后端双防线幂等兜底）。不绕过 apiClient（credentials:include 带 rv_vid cookie）。
 */
export async function reportVideoPlayEvent(
  client: PlayEventApiClient,
  input: ReportPlayEventInput,
): Promise<void> {
  const idempotencyKey = await buildPlayEventIdempotencyKey({
    playSessionId: input.playSessionId,
    shortId: input.shortId,
    episodeNumber: input.episodeNumber,
  })
  if (!idempotencyKey) return // crypto.subtle 不可用，放弃（极少见）

  const body: Record<string, unknown> = {
    playSessionId: input.playSessionId,
    idempotencyKey,
    watchSeconds: Math.max(0, Math.floor(input.watchSeconds)),
    occurredAt: new Date().toISOString(),
  }
  // episodeNumber：前端恒 ≥1（zod min(1)）；null（理论上不会发生）则省略，由后端 COALESCE 0。
  if (input.episodeNumber !== null && input.episodeNumber >= 1) body.episodeNumber = input.episodeNumber
  if (input.sourceId) body.sourceId = input.sourceId
  if (input.durationSeconds && input.durationSeconds > 0) body.durationSeconds = Math.floor(input.durationSeconds)
  if (input.locale) body.locale = input.locale

  try {
    await client.post(`/videos/${input.shortId}/play-events`, body)
  } catch {
    // fire-and-forget：上报失败不影响播放（端点 202、后端幂等兜底）
  }
}
