/**
 * short-id.ts — slug → shortId 提取纯函数（CHG-VIR-13 收口 FIX 自 video-detail.ts 抽出）
 *
 * 抽出原因：video-detail.ts 顶层 `import { cookies, headers } from 'next/headers'`
 * （server-only），而 client 组件（PlayerShell / VideoDetailClient）value-import
 * 本函数会把整个 server-only 模块拉入 client bundle → 干净环境自起 dev server
 * 编译失败（外部热 server 的旧编译产物长期掩盖该潜伏破坏，e2e:player 收口时暴露）。
 * 纯函数零依赖，client/server 双侧安全。
 */

/** 从 slug（`<title>-<shortId>`）提取末段 shortId；无 `-` 时原样返回 */
export function extractShortId(slug: string): string {
  const lastDash = slug.lastIndexOf('-')
  if (lastDash === -1) return slug
  return slug.slice(lastDash + 1)
}
