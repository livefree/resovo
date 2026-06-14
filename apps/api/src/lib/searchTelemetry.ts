/**
 * searchTelemetry.ts — 后台搜索可观测埋点工具（ADR-200 D-200-10）
 *
 * 职责（纯工具、不依赖 logger）：
 *   - `hashQuery`：query 文本加盐 sha256 截断 16 hex（PII 红线 D-200-10.2）；
 *     盐 `SEARCH_TELEMETRY_SALT` 缺失 → fail-closed 返 null（route 仅写 query_len、不写 query_hash）。
 *     **盐每次读 env**（非模块加载期固化）→ 便于测试 set/unset + 部署期注入即生效。
 *   - `checkTelemetryLimit`：进程内内存桶（复用 client-log 范式），key=userId / 60s / 60；
 *     超限返 false（route 回 429 + 不 emit）。**进程级近似**（横向扩容 per-instance，D-200-10-D）。
 */
import { createHash } from 'node:crypto'

/** 加盐 sha256 截断 16 hex（64-bit）；盐缺失 fail-closed 返 null（PII 优先、不泄明文 query） */
export function hashQuery(raw: string): string | null {
  const salt = process.env.SEARCH_TELEMETRY_SALT
  if (!salt) return null
  const normalized = raw.trim().toLowerCase()
  return createHash('sha256').update(salt + normalized).digest('hex').slice(0, 16)
}

// ── 限流桶（进程内、key=userId；client-log checkIpLimit 同款范式）─────────────
const WINDOW_MS = 60_000
const LIMIT = 60
const callMap = new Map<string, { count: number; resetAt: number }>()

/** true=放行 / false=超限（429）。窗口 60s 内同 userId 上限 60。 */
export function checkTelemetryLimit(userId: string): boolean {
  const now = Date.now()
  const entry = callMap.get(userId)
  if (!entry || now >= entry.resetAt) {
    callMap.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= LIMIT
}
