// visitorCookie.ts — 匿名 visitor 身份单一边界（ADR-216 D-216-7 / SEQ-20260624-02 STATS-03-A1）
//
// 全局 onRequest 钩子：签发/刷新 rv_vid cookie + 解析 visitor_hash，装饰 request 供 write 端点（STATS-03-A2）消费。
// 关键不变量（D-216-7）：
//   - cookie 由此边界**唯一签发**且**签名**（@fastify/cookie signed）；伪造/篡改 rv_vid 校验失败 → 落 ephemeral 并重签
//     （Codex H-3：unsigned 无法强制"唯一签发"、客户端可伪造轮换绕过 UV/限流 → 改 signed 校验）。
//   - visitor_hash = HMAC-SHA256(rv_vid, SERVER_VISITOR_SECRET) 截断 hex，不可逆、无 PII（核心不变量⑤）。
//   - cookie 缺失/首屏竞态/签名失效 → request-scoped ephemeral hash（ip+ua+时窗），visitor_is_ephemeral=true；
//     聚合不计 UV（H2 已知接受偏差：首访 Set-Cookie 晚于首个 play-event，UV 轻微低估优于虚增）。
//   - **fail-safe**：本钩子命中**每个**请求，任何异常都不得破坏请求 → catch 后置 null/ephemeral 并继续。
//   - **探针/预检不签发**（Codex H-2）：HEAD/OPTIONS 与 /v1/health 短路，避免污染健康探针与可缓存响应。
//
// 偏离登记（D-216-7 实现细化，见 changelog [STATS-03-A1]）：
//   - Secure：D-216-7 字面"无条件 Secure"；实现为 NODE_ENV==='production' 才置 Secure，本地 dev http 无法回传
//     Secure cookie（标准 dev-http 通融，非语义偏离，M-1）。
//   - ephemeral hash 含 ip+ua+10min 窗：同 NAT 出口 IP+同 UA 多用户合并、窗边界可双发——接受偏差；防刷
//     真源是 STATS-03-A2 双维（visitor_hash + ip_hash）限流 + per-visitor 硬上限，不单赖本 hash（M-2）。

import { createHmac } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    /** D-216-7：HMAC(rv_vid | ephemeral, secret) 截断 hex；解析失败/排除路径为 null（write 端点据此处理） */
    visitorHash: string | null
    /** D-216-7 H1：ephemeral（cookie 缺失/首屏竞态/签名失效/解析失败）为 true → 聚合不计 UV */
    visitorIsEphemeral: boolean
  }
}

export const VISITOR_COOKIE_NAME = 'rv_vid'

const DEV_VISITOR_SECRET_FALLBACK = 'dev-visitor-secret-replace-in-production'

// rv_vid 值字母表（URL-safe，避开 cookie 特殊字符；复用 short-id 字母表口径）
const VISITOR_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const VISITOR_ID_LENGTH = 21
const generateVisitorId = customAlphabet(VISITOR_ID_ALPHABET, VISITOR_ID_LENGTH)

// D-216-7：Max-Age 400 天（对齐 video_play_daily_visitors retention）
export const VISITOR_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60
// ephemeral 限流时窗（10min）：同 ip+ua 窗内 hash 稳定供限流；窗外滚动避免长期可追踪
const EPHEMERAL_WINDOW_MS = 10 * 60 * 1000
// 截断 hex（128-bit，碰撞可忽略；不存全摘要减表膨胀）
const VISITOR_HASH_HEX_LEN = 32

// 探针/预检短路：不签发 cookie（Codex H-2）
const COOKIE_EXEMPT_PATHS = new Set(['/v1/health'])
const COOKIE_EXEMPT_METHODS = new Set(['HEAD', 'OPTIONS'])

/** 解析 HMAC 密钥（per-request 非抛；boot 期严格校验见 assertVisitorSecretStrength）。 */
function resolveVisitorSecret(): string {
  return process.env.SERVER_VISITOR_SECRET ?? DEV_VISITOR_SECRET_FALLBACK
}

