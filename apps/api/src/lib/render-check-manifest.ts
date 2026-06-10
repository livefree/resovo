/**
 * render-check-manifest.ts — 手动「试播」manifest 真解析 IO 编排（SRCHEALTH-P1-3）
 *
 * SourceProbeService 的试播探测路径（D1/D2 消除）：GET + @resovo/media-probe 解析
 * 判定（与 worker level2 同源），替代旧 HEAD + Content-Type（仅 reachability 强化版，
 * 非 playability / 原 I3 已知限制）。三态结果 ok/partial/dead。
 * 抽出为 lib（SourceProbeService 超 500 行红线拆分）：纯探测 IO，不碰 DB。
 *
 * - 超时 8s = api 独立预算（arch-reviewer claude-opus-4-8 裁决 D-2：不复用 worker
 *   30s——inline 端点批量 5 并发分批下慢 CDN 拖垮 admin 响应；HEAD 3s 对 GET 偏紧）。
 * - HTTP 级失败（非 2xx / 超时 / 网络异常）→ dead verdict（IO 层职责，A2 边界）。
 */

import {
  parseM3u8,
  parseMp4Moov,
  parseMpd,
  evaluateHls,
  evaluateMp4,
  evaluateMpd,
  type MediaProbeVerdict,
} from '@resovo/media-probe'
import type { VideoSourceLine } from '@resovo/types'

// SRCHEALTH-P1-3（D-2 裁决）：试播 manifest GET 的 api 独立超时
const RENDER_CHECK_TIMEOUT_MS = 8000

// mp4 moov 解析的 Range 字节数（对齐 worker config.probe.mp4RangeBytes）
const MP4_RANGE_BYTES = 65535

// manifest 文本（m3u8/mpd）读取上限——正常 manifest 为 KB 级，2MB 防 URL 指向大文件
const MANIFEST_MAX_BYTES = 2 * 1024 * 1024

export async function renderCheckManifest(
  source: VideoSourceLine,
): Promise<{ verdict: MediaProbeVerdict; httpCode: number | null }> {
  const deadVerdict = (errorDetail: string): MediaProbeVerdict => ({
    status: 'dead',
    width: null,
    height: null,
    quality: null,
    errorDetail,
  })
  try {
    const isMp4 = source.type === 'mp4'
    const res = await fetch(source.sourceUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(RENDER_CHECK_TIMEOUT_MS),
      ...(isMp4 ? { headers: { Range: `bytes=0-${MP4_RANGE_BYTES - 1}` } } : {}),
    })
    // mp4 Range 请求成功返回 206（res.ok 已含 206；显式留判与 worker checkMp4 对齐）
    const httpStatusOk = res.ok || (isMp4 && res.status === 206)
    if (!httpStatusOk) {
      return { verdict: deadVerdict(`HTTP ${res.status}`), httpCode: res.status }
    }
    // Codex stop-time review 拦截：不得用 res.text()/arrayBuffer() 全量读——
    // 服务器忽略 Range 返回 200 全量（或 URL 指向大文件）时会把整个视频缓冲进
    // 内存，inline 端点 5 并发下 OOM。一律限量流式读取后解析。
    switch (source.type) {
      case 'hls': {
        const text = (await readBodyLimited(res, MANIFEST_MAX_BYTES)).toString('utf8')
        return { verdict: evaluateHls(parseM3u8(text)), httpCode: res.status }
      }
      case 'mp4': {
        const buf = await readBodyLimited(res, MP4_RANGE_BYTES)
        return { verdict: evaluateMp4(parseMp4Moov(buf)), httpCode: res.status }
      }
      case 'dash': {
        const xml = (await readBodyLimited(res, MANIFEST_MAX_BYTES)).toString('utf8')
        return { verdict: evaluateMpd(parseMpd(xml)), httpCode: res.status }
      }
      default:
        return { verdict: deadVerdict('unknown source type'), httpCode: res.status }
    }
  } catch {
    // timeout / 网络错误 / CDN 防盗链 → dead（Y3 已知限制同 probe 路径）
    return { verdict: deadVerdict('fetch failed or timeout'), httpCode: null }
  }
}

// 响应体限量流式读取——与 apps/worker/src/jobs/source-health/level2-render.ts
// readBodyLimited 双副本同步（IO 编排层，A2 裁决不进 @resovo/media-probe；改动须
// 双向同步，ADR-107 §4 双副本范式）。读满 maxBytes 即 cancel 流，杜绝 200 全量
// 响应缓冲进内存。
async function readBodyLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const body = res.body
  if (body === null) return Buffer.alloc(0)
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
      total += value.byteLength
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks).subarray(0, maxBytes)
}
