/**
 * banner-image-guard.test.ts — Banner 横图校验规则纯函数
 * （CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6 / D-052-9 警告级口径）
 */

import { describe, it, expect } from 'vitest'
import {
  evaluateBannerImage,
  BANNER_IMAGE_RECOMMENDED,
  BANNER_IMAGE_MIN,
} from '../../../apps/server-next/src/lib/banners/image-guard'

describe('evaluateBannerImage — 尺寸/比例规则（方案 §6.2/§6.3）', () => {
  it('达标（1920×1080 推荐尺寸 16:9）→ 无警告', () => {
    expect(evaluateBannerImage(1920, 1080)).toEqual([])
  })

  it('低于推荐但达最低（1600×900）→ below_recommended 单项', () => {
    const warnings = evaluateBannerImage(1600, 900)
    expect(warnings.map((w) => w.code)).toEqual(['below_recommended'])
    expect(warnings[0].message).toContain('1600×900')
  })

  it('低于最低建议（1024×576）→ below_min 且不叠报 below_recommended', () => {
    const codes = evaluateBannerImage(1024, 576).map((w) => w.code)
    expect(codes).toContain('below_min')
    expect(codes).not.toContain('below_recommended')
  })

  it('比例窄于 16:9（2000×2000 方图，尺寸达标）→ 仅 ratio_out_of_range（建议裁切）', () => {
    const warnings = evaluateBannerImage(2000, 2000)
    expect(warnings.map((w) => w.code)).toEqual(['ratio_out_of_range'])
    expect(warnings[0].message).toContain('建议裁切')
  })

  it('比例宽于 21:9（3840×1080 = 3.56:1）→ ratio_out_of_range', () => {
    expect(evaluateBannerImage(3840, 1080).map((w) => w.code)).toEqual(['ratio_out_of_range'])
  })

  it('尺寸与比例双违规（800×800）→ 两项并报', () => {
    const codes = evaluateBannerImage(800, 800).map((w) => w.code)
    expect(codes).toEqual(['below_min', 'ratio_out_of_range'])
  })

  it('区间端点恰好命中：1280×720（16:9 下限）→ 仅 below_recommended；2520×1080（21:9 上限）→ 无警告', () => {
    expect(evaluateBannerImage(BANNER_IMAGE_MIN.width, BANNER_IMAGE_MIN.height).map((w) => w.code))
      .toEqual(['below_recommended'])
    expect(evaluateBannerImage(2520, 1080)).toEqual([])
    expect(evaluateBannerImage(BANNER_IMAGE_RECOMMENDED.width, BANNER_IMAGE_RECOMMENDED.height)).toEqual([])
  })

  it('非法输入（0 或负值）→ 空数组（探测异常由 probe 失败分支承担）', () => {
    expect(evaluateBannerImage(0, 0)).toEqual([])
    expect(evaluateBannerImage(-1, 1080)).toEqual([])
  })
})
