/**
 * @resovo/media-probe — 视频源 manifest 解析 + playability 判定共享包。
 *
 * SRCHEALTH-P1-3（导出面 = arch-reviewer claude-opus-4-8 裁决 A2）：
 * - 解析层：纯函数，输入 string / Buffer（m3u8 / mp4 moov / mpd）。
 * - 判定层：纯函数，输入已解析结构，输出统一 MediaProbeVerdict（ok/partial/dead）。
 * - IO（fetch / timeout / Range / UA / 并发）不进包，由 worker 与 api 各自编排。
 * 消费方：apps/worker source-health（level1 解析 / level2 解析+判定）、
 *         apps/api SourceProbeService（手动试播 manifest 真解析）。
 */

// 解析层
export { parseM3u8 } from './m3u8'
export type { M3u8ParseResult, M3u8Variant } from './m3u8'

export { parseMp4Moov } from './mp4-moov'
export type { Mp4ParseResult } from './mp4-moov'

export { parseMpd } from './mpd'
export type { MpdParseResult, MpdRepresentation } from './mpd'

// 判定层
export { evaluateHls, evaluateMp4, evaluateMpd, heightToQuality } from './evaluate'

// 类型契约
export type { MediaProbeStatus, QualityDetected, MediaProbeVerdict } from './types'
