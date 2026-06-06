/**
 * image-guard.ts — Banner 横图警告级校验规则（CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6）
 *
 * 校验级别口径（方案 §6 / ADR-052 AMENDMENT D-052-9）：所有横图校验
 * （尺寸 / 比例 / 探测失败）统一为**警告级**——显著提醒、不阻断发布。
 * 职责边界：仅管 home_banners.image_url；home_modules.image_url 归
 * D-052-9 预留 CHG-HOME-IMAGE-GUARD（两卡勿混）。
 */

// ── 规则常量（方案 §6.2/§6.3）────────────────────────────────────

export const BANNER_IMAGE_RECOMMENDED = { width: 1920, height: 1080 } as const
export const BANNER_IMAGE_MIN = { width: 1280, height: 720 } as const
/** 比例建议区间 16:9 ～ 21:9（含端点） */
export const BANNER_RATIO_MIN = 16 / 9
export const BANNER_RATIO_MAX = 21 / 9

// ── 警告模型 ─────────────────────────────────────────────────────

export type BannerImageWarningCode = 'below_min' | 'below_recommended' | 'ratio_out_of_range'

export interface BannerImageWarning {
  readonly code: BannerImageWarningCode
  readonly message: string
}

/**
 * 尺寸/比例规则评估（纯函数）。
 * - 低于最低建议（1280×720）→ below_min（不再叠报 below_recommended）
 * - 低于推荐（1920×1080）→ below_recommended
 * - 比例出 16:9–21:9 区间 → ratio_out_of_range（建议裁切）
 */
export function evaluateBannerImage(width: number, height: number): BannerImageWarning[] {
  const warnings: BannerImageWarning[] = []
  if (width <= 0 || height <= 0) return warnings

  if (width < BANNER_IMAGE_MIN.width || height < BANNER_IMAGE_MIN.height) {
    warnings.push({
      code: 'below_min',
      message: `当前 ${width}×${height} 低于最低建议 ${BANNER_IMAGE_MIN.width}×${BANNER_IMAGE_MIN.height}，首屏可能明显模糊`,
    })
  } else if (width < BANNER_IMAGE_RECOMMENDED.width || height < BANNER_IMAGE_RECOMMENDED.height) {
    warnings.push({
      code: 'below_recommended',
      message: `当前 ${width}×${height} 低于推荐 ${BANNER_IMAGE_RECOMMENDED.width}×${BANNER_IMAGE_RECOMMENDED.height}`,
    })
  }

  const ratio = width / height
  if (ratio < BANNER_RATIO_MIN || ratio > BANNER_RATIO_MAX) {
    warnings.push({
      code: 'ratio_out_of_range',
      message: `比例 ${ratio.toFixed(2)}:1 超出建议区间 16:9（1.78:1）～ 21:9（2.33:1），建议裁切`,
    })
  }
  return warnings
}

// ── 外链探测（方案 §6.6）─────────────────────────────────────────

export interface ImageProbeResult {
  readonly width: number
  readonly height: number
}

/**
 * 浏览器端图片尺寸探测（img 加载不受 CORS 限制，可读 naturalWidth/Height）。
 * 失败 reject —— 消费方标记「探测失败」风险提醒，运营确认后仍可发布（§6.6）。
 */
export function probeImageSize(url: string): Promise<ImageProbeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}
