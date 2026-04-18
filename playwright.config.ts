import { defineConfig, devices } from '@playwright/test'

const WEB_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const ADMIN_URL = process.env.ADMIN_APP_URL       ?? 'http://localhost:3001'

// 前台 E2E：homepage / search / player / auth
const WEB_SPECS   = ['**/e2e/homepage.spec.ts', '**/e2e/search.spec.ts', '**/e2e/player.spec.ts', '**/e2e/auth.spec.ts']
// 后台 E2E：admin 访问控制 / 视频治理 / 发布流程（admin 部分）
const ADMIN_SPECS = ['**/e2e/admin.spec.ts', '**/e2e/admin-source-and-video-flows.spec.ts', '**/e2e/video-governance.spec.ts', '**/e2e/publish-flow.spec.ts']

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['line']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── 前台（web:3000） ────────────────────────────────────────────
    {
      name: 'web-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
      testMatch: WEB_SPECS,
    },
    {
      name: 'web-mobile',
      use: { ...devices['iPhone 14'], baseURL: WEB_URL },
      testMatch: WEB_SPECS,
    },
    // ── 后台（server:3001） ─────────────────────────────────────────
    {
      name: 'admin-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
      testMatch: ADMIN_SPECS,
    },
  ],

  webServer: [
    {
      command: 'npm --workspace @resovo/web run dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'npm --workspace @resovo/server run dev',
      url: `${ADMIN_URL}/admin`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
})
