/**
 * home-modules/entry.ts — `/admin/home` 批量添加深链构造单一真源（CHG-HOME-UX-08）
 *
 * 仿 lib/merge/entry.ts 模式（CHG-VIR-13-A1 先例）：所有入口必须经由本文件
 * 构造/解析，禁止内联拼接 URL。
 *
 * 参数顺序契约（测试断言锚定，勿调换）：add_ids → from
 * URL 形态：/admin/home?add_ids=<uuid,uuid,...>&from=<source>
 */

// ── 入口来源枚举 ───────────────────────────────────────────────────

export const HOME_ENTRY_SOURCES = ['videos', 'videos-batch'] as const

export type HomeEntrySource = (typeof HOME_ENTRY_SOURCES)[number]

export function isHomeEntrySource(v: string | null | undefined): v is HomeEntrySource {
  return v != null && (HOME_ENTRY_SOURCES as readonly string[]).includes(v)
}

/** 来源回链栏元数据（HomeOpsClient 消费；label/backHref 单一真源在此） */
export const HOME_ENTRY_SOURCE_META: Record<
  HomeEntrySource,
  { readonly label: string; readonly backHref: string; readonly backLabel: string }
> = {
  videos: { label: '来自视频库', backHref: '/admin/videos', backLabel: '返回视频库' },
  'videos-batch': { label: '来自视频库批量操作', backHref: '/admin/videos', backLabel: '返回视频库' },
}

// ── 深链形态 ───────────────────────────────────────────────────────

export interface HomeAddEntry {
  readonly ids: readonly string[]
  readonly from: HomeEntrySource
}

/** 统一构造 /admin/home 批量添加深链（所有入口必须经由本函数） */
export function buildHomeAddHref(entry: HomeAddEntry): string {
  const qs = new URLSearchParams()
  qs.set('add_ids', entry.ids.join(','))
  qs.set('from', entry.from)
  return `/admin/home?${qs.toString()}`
}

/**
 * 解析深链参数；add_ids 缺失/空、from 非法时返回 null（普通访问零干扰）。
 * ids 去空去重（保持首现顺序）。
 */
export function parseHomeAddEntry(searchParams: URLSearchParams): HomeAddEntry | null {
  const raw = searchParams.get('add_ids')
  const from = searchParams.get('from')
  if (!raw || !isHomeEntrySource(from)) return null
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
  if (ids.length === 0) return null
  return { ids, from }
}
