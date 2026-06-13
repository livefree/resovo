/**
 * tests/e2e-next/_seed/global-teardown.ts — CHORE-E2E-WATCH-SSR-SEED
 *
 * Playwright globalTeardown：级联清理 watch 页 seed 视频（不污染 resovo_dev）。
 */
import { teardownE2eWatchVideos } from './db'

export default async function globalTeardown(): Promise<void> {
  await teardownE2eWatchVideos()
}
