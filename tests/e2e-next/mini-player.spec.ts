/**
 * tests/e2e-next/mini-player.spec.ts — HANDOFF-03 MiniPlayer 交互补齐 E2E
 *
 * 覆盖：
 *   §1 mini 浮窗注入 → 可见（320×180 默认）
 *   §2 关闭 ✕ 按钮 → MiniPlayer 隐藏
 *   §3 展开按钮 → hostMode='full'（切回主视图）
 *   §4 localStorage 几何持久化（写 localStorage + reload + 读回几何应用）
 *   §5 移动端 @media (hover:none) and (pointer:coarse) → display:none 严格屏蔽
 *   §6 ?_theme=dark query → document.documentElement.dataset.theme === 'dark'（HANDOFF-01 Nit #2）
 *   §7 window.resize 越界 re-snap → corner 重新吸附（resize 到极小视口后断言浮窗仍在视口内）
 *
 * 方案 B 决策：video 跨容器不 reload 验收项留白到 SEQ-202605XX-PLAYER-VIDEO-LIFT（HANDOFF-03 分歧）。
 * 拖拽 / 缩放 / spring 吸附的动效瞬态由 §7 UI 复核 Manual fallback 覆盖。
 */

import { test, expect } from './_fixtures'

const PLAYER_SESSION_KEY = 'resovo:player-host:v1'
const MINI_GEOMETRY_KEY = 'resovo:player-mini-geometry:v1'

interface SessionPlayerV1 {
  v: 1
  hostMode: 'mini' | 'pip'
  shortId: string | null
  currentEpisode: number
  hostOrigin: { href: string; slug: string } | null
}

async function seedMiniMode(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(
    (args) => {
      const [key, payload] = args
      window.sessionStorage.setItem(key, JSON.stringify(payload))
    },
    [
      PLAYER_SESSION_KEY,
      {
        v: 1,
        hostMode: 'mini',
        shortId: 'test-shortid',
        currentEpisode: 1,
        hostOrigin: { href: '/watch/test-slug', slug: 'test-slug' },
      } satisfies SessionPlayerV1,
    ] as const,
  )
  // reload 触发 hydrateFromSession，使 MiniPlayer 渲染
  await page.reload()
}

// ─── §1 注入 + 可见 ──────────────────────────────────────────────
test.describe('MiniPlayer · §1 注入', () => {
  test('sessionStorage 注入 hostMode=mini → MiniPlayer 可见（默认 320×180）', async ({ page }) => {
    await seedMiniMode(page)
    const mini = page.getByTestId('mini-player')
    await expect(mini).toBeVisible({ timeout: 5000 })

    // 初次 mount 用默认几何（±3px 容差兼容边框像素）
    const box = await mini.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(318)
    expect(box!.width).toBeLessThanOrEqual(323)
    expect(box!.height).toBeGreaterThanOrEqual(177)
    expect(box!.height).toBeLessThanOrEqual(183)
  })
})

// ─── §2 关闭按钮 ────────────────────────────────────────────────
// HANDOFF-31：header 默认 opacity:0 + pointer-events:none，需先 hover 使 header 可见
test.describe('MiniPlayer · §2 关闭', () => {
  test('hover → ✕ 按钮点击 → releaseMiniPlayer → MiniPlayer 隐藏', async ({ page }) => {
    await seedMiniMode(page)
    const mini = page.getByTestId('mini-player')
    await expect(mini).toBeVisible()

    // hover 使 header 显现（pointer-events: all）
    await mini.hover()
    await page.getByRole('button', { name: '关闭播放器' }).click()
    await expect(mini).toBeHidden()
  })
})

// ─── §3 折叠/展开（HANDOFF-31 语义变更：展开按钮改为折叠/展开 isExpanded 切换）────
// 产品决策 2026-04-24：原"展开全屏"改为 mini 内部双态；返回全屏由"返回播放页"← 按钮实现
test.describe('MiniPlayer · §3 折叠/展开', () => {
  test('hover → 展开按钮点击 → 控制栏可见，高度增加', async ({ page }) => {
    await seedMiniMode(page)
    const mini = page.getByTestId('mini-player')
    await expect(mini).toBeVisible()

    const boxBefore = await mini.boundingBox()
    expect(boxBefore).not.toBeNull()

    // hover 使 header 可见，点击展开按钮
    await mini.hover()
    await page.getByTestId('mini-player-toggle-expand').click()

    // Expanded 后高度应增加约 44px
    const boxAfter = await mini.boundingBox()
    expect(boxAfter).not.toBeNull()
    expect(boxAfter!.height).toBeGreaterThan(boxBefore!.height + 30)

    // 控制栏中进度条应可见
    await expect(page.getByTestId('mini-player-progress')).toBeVisible()
  })

  test('展开后再次点击折叠 → 高度恢复', async ({ page }) => {
    await seedMiniMode(page)
    const mini = page.getByTestId('mini-player')
    const boxCollapsed = await mini.boundingBox()

    // 展开
    await mini.hover()
    await page.getByTestId('mini-player-toggle-expand').click()
    const boxExpanded = await mini.boundingBox()
    expect(boxExpanded!.height).toBeGreaterThan(boxCollapsed!.height)

    // 折叠
    await page.getByTestId('mini-player-toggle-expand').click()
    const boxBack = await mini.boundingBox()
    expect(boxBack!.height).toBeCloseTo(boxCollapsed!.height, 0)
  })
})

