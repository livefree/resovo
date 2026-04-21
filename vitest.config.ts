import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'

function resolveWithExtensions(base: string): string | undefined {
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js',
    base + '/index.ts', base + '/index.tsx', base + '/index.js',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return undefined
}

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],  // 只运行 unit 测试，排除 e2e
    environment: 'node',          // API 测试用 node 环境
    environmentMatchGlobs: [
      ['tests/unit/components/**', 'jsdom'],  // 组件测试用 jsdom
      ['tests/unit/hooks/**', 'jsdom'],        // hook 测试用 jsdom（依赖 window/sessionStorage）
      ['tests/unit/web-next/**', 'jsdom'],    // web-next 组件测试
    ],
    setupFiles: ['./tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'apps/api/src/services/**',
        'apps/api/src/routes/**',
        'apps/api/src/db/queries/**',
        'apps/web/src/components/player/**',
        'apps/web/src/lib/api-client.ts',
      ],
      thresholds: {
        // 覆盖率低于此值时输出警告（不阻断）
        lines: 60,
        functions: 60,
      },
    },
    // 测试超时：单个测试 10 秒，集成测试 30 秒
    testTimeout: 10000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: [
      { find: '@/api',              replacement: path.resolve(__dirname, './apps/api/src') },
      { find: '@/components/admin', replacement: path.resolve(__dirname, './apps/server/src/components/admin') },
      { find: '@/components/shared',replacement: path.resolve(__dirname, './apps/server/src/components/shared') },
      // @/stores is context-aware: web-next → apps/web-next/src/stores; server/other → apps/server/src/stores
      {
        find: /^@\/stores(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isWebNext =
            importer?.includes('/apps/web-next/') || importer?.includes('/tests/unit/web-next/')
          const storesBase = isWebNext
            ? path.resolve(__dirname, './apps/web-next/src/stores')
            : path.resolve(__dirname, './apps/server/src/stores')
          const subPath = replacedId.replace(/^\//, '') || 'index'
          return resolveWithExtensions(path.resolve(storesBase, subPath))
        },
      },
      // Smart @ resolver: web-next source files get apps/web-next/src, others get apps/web/src
      {
        find: /^@\/(.*)/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const srcBase =
            importer?.includes('/apps/web-next/') || importer?.includes('/tests/unit/web-next/')
              ? path.resolve(__dirname, './apps/web-next/src')
              : path.resolve(__dirname, './apps/web/src')
          return resolveWithExtensions(path.resolve(srcBase, replacedId))
        },
      },
      { find: '@resovo/player-core', replacement: path.resolve(__dirname, './packages/player-core/src/index.ts') },
      { find: '@resovo/types',       replacement: path.resolve(__dirname, './packages/types/src/index.ts') },
    ],
  },
  // 自动 JSX 转换（React 17+ automatic runtime，组件测试不需要 import React）
  esbuild: {
    jsx: 'automatic',
  },
})
