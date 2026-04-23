// 本文件收纳三类静态 CSS 变量（不分 light/dark 主题）：
//   1. semantic layout alias   → --layout-*, --page-*    (spec §4.2 条 2)
//   2. shelf component alias   → --shelf-*               (spec §4.2 条 3，文件收敛见 spec §24.3)
//   3. header/footer alias     → --header-*, --footer-*  (同上)
//
// 分组仅影响 TS 阅读结构；叶子 key 即最终 CSS 变量名（不含 --），
// build-css.ts 直接 `--${key}: value` 输出，不加文件前缀。

export type LayoutGroup = Readonly<Record<string, string>>

export interface LayoutToken {
  container: LayoutGroup
  page: LayoutGroup
  shelf: LayoutGroup
  header: LayoutGroup
  footer: LayoutGroup
}

export const layout: LayoutToken = {
  // ── 容器尺寸（spec §6.1）────────────────────────────────────────
  container: {
    'layout-shell-max':    '1440px',
    'layout-page-max':     '1280px',
    'layout-feature-max':  '1200px',
    'layout-wide-max':     '1600px',
    'layout-shell-inset':  '32px',
    'layout-page-inset':   '24px',
    'layout-min-desktop':  '1200px',
  },

  // ── Page Rhythm（spec §6.2）──────────────────────────────────────
  page: {
    'page-section-gap':    'var(--space-14)',   // 56px
    'page-block-gap':      'var(--space-12)',   // 48px
    'page-subblock-gap':   'var(--space-6)',    // 24px
    'page-stack-gap':      'var(--space-5)',    // 20px
    'page-inline-gap':     'var(--space-4)',    // 16px
    'page-caption-gap':    'var(--space-2)',    // 8px
  },

  // ── Shelf（spec §6.3）───────────────────────────────────────────
  shelf: {
    'shelf-gap':              'var(--space-4)',  // 16px
    'shelf-bottom-padding':   'var(--space-2)',  // 8px
    'shelf-card-w-portrait':  '170px',
    'shelf-card-w-landscape': '300px',
    'shelf-card-w-top10':     '170px',
    'shelf-empty-opacity':    '0.32',
    'shelf-empty-min-slots':  '4',
  },

  // ── Header component alias（spec §8.2）──────────────────────────
  header: {
    'header-height':      '72px',
    'header-main-gap':    'var(--space-6)',   // 24px
    'header-nav-gap':     'var(--space-1)',   // 4px
    'header-nav-padding': '8px 14px',
    'header-right-gap':   'var(--space-2)',   // 8px
  },

  // ── Footer component alias（spec §9.3）──────────────────────────
  footer: {
    'footer-col-gap':        'var(--space-10)',  // 40px
    'footer-top-padding':    '48px 32px 32px',
    'footer-bottom-padding': '20px 32px',
    'footer-social-gap':     'var(--space-2)',   // 8px
    'footer-legal-gap':      'var(--space-5)',   // 20px
  },
} as const
