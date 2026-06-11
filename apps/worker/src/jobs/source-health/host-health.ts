import type { Pool } from 'pg'
import type pino from 'pino'
import { config } from '../../config'
import type { CircuitTransition } from '../../lib/circuit-breaker'

/**
 * host_health 翻转事件落库（SRCHEALTH-P3-3-B1，arch-reviewer 裁决 B）。
 * 仅在 CircuitTransition 非 null（tripped/recovered）时调用——逐次探测不写库。
 * 落库失败 catch+warn 不阻断探测主流程（P1-2 先例：worker 翻转信号丢失由
 * 下次翻转事件自愈，评分侧 cooldown_until 过期语义本就容忍秒级误差）。
 * 两 job（level1/level2）同进程共享内存 Map，PG 侧 ON CONFLICT 行级锁幂等，无需 advisory lock。
 */
export async function persistCircuitTransition(
  pool: Pool,
  log: pino.Logger,
  hostname: string,
  transition: CircuitTransition,
): Promise<void> {
  if (transition === null) return
  try {
    if (transition === 'tripped') {
      // cooldown_until 用落库时刻 + 同一 config 真源重算（与内存值毫秒级差异可忽略）
      await pool.query(
        `INSERT INTO host_health (hostname, cooldown_until, last_failure_at, last_tripped_at, trip_count, updated_at)
         VALUES ($1, NOW() + make_interval(secs => $2), NOW(), NOW(), 1, NOW())
         ON CONFLICT (hostname) DO UPDATE
           SET cooldown_until = EXCLUDED.cooldown_until,
               last_failure_at = NOW(),
               last_tripped_at = NOW(),
               trip_count = host_health.trip_count + 1,
               updated_at = NOW()`,
        [hostname, config.circuitBreaker.cooldownMs / 1000],
      )
    } else {
      await pool.query(
        `INSERT INTO host_health (hostname, cooldown_until, last_success_at, updated_at)
         VALUES ($1, NULL, NOW(), NOW())
         ON CONFLICT (hostname) DO UPDATE
           SET cooldown_until = NULL,
               last_success_at = NOW(),
               updated_at = NOW()`,
        [hostname],
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn({ hostname, transition, err: msg }, 'host_health persist failed (probe flow not blocked)')
  }
}
