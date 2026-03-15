/**
 * authStore.ts — 认证状态
 *
 * 重要约束（ADR-003）：
 * - accessToken 只存内存（此 store），不存 localStorage
 * - refreshToken 通过 HttpOnly Cookie 传递，JS 不可读
 */

import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
}

interface AuthActions {
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  login: (user: User, accessToken: string) => void
  logout: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialState,

  setAccessToken: (accessToken) => set({ accessToken }),

  setUser: (user) => set({ user }),

  login: (user, accessToken) => set({ user, accessToken }),

  logout: () => {
    // 清除内存中的 token 和用户信息
    // refreshToken 的清除由后端在 POST /auth/logout 时处理 Cookie
    set(initialState)
  },
}))

// 选择器
export const selectUser        = (s: AuthStore) => s.user
export const selectAccessToken = (s: AuthStore) => s.accessToken
export const selectIsLoggedIn  = (s: AuthStore) => s.user !== null
export const selectIsAdmin     = (s: AuthStore) => s.user?.role === 'admin'
export const selectIsModerator = (s: AuthStore) =>
  s.user?.role === 'admin' || s.user?.role === 'moderator'
