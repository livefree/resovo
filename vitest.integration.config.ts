/**
 * vitest.integration.config.ts — 集成测试配置（CHG-SN-6-INTEGRATION-TEST / RETRO 2/7）
 *
 * 与 vitest.config.ts（unit）分离：
 *   - include: tests/integration/**
 *   - 真实 PG 连接（DATABASE_URL）
 *   - 串行执行（避免 PG 并发写冲突）
 *   - testTimeout 30s（PG query 慢于 mock）
 *
 * 用法：npm run test:integration
 */

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/integration/**/*.{test,spec}.ts'],
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    // 串行：避免多 worker 并发跑真实 PG（连接池压力 / 写冲突）
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: [
      { find: '@resovo/types', replacement: path.resolve(__dirname, './packages/types/src/index.ts') },
      // @/types：apps/api 内部消费 packages/types barrel（META-32-B metadata-status.derive → @/types）
      // 镜像 vitest.config.ts unit 别名（apps/api 唯一消费 packages/types，无 web-next fallback 需求）
      { find: /^@\/types(\/.*)?$/, replacement: path.resolve(__dirname, './packages/types/src') + '$1' },
      // @/api：启用对带 @/api 传递依赖的 query（如 video_sources.ts → @/api/lib/errors）的真库集成测试
      // （BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST，镜像 vitest.config.ts unit 别名）
      { find: '@/api', replacement: path.resolve(__dirname, './apps/api/src') },
    ],
  },
})
