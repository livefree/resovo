/**
 * TEMPLATE: Zustand Store
 * 使用方法：复制此文件到 src/stores/[name]Store.ts
 * 替换 [Name] 和 [name]，填充 TODO 部分
 */

import { create } from 'zustand'
// TODO: 按需添加持久化（如主题偏好）
// import { persist } from 'zustand/middleware'

// ── 类型定义 ─────────────────────────────────────────────────────

interface [Name]State {
  // TODO: 替换为实际状态字段
  isLoading: boolean
  error: string | null
  // data: SomeType | null
}

interface [Name]Actions {
  // TODO: 替换为实际 action
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

type [Name]Store = [Name]State & [Name]Actions

// ── 初始状态 ─────────────────────────────────────────────────────

const initialState: [Name]State = {
  isLoading: false,
  error: null,
  // data: null,
}

// ── Store 定义 ───────────────────────────────────────────────────

export const use[Name]Store = create<[Name]Store>()((set) => ({
  ...initialState,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),

  // TODO: 添加实际 actions
  // fetchData: async (id: string) => {
  //   set({ isLoading: true, error: null })
  //   try {
  //     const data = await apiClient.get(`/resource/${id}`)
  //     set({ data, isLoading: false })
  //   } catch (err) {
  //     set({ error: String(err), isLoading: false })
  //   }
  // },
}))

// ── 选择器（避免不必要的重渲染）─────────────────────────────────
// 使用方法：const isLoading = use[Name]Store(select[Name]Loading)

export const select[Name]Loading = (s: [Name]Store) => s.isLoading
export const select[Name]Error   = (s: [Name]Store) => s.error
