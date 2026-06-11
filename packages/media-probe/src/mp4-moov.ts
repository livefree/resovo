export type Mp4ParseResult = {
  width: number | null
  height: number | null
  durationSeconds: number | null
  codec: string | null
  /**
   * 首 box type 为已知 ISO BMFF 4CC（ftyp/moov/...）——HTML 错误页等非容器内容为
   * false。注意 moov 不在读取窗口（非 faststart 文件尾部 moov）时 width/height
   * 仍为 null，但 isValidMp4 为 true（已知限制，不可据 null 判 dead）。
   */
  isValidMp4: boolean
}

// ISO BMFF 顶层常见 box（首 box 校验集合；ftyp 规范上应为首个，放宽兼容直出流）
const KNOWN_TOP_BOXES = new Set(['ftyp', 'styp', 'moov', 'moof', 'mdat', 'free', 'skip', 'wide', 'pdin', 'sidx'])

const FOUR_CC = (buf: Buffer, offset: number): string =>
  String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3])

const readUint32BE = (buf: Buffer, offset: number): number =>
  ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0

const readUint16BE = (buf: Buffer, offset: number): number =>
  ((buf[offset] << 8) | buf[offset + 1]) >>> 0

export function parseMp4Moov(bytes: Buffer): Mp4ParseResult {
  const result: Mp4ParseResult = {
    width: null,
    height: null,
    durationSeconds: null,
    codec: null,
    isValidMp4: isKnownTopBox(bytes),
  }
  walkBoxes(bytes, 0, bytes.length, result)
  return result
}

function isKnownTopBox(buf: Buffer): boolean {
  if (buf.length < 8) return false
  const size = readUint32BE(buf, 0)
  // size=1 为 64 位扩展 size box（largesize 随后），同样按 type 校验
  if (size !== 1 && size < 8) return false
  return KNOWN_TOP_BOXES.has(FOUR_CC(buf, 4))
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
