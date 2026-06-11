/**
 * admin-preview-url.ts — admin「前台预览」专用 URL builder（MODUX-P1-3 / ADR-160 D-160-7）
 *
 * 职责：在跨 app 纯函数 `getVideoDetailHref`（packages/types，不承载 web-next
 * locale 策略）之上，收口 server-next 侧 preview 链接派生的三件事：
 *   1. WEB_NEXT_ORIGIN（dev 双端口 / prod 主域，复用 NEXT_PUBLIC_APP_URL env）
 *   2. locale 前缀注入（web-next `localePrefix: always`，显式注入省一跳
 *      307 redirect；实测 redirect 保留 query 不致 404，注入仅为减少跳转）
 *   3. `?preview=admin` 双因素 query（ADR-160 D-160-1，与 user_role cookie 配合）
 *
 * 不做：不校验 locale 合法性（web-next middleware 对未知首段自动按 locale
 * 协商 redirect，错误值自愈）；不读 cookie / 不判定权限（middleware 职责）。
 */
import { getVideoDetailHref, type VideoType } from '@resovo/types'

const WEB_NEXT_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** 运营预览默认 locale：admin 操作员以中文语境验收前台展示效果 */
const DEFAULT_PREVIEW_LOCALE = 'zh-CN'

export interface AdminPreviewVideo {
  readonly type: VideoType
  readonly slug: string | null
  readonly shortId: string
}

export function buildAdminPreviewUrl(
  video: AdminPreviewVideo,
  locale: string = DEFAULT_PREVIEW_LOCALE,
): string {
  const href = getVideoDetailHref(video)
  return `${WEB_NEXT_ORIGIN}/${locale}${href}?preview=admin`
}
