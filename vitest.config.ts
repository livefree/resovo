import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'
import fs from 'fs'

// jsdom 环境的测试目录（组件 / hook / web-next / 审核台）。node 项目需排除这些，
// 避免同一文件在两个项目重复运行（且 node 环境无 window/localStorage 会失败）。
const JSDOM_GLOBS = [
  'tests/unit/components/**/*.{test,spec}.{ts,tsx}',
  'tests/unit/hooks/**/*.{test,spec}.{ts,tsx}',
  'tests/unit/web-next/**/*.{test,spec}.{ts,tsx}',
  'tests/unit/admin-moderation/**/*.{test,spec}.{ts,tsx}',
]
const ALL_UNIT_GLOBS = ['tests/unit/**/*.{test,spec}.{ts,tsx}']

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
    setupFiles: ['./tests/helpers/setup.ts'],
    // environmentMatchGlobs（vitest 3.x deprecated）→ test.projects（按目录切环境）。
    // 两个项目均 extends: true 继承根的 resolve.alias / esbuild / setupFiles / globals / 超时。
    projects: [
      {
        extends: true,
        test: {
          name: 'node',                // API / 后端 / 纯逻辑测试（node 环境）
          environment: 'node',
          include: ALL_UNIT_GLOBS,
          exclude: [...configDefaults.exclude, ...JSDOM_GLOBS],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',               // 组件 / hook / web-next / 审核台（jsdom：window/localStorage）
          environment: 'jsdom',
          include: JSDOM_GLOBS,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'apps/api/src/services/**',
        'apps/api/src/routes/**',
        'apps/api/src/db/queries/**',
        'apps/web-next/src/components/player/**',
        'apps/web-next/src/lib/**',
        'apps/worker/src/**',
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
    // 升全量触发集（ADR-180 D-180-2 配置层）：--changed / watch 模式下命中即强制全跑。
    // 显式覆盖默认值（默认含 package.json / vitest.config.*，覆盖时必须保留）并补
    // tests/helpers/**（setup.ts 经 setupFiles 全局加载，db/factories 仅部分文件 import，统一升全量最稳）。
    // 与 scripts/test-changed.mjs 的脚本层触发集构成双保险（绕过包装器直接 vitest run --changed 也安全）。
    forceRerunTriggers: [
      '**/vitest.config.ts',
      '**/vitest.integration.config.ts',
      '**/tests/helpers/**',
      '**/package.json',
      '**/tsconfig*.json',
    ],
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
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/') || importer?.includes('/tests/unit/admin-moderation/')
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
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/') || importer?.includes('/tests/unit/admin-moderation/')
          const base = isServerNext
            ? path.resolve(__dirname, './apps/server-next/src/components/shared')
            : path.resolve(__dirname, './apps/server/src/components/shared')
          const subPath = replacedId.replace(/^\//, '') || 'index'
          return resolveWithExtensions(path.resolve(base, subPath))
        },
      },
      // @/stores is context-aware: server-next → apps/server-next/src/stores; server/admin → apps/server/src/stores; default → apps/web-next/src/stores
      // （CUTOVER 2026-04-23 后 apps/web 已退役，apps/web 分支移除；server-next 2026-05-20 补入）
      {
        find: /^@\/stores(\/.*)?$/,
        replacement: '$1',
        customResolver(replacedId: string, importer: string | undefined) {
          const isServerNext =
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/') || importer?.includes('/tests/unit/admin-moderation/')
          const isServer =
            importer?.includes('/apps/server/') || importer?.includes('/tests/unit/components/admin/')
          const storesBase = isServerNext
            ? path.resolve(__dirname, './apps/server-next/src/stores')
            : isServer
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
            importer?.includes('/apps/server-next/') || importer?.includes('/tests/unit/components/server-next/') || importer?.includes('/tests/unit/admin-moderation/')
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
      { find: '@resovo/worker',      replacement: path.resolve(__dirname, './apps/worker/src') },
    ],
  },
  // 自动 JSX 转换（React 17+ automatic runtime，组件测试不需要 import React）
  esbuild: {
    jsx: 'automatic',
  },
})
