/**
 * URL 工具分区（非 manifest 解析层）：与 source-health 消费方共置。
 *
 * SRCHEALTH-P3-3-A（arch-reviewer claude-opus-4-8 裁决 C）：
 * `video_sources.source_hostname` 写路径 + 回填脚本 + P3-3-B worker host_health
 * JOIN 三方的唯一 hostname 语义真源。语义 = Node `new URL(url).hostname`：
 * - 自动小写化（HTTP://Example.COM → example.com）
 * - 去端口 / 去 userinfo
 * - IDN → punycode（例子.com → xn--fsqu00a.com）——SQL regex 无法复制的关键差异，
 *   故存量回填必须走本函数（scripts/backfill-source-hostname.ts）而非 SQL 表达式
 * - IPv6 hostname 含方括号（http://[::1]/ → "[::1]"，测试固化）
 *
 * ⚠️ P3-3-B 落地约束（裁决 B 登记）：worker `extractSiteId`（level1-probe / level2-render
 * 双副本，fallback `url.slice(0,64)`）须切换到本函数并在持久化 host_health 前过滤 null——
 * slice fallback 与本列 NULL 语义冲突，不可 JOIN。
 */

/**
 * 从 URL 提取规范化 hostname。解析失败或无 hostname 返回 null（不抛异常）。
 * null 对应 `video_sources.source_hostname` 的 NULL 语义：无有效 hostname，
 * 不参与 hostname 维度降权。
 */
export function extractHostname(url: string): string | null {
  try {
    const hostname = new URL(url.trim()).hostname
    return hostname.length > 0 ? hostname.toLowerCase() : null
  } catch {
    return null
  }
}
