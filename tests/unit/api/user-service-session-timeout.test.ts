/**
 * tests/unit/api/user-service-session-timeout.test.ts —
 * ADR-148 / CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A
 * UserService.getSessionTimeoutMinutes KV 消费 + 4 caller 集成 + clamp 防护单测
 *
 * 覆盖（ADR-148 §6 测试 surface #4-12，共 9 用例）：
 *   #4 login KV '30' → exp-iat=1800
 *   #5 register KV '30' → exp-iat=1800
 *   #6 refresh KV '120' → exp-iat=7200
 *   #7 devLogin KV '45' → exp-iat=2700
 *   #8 KV 缺失 → 默认 60min (3600s)
 *   #9 KV 非数字 → 降级 60min
 *  #10 KV '1' → clamp 5min (300s)
 *  #11 KV '9999' → clamp 1440min (86400s)
 *  #12 KV '0' → clamp 5min (300s)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getSettingMock } = vi.hoisted(() => ({ getSettingMock: vi.fn() }))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}))
vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: getSettingMock,
}))

const { findUserByEmailMock, findUserByUsernameMock, findUserByIdMock, createUserMock } =
  vi.hoisted(() => ({
    findUserByEmailMock: vi.fn(),
    findUserByUsernameMock: vi.fn(),
    findUserByIdMock: vi.fn(),
    createUserMock: vi.fn(),
  }))

vi.mock('@/api/db/queries/users', () => ({
  findUserByEmail: findUserByEmailMock,
  findUserByUsername: findUserByUsernameMock,
  findUserById: findUserByIdMock,
  createUser: createUserMock,
}))

import bcrypt from 'bcryptjs'
import { UserService } from '@/api/services/UserService'
import { verifyAccessToken, signRefreshToken } from '@/api/lib/auth'
import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'

const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-1',
  email: 'a@b.com',
  username: 'alice',
  role: 'user' as const,
  passwordHash: bcrypt.hashSync('password', 4),
  locale: 'zh',
  bannedAt: null,
  roleChangedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  getSettingMock.mockReset()
  findUserByEmailMock.mockReset()
  findUserByUsernameMock.mockReset()
  findUserByIdMock.mockReset()
  createUserMock.mockReset()
})

function newService() {
  return new UserService(db as never, redis as never)
}

describe('UserService — KV session_timeout_minutes 4 caller 集成', () => {
  it('#4 login KV "30" → exp-iat=1800', async () => {
    getSettingMock.mockResolvedValue('30')
    const user = fakeUser()
    findUserByEmailMock.mockResolvedValue(user)
    const res = await newService().login('a@b.com', 'password')
    const payload = verifyAccessToken(res.accessToken)
    expect(payload.exp - payload.iat).toBe(1800)
  })

  it('#5 register KV "30" → exp-iat=1800', async () => {
    getSettingMock.mockResolvedValue('30')
    findUserByEmailMock.mockResolvedValue(null)
    findUserByUsernameMock.mockResolvedValue(null)
    createUserMock.mockResolvedValue(fakeUser())
    const res = await newService().register({ username: 'alice', email: 'a@b.com', password: 'password' })
    const payload = verifyAccessToken(res.accessToken)
    expect(payload.exp - payload.iat).toBe(1800)
  })

  it('#6 refresh KV "120" → exp-iat=7200', async () => {
    getSettingMock.mockResolvedValue('120')
    findUserByIdMock.mockResolvedValue(fakeUser())
    const rt = signRefreshToken('u-1')
    const res = await newService().refresh(rt)
    const payload = verifyAccessToken(res.accessToken)
    expect(payload.exp - payload.iat).toBe(7200)
  })

  it('#7 devLogin KV "45" → exp-iat=2700', async () => {
    getSettingMock.mockResolvedValue('45')
    findUserByEmailMock.mockResolvedValue(fakeUser())
    const res = await newService().devLogin('a@b.com')
    const payload = verifyAccessToken(res.accessToken)
    expect(payload.exp - payload.iat).toBe(2700)
  })
})

describe('UserService.getSessionTimeoutMinutes — 边界 + clamp（ADR-148 D-148-5）', () => {
  // 通过 login 间接测 helper（hidden private）
  async function loginAndDecode(kvValue: unknown): Promise<number> {
    getSettingMock.mockResolvedValue(kvValue)
    findUserByEmailMock.mockResolvedValue(fakeUser())
    const res = await newService().login('a@b.com', 'password')
    const payload = verifyAccessToken(res.accessToken)
    return payload.exp - payload.iat
  }

  it('#8 KV 缺失（null）→ 默认 60min (3600s)', async () => {
    const ttl = await loginAndDecode(null)
    expect(ttl).toBe(3600)
  })

  it('#9 KV 非数字 "abc" → 降级 60min (3600s)', async () => {
    const ttl = await loginAndDecode('abc')
    expect(ttl).toBe(3600)
  })

  it('#10 KV "1" → clamp 5min (300s)', async () => {
    const ttl = await loginAndDecode('1')
    expect(ttl).toBe(300)
  })

  it('#11 KV "9999" → clamp 1440min (86400s)', async () => {
    const ttl = await loginAndDecode('9999')
    expect(ttl).toBe(86400)
  })

  it('#12 KV "0" → clamp 5min (300s)', async () => {
    const ttl = await loginAndDecode('0')
    expect(ttl).toBe(300)
  })
})
