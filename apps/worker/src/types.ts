export type ProbeStatus = 'pending' | 'ok' | 'partial' | 'dead'
export type QualityDetected = '4K' | '2K' | '1080P' | '720P' | '480P' | '360P' | '240P'
export type SourceType = 'hls' | 'mp4' | 'dash'

export type VideoSource = {
  id: string
  video_id: string
  source_url: string
  type: SourceType
  is_active: boolean
  probe_status: ProbeStatus
  render_status: ProbeStatus
  quality_detected: QualityDetected | null
  last_probed_at: Date | null
  last_rendered_at: Date | null
}

export type ProbeResult = {
  source_id: string
  video_id: string
  status: ProbeStatus
  http_code: number | null
  latency_ms: number | null
  error_detail: string | null
  resolution_width: number | null
  resolution_height: number | null
  quality_detected: QualityDetected | null
}

export type CircuitState = 'cleared' | 'active'
