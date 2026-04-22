import { test, expect } from './_fixtures'

test.describe('web-next smoke', () => {
  test('next-placeholder 返回 200 且渲染验收页', async ({ page }) => {
    const response = await page.goto('/en/next-placeholder')
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('next-placeholder-root')).toBeVisible()
    await expect(page.locator('h1')).toContainText('apps/web-next')
  })

  test('zh-CN locale next-placeholder 返回 200', async ({ page }) => {
    const response = await page.goto('/zh-CN/next-placeholder')
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('next-placeholder-root')).toBeVisible()
  })
})
