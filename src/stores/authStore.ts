/**
 * authStore.ts — 认证状态
 * CHG-37: zustand persist（只持久化 user + isLoggedIn）；tryRestoreSession
 *
 * 重要约束（ADR-003）：
 * - accessToken 只存内存（此 store），不存 localStorage
 * - refreshToken 通过 HttpOnly Cookie 传递，JS 不可读
 * - localStorage 只存 user 和 isLoggedIn，用于页面刷新后的 UI 快速恢复
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoggedIn: boolean
  isRestoring: boolean
}

interface AuthActions {
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  login: (user: User, accessToken: string) => void
  logout: () => void
  tryRestoreSession: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoggedIn: false,
  isRestoring: false,
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set({ user }),

      login: (user, accessToken) => set({ user, accessToken, isLoggedIn: true }),

      logout: () => set(initialState),

      /**
       * 刷新页面后：isLoggedIn=true（来自 localStorage）但 accessToken=null（内存丢失）
       * → 发起 POST /auth/refresh 静默恢复 accessToken
       * 成功：写入 accessToken；失败：清除登录状态
       */
      tryRestoreSession: async () => {
        const { isLoggedIn, accessToken } = get()
        if (!isLoggedIn || accessToken) return // 不需要恢复

        set({ isRestoring: true })
        try {
          const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json() as { accessToken: string; data?: { accessToken: string } }
            const token = data.accessToken ?? (data.data as { accessToken: string } | undefined)?.accessToken
            if (token) {
              set({ accessToken: token })
            } else {
              set(initialState)
            }
          } else {
            set(initialState)
          }
        } catch {
          set(initialState)
        } finally {
          set({ isRestoring: false })
        }
      },
    }),
    {
      name: 'resovo-auth',
      // 只持久化 user 和 isLoggedIn；accessToken 始终只存内存
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
)

// 选择器
export const selectUser          = (s: AuthStore) => s.user
export const selectAccessToken   = (s: AuthStore) => s.accessToken
export const selectIsLoggedIn    = (s: AuthStore) => s.isLoggedIn
export const selectIsRestoring   = (s: AuthStore) => s.isRestoring
export const selectIsAdmin       = (s: AuthStore) => s.user?.role === 'admin'
export const selectIsModerator   = (s: AuthStore) =>
  s.user?.role === 'admin' || s.user?.role === 'moderator'
