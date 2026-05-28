/**
 * line-display-name.ts — 播放线路显示名归一化
 * 目标：将 subyun / 线路2 等技术名转换为用户可读文案。
 */

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sub[\s_-]*yun|sub云/i, label: 'SUB云' },
  { pattern: /ali[\s_-]*yun|aliyun/i, label: '阿里云' },
  { pattern: /tx[\s_-]*yun|tencent/i, label: '腾讯云' },
  { pattern: /quark/i, label: '夸克云' },
  { pattern: /bili|bilibili/i, label: '哔哩源' },
  { pattern: /bfzy|bfzym3u8|暴风/i, label: '暴风资源' },
  { pattern: /1080zyk|1080p?zy/i, label: '1080P资源' },
  { pattern: /lzzy|量子/i, label: '量子资源' },
  { pattern: /jyzy|金鹰/i, label: '金鹰资源' },
  { pattern: /wolongzy|卧龙/i, label: '卧龙资源' },
  { pattern: /subo|速播/i, label: '速播资源' },
  { pattern: /modu|魔都/i, label: '魔都资源' },
  { pattern: /youzzy|优质/i, label: '优质资源' },
]

const GENERIC_LINE_PATTERN = /^(line|线路|默认线路|备用线路|备用|route|source)\s*([0-9]+)?$/i

