/**
 * authStore.ts — server-next 认证状态（ADR-003 / 沿用 apps/server 模式）
 *
 * 重要约束（ADR-003）：
 *   - accessToken 只存内存（此 store），不存 localStorage
 *   - refreshToken 通过 HttpOnly Cookie 传递，JS 不可读
 *   - localStorage 只存 user 和 isLoggedIn 用于刷新后 UI 快速恢复
 *
 * 与 apps/server/src/stores/authStore.ts 简化对齐：
 *   - 不实装 tryRestoreSession（401-driven refresh + retry 已在 api-client 层覆盖
 *     首次刷新场景；M-SN-3 业务卡按需启用）
 *   - 选择器 selectIsAdmin / selectIsModerator 与 apps/server 同形态
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@resovo/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoggedIn: boolean
}

interface AuthActions {
  setAccessToken: (token: string | null) => void
  setUser: (user: User) => void
  login: (user: User, accessToken: string) => void
  logout: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoggedIn: false,
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      login: (user, accessToken) => set({ user, accessToken, isLoggedIn: true }),
      logout: () => set(initialState),
    }),
    {
      name: 'resovo-server-next-auth',
      // 只持久化 user 和 isLoggedIn；accessToken 始终只存内存（ADR-003）
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
)

export const selectUser        = (s: AuthStore) => s.user
export const selectAccessToken = (s: AuthStore) => s.accessToken
export const selectIsLoggedIn  = (s: AuthStore) => s.isLoggedIn
export const selectIsAdmin     = (s: AuthStore) => s.user?.role === 'admin'
export const selectIsModerator = (s: AuthStore) =>
  s.user?.role === 'admin' || s.user?.role === 'moderator'
