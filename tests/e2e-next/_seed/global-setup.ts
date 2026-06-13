/**
 * tests/e2e-next/_seed/global-setup.ts — CHORE-E2E-WATCH-SSR-SEED
 *
 * Playwright globalSetup（仅 web 域启用，见 playwright.config.ts）：
 * watch 页 SSR `fetchVideoDetail` 直连 api，故 spec 引用视频须真实存在于 DB。
 * 直连 pg 落库固定 seed 集（幂等），不依赖 api server 是否已启动（Postgres 独立）。
 */
import { seedE2eWatchVideos } from './db'

export default async function globalSetup(): Promise<void> {
  await seedE2eWatchVideos()
}
