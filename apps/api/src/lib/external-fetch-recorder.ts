/**
 * external-fetch-recorder.ts — 外部资源采集操作埋点旁路（ADR-188 D-188-4）
 *
 * 在线出口（doubanAdapter 3 函数 + 未来 provider 出口）调用，旁路写一行 external_fetch_log。
 * await + try/catch 吞错——埋点失败绝不阻塞 / 改变业务（观测旁路，ADR-188 M2）。
 * offline dump 本地召回不经此（D-188-3：本地 DB 查询非外部 fetch）。
 */

import { insertFetchLog, type FetchLogInput, type FetchStatus } from '@/api/db/queries/external-fetch-log'
import { baseLogger } from '@/api/lib/logger'

const log = baseLogger.child({ service: 'external-fetch-recorder' })

/**
 * 旁路记录一次外部采集操作；任何写入异常吞掉（不抛、不影响调用方返回）。
 * db 单例**惰性动态 import**——避免本模块（及下游 doubanAdapter）在模块 load 期即
 * 静态依赖 postgres（其无 DATABASE_URL 时 import 即抛），保持下游可在无 DB 环境 import。
 */
export async function recordFetch(input: FetchLogInput): Promise<void> {
  try {
    const { db } = await import('@/api/lib/postgres')
    await insertFetchLog(db, input)
  } catch (err) {
    log.warn(
      { err, provider: input.provider, operation: input.operation },
      'recordFetch failed (swallowed)',
    )
  }
}

/**
 * 据错误判定 status：AbortError/TimeoutError → 'timeout'，其余 → 'fail'。
 * 注意 AbortSignal.timeout 抛 DOMException（Node 下非 instanceof Error），故按 name 判定不依赖类型。
 */
export function classifyFetchError(err: unknown): FetchStatus {
  const name = (err as { name?: unknown } | null | undefined)?.name
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout'
  return 'fail'
}

/** 截断错误摘要（error 列防超长）。 */
export function fetchErrorSummary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 500)
}
