export type PlayerMode = 'default' | 'theater'
export type HostPlayerMode = 'closed' | 'full' | 'mini' | 'pip'

export interface PlayerHostOrigin {
  href: string
  slug: string
}

export interface PersistedPlayerHostV1 {
  v: 1
  hostMode: Exclude<HostPlayerMode, 'closed'>
  shortId: string | null
  currentEpisode: number
  hostOrigin: PlayerHostOrigin | null
  // v1.1 extended fields (optional for backward-compat reads)
  currentTime?: number
  isMuted?: boolean
  volume?: number
  /**
   * PLAYER-LINE-BOUND-EP：取代 activeSourceIndex（易变 index）的稳定线路 key（buildLineKey 口径）。
   * 加性可选 / 旧 v1 会话无此字段 → hydrate 取 null → 回退最优线路（无害降级，不升版本号）。
   */
  activeLineKey?: string | null
}
