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

// 无效内容（HTML 错误页 / 垃圾字节）一律 dead——HTTP 200 不代表 manifest 有效
// （Codex stop-time review 拦截：invalid manifest bodies are marked ok；亦防 api
// 试播从旧 Content-Type 检查倒退）
const invalidVerdict = (errorDetail: string): MediaProbeVerdict => ({
  status: 'dead',
  width: null,
  height: null,
  quality: null,
  errorDetail,
})

export function evaluateHls(parsed: M3u8ParseResult): MediaProbeVerdict {
  if (!parsed.isValidM3u8) {
    return invalidVerdict('not a valid m3u8 manifest')
  }
  if (parsed.isMaster && parsed.variants.length === 0) {
    return { status: 'partial', width: null, height: null, quality: null, errorDetail: 'no variants in master' }
  }
  if (!parsed.isMaster && !parsed.hasSegments) {
    return invalidVerdict('no media segments in playlist')
  }
  const height = parsed.maxResolutionHeight
  const quality = height !== null ? heightToQuality(height) : null
  const width = parsed.variants[0]?.resolution ? parseWidth(parsed.variants[0].resolution) : null
  return { status: 'ok', width, height, quality, errorDetail: null }
}

export function evaluateMp4(parsed: Mp4ParseResult): MediaProbeVerdict {
  if (!parsed.isValidMp4) {
    return invalidVerdict('not a valid mp4 container')
  }
  // isValidMp4 但尺寸 null = moov 不在读取窗口（非 faststart）——保持 ok，不误杀
  const quality = parsed.height !== null ? heightToQuality(parsed.height) : null
  return { status: 'ok', width: parsed.width, height: parsed.height, quality, errorDetail: null }
}

export function evaluateMpd(parsed: MpdParseResult): MediaProbeVerdict {
  if (!parsed.isValidMpd) {
    return invalidVerdict('not a valid mpd manifest')
  }
  if (parsed.representations.length === 0) {
    // 结构有效但无可播流——与 HLS master 无 variants 同语义
    return { status: 'partial', width: null, height: null, quality: null, errorDetail: 'no representations in mpd' }
  }
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
