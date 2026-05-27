/**
 * admin-preview-redirect.spec.ts — CHG-361-C / ADR-160 D-160-7 验收
 *
 * 黄金路径：PendingCenter "在前台预览" 按钮 → window.open 调跨 app web-next URL，
 * 携带双因素 `?preview=admin` query；URL 派生通过 getVideoDetailHref({type, slug, shortId})。
 *
 * 验证项：
 *  - window.open 被调用且仅 1 次
 *  - URL 包含 getVideoDetailHref 派生路径（/{type}/{slug}-{shortId}）
 *  - URL 携带 `?preview=admin`
 *  - target=_blank
 */

import { test, expect } from '@playwright/test'
import {
  setModeratorCookies,
  installModerationMocks,
  freshState,
  makeQueueRow,
} from './_helpers'

const VIDEO_ID = 'vid-preview-01'
const SLUG = 'attack-on-titan'
const SHORT_ID = 'aB3kR9x1'

test.describe('CHG-361-C admin preview 跨 app 跳转', () => {
  test('点击 "在前台预览" → window.open 调 web-next preview URL', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state = freshState({
      pending: [
        makeQueueRow({
          id: VIDEO_ID,
          slug: SLUG,
          shortId: SHORT_ID,
          type: 'movie',
          title: 'Preview 测试视频',
        }),
      ],
    })
    await installModerationMocks(page, state)

    // 加载前 stub window.open（记录调用 / 返回 null 避免真实开新窗口）
    await page.addInitScript(() => {
      ;(window as unknown as { __opened: Array<{ url: string; target: string }> }).__opened = []
      const originalOpen = window.open.bind(window)
      void originalOpen
      window.open = ((url?: string | URL, target?: string): Window | null => {
        ;(window as unknown as { __opened: Array<{ url: string; target: string }> }).__opened.push({
          url: typeof url === 'string' ? url : (url?.toString() ?? ''),
          target: target ?? '',
        })
        return null
      }) as typeof window.open
    })

    await page.goto('/admin/moderation')
    await expect(page.getByTestId('moderation-split')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Preview 测试视频').first()).toBeVisible()

    // PendingCenter "↗ 前台预览" 按钮 / aria-label = "在前台预览"（i18n moderation.aria.openFrontend）
    await page.getByRole('button', { name: '在前台预览' }).first().click()

    const opened = await page.evaluate(
      () => (window as unknown as { __opened: Array<{ url: string; target: string }> }).__opened
    )
    expect(opened).toHaveLength(1)
    const entry = opened[0]!
    // 派生 URL = `${ORIGIN}/movie/attack-on-titan-aB3kR9x1?preview=admin`
    expect(entry.url).toMatch(/\/movie\/attack-on-titan-aB3kR9x1\?preview=admin$/)
    expect(entry.target).toBe('_blank')
  })
})
