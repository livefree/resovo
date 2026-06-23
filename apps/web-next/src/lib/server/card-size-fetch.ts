/**
 * card-size-fetch.ts — 前台卡片尺寸体系 server-only 取数 + :root CSS 变量生成（ADR-214 D-214-6）
 *
 * Server-only：经公开 `GET /card-sizes`（无鉴权只读，DB 单真源 card_size_settings）取 3 档配置，
 * 供 `[locale]/layout.tsx` 在 SSR 阶段注入 `:root` CSS 变量，消除 FOUC/CLS。
 * **禁止在客户端组件导入**（顶层引 logger.server + 走 server fetch，仿 video-detail.ts server fetch 范式）。
 *
 * 新鲜度有界（D-214-9 / Codex-R3）：`next.revalidate = 60s`——卡片尺寸低频改 + API 侧已有 Redis 缓存，
 *   短 revalidate 压力可忽略；admin PUT 改后 SSR 渲染页陈旧上界 ≤ 60s（不再「max-age 无界陈旧」）。
 * 失败降级（D-214-6）：取数异常 / 非 2xx / 空 data → CARD_SIZE_DEFAULTS 兜底
 *   （**非空 catch + 结构化 warn**，CLAUDE.md 禁空 catch），首屏永远有可渲染变量、不裸奔。
 *
 * CSS 变量契约（Amendment A1 单位统一为卡宽，按字段非空派生）：
 *   - cardWidthPx 非空（standard size-driven 卡宽 / scroll 横滚定宽）：`--card-w-{class}`（--card-w-standard / --card-w-scroll）
 *   - desktopColumns 非空（可选最大列数护栏，本轮全 null 故不注入）：`--card-cols-{class}-desktop`
 *   - gap：`--card-gap-{class}`
 * 下游 CardGrid（standard ≥1024 auto-fill 消费 --card-w-standard）/ 横滚行消费 --card-w-scroll。
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

/** CARD_SIZE_DEFAULTS（Record）→ CardSizeSettings[]（降级合成行，CardSizeClass 枚举序）。 */
function defaultsAsSettings(): CardSizeSettings[] {
  return CARD_SIZE_CLASSES.map((sizeClass) => ({
    id: `default-${sizeClass}`,
    sizeClass,
    desktopColumns: CARD_SIZE_DEFAULTS[sizeClass].desktopColumns,
    cardWidthPx: CARD_SIZE_DEFAULTS[sizeClass].cardWidthPx,
    gapPx: CARD_SIZE_DEFAULTS[sizeClass].gapPx,
    settings: {},
    updatedAt: new Date(0).toISOString(),
  }))
}

/**
 * server-only 取卡片尺寸 3 档配置（`GET /card-sizes`，revalidate 60s）。
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
 * 单档 → `:root` CSS 变量声明片段（按档位单位派生，可扩展）。
 * 值强制 `Number` → 杜绝 SSR 注入风险（buildCardSizeRootCss 经 dangerouslySetInnerHTML 消费）。
 *   网格档（desktopColumns 非空）：`--card-cols-{class}-desktop` + `--card-gap-{class}`
 *   scroll 档（cardWidthPx 非空）：`--card-w-{class}` + `--card-gap-{class}`
 */
function declarationsFor(row: CardSizeSettings): string[] {
  const decls: string[] = []
  const cls = row.sizeClass
  if (row.desktopColumns != null) {
    decls.push(`--card-cols-${cls}-desktop: ${Number(row.desktopColumns)}`)
  }
  if (row.cardWidthPx != null) {
    decls.push(`--card-w-${cls}: ${Number(row.cardWidthPx)}px`)
  }
  decls.push(`--card-gap-${cls}: ${Number(row.gapPx)}px`)
  return decls
}

/**
 * 3 档 → 完整 `:root{...}` CSS 文本（供 layout.tsx `<style>` SSR 注入）。
 * 纯函数（无 server 依赖），便于单测断言变量集 + 防档位×单位倒置变量。
 */
export function buildCardSizeRootCss(settings: CardSizeSettings[]): string {
  const body = settings.flatMap(declarationsFor).join('; ')
  return `:root{${body}}`
}
