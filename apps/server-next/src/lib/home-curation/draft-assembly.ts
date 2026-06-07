/**
 * draft-assembly.ts — 首次编辑惰性建稿的整页装配（CHG-HOME-DRAFT-PUBLISH-B-FIX / ADR-185 D-185-2.1）
 *
 * publish 为三表**全量替换**：装配缺行 = 发布即删行。Codex stop-time review
 * 命中原单页装配（limit 100）在存量 > 100 时的静默截断 → 改分页聚合至 total，
 * 任何不完整/超上限路径**显式失败**（宁可建稿失败，不可静默截断）。
 *
 * 上限与 HomePageConfigSchema（卡 24 zod）同源：modules ≤ 500 / banners ≤ 100
 * ——超限本就会被 PUT 422 拒收，此处前移为可读错误。
 */

import { listBanners } from '@/lib/banners/api'
import { listHomeModules } from '@/lib/home-modules/api'
import { listHomeSections } from './api'
import type { HomePageConfig } from './types'

/** 单页页宽 = 两列表路由 limit 上限（ListSchema / banners 路由均 max 100） */
const PAGE_LIMIT = 100
/** HomePageConfigSchema 同源上限（packages 侧 zod；扩值必须同卡同步） */
const MAX_MODULES = 500
const MAX_BANNERS = 100

async function fetchAllPages<T>(
  label: string,
  max: number,
  fetchPage: (page: number) => Promise<{ rows: readonly T[]; total: number }>,
): Promise<T[]> {
  const rows: T[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY
  while (rows.length < total) {
    const result = await fetchPage(page)
    total = result.total
    if (result.rows.length === 0) break // 防御：空页提前终止（与 total 不符走下方硬校验）
    rows.push(...result.rows)
    if (rows.length > max) {
      throw new Error(`${label}条目数（>${max}）超出整页装配上限，无法安全建稿（发布为全量替换，缺行即删行）`)
    }
    page += 1
  }
  // 完整性硬校验：聚合数 < total（并发删改 / 服务端异常）→ 显式失败重试
  if (rows.length < total) {
    throw new Error(`${label}装配不完整（${rows.length}/${total}），请重试建稿`)
  }
  return rows
}

/**
 * 三真源装配整页 config（首次编辑底座）：
 * modules **全量含 banner-slot 冻结存量**——publish 全量替换语义下缺装配即被删除。
 */
export async function assembleBaseConfig(): Promise<HomePageConfig> {
  const [banners, modules, sections] = await Promise.all([
    fetchAllPages('Banner ', MAX_BANNERS, async (page) => {
      const result = await listBanners({ page, limit: PAGE_LIMIT })
      return { rows: result.data, total: result.pagination.total }
    }),
    fetchAllPages('运营位模块', MAX_MODULES, async (page) => {
      const result = await listHomeModules({ page, limit: PAGE_LIMIT })
      return { rows: result.data, total: result.total }
    }),
    listHomeSections(),
  ])
  return {
    banners,
    modules,
    settings: sections.map((s) => s.settings),
  }
}
