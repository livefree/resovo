/**
 * tests/e2e-next/_fixtures.ts
 *
 * 框架层 SSR 状态码兜底（d 方案·BLOCKER CLOSE-03 决策落地）：
 * 所有 e2e-next spec 统一 import `test` / `expect` from this file（而非 `@playwright/test`），
 * 使得任一 test 中 navigation 响应 ≥500 时在 teardown 强制抛错。
 *
 * 背景：M5-CLOSE-03 代理证据采集阶段发现 `/en/search?q=...` SSR 返回 500，但 Playwright
 * page.goto 后浏览器 hydrate 自动恢复到可用 UI，case 仅断言 DOM 可见未 assert
 * response.status()，导致 CLEANUP-11 e2e 盲区。本 fixture 作为统一守门。
 */

import { test as base, expect } from '@playwright/test'

interface NavFailure {
  status: number
  url: string
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const ssrFailures: NavFailure[] = []
    page.on('response', (resp) => {
      if (resp.request().isNavigationRequest() && resp.status() >= 500) {
        ssrFailures.push({ status: resp.status(), url: resp.url() })
      }
    })

    await use(page)

    if (ssrFailures.length > 0) {
      const detail = ssrFailures.map((f) => `  - ${f.status} ${f.url}`).join('\n')
      throw new Error(
        `Navigation SSR response ≥500 detected during test:\n${detail}\n` +
          `若确属预期 error page 测试，请在 spec 顶部手动移除此 fixture 或在 test 内 page.removeAllListeners('response')`,
      )
    }
  },
})

export { expect }
