/**
 * robots.ts — 生成 robots.txt
 * DEC-08: 屏蔽 /admin/** 及已下线的 /auth/** 路径，后台入口不对外公开
 */

import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/auth/'],
      },
    ],
  }
}
