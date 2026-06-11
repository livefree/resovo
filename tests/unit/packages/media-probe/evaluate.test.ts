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
  parseMp4Moov,
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
    expect(
      evaluateHls({ variants: [], maxResolutionHeight: null, isMaster: true, isValidM3u8: true, hasSegments: false }),
    ).toEqual({
      status: 'partial',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'no variants in master',
    })
  })

  it('media playlist（非 master，含 #EXTINF）→ ok，无分辨率信息', () => {
    const parsed = parseM3u8('#EXTM3U\n#EXTINF:10,\nseg-0.ts\n#EXT-X-ENDLIST\n')
    expect(evaluateHls(parsed)).toEqual({
      status: 'ok',
      width: null,
      height: null,
      quality: null,
      errorDetail: null,
    })
  })

  // Codex stop-time review 拦截守卫：HTTP 200 + 非 manifest 内容不得判 ok
  it('HTML 错误页（无 #EXTM3U 头）→ dead', () => {
    const parsed = parseM3u8('<!DOCTYPE html>\n<html><body>404 Not Found</body></html>\n')
    expect(evaluateHls(parsed)).toEqual({
      status: 'dead',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'not a valid m3u8 manifest',
    })
  })

  it('有效头但无 #EXTINF 分片的 media playlist → dead（不可播）', () => {
    const parsed = parseM3u8('#EXTM3U\n#EXT-X-VERSION:3\n')
    expect(evaluateHls(parsed)).toEqual({
      status: 'dead',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'no media segments in playlist',
    })
  })
})

describe('evaluateMp4', () => {
  it('解析出尺寸 → ok + 质量推导', () => {
    expect(
      evaluateMp4({ width: 1280, height: 720, durationSeconds: 600, codec: 'avc1', isValidMp4: true }),
    ).toEqual({ status: 'ok', width: 1280, height: 720, quality: '720P', errorDetail: null })
  })

  it('容器有效但 moov 不在读取窗口（尺寸 null）→ ok 质量全 null（不误杀非 faststart）', () => {
    expect(
      evaluateMp4({ width: null, height: null, durationSeconds: null, codec: null, isValidMp4: true }),
    ).toEqual({ status: 'ok', width: null, height: null, quality: null, errorDetail: null })
  })

  // Codex stop-time review 拦截守卫：垃圾字节（首 box 非已知 4CC）不得判 ok
  it('非 mp4 容器内容（垃圾字节 / HTML 页）→ dead', () => {
    const parsed = parseMp4Moov(Buffer.from('<!DOCTYPE html><html>404</html>'))
    expect(parsed.isValidMp4).toBe(false)
    expect(evaluateMp4(parsed)).toEqual({
      status: 'dead',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'not a valid mp4 container',
    })
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

  it('结构有效但无 Representation → partial（与 HLS master 无 variants 同语义）', () => {
    expect(
      evaluateMpd({ representations: [], maxResolutionHeight: null, isValidMpd: true }),
    ).toEqual({
      status: 'partial',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'no representations in mpd',
    })
  })

  // Codex stop-time review 拦截守卫：非 MPD 内容不得判 ok
  it('HTML 错误页（无 <MPD 根元素）→ dead', () => {
    const parsed = parseMpd('<!DOCTYPE html><html><body>404</body></html>')
    expect(evaluateMpd(parsed)).toEqual({
      status: 'dead',
      width: null,
      height: null,
      quality: null,
      errorDetail: 'not a valid mpd manifest',
    })
  })
})
