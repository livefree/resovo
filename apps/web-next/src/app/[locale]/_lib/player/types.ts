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
  activeSourceIndex?: number
}
