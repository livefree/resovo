/**
 * tests/helpers/setup.ts — 全局测试配置
 * Vitest 在每个测试文件执行前自动加载
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'

// 加载测试环境变量
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
process.env.JWT_SECRET   = 'test-secret-do-not-use-in-production'

// 全局测试生命周期（按需在具体测试文件中覆盖）
beforeAll(async () => {
  // 可在此初始化测试数据库连接池
})

afterAll(async () => {
  // 可在此关闭连接池
})
