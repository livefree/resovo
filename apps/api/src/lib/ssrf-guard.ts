/**
 * ssrf-guard.ts — outbound HTTP URL SSRF 5 层防御独立模块
 * ADR-146 D-146 R-146-1 / CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A
 *
 * 适用：admin 可配置的 outbound URL（webhook / 未来 SSO 回调等）。
 * 防御层：
 *   1. 仅 https 协议（拒绝 http / ftp / file / data 等）
 *   2. 拒绝 RFC 1918 私有 IP（10/8 + 172.16/12 + 192.168/16）
 *   3. 拒绝 loopback（127.0.0.0/8 + ::1）
 *   4. 拒绝 link-local 169.254.0.0/16（含 AWS/GCP/Azure 元数据端点）
 *   5. 拒绝云元数据 hostname（metadata.google.internal 等）
 *
 * 仅做静态 URL parse + IPv4/IPv6 网段判断；不做 DNS 解析（避免 DNS rebinding
 * 攻击 / 测试环境复杂度）。生产部署应配合 egress 防火墙作为第二道防线。
 */

const METADATA_HOSTNAMES = new Set<string>([
  'metadata.google.internal',
  'metadata',
  'metadata.aws',
  'metadata.azure.com',
])

/** RFC 1918 私有 IPv4 段 + loopback + link-local */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => parseInt(p, 10))
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = octets as [number, number, number, number]
  if (a === 10) return true                            // 10.0.0.0/8
  if (a === 127) return true                           // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true              // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true     // 172.16.0.0/12
  if (a === 192 && b === 168) return true              // 192.168.0.0/16
  if (a === 0) return true                              // 0.0.0.0/8
  return false
}

/** IPv6 loopback / link-local / 私有 */
function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
  if (lower.startsWith('fe80:')) return true     // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // unique local (fc00::/7)
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true
  return false
}

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * 校验 outbound URL 是否安全（不在受保护内网段）。
 * 返回 false 时调用方应静默拒绝（不发请求，可记 warn 日志）。
 */
export function isAllowedWebhookUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  // 1. 仅 https
  if (url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()

  // 5. 云元数据 hostname 拒绝
  if (METADATA_HOSTNAMES.has(hostname)) return false

  // IPv6 字面量
  if (hostname.includes(':')) {
    if (isPrivateOrReservedIPv6(hostname)) return false
    return true
  }

  // IPv4 字面量
  if (IPV4_RE.test(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) return false
    return true
  }

  // 域名 — 拒绝 localhost / 单标签内网名（避免 DNS rebinding 基础风险）
  if (hostname === 'localhost') return false
  if (!hostname.includes('.')) return false  // 单标签无 TLD 通常是内网

  return true
}
