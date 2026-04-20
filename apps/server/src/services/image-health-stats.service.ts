import { apiClient } from '@/lib/api-client'

export interface ImageHealthStats {
  totalVideos: number
  posterOkCount: number
  posterCoverage: number
  backdropOkCount: number
  backdropCoverage: number
  brokenLast7Days: number
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

  async getMissingVideos(page = 1, limit = 20): Promise<MissingVideosResult> {
    const res = await apiClient.get<{ data: MissingVideoRow[]; total: number }>(
      `/admin/image-health/missing-videos?page=${page}&limit=${limit}`
    )
    return { data: res.data, total: res.total }
  },
}
