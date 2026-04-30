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
        'apps/web-next/src/components/player/**',
        'apps/web-next/src/lib/**',
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
      // CHG-DESIGN-07 7C：context-aware alias — server-next importer 走 apps/server-next；
      // 历史 v1 server importer 仍走 apps/server。优先级高于通用 @/(.*) 通配
      {
        find: /^@\/components\/admin(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isServerNext =
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/')
          const base = isServerNext
            ? path.resolve(__dirname, './apps/server-next/src/components/admin')
            : path.resolve(__dirname, './apps/server/src/components/admin')
          const subPath = replacedId.replace(/^\//, '') || 'index'
          return resolveWithExtensions(path.resolve(base, subPath))
        },
      },
      {
        find: /^@\/components\/shared(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isServerNext =
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/')
          const base = isServerNext
            ? path.resolve(__dirname, './apps/server-next/src/components/shared')
            : path.resolve(__dirname, './apps/server/src/components/shared')
          const subPath = replacedId.replace(/^\//, '') || 'index'
          return resolveWithExtensions(path.resolve(base, subPath))
        },
      },
      // @/stores is context-aware: web-next → apps/web-next/src/stores; server/admin → apps/server/src/stores
      // （CUTOVER 2026-04-23 后 apps/web 已退役，apps/web 分支移除）
      {
        find: /^@\/stores(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isServer =
            importer?.includes('/apps/server/') || importer?.includes('/tests/unit/components/admin/')
          const storesBase = isServer
            ? path.resolve(__dirname, './apps/server/src/stores')
            : path.resolve(__dirname, './apps/web-next/src/stores')
          const subPath = replacedId.replace(/^\//, '') || 'index'
          return resolveWithExtensions(path.resolve(storesBase, subPath))
        },
      },
      // @/types：优先走 packages/types（apps/api 主要消费者），fallback 到 apps/web-next/src/types（brand.ts / tag.ts）
      // CUTOVER 2026-04-23 与 tsconfig.json paths 同步
      {
        find: /^@\/types(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string) {
          const subPath = replacedId.replace(/^\//, '') || 'index'
          const pkgPath = resolveWithExtensions(path.resolve(__dirname, './packages/types/src', subPath))
          if (pkgPath) return pkgPath
          return resolveWithExtensions(path.resolve(__dirname, './apps/web-next/src/types', subPath))
        },
      },
      // @ resolver: context-aware
      // server-next → apps/server-next/src; server/admin → apps/server/src; default → apps/web-next/src
      {
        find: /^@\/(.*)/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isServerNext =
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/')
          const isServer =
            importer?.includes('/apps/server/') || importer?.includes('/tests/unit/components/admin/')
          const srcBase = isServerNext
            ? path.resolve(__dirname, './apps/server-next/src')
            : isServer
              ? path.resolve(__dirname, './apps/server/src')
              : path.resolve(__dirname, './apps/web-next/src')
          return resolveWithExtensions(path.resolve(srcBase, replacedId))
        },
      },
      { find: '@resovo/player-core', replacement: path.resolve(__dirname, './packages/player-core/src/index.ts') },
      { find: '@resovo/types',       replacement: path.resolve(__dirname, './packages/types/src/index.ts') },
      { find: '@resovo/logger',      replacement: path.resolve(__dirname, './packages/logger/src/index.ts') },
    ],
  },
  // 自动 JSX 转换（React 17+ automatic runtime，组件测试不需要 import React）
  esbuild: {
    jsx: 'automatic',
  },
})
