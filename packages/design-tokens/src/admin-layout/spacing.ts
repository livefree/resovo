/**
 * admin layout 间距规范（CHG-UX2-01 / SEQ-20260505-01）
 *
 * 与 primitives space 的关系：
 *   - primitives space 提供原子刻度（4px / 8px / 12px / 16px / 20px / 24px ...）
 *   - admin-layout spacing 提供「场景命名」语义槽位（page / section / list / card / toolbar）
 *
 * 设计稿真源：`docs/designs/backend_design_v2.1/reference.md` §3「间距系统」
 *   + `components.css` `.dt__toolbar` / `.dt__bulk` / `.dt__foot` 实测值
 *
 * 7 类槽位（共 13 个 var）：
 *   - page-padding-x / page-padding-y：页面级最外层 padding（PAGE_STYLE 等）
 *   - section-gap：页面内大区段之间间距（head / toolbar / table / foot 间）
 *     ⚠️ section-gap 是 gap 语义（section 与 section 之间），**不是** panel 内部 padding
 *   - list-row-padding-x / list-row-padding-y：列表行（ModListRow / NotificationItem 等）
 *   - card-padding-x / card-padding-y：卡片型容器（KpiCard / DecisionCard / detail card 等）
 *   - toolbar-padding-x / toolbar-padding-y：toolbar 类水平条（dt__toolbar / 详情区 toolbar）
 *   - foot-padding-x / foot-padding-y：footer 类水平条（dt__foot 等）
 *   - panel-padding-x / panel-padding-y（CHG-UX2-EXT-F 新增）：panel-in-page 内 padding
 *     适用：PendingCenter SECTION / RejectedTabContent actions 等"页面内嵌入式 panel"
 *     与 card 的区别：card 是独立 surface（自带边框/阴影/标题），panel 是 page 内分组容器
 *   - button-padding-x（CHG-UX2-EXT-F 新增，临时占位）：按钮水平 padding
 *     ⚠️ 长期方案：迁到 packages/design-tokens/src/components/button.ts 真源（admin-ui Button
 *     立项后），本槽位届时 deprecated；当前业务层 BATCH_BTN/HEAD_BTN 等内联按钮先借用
 *
 * 取值依据：
 *   - page 24/20：reference §3 表格页 padding；与 AdminShell main padding 20 协同
 *   - section 12：表格 head→toolbar→body→foot 之间默认间距
 *   - list-row 12/10：ModListRow 既有值 → 语义化保留
 *   - card 18/14：PendingCenter 等中等密度卡片实测
 *   - toolbar 12/10：dt-styles 既有值 → 语义化保留
 *   - foot 12/6：dt-styles 既有值 → 语义化保留
 *   - panel 12/12：PendingCenter SECTION + RejectedTabContent actions 既有值 → 语义化保留
 *   - button-x 12：VideoListClient BATCH_BTN/HEAD_BTN 既有值 → 临时占位
 */
export const adminSpacing = {
  // page 级（页面最外层）
  'page-padding-x': '24px',
  'page-padding-y': '20px',
  'section-gap': '12px',

  // list-row（紧凑列表行）
  'list-row-padding-x': '12px',
  'list-row-padding-y': '10px',

  // card（中等密度卡片）
  'card-padding-x': '18px',
  'card-padding-y': '14px',

  // toolbar（水平条 - DataTable toolbar / 详情区 toolbar 等）
  'toolbar-padding-x': '12px',
  'toolbar-padding-y': '10px',

  // foot（DataTable foot 等紧凑底栏）
  'foot-padding-x': '12px',
  'foot-padding-y': '6px',

  // panel（page 内嵌入式 panel；CHG-UX2-EXT-F 新增）
  'panel-padding-x': '12px',
  'panel-padding-y': '12px',

  // button（临时占位；CHG-UX2-EXT-F 新增；待 admin-ui Button 立项后迁 components/button.ts）
  'button-padding-x': '12px',
} as const

export type AdminSpacingToken = keyof typeof adminSpacing
