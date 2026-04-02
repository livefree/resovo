import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required')
}

const MAX_RETRIES = 10

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy(times) {
    if (times > MAX_RETRIES) {
      process.stderr.write(
        `[redis] ✗ 已放弃重连（超过 ${MAX_RETRIES} 次）。`
        + ` 请检查：① Redis 服务是否运行（redis-cli ping）`
        + ` ② REDIS_URL 配置是否正确（当前：${REDIS_URL}）`
        + ` ③ 网络/防火墙是否允许连接\n`,
      )
      return null
    }
    return Math.min(times * 200, 3000)   // 退避式重连：200ms → 3s
  },
})

function getConnectionHint(err: NodeJS.ErrnoException): string {
  switch (err.code) {
    case 'ECONNREFUSED':
      return '连接被拒绝 — Redis 服务可能未启动，或端口不正确'
    case 'ENOTFOUND':
      return '主机名无法解析 — 请检查 REDIS_URL 中的 hostname'
    case 'ETIMEDOUT':
      return '连接超时 — 网络延迟过高或防火墙阻断了连接'
    case 'ECONNRESET':
      return '连接被重置 — Redis 服务可能重启或网络不稳定'
    case 'EACCES':
      return '权限拒绝 — Redis 需要认证（requirepass），请检查 REDIS_URL 中的密码'
    default:
      return '请检查 Redis 服务状态和 REDIS_URL 配置'
  }
}

redis.on('error', (err: NodeJS.ErrnoException) => {
  const hint = getConnectionHint(err)
  process.stderr.write(`[redis] 连接错误: ${err.message} — ${hint}\n`)
})

redis.on('reconnecting', (delay: number) => {
  process.stderr.write(`[redis] 正在重连（${delay}ms 后重试）...\n`)
})

redis.on('ready', () => {
  process.stderr.write('[redis] 连接就绪\n')
})

export default redis
