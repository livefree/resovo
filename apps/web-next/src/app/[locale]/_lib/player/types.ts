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
}