function toAlphaIndex(index: number): string {
  let n = Math.max(0, index)
  let output = ''
  do {
    output = String.fromCharCode(65 + (n % 26)) + output
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return output
}

function parseLineOrdinal(raw: string): number | null {
  const direct = raw.match(/(?:line|线路|route|备用)\s*([0-9]+)/i)
  if (!direct) return null
  const n = Number.parseInt(direct[1], 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n - 1
}

export function normalizeProviderName(rawName: string | null | undefined): string | null {
  const raw = rawName?.trim()
  if (!raw) return null

  for (const { pattern, label } of PROVIDER_PATTERNS) {
    if (pattern.test(raw)) return label
  }

  if (GENERIC_LINE_PATTERN.test(raw)) return null
  return raw
}

export function buildLineDisplayName(input: {
  rawName?: string | null
  siteDisplayName?: string | null
  fallbackIndex: number
  quality?: string | null
}): string {
  const provider = input.siteDisplayName?.trim()
    ? input.siteDisplayName.trim()
    : normalizeProviderName(input.rawName)
  const base = provider ?? `线路${toAlphaIndex(parseLineOrdinal(input.rawName?.trim() ?? '') ?? input.fallbackIndex)}`
  const quality = input.quality?.trim()
  if (quality) return `${base} · ${quality}`
  return base
}

export function resolveSourceDisplayName(
  siteDisplayName: string | null | undefined,
  sourceName: string | null | undefined,
): string {
  if (siteDisplayName?.trim()) return siteDisplayName.trim()
  return normalizeProviderName(sourceName) ?? '未知线路'
}

export function deduplicateLabels<T extends { label: string }>(items: T[]): T[] {
  const counts = new Map<string, number>()
  const seen = new Map<string, number>()
  for (const it of items) counts.set(it.label, (counts.get(it.label) ?? 0) + 1)
  return items.map((it) => {
    if ((counts.get(it.label) ?? 1) <= 1) return it
    const n = (seen.get(it.label) ?? 0) + 1
    seen.set(it.label, n)
    return { ...it, label: `${it.label}-${n}` }
  })
}

// ── CHG-353 / route-labeling Phase 1 Layer C：主题标签系统 ────────────
// 真源：docs/designs/route-labeling-system.md §Layer C / docs/manual/route-labeling.md
// arch-reviewer (CHG-352 I3) advisory：pending 行加单独标记（"检测中"）防"未知>已知差"困惑

export interface RouteTheme {
  /** 主题标识（i18n key 或英文名）*/
  readonly id: string
  /** 主题展示名（i18n 当前语言）*/
  readonly displayName: string
  /** 标签列表（按线路索引 0..N 映射）*/
  readonly labels: readonly string[]
  /** dead 线路文案 */
  readonly deadLabel: string
  /** 超主题长度时 fallback 文案前缀（如 "线路" / "Route "）*/
  readonly fallbackPrefix: string
}

// 5 主题常量（设计稿 §Layer C 预置主题）

export const THEME_JIE_QI: RouteTheme = {
  id: 'jie_qi',
  displayName: '节气',
  labels: [
    '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
    '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
  ],
  deadLabel: '已断',
  fallbackPrefix: '线路',
}

export const THEME_NATO: RouteTheme = {
  id: 'nato',
  displayName: 'NATO Phonetic',
  labels: [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
    'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima',
    'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
    'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray',
    'Yankee', 'Zulu',
  ],
  deadLabel: 'Offline',
  fallbackPrefix: 'Route ',
}

export const THEME_NUMBERS: RouteTheme = {
  id: 'numbers',
  displayName: '数字',
  labels: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
  deadLabel: '断',
  fallbackPrefix: '线路',
}

export const THEME_PLANETS: RouteTheme = {
  id: 'planets',
  displayName: 'Planets',
  labels: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  deadLabel: 'Dark',
  fallbackPrefix: 'Route ',
}

export const THEME_COLORS: RouteTheme = {
  id: 'colors',
  displayName: 'Colors',
  labels: ['Crimson', 'Amber', 'Jade', 'Azure', 'Indigo', 'Violet', 'Onyx', 'Pearl'],
  deadLabel: 'Dim',
  fallbackPrefix: 'Route ',
}

export const ALL_THEMES: readonly RouteTheme[] = [
  THEME_JIE_QI, THEME_NATO, THEME_NUMBERS, THEME_PLANETS, THEME_COLORS,
]

/** 按 locale 选默认主题：zh-CN → 节气 / en + 其他 → NATO Phonetic */
export function getDefaultTheme(locale: string): RouteTheme {
  if (locale.toLowerCase().startsWith('zh')) return THEME_JIE_QI
  return THEME_NATO
}

/**
 * 应用主题标签到已排序的线路列表
 *
 * 规则（设计稿 §Layer C）：
 *   - index < theme.labels.length → theme.labels[index]
 *   - index >= theme.labels.length → `${fallbackPrefix}${index+1}` fallback
 *   - effectiveScore 极低（< DEAD_THRESHOLD）→ deadLabel
 *
 * 边界（消费方 SourceBar 处理）：
 *   - 0 条 → 不渲染（caller 处理）
 *   - 1 条 → 不显标签（仅画质 / caller 处理）
 *   - 全 dead → 所有按钮置灰 + deadLabel（本函数处理）
 *
 * @param routes 已按 effective_score 降序的线路列表（含 effectiveScore + quality）
 * @param theme 主题
 * @returns 含主题标签的线路数组（保持输入顺序）
 */
export interface ThemedRouteInput {
  readonly effectiveScore?: number
  readonly quality?: string | null
}

export interface ThemedRouteOutput {
  /** 主题标签（含 dead / fallback 处理）*/
  readonly themeLabel: string
  /** 是否判定为 dead（应渲染置灰）*/
  readonly isDead: boolean
  /** 是否是 fallback（超主题长度）*/
  readonly isFallback: boolean
  /** 是否是 pending（中性状态，建议加"检测中"标记 / CHG-352 I3 advisory）*/
  readonly isPending: boolean
}

/** dead 判定阈值（effectiveScore < 此值视为 dead）
 *  数学校准：全 dead 线路最高分（dead+4K+fast）= 0.45 — 用 0.1 不会误判
 *  全 dead+240P+slow = 0.030（min）— 0.1 阈值能覆盖
 *  全 dead+1080P+200ms = 0 + 0.21 + 0.15 + 0 = 0.36 — 不被覆盖（advisory：Phase 2 暴露 isDead 字段）
 *  Phase 1 简化：仅明显 dead 走此判定；后续 Phase 2 后端 SourceService 派生 isDead 字段更精准 */
const DEAD_THRESHOLD = 0.1
/** pending 判定阈值范围：中性 score ≈ 0.345（CHG-352 校准）
 *  pending heuristic：0.30 ≤ effectiveScore < 0.40 → 视为中性 pending */
const PENDING_MIN = 0.3
const PENDING_MAX = 0.4

export function applyThemeLabels(
  routes: ReadonlyArray<ThemedRouteInput>,
  theme: RouteTheme,
): ThemedRouteOutput[] {
  return routes.map((route, index) => {
    const score = route.effectiveScore ?? 0
    const isDead = score > 0 && score < DEAD_THRESHOLD
    const isPending = score >= PENDING_MIN && score < PENDING_MAX
    const isFallback = index >= theme.labels.length

    if (isDead) {
      return { themeLabel: theme.deadLabel, isDead: true, isFallback: false, isPending: false }
    }

    const themeLabel = isFallback
      ? `${theme.fallbackPrefix}${index + 1}`
      : theme.labels[index]

    return { themeLabel, isDead: false, isFallback, isPending }
  })
}

// ── CHG-369 / Codex stop-time review #11：原始 VideoSource → themed sources 派生 ──
// 抽自 PlayerShell.tsx 内联 helper，目的是支持主题切换时对已加载 sources 重新 relabel
// （详 CHG-369 commit + Codex #11 fix）。三处复用：初始 fetch / 集数切换 fetch / 主题切换 effect。

/** ThemedSource — 渲染层 source 形态（PlayerShell sources state element） */
export interface ThemedSource {
  readonly src: string
  readonly type: string
  readonly label?: string
  readonly quality?: string | null
  readonly isDead?: boolean
  readonly isPending?: boolean
}

/** RawSourceForTheme — buildThemedSources 输入需要的 VideoSource 字段子集 */
export interface RawSourceForTheme {
  readonly sourceUrl: string
  readonly type: string
  readonly sourceName: string
  readonly siteDisplayName: string | null
  readonly quality: string | null
  readonly effectiveScore?: number
}

/**
 * 跨集数稳定匹配 activeSourceIndex（CHG-369 / Codex stop-time review #13 + #14）
 *
 * 集数切换时保持"同一线路"语义；用 raw source 的稳定 key 而非 label 匹配
 * （label 是主题派生不稳定 — 主题切换会改写 / 闭包会 stale）。
 *
 * 匹配优先级（Codex #14：sourceName-only 在多站点同名时可能切错源 → 升级复合匹配）：
 *   1. `(siteDisplayName, sourceName)` 复合精确命中
 *   2. siteDisplayName 缺失 / 复合无命中时 → 单 sourceName 兜底（兼容历史 null siteDisplayName）
 *   3. 找不到 → fallback 0（第一条）
 *
 * @param prevRawSources 上一集的原始 sources 数组
 * @param prevIndex 上一集的 activeSourceIndex
 * @param newRawSources 新集数的原始 sources 数组
 * @returns 匹配到的 newRawSources 中的位置；找不到时 0
 */
export function matchActiveSourceIndex(
  prevRawSources: ReadonlyArray<RawSourceForTheme>,
  prevIndex: number,
  newRawSources: ReadonlyArray<RawSourceForTheme>,
): number {
  const prev = prevRawSources[prevIndex]
  if (!prev) return 0
  const prevName = prev.sourceName
  const prevSite = prev.siteDisplayName
  if (!prevName) return 0

  // 优先级 1：复合 (siteDisplayName, sourceName) 命中（防多站点同名误切）
  if (prevSite !== null) {
    const exact = newRawSources.findIndex(
      (s) => s.siteDisplayName === prevSite && s.sourceName === prevName,
    )
    if (exact >= 0) return exact
  }

  // 优先级 2：单 sourceName 兜底（兼容历史 siteDisplayName=null / 新数组未配 site_display_name）
  const byName = newRawSources.findIndex((s) => s.sourceName === prevName)
  return byName >= 0 ? byName : 0
}

/**
 * 把原始 sources 数组按当前主题派生为 ThemedSource[]
 * - effectiveScore 存在 → applyThemeLabels 输出主题标签
 * - effectiveScore 缺失（老后端兜底）→ buildLineDisplayName fallback
 * - 输出经 deduplicateLabels 去重（同名加 -1/-2 后缀）
 */
export function buildThemedSources(
  raw: ReadonlyArray<RawSourceForTheme>,
  theme: RouteTheme,
): ThemedSource[] {
  const themed = applyThemeLabels(
    raw.map((s) => ({ effectiveScore: s.effectiveScore, quality: s.quality })),
    theme,
  )
  return deduplicateLabels(
    raw.map((s, index) => ({
      src: s.sourceUrl,
      type: s.type,
      label: s.effectiveScore !== undefined
        ? themed[index].themeLabel
        : buildLineDisplayName({
            rawName: s.sourceName,
            siteDisplayName: s.siteDisplayName,
            fallbackIndex: index,
            quality: s.quality,
          }),
      quality: s.quality,
      isDead: themed[index].isDead,
      isPending: themed[index].isPending,
    })),
  )
}
