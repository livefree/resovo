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
   * type 维度选项值集合（VideoType 枚举值，不含 'all'；顺序即展示顺序）。
   * 由消费方从 ALL_CATEGORIES 派生注入 —— 共享组件不 import lib/categories.ts，
   * 保 taxonomy valueSource='category' 契约意图（值源自 categories SSOT，ADR-048）。
   * label 由组件内 t(`videoType.${value}`) 取（labelSource='videoType'）。
   * （HANDOFF-39 实装缺口回填，arch-reviewer Opus 定稿。）
   */
  readonly typeOptions: readonly VideoType[]

  /**
   * category 模式当前激活的 type（受控高亮）：分类页 type 在 pathname 段而非 ?type=，
   * 组件读不到且禁持 categories 路由知识，故由包装器解析 videoType 传入。
   * search 模式忽略此 prop（type 激活由组件读 ?type= 自管）。null=无。
   * （HANDOFF-39 实装缺口回填，arch-reviewer Opus 定稿。）
   */
  readonly activeType?: VideoType | null

  /**
   * type 维度选择回调（仅传 API 枚举值，不传 URL slug；null=「全部」）。
   * category 模式：页面据此 + 自持 locale/categories 做路由跳转（URL 映射知识留在页面）。
   * search 模式：可省略；组件内部把 type 写入 URL param（不调此回调）。
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
  /**
   * 页面模式，承载排序「无 ?sort= 时默认高亮」差异（与 FilterAreaProps.mode 对齐）：
   *   'category'（默认）— 无 ?sort= 时高亮 DEFAULT_SORT(latest)，即后端分类默认排序；选 latest 删 param 回默认。
   *   'search'         — 无 ?sort= 时不高亮任何按钮（relevance 为搜索隐式默认、无对应按钮）；选任何排序均显式写 param 高亮。
   * 修复「搜索页高亮 latest 但后端按 relevance 排」的前后端默认不一致（HANDOFF-40B 已知项收口）。
   */
  readonly mode?: 'category' | 'search'
}
