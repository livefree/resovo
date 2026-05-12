import { defineConfig, devices } from '@playwright/test'

// CUTOVER（2026-04-23）：apps/web 退役，apps/web-next 升为对外入口 port 3000
const WEB_URL        = process.env.NEXT_PUBLIC_APP_URL  ?? 'http://localhost:3000'
const ADMIN_URL      = process.env.ADMIN_APP_URL        ?? 'http://localhost:3001'
const ADMIN_NEXT_URL = process.env.ADMIN_NEXT_APP_URL   ?? 'http://localhost:3003'

// 后台 E2E：admin 访问控制 / 视频治理 / 发布流程（admin 部分）
const ADMIN_SPECS      = ['**/e2e/admin.spec.ts', '**/e2e/admin-source-and-video-flows.spec.ts', '**/e2e/video-governance.spec.ts', '**/e2e/publish-flow.spec.ts']
// server-next 后台 E2E（apps/server-next:3003）
const ADMIN_NEXT_SPECS = ['**/e2e/admin/**/*.spec.ts']
// ── admin-visual project (ADR-116 / CHG-SN-5-PRE-01-E-1) ──────────────────
// 隔离 testDir + testMatch，不与上述 e2e specs 混跑
const ADMIN_VISUAL_TEST_DIR = './tests/visual'
const ADMIN_VISUAL_TEST_MATCH = '**/*.visual.spec.ts'
// admin-visual 默认**不**加入 projects 数组（baseline 部分为占位 / 未入库，跑会全失败阻塞 e2e gate）
// 只有 PLAYWRIGHT_VISUAL=1 env 触发才注册（与 npm scripts `test:visual` / `test:visual:update` 配合）
// 双重防御：(1) npm `test:e2e` 显式列 4 个 e2e projects 不含 admin-visual
//          (2) 本 env gate 防 `npx playwright test` 默认拉 admin-visual
const VISUAL_ENABLED = process.env.PLAYWRIGHT_VISUAL === '1'

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
    // ── 后台（server:3001） ─────────────────────────────────────────
    {
      name: 'admin-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
      testMatch: ADMIN_SPECS,
    },
    // ── 后台 server-next（server-next:3003） ────────────────────────
    {
      name: 'admin-next-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_NEXT_URL },
      testMatch: ADMIN_NEXT_SPECS,
    },
    // ── 前台（web-next:3000） —— CUTOVER 后唯一前端 ─────────────────
    {
      name: 'web-chromium',
      testDir: './tests/e2e-next',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
    {
      name: 'web-mobile',
      testDir: './tests/e2e-next',
      use: { ...devices['iPhone 14'], baseURL: WEB_URL },
    },
    // ── admin-visual project (ADR-116 / CHG-SN-5-PRE-01-E-1) ─────────────
    // Playwright visual baseline 跑 admin-ui 5 件下沉组件 ~12 状态 + moderation 7 张整页
    // 复用 admin-next-chromium 的 webServer 条目（server-next dev :3003），不新增 webServer
    // **默认不注册**（baseline 未入库会全失败阻塞 e2e gate）；用 `npm run test:visual` 或
    // `PLAYWRIGHT_VISUAL=1 npx playwright test` 触发
    ...(VISUAL_ENABLED ? [{
      name: 'admin-visual',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_NEXT_URL },
      testDir: ADMIN_VISUAL_TEST_DIR,
      testMatch: ADMIN_VISUAL_TEST_MATCH,
      expect: {
        // v1 经验初始容差（ADR-116 §2.5 / Y-3 修订）；PRE-01-E-2 真截图入库后据实际 flaky 率调整
        // maxDiffPixelRatio: 2% 像素差异容忍（防抗锯齿 flake）
        // threshold: 10% per-pixel 颜色差异容忍（catches color regression，比 20% 严）
        toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.1 },
      },
    }] : []),
  ],

  webServer: [
    {
      command: 'npm --workspace @resovo/server run dev',
      url: `${ADMIN_URL}/admin`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'npm --workspace @resovo/server-next run dev',
      url: `${ADMIN_NEXT_URL}/admin`,
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      // CUTOVER：web-next 是唯一前台，port 3000
      command: 'npm --workspace @resovo/web-next run dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
})
