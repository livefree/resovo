/**
 * tests/unit/stores/authStore.test.ts
 * AUTH-03 + CHG-37: authStore 状态机测试 + tryRestoreSession 三场景
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    vi.restoreAllMocks()
    // 每次测试前重置 store 到初始状态
    useAuthStore.setState({ user: null, accessToken: null, isLoggedIn: false, isRestoring: false })
  })

  // ── 初始状态 ─────────────────────────────────────────────────────

  it('初始状态：user 为 null，accessToken 为 null，isLoggedIn 为 false', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isLoggedIn).toBe(false)
  })

  // ── login ────────────────────────────────────────────────────────

  it('login：同时更新 user、accessToken 和 isLoggedIn', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(MOCK_USER)
    expect(state.accessToken).toBe(MOCK_TOKEN)
    expect(state.isLoggedIn).toBe(true)
  })

  it('login 后 selectIsLoggedIn 返回 true', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    expect(selectIsLoggedIn(useAuthStore.getState())).toBe(true)
  })

  // ── logout ───────────────────────────────────────────────────────

  it('logout：清除 user、accessToken 和 isLoggedIn', () => {
    useAuthStore.getState().login(MOCK_USER, MOCK_TOKEN)
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isLoggedIn).toBe(false)
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

  // ── tryRestoreSession ────────────────────────────────────────────

  describe('tryRestoreSession', () => {
    it('场景1：无 accessToken 时会尝试 refresh（不依赖 isLoggedIn）', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)
      useAuthStore.setState({ user: null, isLoggedIn: false, accessToken: null })
      await useAuthStore.getState().tryRestoreSession()
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('场景2：已有 accessToken，不重复刷新', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch')
      useAuthStore.setState({ user: MOCK_USER, isLoggedIn: true, accessToken: MOCK_TOKEN })
      await useAuthStore.getState().tryRestoreSession()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('场景3：refresh 成功 + /users/me 成功 → 写入 accessToken 和 user', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { accessToken: 'new-token-123' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: MOCK_USER }),
        } as Response)
      useAuthStore.setState({ user: null, isLoggedIn: false, accessToken: null })
      await useAuthStore.getState().tryRestoreSession()
      expect(useAuthStore.getState().accessToken).toBe('new-token-123')
      expect(useAuthStore.getState().isLoggedIn).toBe(true)
      expect(useAuthStore.getState().user?.id).toBe(MOCK_USER.id)
      expect(useAuthStore.getState().isRestoring).toBe(false)
    })

    it('场景4：refresh 失败（HTTP 401）→ 清除登录状态', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)
      useAuthStore.setState({ user: MOCK_USER, isLoggedIn: true, accessToken: null })
      await useAuthStore.getState().tryRestoreSession()
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isLoggedIn).toBe(false)
      expect(state.accessToken).toBeNull()
      expect(state.isRestoring).toBe(false)
    })

    it('场景5：fetch 网络异常 → 清除登录状态', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))
      useAuthStore.setState({ user: MOCK_USER, isLoggedIn: true, accessToken: null })
      await useAuthStore.getState().tryRestoreSession()
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isLoggedIn).toBe(false)
      expect(state.isRestoring).toBe(false)
    })
  })
})
