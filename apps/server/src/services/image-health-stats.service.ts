import { apiClient } from '@/lib/api-client'

export interface BrokenTrendPoint {
  date: string
  count: number
}

export interface ImageHealthStats {
  totalVideos: number
  posterOkCount: number
  posterCoverage: number
  backdropOkCount: number
  backdropCoverage: number
  brokenLast7Days: number
  brokenTrend: BrokenTrendPoint[]
}

export interface BrokenDomainRow {
  domain: string
  eventCount: number
  affectedVideos: number
}

export interface MissingVideoRow {
  videoId: string
  title: string
  posterStatus: string
}

export type MissingVideoSortField = 'created_at' | 'title' | 'poster_status'
export type SortDir = 'asc' | 'desc'

export interface MissingVideosResult {
  data: MissingVideoRow[]
  total: number
}

export const imageHealthService = {
  async getStats(): Promise<ImageHealthStats> {
    const res = await apiClient.get<{ data: ImageHealthStats }>('/admin/image-health/stats')
    return res.data
  },

  async getBrokenDomains(limit = 20): Promise<BrokenDomainRow[]> {
    const res = await apiClient.get<{ data: BrokenDomainRow[] }>(
      `/admin/image-health/broken-domains?limit=${limit}`
    )
    return res.data
  },

  async getMissingVideos(
    page = 1,
    limit = 20,
    sortField: MissingVideoSortField = 'created_at',
    sortDir: SortDir = 'desc'
  ): Promise<MissingVideosResult> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortField,
      sortDir,
    })
    const res = await apiClient.get<{ data: MissingVideoRow[]; total: number }>(
      `/admin/image-health/missing-videos?${params.toString()}`
    )
    return { data: res.data, total: res.total }
  },
}
