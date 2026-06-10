/**
 * evaluate.test.ts — @resovo/media-probe 判定层（SRCHEALTH-P1-3）
 *
 * heightToQuality 11 用例自 tests/unit/worker/jobs/source-health/level2-render.test.ts
 * 迁入（函数随判定层进包，原文件删除）；evaluate* 三函数为新增覆盖——
 * 判定逻辑是 worker level2 与 api 手动试播的共同真源，三态语义在此锁定。
 */

import { describe, it, expect } from 'vitest'
import {
  evaluateHls,
  evaluateMp4,
  evaluateMpd,
  heightToQuality,
  parseM3u8,
  parseMpd,
} from '@resovo/media-probe'

describe('heightToQuality', () => {
  it('maps 2160 to 4K', () => expect(heightToQuality(2160)).toBe('4K'))
  it('maps 2161 to 4K', () => expect(heightToQuality(2161)).toBe('4K'))
  it('maps 1440 to 2K', () => expect(heightToQuality(1440)).toBe('2K'))
  it('maps 1441 to 2K', () => expect(heightToQuality(1441)).toBe('2K'))
  it('maps 1080 to 1080P', () => expect(heightToQuality(1080)).toBe('1080P'))
  it('maps 720 to 720P', () => expect(heightToQuality(720)).toBe('720P'))
  it('maps 480 to 480P', () => expect(heightToQuality(480)).toBe('480P'))
  it('maps 360 to 360P', () => expect(heightToQuality(360)).toBe('360P'))
  it('maps 240 to 240P', () => expect(heightToQuality(240)).toBe('240P'))
  it('maps 1 to 240P', () => expect(heightToQuality(1)).toBe('240P'))
  it('maps 1079 to 720P', () => expect(heightToQuality(1079)).toBe('720P'))
})

describe('evaluateHls', () => {
  it('master 含 variants → ok + 最高分辨率质量 + 首 variant 宽度', () => {
    const parsed = parseM3u8(
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\nhigh.m3u8\n',
    )
    expect(evaluateHls(parsed)).toEqual({
      status: 'ok',
      width: 640,
      height: 1080,
      quality: '1080P',
      errorDetail: null,
    })
  })

  it('master 无 variants → partial（playability 判定核心分支）', () => {
    expect(evaluateHls({ variants: [], maxResolutionHeight: null, isMaster: true })).toEqual({
      status: 'partial',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'no variants in master',
    })
  })

  it('media playlist（非 master）→ ok，无分辨率信息', () => {
    const parsed = parseM3u8('#EXTM3U\n#EXTINF:10,\nseg-0.ts\n#EXT-X-ENDLIST\n')
    expect(evaluateHls(parsed)).toEqual({
      status: 'ok',
      width: null,
      height: null,
      quality: null,
      errorDetail: null,
    })
  })
})

describe('evaluateMp4', () => {
  it('解析出尺寸 → ok + 质量推导', () => {
    expect(
      evaluateMp4({ width: 1280, height: 720, durationSeconds: 600, codec: 'avc1' }),
    ).toEqual({ status: 'ok', width: 1280, height: 720, quality: '720P', errorDetail: null })
  })

  it('moov 解析不出尺寸 → ok 但质量字段全 null（与 worker 既有行为一致）', () => {
    expect(
      evaluateMp4({ width: null, height: null, durationSeconds: null, codec: null }),
    ).toEqual({ status: 'ok', width: null, height: null, quality: null, errorDetail: null })
  })
})

describe('evaluateMpd', () => {
  it('representations 含分辨率 → ok + 最高分辨率质量（无宽度，MPD 仅 height）', () => {
    const parsed = parseMpd(
      '<?xml version="1.0"?><MPD><Representation height="2160" bandwidth="9000000"/><Representation height="1080" bandwidth="3000000"/></MPD>',
    )
    expect(evaluateMpd(parsed)).toEqual({
      status: 'ok',
      width: null,
      height: 2160,
      quality: '4K',
      errorDetail: null,
    })
  })

  it('无分辨率信息 → ok 全 null', () => {
    expect(evaluateMpd({ representations: [], maxResolutionHeight: null })).toEqual({
      status: 'ok',
      width: null,
      height: null,
      quality: null,
      errorDetail: null,
    })
  })
})
