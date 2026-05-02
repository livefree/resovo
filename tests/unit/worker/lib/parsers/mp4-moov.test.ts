import { describe, it, expect } from 'vitest'
import { parseMp4Moov } from '../../../../../apps/worker/src/lib/parsers/mp4-moov'

function buildMoovBox(width: number, height: number): Buffer {
  const stsdPayload = buildStsdBox(width, height)
  const stblPayload = wrapBox('stbl', stsdPayload)
  const minfPayload = wrapBox('minf', stblPayload)
  const mdiaPayload = wrapBox('mdia', minfPayload)
  const tkhdBox = buildTkhdBox(width, height)
  const trakPayload = Buffer.concat([tkhdBox, wrapBox('trak-inner', Buffer.alloc(0))])
  const trakBox = wrapBox('trak', Buffer.concat([tkhdBox, mdiaPayload]))
  const moovBox = wrapBox('moov', trakBox)
  return moovBox
}

function wrapBox(type: string, payload: Buffer): Buffer {
  const size = 8 + payload.length
  const buf = Buffer.alloc(size)
  buf.writeUInt32BE(size, 0)
  buf.write(type.padEnd(4, '\0').slice(0, 4), 4, 'ascii')
  payload.copy(buf, 8)
  return buf
}

function buildTkhdBox(width: number, height: number): Buffer {
  const payload = Buffer.alloc(80)
  payload[0] = 0
  const dimOffset = 76 - 8
  payload.writeUInt32BE(width << 16, dimOffset)
  payload.writeUInt32BE(height << 16, dimOffset + 4)
  return wrapBox('tkhd', payload)
}

function buildStsdBox(width: number, height: number): Buffer {
  const entryPayload = Buffer.alloc(70)
  entryPayload.write('avc1', 4, 'ascii')
  const vidOffset = 6 + 2 + 2 + 4
  entryPayload.writeUInt16BE(width, vidOffset)
  entryPayload.writeUInt16BE(height, vidOffset + 2)
  const entry = wrapBox('avc1', entryPayload)
  const stsdPayload = Buffer.alloc(8)
  stsdPayload.writeUInt32BE(1, 4)
  return wrapBox('stsd', Buffer.concat([stsdPayload, entry]))
}

describe('parseMp4Moov', () => {
  it('returns nulls on empty buffer', () => {
    const result = parseMp4Moov(Buffer.alloc(0))
    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
  })

  it('returns nulls on non-mp4 buffer', () => {
    const result = parseMp4Moov(Buffer.from('not an mp4 file'))
    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
  })

  it('extracts dimensions from tkhd box', () => {
    const buf = buildMoovBox(1920, 1080)
    const result = parseMp4Moov(buf)
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
  })
})
