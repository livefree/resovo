/**
 * format-country-name.ts — 国家代码 → 本地化显示 helper（CHG-366 / plan §10.4.3）
 *
 * 真源约束：`videos.country` 与 `media_catalog.country` 字段统一存 ISO 3166-1 alpha-2
 * code（'US' / 'CN' / 'JP' / ...）。所有显示层须经此 helper 转中英文。
 *
 * 实现：Node 16+ / 现代浏览器 / Edge Runtime 全部内置 `Intl.DisplayNames`，
 * 零 npm 依赖。无效 code（不在 ISO 表）时降级返回 `fallback`（默认原 code）。
 *
 * 跨 app 复用：apps/server-next + apps/web-next + apps/server v1 + apps/api 共用。
 * React 组件 wrapper 见 `packages/admin-ui/src/components/cell/country-name.tsx`。
 *
 * 安全设计：单实例缓存 `Intl.DisplayNames` 实例避免重复构造（每次 new 约 200μs，
 * 列表场景成千上万次调用即可观测到）；按 locale 维度 LRU-1 缓存（同一渲染周期内
 * locale 几乎不变）。
 */

const cache: { locale: string; instance: Intl.DisplayNames } = {
  locale: '',
  instance: null as unknown as Intl.DisplayNames,
}

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  if (cache.locale === locale && cache.instance) return cache.instance
  try {
    const instance = new Intl.DisplayNames([locale], { type: 'region' })
    cache.locale = locale
    cache.instance = instance
    return instance
  } catch {
    // 环境异常（极旧 Node）— 调用方走 fallback 路径
    return null
  }
}

/**
 * 把 ISO 3166-1 alpha-2 国家代码转为本地化显示名称。
 *
 * @example
 *   formatCountryName('US', 'zh-CN')   // '美国'
 *   formatCountryName('CN', 'en')      // 'China'
 *   formatCountryName('XX', 'zh-CN')   // 'XX'（无效 code 时降级原 code）
 *   formatCountryName(null)            // ''
 *   formatCountryName('', 'zh-CN', '—') // '—'
 */
export function formatCountryName(
  code: string | null | undefined,
  locale: string = 'zh-CN',
  fallback: string = '',
): string {
  if (!code) return fallback
  const normalized = code.trim().toUpperCase()
  if (!normalized) return fallback
  // ISO 3166-1 alpha-2 严格 2 个 ASCII 字母
  if (!/^[A-Z]{2}$/.test(normalized)) return code

  const instance = getDisplayNames(locale)
  if (!instance) return code
  try {
    const result = instance.of(normalized)
    // Intl.DisplayNames 对无效 region 返回 input 本身或抛错（取决于运行时）
    if (!result || result === normalized) return code
    return result
  } catch {
    return code
  }
}
