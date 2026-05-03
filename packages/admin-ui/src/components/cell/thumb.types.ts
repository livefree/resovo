/**
 * thumb.types.ts — Thumb 共享组件 Props 契约（CHG-DESIGN-12 12A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/styles/components.css` `.tbl-thumb / .tbl-thumb--sm` (行 398-399)
 *      - `.tbl-thumb { width: 38px; height: 56px; border-radius: 4px; background: var(--bg3); object-fit: cover }`
 *      - `.tbl-thumb--sm { width: 32px; height: 48px }`
 *   2. `docs/designs/backend_design_v2.1/reference.md` §10「视频类素材默认**竖版 32×48 poster**。
 *      只有 Home Ops banner / 前台预览等横向运营位使用横图」
 *   3. `docs/designs/backend_design_v2.1/reference.md` §6.1 thumb 列「32×48 竖版 radius 4」
 *   4. CHG-DESIGN-12 任务卡（SEQ-20260429-02 第 12 卡 · 12A 阶段）
 *
 * 业务语义：
 *   通用图片缩略图组件；按 size variant 支持视频库 32×48 竖版 poster、Home Ops 横图 banner
 *   等多种规格；空 src 时降级为 placeholder（占位 box，避免列宽塌陷）。
 *
 * size variant 设计稿映射：
 *   - `poster-sm`（默认）：**32×48 竖版**（reference §10 视频类素材默认）；用于视频库表格行 thumb 列
 *   - `poster-md`：38×56 竖版（components.css `.tbl-thumb` 不带 `--sm` 修饰符的基础尺寸）；预留给详情页 / Drawer header
 *   - `poster-lg`：**80×120 竖版**（CHG-SN-4-FIX-E · plan v1.6 §1 G6 引入）；用于审核台中央海报 / 详情页主图
 *     等中等尺寸视觉位；视觉量级显著大于 poster-md，对齐 `Screenshot 2026-05-02 at 20.15.54.png` 中央海报
 *   - `banner-sm`：64×36 横版（CHG-DESIGN-08 之前 VideoListClient 沿用的旧规格）；用于 Home Ops banner / 前台预览
 *   - `square-sm`：28×28 正方形 radius 6；用于 RecentActivityCard 行级 sev icon box（CHG-DESIGN-07 已用 inline；
 *     12B Thumb 实装后可在 7C dashboard 业务卡复用，统一视觉规格）
 *
 * 不变约束：
 *   - 颜色仅消费 packages/design-tokens（背景占位 `--bg-surface-elevated`；边框 `--border-default`）
 *   - 不引入图片懒加载库（lazy 由消费方按需在 src 上加 loading="lazy" props）
 *   - Edge Runtime 兼容
 */

import type { ReactNode } from 'react'

/**
 * Thumb 尺寸变体
 *
 * 设计稿 §10 + components.css 映射；5 种规格满足视频库 / 审核台 / banner / dashboard 全场景。
 *
 * - `poster-sm`（默认）：32×48 竖版 radius 4 — reference §6.1 视频库 thumb 列 + 审核台列表行
 * - `poster-md`：38×56 竖版 radius 4 — Drawer header
 * - `poster-lg`：80×120 竖版 radius 4 — 审核台中央海报 / 详情页主图（v1.6 G6 引入）
 * - `banner-sm`：64×36 横版 radius 4 — Home Ops banner / 横向运营位
 * - `square-sm`：28×28 正方形 radius 6 — sev icon box / 头像类圆角方块
 */
export type ThumbSize = 'poster-sm' | 'poster-md' | 'poster-lg' | 'banner-sm' | 'square-sm'

/**
 * Thumb Props
 *
 * 渲染：
 * - `src` 非空 → `<img>` 元素 + `object-fit: cover`
 * - `src` 空 → placeholder span（占位 box，按 size 渲染同尺寸）
 *
 * a11y：
 * - 装饰性 thumb（如表格行配图）→ `alt=""` + `aria-hidden="true"`
 * - 信息性 thumb（如详情页主图）→ `alt={alt}` 必填
 * - 由消费方通过 `decorative` prop 显式声明（默认 true，与表格行典型用例一致）
 *
 * fallback：
 * - `src` 空 + `fallback` 非空 → 渲染 `fallback` ReactNode（如自定义 icon）
 * - `src` 空 + `fallback` 空 → 默认 placeholder（背景色块）
 */
export interface ThumbProps {
  /** 图片 URL；空字符串 / undefined / null 时降级到 placeholder */
  readonly src?: string | null

  /**
   * 尺寸变体（默认 'poster-sm'，对齐 reference §10「视频类素材默认 32×48」）
   */
  readonly size?: ThumbSize

  /**
   * a11y alt 文本
   *
   * - decorative=true（默认）→ alt 永远渲染为空字符串（aria-hidden=true）
   * - decorative=false → alt 必填（dev warn 缺失时提示）
   */
  readonly alt?: string

  /**
   * 是否装饰性图（默认 true）
   *
   * decorative=true 时 alt 强制为空 + aria-hidden=true（视频库表格行典型用例）；
   * decorative=false 时按 alt 渲染（详情页 / Drawer 主图等信息性图典型用例）。
   */
  readonly decorative?: boolean

  /**
   * src 空时的 fallback ReactNode（可选）
   *
   * 默认渲染纯背景占位 box；消费方传如 `<ImageOff size={...} />` 提示"无封面"。
   */
  readonly fallback?: ReactNode

  /**
   * loading 策略（透传到 `<img loading={...}>`，仅 src 非空时生效）
   *
   * - `'lazy'`（默认）：长列表视频库典型用例，节省带宽
   * - `'eager'`：详情页主图首屏需立刻加载
   */
  readonly loading?: 'lazy' | 'eager'

  /** 测试钩子 */
  readonly testId?: string
}
