/**
 * evaluate.ts — manifest 解析结果 → playability 判定（纯函数，对 IO 无知）。
 *
 * SRCHEALTH-P1-3：从 apps/worker level2-render 抽出，判定逻辑唯一真源，
 * worker level2 cron 与 api 手动「试播」共同消费。HTTP 级错误（非 2xx / 超时 /
 * 网络异常）由两端 IO 编排层自行构造 dead verdict，不进本层（A2 边界裁决）。
 */

import type { M3u8ParseResult } from './m3u8'
import type { Mp4ParseResult } from './mp4-moov'
import type { MpdParseResult } from './mpd'
import type { MediaProbeVerdict, QualityDetected } from './types'

export function evaluateHls(parsed: M3u8ParseResult): MediaProbeVerdict {
  if (parsed.isMaster && parsed.variants.length === 0) {
    return { status: 'partial', width: null, height: null, quality: null, errorDetail: 'no variants in master' }
  }
  const height = parsed.maxResolutionHeight
  const quality = height !== null ? heightToQuality(height) : null
  const width = parsed.variants[0]?.resolution ? parseWidth(parsed.variants[0].resolution) : null
  return { status: 'ok', width, height, quality, errorDetail: null }
}

export function evaluateMp4(parsed: Mp4ParseResult): MediaProbeVerdict {
  const quality = parsed.height !== null ? heightToQuality(parsed.height) : null
  return { status: 'ok', width: parsed.width, height: parsed.height, quality, errorDetail: null }
}

export function evaluateMpd(parsed: MpdParseResult): MediaProbeVerdict {
  const height = parsed.maxResolutionHeight
  const quality = height !== null ? heightToQuality(height) : null
  return { status: 'ok', width: null, height, quality, errorDetail: null }
}

export function heightToQuality(height: number): QualityDetected {
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return '1080P'
  if (height >= 720) return '720P'
  if (height >= 480) return '480P'
  if (height >= 360) return '360P'
  return '240P'
}

function parseWidth(resolution: string): number | null {
  const m = resolution.match(/^(\d+)x/)
  return m ? parseInt(m[1], 10) : null
}
