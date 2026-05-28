'use client'

/**
 * country-name.tsx — CountryName 实装（CHG-366 / plan §10.4.3）
 *
 * 用途：把 ISO 3166-1 alpha-2 国家代码（如 'US' / 'CN'）转为本地化显示（'美国' /
 * 'United States'）。复用 `@resovo/types#formatCountryName` 纯函数，本组件仅薄
 * 包装 + a11y title 提示原 code（便于运营核对真实存储值）。
 */

import { formatCountryName } from '@resovo/types'
import type { CountryNameProps } from './country-name.types'

export function CountryName({
  code,
  locale = 'zh-CN',
  fallback = '—',
  muted = false,
  testId = 'country-name',
  className,
}: CountryNameProps) {
  const display = formatCountryName(code, locale, fallback)
  const showOriginalTitle = !!code && display !== code

  return (
    <span
      data-testid={testId}
      data-country-code={code ?? undefined}
      title={showOriginalTitle ? code! : undefined}
      className={className}
      style={{
        color: muted ? 'var(--fg-muted)' : 'var(--fg-default)',
      }}
    >
      {display}
    </span>
  )
}
