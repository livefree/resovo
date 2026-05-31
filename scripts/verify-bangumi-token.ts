/**
 * verify-bangumi-token.ts — 一次性验证 system_settings 里已保存的 Bangumi API Token 是否有效
 *
 * FIX-SETTINGS-PARTIAL-SAVE 第 3 步：不新增 admin 端点（避开 ADR BLOCKER），
 * 直接读 DB 凭证 → 调 Bangumi 鉴权端点 /v0/me 验证 token 真实有效性。
 * （公共端点如 /v0/subjects 即使 token 错也会 200，故必须用需鉴权的 /v0/me。）
 *
 * 运行：
 *   node --env-file=.env.local --import tsx scripts/verify-bangumi-token.ts
 */

import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

const API_BASE = 'https://api.bgm.tv'
const DEFAULT_UA = 'resovo/1.0 (+https://github.com/resovo)'

async function main(): Promise<void> {
  const raw = await systemSettingsQueries.getAllSettings(db)
  const token = raw.bangumi_api_token
  const userAgent = raw.bangumi_user_agent || DEFAULT_UA
  const timeoutMs = Number(raw.bangumi_api_timeout_ms) > 0 ? Number(raw.bangumi_api_timeout_ms) : 8000

  if (!token) {
    console.error('✗ system_settings.bangumi_api_token 未配置（请先在后台「外部数据源」保存 token）')
    process.exitCode = 2
    return
  }
  // 不打印 token 任何片段（含末位），避免凭证信息外泄到终端/日志
  console.log(`已读取 token / UA="${userAgent}" / timeout=${timeoutMs}ms`)
  console.log(`调用 ${API_BASE}/v0/me 验证鉴权…`)

  let res: Response
  try {
    res = await fetch(`${API_BASE}/v0/me`, {
      headers: { 'User-Agent': userAgent, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    console.error(`✗ 请求失败（网络/超时）：${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
    return
  }

  if (res.status === 200) {
    console.log('✓ Token 有效（/v0/me 鉴权返回 200）。')
    return
  }
  if (res.status === 401) {
    console.error('✗ Token 无效或已过期（HTTP 401）。请在 bangumi.tv 重新生成 access token 后保存。')
    process.exitCode = 1
    return
  }
  console.error(`✗ 非预期响应 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`)
  process.exitCode = 1
}

main()
  .catch((err) => {
    console.error('✗ 脚本异常：', err)
    process.exitCode = 1
  })
  .finally(() => {
    void db.end()
  })
