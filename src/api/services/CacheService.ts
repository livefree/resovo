/**
 * CacheService.ts — Redis 缓存管理服务
 * CHG-30: SCAN + UNLINK，按业务前缀分类管理
 */

import type { Redis } from 'ioredis'

// ── 业务缓存前缀定义 ───────────────────────────────────────────────

export const CACHE_PREFIXES = {
  search: 'search:',
  video: 'video:',
  danmaku: 'danmaku:',
  analytics: 'analytics:',
} as const

export type CacheType = keyof typeof CACHE_PREFIXES | 'all'

/** 不得清除的系统 key 前缀（Bull 队列、token 黑名单） */
const PROTECTED_PREFIXES = ['bull:', 'blacklist:']

export interface CacheStat {
  type: CacheType
  count: number
  sizeKb: number
}

// ── CacheService ───────────────────────────────────────────────────

export class CacheService {
  constructor(private readonly redis: Redis) {}

  /**
   * 使用 SCAN 枚举指定前缀的所有 key，返回 key 列表
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'

    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = nextCursor
      keys.push(...batch)
    } while (cursor !== '0')

    return keys
  }

  /**
   * 统计单个前缀类型的 key 数量和大致内存占用
   */
  private async statForPrefix(prefix: string): Promise<{ count: number; sizeKb: number }> {
    const keys = await this.scanKeys(`${prefix}*`)
    if (keys.length === 0) return { count: 0, sizeKb: 0 }

    // 使用 DEBUG OBJECT 估算内存（非精确，允许误差）
    let totalBytes = 0
    const pipeline = this.redis.pipeline()
    for (const key of keys) {
      pipeline.strlen(key)
    }
    const results = await pipeline.exec()
    if (results) {
      for (const [err, len] of results) {
        if (!err && typeof len === 'number') {
          totalBytes += len + 64 // 加上 key overhead 估算
        }
      }
    }

    return { count: keys.length, sizeKb: Math.round(totalBytes / 1024) }
  }

  /**
   * 获取所有业务缓存类型的统计信息
   */
  async getStats(): Promise<CacheStat[]> {
    const entries = Object.entries(CACHE_PREFIXES) as [keyof typeof CACHE_PREFIXES, string][]
    const stats: CacheStat[] = []

    for (const [type, prefix] of entries) {
      const { count, sizeKb } = await this.statForPrefix(prefix)
      stats.push({ type, count, sizeKb })
    }

    return stats
  }

  /**
   * 清除指定类型的缓存（使用 UNLINK 非阻塞删除）
   * 'all' 时清除全部业务缓存前缀，不删除受保护的系统 key
   */
  async clearCache(type: CacheType): Promise<number> {
    const prefixes: string[] =
      type === 'all'
        ? Object.values(CACHE_PREFIXES)
        : [CACHE_PREFIXES[type as keyof typeof CACHE_PREFIXES]]

    let total = 0

    for (const prefix of prefixes) {
      // 安全校验：不允许操作受保护前缀
      if (PROTECTED_PREFIXES.some((p) => prefix.startsWith(p))) {
        continue
      }

      const keys = await this.scanKeys(`${prefix}*`)
      if (keys.length === 0) continue

      // UNLINK 是非阻塞的 DEL 替代
      await this.redis.unlink(...keys)
      total += keys.length
    }

    return total
  }
}
