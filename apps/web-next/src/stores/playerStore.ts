import { create } from 'zustand'
import type { HostPlayerMode, PlayerHostOrigin, PersistedPlayerHostV1 } from '@/app/[locale]/_lib/player/types'

export type { HostPlayerMode, PlayerHostOrigin } from '@/app/[locale]/_lib/player/types'

// PlayerMode 保留在本文件以维持原有导入路径
export type PlayerMode = 'default' | 'theater'

const STORAGE_KEY = 'resovo:player-host:v1'

const LEGAL_TRANSITIONS: Record<HostPlayerMode, HostPlayerMode[]> = {
  closed: ['full'],
  full:   ['closed', 'mini', 'pip'],
  mini:   ['closed', 'full', 'pip'],
  pip:    ['closed', 'full', 'mini'],
}

interface PlayerState {
  // === 既有字段 ===
  shortId: string | null
  currentEpisode: number
  isPlaying: boolean
  currentTime: number
  duration: number
  mode: PlayerMode

  // === M3-01 新增 ===
  hostMode: HostPlayerMode
  hostOrigin: PlayerHostOrigin | null
  isHydrated: boolean

  // === 既有 actions ===
  initPlayer: (shortId: string, episode: number) => void
  setEpisode: (episode: number) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMode: (mode: PlayerMode) => void
  toggleMode: () => void

  // === M3-01 新增 actions ===
  setHostMode: (next: HostPlayerMode, origin?: PlayerHostOrigin) => void
  closeHost: () => void
  hydrateFromSession: () => void

  // === M5-CARD-CTA-01 新增 ===
  transition: 'fast-takeover' | 'standard-takeover' | null
  enter: (params: { shortId: string; slug: string | null; episode?: number; transition: 'fast-takeover' | 'standard-takeover' }) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  shortId: null,
  currentEpisode: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  mode: 'default',
  hostMode: 'closed',
  hostOrigin: null,
  isHydrated: false,
  transition: null,

  initPlayer: (shortId, episode) =>
    set({ shortId, currentEpisode: episode, isPlaying: false, currentTime: 0, duration: 0 }),

  setEpisode: (episode) => set({ currentEpisode: episode, currentTime: 0 }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'default' ? 'theater' : 'default' })),

  setHostMode: (next, origin) => {
    const cur = get().hostMode
    if (cur === next) return
    if (!LEGAL_TRANSITIONS[cur].includes(next)) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
      console.warn(`[playerStore] illegal hostMode transition: ${cur} -> ${next}`)
      }
      return
    }
    set((s) => ({
      hostMode: next,
      hostOrigin:
        next === 'full' && origin
          ? origin
          : next === 'closed'
            ? null
            : s.hostOrigin,
      mode: next !== 'full' ? 'default' : s.mode,
    }))
    persistToSession(get())
  },

  closeHost: () => {
    get().setHostMode('closed')
  },

  enter: ({ shortId, slug, episode = 1, transition }) => {
    const urlSlug = slug ? `${slug}-${shortId}` : shortId
    set({
      shortId,
      currentEpisode: episode,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      transition,
    })
    get().setHostMode('full', { href: `/watch/${urlSlug}`, slug: urlSlug })
  },

  hydrateFromSession: () => {
    if (get().isHydrated) return
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedPlayerHostV1
        if (parsed.v === 1 && (parsed.hostMode === 'mini' || parsed.hostMode === 'pip')) {
          set({
            hostMode: parsed.hostMode,
            shortId: parsed.shortId,
            currentEpisode: parsed.currentEpisode,
            hostOrigin: parsed.hostOrigin,
            isPlaying: false,
            currentTime: 0,
          })
        }
      }
    } catch {
      // sessionStorage unavailable or parse error — silently ignore
    }
    set({ isHydrated: true })
  },
}))

function persistToSession(state: PlayerState) {
  try {
    if (state.hostMode === 'closed') {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const payload: PersistedPlayerHostV1 = {
      v: 1,
      hostMode: state.hostMode as Exclude<HostPlayerMode, 'closed'>,
      shortId: state.shortId,
      currentEpisode: state.currentEpisode,
      hostOrigin: state.hostOrigin,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}