// ─── §4 localStorage 几何持久化 ─────────────────────────────────
test.describe('MiniPlayer · §4 几何持久化', () => {
  test('写 localStorage 几何 + mini 态 reload → 几何应用（非默认 br） + 双向持久化一致', async ({ page }) => {
    await seedMiniMode(page)
    // 模拟用户拖拽后的结果：把几何写到 localStorage（corner=tl，width=360）
    await page.evaluate(
      (args) => {
        const [key, payload] = args
        window.localStorage.setItem(key, JSON.stringify(payload))
      },
      [MINI_GEOMETRY_KEY, { v: 1, width: 360, height: 202, corner: 'tl' }] as const,
    )
    await page.reload()

    const mini = page.getByTestId('mini-player')
    await expect(mini).toBeVisible()
    const box = await mini.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeCloseTo(360, 0)
    // corner=tl 时浮窗左上 ≈ (16, 16)（DOCK_MARGIN=16）
    expect(box!.x).toBeLessThan(40)
    expect(box!.y).toBeLessThan(40)

    // 加分建议 C：reload 后 localStorage 仍含原几何（持久化双向一致，未被意外清除）
    const persisted = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      MINI_GEOMETRY_KEY,
    )
    expect(persisted).not.toBeNull()
    const parsed = JSON.parse(persisted!) as { corner: string; width: number }
    expect(parsed.corner).toBe('tl')
    expect(parsed.width).toBe(360)
  })

  test('损坏的 localStorage 几何 → fallback 到 defaults（读出 null 后用 br+320）', async ({ page }) => {
    await seedMiniMode(page)
    await page.evaluate(
      (args) => {
        const [key, raw] = args
        window.localStorage.setItem(key, raw)
      },
      [MINI_GEOMETRY_KEY, '{corrupted'] as const,
    )
    await page.reload()

    const mini = page.getByTestId('mini-player')
    await expect(mini).toBeVisible()
    const box = await mini.boundingBox()
    // fallback 到默认 corner=br，320×180
    expect(box!.width).toBeCloseTo(320, 0)
  })
})

// ─── §5 移动端屏蔽 ──────────────────────────────────────────────
test.describe('MiniPlayer · §5 移动端严格 display:none（方案 A）', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  })

  test('hover:none + pointer:coarse → MiniPlayer display:none', async ({ page }) => {
    await seedMiniMode(page)

    const mini = page.getByTestId('mini-player')
    // 元素在 DOM 中但 display:none → hidden
    await expect(mini).toBeHidden()
  })
})

// ─── §6 ?_theme= query（HANDOFF-01 Nit #2）─────────────────────
test.describe('?_theme= query · HANDOFF-01 Nit #2', () => {
  test('?_theme=dark → document.documentElement.dataset.theme === dark', async ({ page }) => {
    await page.goto('/?_theme=dark')
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe('dark')
  })

  test('?_theme=light → data-theme=light（覆盖 cookie）', async ({ page }) => {
    await page.context().addCookies([
      { name: 'resovo-theme', value: 'dark', url: 'http://localhost:3002' },
    ])
    await page.goto('/?_theme=light')
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe('light')
  })

  test('?_theme=invalid → 忽略 query，回退 cookie / system 默认', async ({ page }) => {
    await page.goto('/?_theme=rainbow')
    const theme = await page.evaluate(() => document.documentElement.dataset.theme)
    expect(['light', 'dark']).toContain(theme)
  })
})

// ─── §7 window.resize 越界 re-snap ──────────────────────────────
test.describe('MiniPlayer · §7 window.resize 越界 re-snap', () => {
  test('视口缩小到 mini 不足容纳 → 浮窗自动 re-snap 并落在视口内', async ({ page }) => {
    // 先 seed + 预置几何为 corner=tl width=480（最大宽度）
    await page.goto('/')
    await page.evaluate(
      (args) => {
        const [sessionKey, geoKey, session, geo] = args
        window.sessionStorage.setItem(sessionKey, JSON.stringify(session))
        window.localStorage.setItem(geoKey, JSON.stringify(geo))
      },
      [
        PLAYER_SESSION_KEY,
        MINI_GEOMETRY_KEY,
        {
          v: 1,
          hostMode: 'mini',
          shortId: 'test-shortid',
          currentEpisode: 1,
          hostOrigin: { href: '/watch/test-slug', slug: 'test-slug' },
        },
        { v: 1, width: 480, height: 270, corner: 'tl' },
      ] as const,
    )
    await page.reload()
    await expect(page.getByTestId('mini-player')).toBeVisible()

    // 缩到极小视口（600×400），触发 attachViewportResizeWatcher 的 re-snap
    await page.setViewportSize({ width: 600, height: 400 })
    // 等待 rAF
    await page.waitForTimeout(500)

    const box = await page.getByTestId('mini-player').boundingBox()
    expect(box).not.toBeNull()
    // 浮窗应完全在视口内
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(600)
    expect(box!.y + box!.height).toBeLessThanOrEqual(400)
  })
})
