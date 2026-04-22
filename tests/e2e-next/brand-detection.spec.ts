/**
 * tests/e2e-next/brand-detection.spec.ts
 * REG-M1-02: middleware brand/theme 识别分层协议 E2E 验证
 *
 * 测试 apps/web-next middleware 的 brand/theme header 注入行为。
 * 断言：cookie → response header → DOM data-brand/data-theme 的端到端链路。
 */

import { test, expect } from './_fixtures'

const VALID_THEMES = new Set(['light', 'dark', 'system'])

test.describe('middleware brand/theme 识别', () => {
  test('无 cookie 时注入默认 brand/theme header', async ({ request }) => {
    const response = await request.get('/en', {
      headers: { cookie: '' },
    })

    expect(response.ok()).toBe(true)
    const headers = response.headers()
    expect(headers['x-resovo-brand']).toBe('resovo')
    expect(headers['x-resovo-theme']).toBe('system')
  })

  test('有效 cookie 传播到 response header 和 DOM', async ({ page, context }) => {
    await context.addCookies([
      { name: 'resovo-brand', value: 'resovo', domain: 'localhost', path: '/' },
      { name: 'resovo-theme', value: 'dark', domain: 'localhost', path: '/' },
    ])

    const response = await page.goto('/en')
    expect(response).not.toBeNull()

    const headers = response!.headers()
    expect(headers['x-resovo-brand']).toBe('resovo')
    expect(headers['x-resovo-theme']).toBe('dark')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('非法 cookie 值回退到默认值（不泄露）', async ({ request }) => {
    const response = await request.get('/en', {
      headers: {
        cookie: 'resovo-brand=<script>alert(1)</script>; resovo-theme=hacker',
      },
    })

    expect(response.ok()).toBe(true)
    const headers = response.headers()
    expect(headers['x-resovo-brand']).toBe('resovo')
    expect(headers['x-resovo-theme']).toBe('system')
  })

  test('经 next-intl redirect 路径后 header 仍存在', async ({ page }) => {
    // 直接访问根路径，next-intl 会 redirect 到带 locale 的路径
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    // 最终落地页响应必须携带 brand/theme header（middleware 在每个请求上运行）
    const headers = response!.headers()
    expect(headers['x-resovo-brand']).toBeDefined()
    expect(headers['x-resovo-theme']).toBeDefined()
    expect(headers['x-resovo-brand']).toBe('resovo')

    // DOM data-theme 值必须是合法主题之一（init-script 已解析 system）
    const dataTheme = await page.locator('html').getAttribute('data-theme')
    expect(dataTheme).not.toBeNull()
    expect(VALID_THEMES.has(dataTheme!)).toBe(true)
  })
})
