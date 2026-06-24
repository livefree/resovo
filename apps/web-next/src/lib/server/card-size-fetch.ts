/**
 * card-size-fetch.ts — 前台卡片尺寸体系 server-only 取数 + :root CSS 变量生成（ADR-214 D-214-6 + Amendment A2）
 *
 * Server-only：经公开 `GET /card-sizes`（无鉴权只读，DB 单真源 card_size_settings）取单行全局配置，
 * 供 `[locale]/layout.tsx` 在 SSR 阶段注入 `:root` CSS 变量，消除 FOUC/CLS。
 * **禁止在客户端组件导入**（顶层引 logger.server + 走 server fetch，仿 video-detail.ts server fetch 范式）。
 *
 * 新鲜度有界（D-214-9 / Codex-R3）：`next.revalidate = 60s`——卡片尺寸低频改 + API 侧已有 Redis 缓存，
 *   短 revalidate 压力可忽略；admin PUT 改后 SSR 渲染页陈旧上界 ≤ 60s（不再「max-age 无界陈旧」）。
 * 失败降级（D-214-6）：取数异常 / 非 2xx / 空 data → CARD_SIZE_DEFAULTS 兜底
 *   （**非空 catch + 结构化 warn**，CLAUDE.md 禁空 catch），首屏永远有可渲染变量、不裸奔。
 *
 * CSS 变量契约（Amendment A2 D-214-A2-1/7，单一全局卡宽）：
 *   - `--card-w: {cardWidthPx}px` — 全站统一卡片宽度（网格 + 横滚共用）
 *   - `--card-gap: {gapPx}px` — 全站统一卡间距
 * 下游 CardGrid（auto-fill 消费 --card-w）/ ScrollRow / Shelf / TopTenRow / DailyAnimeRow 横滚区共用 --card-w。
 */

import {
  CARD_SIZE_CLASSES,
  CARD_SIZE_DEFAULTS,
  type CardSizeSettings,
} from '@resovo/types'
import { serverLogger } from '../logger.server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

/** SSR 取数新鲜度上界（秒，D-214-9 / Codex-R3：admin 改后 SSR 陈旧 ≤ 此值）。 */
export const CARD_SIZE_REVALIDATE_SECONDS = 60

interface CardSizesResponse {
  data?: CardSizeSettings[]
}

/** CARD_SIZE_DEFAULTS（Record）→ CardSizeSettings[]（降级合成行，A2 单行全局）。 */
function defaultsAsSettings(): CardSizeSettings[] {
  return CARD_SIZE_CLASSES.map((sizeClass) => ({
    id: `default-${sizeClass}`,
    sizeClass,
    cardWidthPx: CARD_SIZE_DEFAULTS[sizeClass].cardWidthPx,
    gapPx: CARD_SIZE_DEFAULTS[sizeClass].gapPx,
    settings: {},
    updatedAt: new Date(0).toISOString(),
  }))
}

/**
 * server-only 取卡片尺寸全局配置（`GET /card-sizes`，revalidate 60s）。
 * 失败（网络异常 / 非 2xx / 空 data）→ CARD_SIZE_DEFAULTS 降级（warn 不上抛，D-214-6）。
 */
export async function fetchCardSizeSettings(): Promise<CardSizeSettings[]> {
  try {
    const res = await fetch(`${API_BASE}/card-sizes`, {
      next: { revalidate: CARD_SIZE_REVALIDATE_SECONDS },
    })
    if (!res.ok) {
      serverLogger.warn(
        { status: res.status },
        '[card-size-fetch] GET /card-sizes 非 2xx，降级 CARD_SIZE_DEFAULTS（D-214-6）',
      )
      return defaultsAsSettings()
    }
    const body = (await res.json()) as CardSizesResponse
    if (!body.data || body.data.length === 0) {
      serverLogger.warn(
        {},
        '[card-size-fetch] GET /card-sizes 返回空 data，降级 CARD_SIZE_DEFAULTS（D-214-6）',
      )
      return defaultsAsSettings()
    }
    return body.data
  } catch (err) {
    serverLogger.warn(
      { err },
      '[card-size-fetch] GET /card-sizes 取数异常，降级 CARD_SIZE_DEFAULTS（D-214-6）',
    )
    return defaultsAsSettings()
  }
}

/**
 * 单行全局 → `:root` CSS 变量声明片段（Amendment A2 D-214-A2-1/7：单一全局卡宽，无档位后缀）。
 * 值强制 `Number` → 杜绝 SSR 注入风险（buildCardSizeRootCss 经 dangerouslySetInnerHTML 消费）。
 *   `--card-w: {cardWidthPx}px`（cardWidthPx 非空时；DB NOT NULL 保证）+ `--card-gap: {gapPx}px`
 */
function declarationsFor(row: CardSizeSettings): string[] {
  const decls: string[] = []
  if (row.cardWidthPx != null) {
    decls.push(`--card-w: ${Number(row.cardWidthPx)}px`)
  }
  decls.push(`--card-gap: ${Number(row.gapPx)}px`)
  return decls
}

/**
 * 单行全局 → 完整 `:root{...}` CSS 文本（供 layout.tsx `<style>` SSR 注入）。
 * 纯函数（无 server 依赖），便于单测断言变量集。
 */
export function buildCardSizeRootCss(settings: CardSizeSettings[]): string {
  const body = settings.flatMap(declarationsFor).join('; ')
  return `:root{${body}}`
}
