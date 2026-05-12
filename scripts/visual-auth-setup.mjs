#!/usr/bin/env node
/**
 * scripts/visual-auth-setup.mjs — Playwright admin storageState 一次性生成器
 *
 * 真源：ADR-116 §2.7 Y-2 前置数据协议（CHG-SN-5-PRE-01-F）
 *
 * 用途：替代 `playwright codegen --save-storage`（codegen 浏览器扩展会注入
 * `data-pw-cursor` 属性触发 Next.js hydration mismatch warning，且 codegen
 * 录制 UI 干扰登录流程）。本脚本启一个纯净 Playwright Chromium，user 手动
 * 登录，自动捕获 storageState 入库 `tests/visual/.auth/admin.json`。
 *
 * 使用：
 *   1. 启 server-next dev（**不带** NEXT_PUBLIC_ASSET_PREFIX，否则 /login 资源 404）：
 *      `NEXT_PUBLIC_ASSET_PREFIX="" npm --workspace @resovo/server-next run dev`
 *   2. 跑本脚本：
 *      `node scripts/visual-auth-setup.mjs`
 *   3. 浏览器自动打开 /login，手动输入 admin 凭据登录
 *   4. 登录后被 redirect 到 /admin/* 时脚本自动捕获 cookies，关闭浏览器
 *   5. storageState 入库 tests/visual/.auth/admin.json（git ignored）
 *
 * 之后跑 visual baseline 即可：
 *   `npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts`
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const LOGIN_URL = process.env.LOGIN_URL ?? 'http://localhost:3003/login'
const STORAGE_PATH = resolve(process.cwd(), 'tests/visual/.auth/admin.json')

async function main() {
  mkdirSync(dirname(STORAGE_PATH), { recursive: true })

  console.log(`[visual-auth-setup] Launching headed Chromium...`)
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  console.log(`[visual-auth-setup] Navigating to ${LOGIN_URL}`)
  await page.goto(LOGIN_URL)

  console.log(`
=============================================================
请在打开的浏览器中：
  1. 手动登录 admin 账号
  2. 登录成功后浏览器会自动跳转到 /admin/* 路径
  3. 脚本检测到 URL 跳出 /login 后自动保存 storageState

如登录失败：
  - 检查 server-next dev 是否启动（http://localhost:3003）
  - 检查 .env.local NEXT_PUBLIC_ASSET_PREFIX 是否设为空（/login 路径不应带 /admin 前缀）
  - 检查 dev DB 是否有可用 admin 账号
=============================================================
`)

  // 等待 URL 跳出 /login（最多 5 分钟）
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), {
      timeout: 5 * 60 * 1000,
    })
  } catch (err) {
    console.error('[visual-auth-setup] 超时 5 分钟仍在 /login 页面；登录未成功')
    await browser.close()
    process.exit(1)
  }

  console.log(`[visual-auth-setup] 登录成功，捕获 cookies...`)
  await ctx.storageState({ path: STORAGE_PATH })

  console.log(`[visual-auth-setup] ✓ storageState 已保存到 ${STORAGE_PATH}`)
  console.log(`[visual-auth-setup] 该文件已 .gitignore，不会入库`)

  await browser.close()

  console.log(`
=============================================================
下一步：跑 moderation visual baseline 生成（PRE-01-F）
  npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts
=============================================================
`)
}

main().catch((err) => {
  console.error('[visual-auth-setup] error:', err)
  process.exit(1)
})
