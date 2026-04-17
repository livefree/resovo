/**
 * robots.ts — 生成 robots.txt
 * DEC-08: 屏蔽 /admin/** 及已下线的 /auth/** 路径，后台入口不对外公开
 * CHG-343: 基于 routing.locales 动态生成多语言屏蔽路径，避免新增语言时遗漏
 */

import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

export default function robots(): MetadataRoute.Robots {
  const localizedPaths = routing.locales.flatMap((locale) => [
    `/${locale}/admin/`,
    `/${locale}/auth/`,
  ])
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/auth/', ...localizedPaths],
      },
    ],
  }
}
