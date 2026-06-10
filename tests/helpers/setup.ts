/**
 * tests/helpers/setup.ts — 全局测试配置
 * Vitest 在每个测试文件执行前自动加载
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'

// 加载测试环境变量
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
process.env.JWT_SECRET   = 'test-secret-do-not-use-in-production'
// REDIS_URL：lib/redis 在 import 时校验存在性（缺失即 throw）。NTLG-P2-c-B-1 起 NotificationEmitter
// 经 notification-pubsub 传递 import lib/redis → 域服务测试需此兜底。lazyConnect=true 不会真连，
// 未 mock redis 的测试里 publish 为 fire-and-forget（连不上仅 warn，不影响断言）；需真 redis 的测试自带 mock。
process.env.REDIS_URL    = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

// 全局测试生命周期（按需在具体测试文件中覆盖）
beforeAll(async () => {
  // 可在此初始化测试数据库连接池
})

afterAll(async () => {
  // 可在此关闭连接池
})
