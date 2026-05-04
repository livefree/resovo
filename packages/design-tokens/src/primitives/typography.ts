export const typography = {
  /**
   * fontSize（CHG-UX2-01 / SEQ-20260505-01 对齐设计稿 `tokens.css` --fs-* 序列）
   *
   * 设计稿真源：`docs/designs/backend_design_v2.1/styles/tokens.css` line 56-58
   *   `--fs-11/12/13/14/15/16/18/20/24/28/32`
   *
   * 校准与新增（CHG-UX2-01）：
   *   - 新增 4 档：2xs(10) / xxs(11=fs-11) / sm-tight(13=fs-13) / sm-loose(15=fs-15)
   *   - 校准 2 档：3xl 1.875rem(30) → 1.75rem(28=fs-28) / 4xl 2.25rem(36) → 2rem(32=fs-32)
   *   - 不变 6 档：xs(12) / sm(14) / base(16) / lg(18) / xl(20) / 2xl(24)
   *   - 保留 1 档：5xl(48)（设计稿无但 hero 场景预留）
   *
   * 向后兼容：
   *   - 既有 6 个抽象 key 数值零变化
   *   - 业务层 0 处直接消费 var(--font-size-3xl/4xl)（grep 验证），3xl/4xl 校准安全
   */
  fontSize: {
    '2xs':       '0.625rem',   // 10px — 新增（业务最小裸值，TabLines / VideoListClient meta）
    xxs:         '0.6875rem',  // 11px — 新增（设计 --fs-11；count badge / meta info）
    xs:          '0.75rem',    // 12px ✓ 设计 --fs-12
    'sm-tight':  '0.8125rem',  // 13px — 新增（设计 --fs-13；37 处业务 inline 在用）
    sm:          '0.875rem',   // 14px ✓ 设计 --fs-14（默认 body）
    'sm-loose':  '0.9375rem',  // 15px — 新增（设计 --fs-15；5 处业务 inline 在用）
    base:        '1rem',       // 16px ✓ 设计 --fs-16
    lg:          '1.125rem',   // 18px ✓ 设计 --fs-18
    xl:          '1.25rem',    // 20px ✓ 设计 --fs-20
    '2xl':       '1.5rem',     // 24px ✓ 设计 --fs-24
    '3xl':       '1.75rem',    // 28px — 校准 30 → 28（对齐设计 --fs-28）
    '4xl':       '2rem',       // 32px — 校准 36 → 32（对齐设计 --fs-32）
    '5xl':       '3rem',       // 48px ✓ 保留（设计稿无但 hero 场景预留）
  },
  lineHeight: {
    tight: '1.15',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.65',
    loose: '1.85',
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  fontFamily: {
    // CHORE-08 (2026-04-22): 字体族决策 Noto Sans + Noto Sans SC
    // 前两项 CSS var 由 next/font/google 在 apps/web-next root layout 注入；
    // 后续 system fallback 保证加载中与非 web-next 消费者（apps/server / apps/web）
    // 也有合理字体栈。
    sans: "var(--font-noto-sans), var(--font-noto-sans-sc), 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  },
} as const

export type TypographyToken = typeof typography
export type FontSizeStep = keyof TypographyToken['fontSize']
export type LineHeightStep = keyof TypographyToken['lineHeight']
export type FontWeightStep = keyof TypographyToken['fontWeight']
export type FontFamilyStep = keyof TypographyToken['fontFamily']