/** boot 期 fail-fast（Codex H-1）：生产环境密钥缺失/等于 dev 默认/过短 → 拒绝启动，杜绝静默用公开 dev 密钥伪造 hash。 */
function assertVisitorSecretStrength(): void {
  if (process.env.NODE_ENV !== 'production') return
  const secret = process.env.SERVER_VISITOR_SECRET
  if (!secret || secret === DEV_VISITOR_SECRET_FALLBACK || secret.length < 32) {
    throw new Error(
      '[visitorCookie] SERVER_VISITOR_SECRET 生产环境必须为强随机值（≥32 字符，非 dev 默认）——拒绝以可伪造密钥启动',
    )
  }
}

function hmacHex(input: string): string {
  return createHmac('sha256', resolveVisitorSecret())
    .update(input)
    .digest('hex')
    .slice(0, VISITOR_HASH_HEX_LEN)
}

/** cookie-backed：HMAC(rv_vid)，不可逆、稳定 → 计入 UV。 */
export function cookieVisitorHash(rvVid: string): string {
  return hmacHex(`v1:${rvVid}`)
}

/** ephemeral fallback：HMAC(ip|ua|时窗)，仅供限流；标 ephemeral 不计 UV（D-216-7）。 */
export function ephemeralVisitorHash(request: Pick<FastifyRequest, 'ip' | 'headers'>): string {
  const ip = request.ip ?? ''
  const ua = typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : ''
  const windowIdx = Math.floor(Date.now() / EPHEMERAL_WINDOW_MS)
  return hmacHex(`eph:${ip}|${ua}|${windowIdx}`)
}

function isExempt(request: FastifyRequest): boolean {
  if (COOKIE_EXEMPT_METHODS.has(request.method)) return true
  const path = (request.url ?? '').split('?')[0]
  return COOKIE_EXEMPT_PATHS.has(path)
}

export async function visitorCookieHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 探针/预检短路：不签发 cookie、不解析身份（保持 decorate 默认 null/false）
  if (isExempt(request)) return

  try {
    const raw = request.cookies?.[VISITOR_COOKIE_NAME]
    if (typeof raw === 'string' && raw.length > 0) {
      // signed 校验（Codex H-3）：仅本边界签发的 cookie 计 cookie-backed；伪造/篡改 → valid=false 落 ephemeral
      const unsigned = request.unsignCookie(raw)
      if (unsigned.valid && unsigned.value) {
        request.visitorHash = cookieVisitorHash(unsigned.value)
        request.visitorIsEphemeral = false
        return
      }
    }

    // 首访/无 cookie/签名失效：为后续请求签发 signed rv_vid（唯一边界），本次落 ephemeral（H2 竞态，接受偏差）
    const newVid = generateVisitorId()
    reply.setCookie(VISITOR_COOKIE_NAME, newVid, {
      signed: true,
      httpOnly: true,
      // D-216-7 Secure：生产强制；本地 dev http 无法回传 Secure cookie → 仅生产置 Secure（M-1 dev-http 通融）
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    })
    request.visitorHash = ephemeralVisitorHash(request)
    request.visitorIsEphemeral = true
  } catch {
    // fail-safe：全局钩子绝不破坏请求；解析/签发失败 → 无 visitor 身份（write 端点据 null 处理）
    request.visitorHash = null
    request.visitorIsEphemeral = true
  }
}

/**
 * 注册：boot 期密钥强度校验 + decorateRequest 默认值 + 全局 onRequest 钩子。
 * 须在 @fastify/cookie 注册之后调用（依赖 request.cookies / request.unsignCookie）。
 */
export function setupVisitorCookie(fastify: FastifyInstance): void {
  assertVisitorSecretStrength()
  fastify.decorateRequest('visitorHash', null)
  fastify.decorateRequest('visitorIsEphemeral', false)
  fastify.addHook('onRequest', visitorCookieHandler)
}
