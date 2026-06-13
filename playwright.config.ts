import { defineConfig, devices } from '@playwright/test'

// CUTOVER（2026-04-23）：apps/web 退役，apps/web-next 升为对外入口 port 3000
// CUTOVER（CHG-CUTOVER-EXECUTE 2026-06-08）：apps/server v1 退役，admin-chromium project + admin webServer 移除，
// 后台 E2E 仅余 server-next（admin-next-chromium :3003）。
const WEB_URL        = process.env.NEXT_PUBLIC_APP_URL  ?? 'http://localhost:3000'
const ADMIN_NEXT_URL = process.env.ADMIN_NEXT_APP_URL   ?? 'http://localhost:3003'

// server-next 后台 E2E（apps/server-next:3003）
const ADMIN_NEXT_SPECS = ['**/e2e/admin/**/*.spec.ts']
// web-mobile 移动专属 specs（ADR-180 D-180-4 / CHG-TEST-SLIM-C）：
// 移动断言的上下文自带（browser.newContext({...MOBILE}) / test.use({ viewport, hasTouch, isMobile })），
// 不依赖本 project 的 iPhone 14 device；其余 16 个 e2e-next spec 不创建移动上下文，
// 在 web-chromium 已有等价覆盖（iPhone 14 下复跑边际覆盖≈0）。保留 3 spec 子集 = 冗余防御 + 显式移动入口。
const WEB_MOBILE_SPECS = [
  '**/e2e-next/mobile-tabbar.spec.ts',
  '**/e2e-next/edge-swipe-back.spec.ts',
  '**/e2e-next/mini-player.spec.ts',
]
// 按需启动 webServer（ADR-180 D-180-3 实施校准）：域选跑脚本（test:e2e:<domain>）通过
// PLAYWRIGHT_SERVERS=admin-next,web 子集只起所需 dev server；默认（未设置）全起，
// `npm run test:e2e` 全量行为零变化。（CHG-CUTOVER-EXECUTE：'admin' 已随 apps/server 退役移除）
const SERVERS = (process.env.PLAYWRIGHT_SERVERS ?? 'admin-next,web').split(',').map((s) => s.trim())
// ── admin-visual project (ADR-116 / CHG-SN-5-PRE-01-E-1) ──────────────────
// 隔离 testDir + testMatch，不与上述 e2e specs 混跑
const ADMIN_VISUAL_TEST_DIR = './tests/visual'
const ADMIN_VISUAL_TEST_MATCH = '**/*.visual.spec.ts'
// admin-visual 默认**不**加入 projects 数组（baseline 部分为占位 / 未入库，跑会全失败阻塞 e2e gate）
// 只有 PLAYWRIGHT_VISUAL=1 env 触发才注册（与 npm scripts `test:visual` / `test:visual:update` 配合）
// 双重防御：(1) npm `test:e2e` 显式列 4 个 e2e projects 不含 admin-visual
//          (2) 本 env gate 防 `npx playwright test` 默认拉 admin-visual
const VISUAL_ENABLED = process.env.PLAYWRIGHT_VISUAL === '1'

// CHORE-E2E-WATCH-SSR-SEED：watch 页 SSR `fetchVideoDetail` 直连 api，player 域 spec 引用视频须
// 真实存在于 DB（公开可见）SSR 才不 404。seed 集仅供 player 域（player/tri-state/option-tabs/
// cinema/mini-player/card），故**仅 test:e2e:player 显式 `E2E_SEED_WATCH=1` 时启用**——避免污染
// 共享 DB 上的 detail/video/search/browse 等其他 web 域 spec（它们与 player 共用 shortId 或依赖
// 列表数据；全局 seed 会让其 SSR 命中 seed 视频或列表多出 5 条 → 误失败）。Codex 复审拦截项。
const WEB_SEED_ENABLED = SERVERS.includes('web') && process.env.E2E_SEED_WATCH === '1'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: WEB_SEED_ENABLED ? './tests/e2e-next/_seed/global-setup.ts' : undefined,
  globalTeardown: WEB_SEED_ENABLED ? './tests/e2e-next/_seed/global-teardown.ts' : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // 本地并发封顶（CHORE-TEST-CPU-CONCURRENCY）：Apple Silicon（如 M2 4P+4E）上 worker=undefined
  // 默认取逻辑核半数，叠加 3 个 dev server + 每 worker 一个 Chromium 后会把 E 核也占满，
  // 抢占 macOS 偏好跑 E 核的 UI/后台 → 系统总占用未满却卡。固定 3 ≈ P 核数-1，占住 P 核、
  // 给 E 核留响应余量；CI 仍 1 不变，CLI `--workers=N` 可覆盖。
  workers: process.env.CI ? 1 : 3,
  reporter: [['html', { open: 'never' }], ['line']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── 后台 server-next（server-next:3003） —— CUTOVER 后唯一后台 ──────
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
      testMatch: WEB_MOBILE_SPECS,
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
    // CHG-E2E-GATE-AUDIT-A：apps/api（:4000）为全部前端域的公共依赖，恒起——
    // 此前缺失使 E2E 隐式依赖外部手动启动的 API（陈旧实例被静默复用 / 缺失时
    // v1+next 双项目大面积超时）。PLAYWRIGHT_SERVERS 语义不变：仅选择前端 server
    // （ADR-180 D-180-3「只起所需」针对前端 dev server；API 是公共底座）。
    // reuseExistingServer 保留本地手动实例复用（开发迭代体验），CI 强制 fresh。
    {
      command: 'npm --workspace @resovo/api run dev',
      url: 'http://localhost:4000/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    ...(SERVERS.includes('admin-next') ? [{
      command: 'npm --workspace @resovo/server-next run dev',
      url: `${ADMIN_NEXT_URL}/admin`,
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    }] : []),
    ...(SERVERS.includes('web') ? [{
      // CUTOVER：web-next 是唯一前台，port 3000
      command: 'npm --workspace @resovo/web-next run dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }] : []),
  ],
})
