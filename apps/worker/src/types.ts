import type { QualityDetected } from '@resovo/media-probe'

export type ProbeStatus = 'pending' | 'ok' | 'partial' | 'dead'
// SRCHEALTH-P1-3：真源迁 @resovo/media-probe（与判定层 heightToQuality 同源），re-export 消副本
export type { QualityDetected }
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
