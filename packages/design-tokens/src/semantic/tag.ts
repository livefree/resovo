import { colors } from '../primitives/color.js'

// Tag overlay colors (spec / rating) use glass — not mapped to color primitives
const GLASS_DARK  = 'color-mix(in oklch, oklch(6.5% 0.004 247) 72%, transparent)'
const GLASS_LIGHT = 'color-mix(in oklch, oklch(6.5% 0.004 247) 56%, transparent)'
const WHITE       = 'oklch(100% 0 0)'

export const tag = {
  light: {
    // ── aggregate aliases (kept for backward compat) ──────────────────────
    lifecycleBg:     colors.success.light,
    lifecycleFg:     colors.success.dark,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.light,
    trendingFg:      colors.warning.dark,
    trendingBorder:  colors.warning.base,

    // ── lifecycle sub-types ───────────────────────────────────────────────
    lifecycleNewBg:         colors.success.light,
    lifecycleNewFg:         colors.success.dark,
    lifecycleComingSoonBg:  colors.info.light,
    lifecycleComingSoonFg:  colors.info.dark,
    lifecycleOngoingBg:     colors.success.light,
    lifecycleOngoingFg:     colors.success.dark,
    lifecycleCompletedBg:   'oklch(92.9% 0.006 247)',
    lifecycleCompletedFg:   'oklch(32.8% 0.012 247)',
    lifecycleDelistingBg:   colors.warning.light,
    lifecycleDelistingFg:   colors.warning.dark,

    // ── trending sub-types ────────────────────────────────────────────────
    trendingHotBg:          colors.error.light,
    trendingHotFg:          colors.error.dark,
    trendingWeeklyTopBg:    colors.warning.light,
    trendingWeeklyTopFg:    colors.warning.dark,
    trendingExclusiveBg:    colors.accent[100],
    trendingExclusiveFg:    colors.accent[700],
    trendingEditorPickBg:   colors.info.light,
    trendingEditorPickFg:   colors.info.dark,

    // ── type chips（HANDOFF-07: 覆盖全部 11 种 VideoType，命名对齐项目 VideoType）──
    // 设计稿预设 5 种（movie/series/anime/variety/documentary）
    chipMovieBg:        colors.accent[100],
    chipMovieFg:        colors.accent[700],
    chipSeriesBg:       colors.warning.light,
    chipSeriesFg:       colors.warning.dark,
    chipAnimeBg:        'oklch(91% 0.08 320)',
    chipAnimeFg:        'oklch(40% 0.14 320)',
    chipVarietyBg:      colors.success.light,
    chipVarietyFg:      colors.success.dark,
    chipDocumentaryBg:  colors.gray[200],
    chipDocumentaryFg:  colors.gray[700],
    // 扩展 6 种（short/sports/music/news/kids/other），palette 策略：
    //   - short: accent 浅色变体（与 movie 同色系但更浅，体现"短视频是电影/剧集子类型"语义）
    //   - sports: error 色系（红橙，运动热血联想）
    //   - music: 340° magenta-pink（音乐艺术独立色相）
    //   - news: info 色系（蓝灰，严肃/资讯语义）
    //   - kids: 55° 金黄（比 series 85° 更暖，友好语义；确保色盲可辨）
    //   - other: gray-scale（比 documentary 更浅，与之区分 + 保守兜底）
    chipShortBg:        'oklch(95% 0.03 230)',
    chipShortFg:        'oklch(42% 0.12 230)',
    chipSportsBg:       colors.error.light,
    chipSportsFg:       colors.error.dark,
    chipMusicBg:        'oklch(90% 0.08 340)',
    chipMusicFg:        'oklch(45% 0.14 340)',
    chipNewsBg:         colors.info.light,
    chipNewsFg:         colors.info.dark,
    chipKidsBg:         'oklch(93% 0.09 55)',
    chipKidsFg:         'oklch(45% 0.14 55)',
    chipOtherBg:        colors.gray[100],
    chipOtherFg:        colors.gray[600],

    // ── spec / rating ─────────────────────────────────────────────────────
    specBg:          GLASS_DARK,
    specFg:          WHITE,
    specBorder:      'transparent',
    ratingBg:        GLASS_LIGHT,
    ratingBorder:    'transparent',
    borderRadius:    '4px',
  },
  dark: {
    // ── aggregate aliases (kept for backward compat) ──────────────────────
    lifecycleBg:     colors.success.dark,
    lifecycleFg:     colors.success.light,
    lifecycleBorder: colors.success.base,
    trendingBg:      colors.warning.dark,
    trendingFg:      colors.warning.light,
    trendingBorder:  colors.warning.base,

    // ── lifecycle sub-types ───────────────────────────────────────────────
    lifecycleNewBg:         colors.success.dark,
    lifecycleNewFg:         colors.success.light,
    lifecycleComingSoonBg:  colors.info.dark,
    lifecycleComingSoonFg:  colors.info.light,
    lifecycleOngoingBg:     colors.success.dark,
    lifecycleOngoingFg:     colors.success.light,
    lifecycleCompletedBg:   'oklch(23.0% 0.010 247)',
    lifecycleCompletedFg:   'oklch(70.8% 0.012 247)',
    lifecycleDelistingBg:   colors.warning.dark,
    lifecycleDelistingFg:   colors.warning.light,

    // ── trending sub-types ────────────────────────────────────────────────
    trendingHotBg:          colors.error.dark,
    trendingHotFg:          colors.error.light,
    trendingWeeklyTopBg:    colors.warning.dark,
    trendingWeeklyTopFg:    colors.warning.light,
    trendingExclusiveBg:    colors.accent[900],
    trendingExclusiveFg:    colors.accent[100],
    trendingEditorPickBg:   colors.info.dark,
    trendingEditorPickFg:   colors.info.light,

    // ── type chips（HANDOFF-07: 11 种 VideoType 覆盖，dark 变体）────────────
    chipMovieBg:        colors.accent[900],
    chipMovieFg:        colors.accent[100],
    chipSeriesBg:       colors.warning.dark,
    chipSeriesFg:       colors.warning.light,
    chipAnimeBg:        'oklch(35% 0.12 320)',
    chipAnimeFg:        'oklch(91% 0.08 320)',
    chipVarietyBg:      colors.success.dark,
    chipVarietyFg:      colors.success.light,
    chipDocumentaryBg:  colors.gray[800],
    chipDocumentaryFg:  colors.gray[300],
    chipShortBg:        'oklch(32% 0.10 230)',
    chipShortFg:        'oklch(88% 0.05 230)',
    chipSportsBg:       colors.error.dark,
    chipSportsFg:       colors.error.light,
    chipMusicBg:        'oklch(35% 0.12 340)',
    chipMusicFg:        'oklch(90% 0.08 340)',
    chipNewsBg:         colors.info.dark,
    chipNewsFg:         colors.info.light,
    chipKidsBg:         'oklch(38% 0.11 55)',
    chipKidsFg:         'oklch(93% 0.09 55)',
    chipOtherBg:        colors.gray[800],
    chipOtherFg:        colors.gray[400],

    // ── spec / rating ─────────────────────────────────────────────────────
    specBg:          GLASS_DARK,
    specFg:          WHITE,
    specBorder:      'transparent',
    ratingBg:        GLASS_DARK,
    ratingBorder:    'transparent',
    borderRadius:    '4px',
  },
} as const

export type TagToken = typeof tag.light
export type TagTheme = keyof typeof tag
