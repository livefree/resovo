/**
 * admin 封面尺寸规范（CHG-UX2-01 / SEQ-20260505-01）
 *
 * 真源：v2.1 后台设计稿 `components.css` `.tbl-thumb` + `reference.md` §10
 *
 * 5 size variant（消费 thumb.tsx ThumbSize union）：
 *   - poster-sm 32×48：紧凑列表行（如 ModListRow / RejectedTabContent 左侧缩略图）
 *   - poster-md 48×72（CHG-UX2-01 校准 — 原 38×56 视觉量级太接近 sm）：
 *     视频库列表 thumb 列（用户痛点"显示过小"）
 *   - poster-lg 80×120：审核台中央 / 详情页主图（视觉量级中等）
 *   - poster-xl 120×180（CHG-UX2-01 新增）：详情页 hero / 全屏预览
 *     （触发型 follow-up CHG-UX2-EXT-A：当 PendingCenter 80×120 仍嫌小时升）
 *   - banner-sm 64×36：Home Ops banner / 横向运营位（保持不动）
 *   - square-sm 28×28：sev icon box / 头像类圆角方块（保持不动）
 *
 * thumb.tsx 数值进入 design-tokens 真源后改为 var() 引用（CHG-UX2-02）；
 * 数值散落 thumb.tsx 函数内不再是真源。
 *
 * 比例约定：
 *   - poster-* 严格 2:3（标准海报）
 *   - banner-sm ~16:9（横向运营位）
 *   - square-sm 1:1
 */
export const adminCover = {
  // poster-sm 32×48
  'cover-poster-sm-w': '32px',
  'cover-poster-sm-h': '48px',

  // poster-md 48×72（CHG-UX2-01 校准 38×56 → 48×72）
  'cover-poster-md-w': '48px',
  'cover-poster-md-h': '72px',

  // poster-lg 80×120
  'cover-poster-lg-w': '80px',
  'cover-poster-lg-h': '120px',

  // poster-xl 120×180（CHG-UX2-01 新增）
  'cover-poster-xl-w': '120px',
  'cover-poster-xl-h': '180px',

  // banner-sm 64×36（不变）
  'cover-banner-sm-w': '64px',
  'cover-banner-sm-h': '36px',

  // square-sm 28×28（不变）
  'cover-square-sm-w': '28px',
  'cover-square-sm-h': '28px',
} as const

export type AdminCoverToken = keyof typeof adminCover
