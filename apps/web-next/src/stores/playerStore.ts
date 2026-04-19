import { create } from 'zustand'

export type PlayerMode = 'default' | 'theater'

interface PlayerState {
  shortId: string | null
  currentEpisode: number
  isPlaying: boolean
  currentTime: number
  duration: number
  mode: PlayerMode

  initPlayer: (shortId: string, episode: number) => void
  setEpisode: (episode: number) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMode: (mode: PlayerMode) => void
  toggleMode: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  shortId: null,
  currentEpisode: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  mode: 'default',

  initPlayer: (shortId, episode) =>
    set({ shortId, currentEpisode: episode, isPlaying: false, currentTime: 0, duration: 0 }),

  setEpisode: (episode) => set({ currentEpisode: episode, currentTime: 0 }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === 'default' ? 'theater' : 'default' })),
}))
