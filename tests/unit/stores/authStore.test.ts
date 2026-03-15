/**
 * tests/unit/stores/authStore.test.ts
 * AUTH-03: authStore 状态机测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, selectIsLoggedIn, selectIsAdmin, selectIsModerator } from '@/stores/authStore'
import type { User } from '@/types'

// ── 测试数据 ────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: 'uuid-1',
  username: 'testuser',
  email: 'test@example.com',
  avatarUrl: null,
  role: 'user',
  locale: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  bannedAt: null,
}

const MOCK_ADMIN: User = { ...MOCK_USER, id: 'uuid-2', role: 'admin', username: 'admin' }
const MOCK_MOD: User = { ...MOCK_USER, id: 'uuid-3', role: 'moderator', username: 'moderator' }
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test.token'

// ── 测试 ────────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    // 每次测试前重置 store 到初始状态
    useAuthStore.setState({ user: null, accessToken: null, isLoading: false })
  })

  // ── 初始状态 ─────────────────────────────────────────────────────

  it('初始状态：user 为 null，accessToken 为 null', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  // ── login ────────────────────────────────────────────────────────

  it('login：同时更新 user 和 accessToken', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(MOCK_USER)
    expect(state.accessToken).toBe(MOCK_TOKEN)
  })

  it('login 后 selectIsLoggedIn 返回 true', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    expect(selectIsLoggedIn(useAuthStore.getState())).toBe(true)
  })

  // ── logout ───────────────────────────────────────────────────────

  it('logout：清除 user 和 accessToken', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
  })

  it('logout 后 selectIsLoggedIn 返回 false', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    useAuthStore.getState().logout()
    expect(selectIsLoggedIn(useAuthStore.getState())).toBe(false)
  })

  // ── setAccessToken ───────────────────────────────────────────────

  it('setAccessToken：只更新 token，不影响 user', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    const newToken = 'new.access.token'
    useAuthStore.getState().setAccessToken(newToken)
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe(newToken)
    expect(state.user).toEqual(MOCK_USER)
  })

  // ── setUser ──────────────────────────────────────────────────────

  it('setUser：只更新 user，不影响 token', () => {
    useAuthStore.setState({ accessToken: MOCK_TOKEN })
    const updatedUser = { ...MOCK_USER, username: 'updated' }
    useAuthStore.getState().setUser(updatedUser)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(updatedUser)
    expect(state.accessToken).toBe(MOCK_TOKEN)
  })

  // ── 角色选择器 ───────────────────────────────────────────────────

  it('selectIsAdmin：admin 用户返回 true', () => {
    useAuthStore.getState().login(MOCK_ADMIN, MOCK_TOKEN)
    expect(selectIsAdmin(useAuthStore.getState())).toBe(true)
  })

  it('selectIsAdmin：普通用户返回 false', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    expect(selectIsAdmin(useAuthStore.getState())).toBe(false)
  })

  it('selectIsModerator：admin 用户返回 true（admin 兼具 moderator 权限）', () => {
    useAuthStore.getState().login(MOCK_ADMIN, MOCK_TOKEN)
    expect(selectIsModerator(useAuthStore.getState())).toBe(true)
  })

  it('selectIsModerator：moderator 用户返回 true', () => {
    useAuthStore.getState().login(MOCK_MOD, MOCK_TOKEN)
    expect(selectIsModerator(useAuthStore.getState())).toBe(true)
  })

  it('selectIsModerator：普通用户返回 false', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    expect(selectIsModerator(useAuthStore.getState())).toBe(false)
  })

  // ── 未登录时的选择器 ─────────────────────────────────────────────

  it('未登录时 selectIsAdmin 返回 false（不崩溃）', () => {
    expect(selectIsAdmin(useAuthStore.getState())).toBe(false)
  })

  it('未登录时 selectIsModerator 返回 false（不崩溃）', () => {
    expect(selectIsModerator(useAuthStore.getState())).toBe(false)
  })
})
