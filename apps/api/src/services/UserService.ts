/**
 * UserService.ts — 用户认证业务逻辑（AUTH 相关）
 * 负责：注册、登录、刷新、登出
 * ADR-003: Access token 15m 内存；Refresh token 7d HttpOnly Cookie
 */

import bcrypt from 'bcryptjs'

import type { Pool } from 'pg'
import type { Redis } from 'ioredis'

import * as userQueries from '@/api/db/queries/users'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  blacklistKey,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@/api/lib/auth'
// ADR-148 D-148-1 / CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A：access token TTL KV 驱动
import { getSetting } from '@/api/db/queries/systemSettings'
import type { User } from '@/types'

// ADR-148 D-148-5 双重防护 clamp 边界（与 siteConfig zod 写入校验一致）
const SESSION_TIMEOUT_MIN_MINUTES = 5
const SESSION_TIMEOUT_MAX_MINUTES = 1440
const SESSION_TIMEOUT_DEFAULT_MINUTES = 60

// bcrypt cost：测试环境用 4 提高速度，生产用 12
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12

// ── 错误类型 ─────────────────────────────────────────────────────

export class ConflictError extends Error {
  readonly code = 'CONFLICT'
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED'
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP：admin 改用户角色后 refresh / authenticate 检测到
// token.iat < user.role_changed_at 时抛此错误；前端 interceptor 识别 ROLE_CHANGED 后强制 logout。
export class RoleChangedError extends Error {
  readonly code = 'ROLE_CHANGED'
  constructor(message = '您的权限已变更，请重新登录') {
    super(message)
    this.name = 'RoleChangedError'
  }
}

// ── UserService ──────────────────────────────────────────────────

export interface RegisterInput {
  username: string
  email: string
  password: string
  locale?: string
}

export interface AuthResult {
  user: User
  accessToken: string
  refreshToken: string
}

export class UserService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  /**
   * ADR-148 D-148-1 + D-148-5：读 KV `session_timeout_minutes` + 双重防护 clamp + NaN 降级
   * 返回 number 分钟（供 caller 拼 `${n}m` 字符串传 signAccessToken）
   *
   * 防御：getSetting 查询失败（DB 不可用 / 测试 mock 缺失）→ 降级默认 60min（不阻塞登录）
   */
  private async getSessionTimeoutMinutes(): Promise<number> {
    let raw: string | null = null
    try {
      raw = await getSetting(this.db, 'session_timeout_minutes')
    } catch {
      // 降级默认值（生产 DB 故障 / 测试 mock 缺失）
    }
    const parsed = raw !== null ? Number(raw) : SESSION_TIMEOUT_DEFAULT_MINUTES
    const safe = Number.isFinite(parsed) ? parsed : SESSION_TIMEOUT_DEFAULT_MINUTES
    return Math.max(SESSION_TIMEOUT_MIN_MINUTES, Math.min(SESSION_TIMEOUT_MAX_MINUTES, safe))
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    // 唯一性校验（email 和 username 均需唯一）
    const [byEmail, byUsername] = await Promise.all([
      userQueries.findUserByEmail(this.db, input.email),
      userQueries.findUserByUsername(this.db, input.username),
    ])
    if (byEmail) throw new ConflictError('该邮箱已注册')
    if (byUsername) throw new ConflictError('该用户名已被占用')

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const user = await userQueries.createUser(this.db, {
      username: input.username,
      email: input.email,
      passwordHash,
      locale: input.locale,
    })

    const { passwordHash: _ph, ...safeUser } = user
    const ttl = await this.getSessionTimeoutMinutes()
    const accessToken = signAccessToken({ userId: user.id, role: user.role }, `${ttl}m`)
    const refreshToken = signRefreshToken(user.id)

    return { user: safeUser, accessToken, refreshToken }
  }

  async login(identifier: string, password: string): Promise<AuthResult> {
    // 包含 @ 则视为邮箱，否则视为用户名
    const user = identifier.includes('@')
      ? await userQueries.findUserByEmail(this.db, identifier)
      : await userQueries.findUserByUsername(this.db, identifier)

    // 统一错误信息，不区分"账号不存在"和"密码错误"，防止用户枚举
    if (!user) {
      await bcrypt.compare(password, '$2b$12$invalidsaltthatisnotrealanddoesntmatch')
      throw new UnauthorizedError('账号或密码错误')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedError('账号或密码错误')

    const { passwordHash: _ph, ...safeUser } = user
    const ttl = await this.getSessionTimeoutMinutes()
    const accessToken = signAccessToken({ userId: user.id, role: user.role }, `${ttl}m`)
    const refreshToken = signRefreshToken(user.id)

    return { user: safeUser, accessToken, refreshToken }
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    // 检查黑名单
    const blocked = await this.redis.get(blacklistKey(refreshToken))
    if (blocked) throw new UnauthorizedError('Refresh token 已失效')

    let payload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      throw new UnauthorizedError('Refresh token 无效或已过期')
    }

    const user = await userQueries.findUserById(this.db, payload.userId)
    if (!user) throw new UnauthorizedError('用户不存在')

    // ADR-139 D-139-3：拒绝过期 refresh token + 强制重新登录
    // payload.iat (秒) vs user.roleChangedAt (ISO ms 转秒)；cache miss / 从未改过 (NULL) 不拦截
    if (user.roleChangedAt) {
      const roleChangedSec = Math.floor(new Date(user.roleChangedAt).getTime() / 1000)
      if (payload.iat < roleChangedSec) {
        throw new RoleChangedError()
      }
    }

    const ttl = await this.getSessionTimeoutMinutes()
    const accessToken = signAccessToken({ userId: user.id, role: user.role }, `${ttl}m`)
    return { accessToken }
  }

  async logout(refreshToken: string): Promise<void> {
    let ttl = REFRESH_TOKEN_TTL_SECONDS

    try {
      const payload = verifyRefreshToken(refreshToken)
      // 精确 TTL：token 剩余有效期
      const remaining = payload.exp - Math.floor(Date.now() / 1000)
      if (remaining > 0) ttl = remaining
    } catch {
      // token 已过期也要写入黑名单（防止重放）
    }

    await this.redis.set(blacklistKey(refreshToken), '1', 'EX', ttl)
  }

  async devLogin(identifier: string): Promise<AuthResult> {
    const user = identifier.includes('@')
      ? await userQueries.findUserByEmail(this.db, identifier)
      : await userQueries.findUserByUsername(this.db, identifier)

    if (!user) {
      throw new UnauthorizedError(`开发账号不存在：${identifier}`)
    }
    if (user.bannedAt) {
      throw new UnauthorizedError('该账号已被封禁，无法开发快捷登录')
    }

    const { passwordHash: _ph, ...safeUser } = user
    const ttl = await this.getSessionTimeoutMinutes()
    const accessToken = signAccessToken({ userId: user.id, role: user.role }, `${ttl}m`)
    const refreshToken = signRefreshToken(user.id)
    return { user: safeUser, accessToken, refreshToken }
  }
}
