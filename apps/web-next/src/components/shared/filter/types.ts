/**
 * filter/types.ts — 共享筛选区组件 Props 契约（HANDOFF-37，arch-reviewer Opus 定稿）
 *
 * 驱动模型：URL-param 驱动（组件内部 useSearchParams/useRouter，5 维 + sort 同源）。
 * 维度集合 + 顺序由 @resovo/types FILTER_TAXONOMY 固定，组件不接受维度配置注入。
 */

import type { VideoType, FilterDimension } from '@resovo/types'

/** FilterArea Props 契约。 */
export interface FilterAreaProps {
  /**
   * 页面模式，承载分类页 vs 搜索页差异（替代散落 if 判断）：
   *   'category' — type 维度选择 = 路由层级跳转（经 onTypeChange 由页面执行）；其余维度走 URL param。
   *   'search'   — 全部维度（含 type）走 URL param，组件内部自管。
   */
  readonly mode: 'category' | 'search'

  /**
   * type 维度选择回调（仅传 API 枚举值，不传 URL slug；null=「全部」）。
   * category 模式：页面据此 + 自持 locale/categories 做路由跳转（URL 映射知识留在页面）。
   * search 模式：可省略；组件内部把 type 写入 URL param。
   * ⚠ 共享组件不 import lib/categories.ts，不持有路由知识（边界：core 不写业务逻辑）。
   */
  readonly onTypeChange?: (videoType: VideoType | null) => void

  /**
   * 不渲染的维度（逃生口，替代旧 lockedDims，语义=「不显示」非「锁定值」）。
   * 例：分类页若隐藏 type 行 → ['type']。默认 []（5 维全显）。
   */
  readonly hiddenDimensions?: readonly FilterDimension[]
}

/**
 * GridSortBar Props 契约。
 * 排序值 URL-param 驱动（组件内读写 'sort' 参数，与 FilterArea 同源；默认 DEFAULT_SORT）。
 * 排序值集合来自 @resovo/types SORT_OPTIONS；label: filter.sort.<value>。
 */
export interface GridSortBarProps {
  /** 网格结果总数（仅总数，本期不做 per-option 计数）。 */
  readonly total?: number
  /** 总数文案 i18n key，约束在 filter 命名空间（分类页/搜索页各一）。 */
  readonly totalLabelKey?: 'filter.countCategory' | 'filter.countSearch'
}
