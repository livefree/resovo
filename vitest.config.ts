import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],  // 只运行 unit 测试，排除 e2e
    environment: 'node',          // API 测试用 node 环境
    environmentMatchGlobs: [
      ['tests/unit/components/**', 'jsdom'],  // 组件测试用 jsdom
      ['tests/unit/hooks/**', 'jsdom'],        // hook 测试用 jsdom（依赖 window/sessionStorage）
    ],
    setupFiles: ['./tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/api/services/**',
        'src/api/routes/**',
        'src/api/db/queries/**',
        'src/components/player/**',
        'src/lib/api-client.ts',
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
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 自动 JSX 转换（React 17+ automatic runtime，组件测试不需要 import React）
  esbuild: {
    jsx: 'automatic',
  },
})
