/**
 * home-cache-invalidation.ts — 发布后公开缓存主动失效（ADR-185 D-185-5 / CHG-HOME-CACHE-INVALIDATE）
 *
 * publish / rollback 事务成功后主动失效两个子前缀键族：
 *   - `home:shelf:*`（D-184-5.2 唯一接口位 HOME_SHELF_CACHE_PREFIX，覆盖全 brand 全 section）
 *   - `home:top10:*`（HomeService TOP10_TTL 60s 键族）
 *
 * **子前缀级精确 scan 删**（D-185-5.3 / arch-reviewer LOW-2）：不得复用
 * CacheService.clearCache 的 type 级整前缀删——`home:*` 整删会连带清非目标
 * home key；PROTECTED_PREFIXES（bull:/blacklist:）与 home 子前缀无交集。
 *
 * **失效失败不回滚发布**（D-185-5.2）：发布事务已提交，失效仅加速生效；
 * 失败 warn 日志 + 60s TTL 兜底自愈——主动失效是优化不是正确性前提。
 */

import type { Redis } from 'ioredis'
import { redis as defaultRedis } from '@/api/lib/redis'
import { baseLogger } from '@/api/lib/logger'
import { HOME_SHELF_CACHE_PREFIX } from '@/api/services/home-curation.shelf'
import { HOME_TOP10_CACHE_PREFIX } from '@/api/services/HomeService'

/** 失效目标子前缀全集（扩前缀必须随对应缓存键族新增同卡同步） */
export const HOME_PUBLISH_INVALIDATION_PREFIXES: readonly string[] = [
  HOME_SHELF_CACHE_PREFIX,
  HOME_TOP10_CACHE_PREFIX,
]

async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
    cursor = nextCursor
    keys.push(...batch)
  } while (cursor !== '0')
  return keys
}

/**
 * 子前缀级精确 scan + UNLINK（CacheService 同款非阻塞删除范式）。
 * @returns 删除的 key 数（0 = 键族为空，合法态）
 * @throws redis 故障原样上抛（容忍归 schedule 包装层）
 */
export async function invalidatePublishedHomeCaches(redis: Redis = defaultRedis): Promise<number> {
  let deleted = 0
  for (const prefix of HOME_PUBLISH_INVALIDATION_PREFIXES) {
    const keys = await scanKeys(redis, `${prefix}*`)
    if (keys.length > 0) {
      await redis.unlink(...keys)
      deleted += keys.length
    }
  }
  return deleted
}

/**
 * 发布钩子（事务外 fire-and-forget）：成功 debug、失败 warn 不上抛——
 * D-185-5.2 失效失败不回滚发布（响应也不等待失效完成）。
 */
export function schedulePublishedHomeCacheInvalidation(
  context: { trigger: 'publish' | 'rollback'; versionNo: number },
  redis: Redis = defaultRedis,
): void {
  invalidatePublishedHomeCaches(redis)
    .then((deleted) => {
      baseLogger.debug(
        { ...context, deleted },
        '[home-cache-invalidation] published home caches invalidated',
      )
    })
    .catch((err: unknown) => {
      baseLogger.warn(
        { err, ...context },
        '[home-cache-invalidation] invalidation failed — 60s TTL 兜底自愈（D-185-5.2，不回滚发布）',
      )
    })
}
