export type Mp4ParseResult = {
  width: number | null
  height: number | null
  durationSeconds: number | null
  codec: string | null
}

const FOUR_CC = (buf: Buffer, offset: number): string =>
  String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3])

const readUint32BE = (buf: Buffer, offset: number): number =>
  ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0

const readUint16BE = (buf: Buffer, offset: number): number =>
  ((buf[offset] << 8) | buf[offset + 1]) >>> 0

export function parseMp4Moov(bytes: Buffer): Mp4ParseResult {
  const result: Mp4ParseResult = { width: null, height: null, durationSeconds: null, codec: null }
  walkBoxes(bytes, 0, bytes.length, result)
  return result
}

function walkBoxes(buf: Buffer, start: number, end: number, result: Mp4ParseResult): void {
  let offset = start
  while (offset + 8 <= end) {
    const size = readUint32BE(buf, offset)
    if (size < 8 || offset + size > end) break
    const type = FOUR_CC(buf, offset + 4)

    if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') {
      walkBoxes(buf, offset + 8, offset + size, result)
    } else if (type === 'mvhd') {
      parseMvhd(buf, offset + 8, result)
    } else if (type === 'tkhd') {
      parseTkhd(buf, offset + 8, result)
    } else if (type === 'stsd') {
      parseStsd(buf, offset + 8, offset + size, result)
    }

    offset += size
  }
}

function parseMvhd(buf: Buffer, offset: number, result: Mp4ParseResult): void {
  if (offset + 4 > buf.length) return
  const version = buf[offset]
  let timescale: number
  let duration: number
  if (version === 1) {
    if (offset + 28 > buf.length) return
    timescale = readUint32BE(buf, offset + 20)
    duration = readUint32BE(buf, offset + 24)
  } else {
    if (offset + 16 > buf.length) return
    timescale = readUint32BE(buf, offset + 12)
    duration = readUint32BE(buf, offset + 16)
  }
  if (timescale > 0 && result.durationSeconds === null) {
    result.durationSeconds = Math.round(duration / timescale)
  }
}

function parseTkhd(buf: Buffer, offset: number, result: Mp4ParseResult): void {
  if (result.width !== null) return
  const version = buf[offset]
  const dimOffset = version === 1 ? offset + 84 : offset + 76
  if (dimOffset + 8 > buf.length) return
  const w = readUint32BE(buf, dimOffset) >> 16
  const h = readUint32BE(buf, dimOffset + 4) >> 16
  if (w > 0 && h > 0) {
    result.width = w
    result.height = h
  }
}

function parseStsd(buf: Buffer, start: number, end: number, result: Mp4ParseResult): void {
  if (start + 8 > end) return
  const entryCount = readUint32BE(buf, start + 4)
  if (entryCount === 0) return
  const entryStart = start + 8
  if (entryStart + 8 > end) return
  const codec = FOUR_CC(buf, entryStart + 4)
  if (result.codec === null) {
    result.codec = codec
  }
  const videoCodecs = new Set(['avc1', 'avc2', 'hev1', 'hvc1', 'vp09', 'av01'])
  if (!videoCodecs.has(codec)) return
  const vidOffset = entryStart + 8 + 6 + 2 + 2 + 4
  if (vidOffset + 4 > end) return
  const w = readUint16BE(buf, vidOffset)
  const h = readUint16BE(buf, vidOffset + 2)
  if (w > 0 && h > 0 && result.width === null) {
    result.width = w
    result.height = h
  }
}
