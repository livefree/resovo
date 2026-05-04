# UI 优化 · 第二批：行密度 / 间距 / 封面 token 对齐 + 圆角与列宽修复

> sequence_id: SEQ-20260505-01
> status: draft（方案）
> owner: @engineering
> created: 2026-05-04
> 关联：SEQ-20260503-01（颜色 token，第一批）/ SEQ-20260504-01（交互反馈，UX 完整性第一批）/ ADR-111 §后续序列触发清单 / ADR-112

---

## §1 背景与触发

第一批（颜色）+ UX 完整性序列收口后，用户验收发现：

1. **容器、组件之间的间距、尺寸缺乏统一管理** — 业务层散落 `padding: '10px 12px'` / `'8px 12px'` / `'20px 24px 0'` / `'4px 10px'` 等裸值，同类语义多种值
2. **页面很宽时，表格列头展开有问题** — 视频库表格列总宽固定，容器变宽时留白
3. **封面尺寸不规范** — 视频库列表海报"显示过小"，审核台中央海报"出现裁剪"
4. **封面 + 表格"左圆右直角"** — frame 内部横向溢出，scrollbar 遮挡右下角；thead row 被 overflow:hidden 切，视觉感受"右侧直角"

实测（playwright，1376px viewport）：

| 元素 | 实测 | 说明 |
|---|---|---|
| 视频库 [data-table] | borderRadius 8px / overflow hidden / frame 4 角圆角 | 框架本身正常 |
| 视频库 [data-table-scroll] | scrollWidth 1230 / clientWidth 987 / 横向溢出 243px | 列总宽 > 容器宽 → 横滚 |
| 视频库列总宽 | 60+320+90+100+140+100+120+90+170 ≈ 1090（默认可见） | 全部固定 width，无 1fr 弹性 |
| Thumb sizes | 5 variant（poster-sm/md/lg/banner-sm/square-sm）硬编码在 thumb.tsx | 未进入 design-tokens 真源 |
| 视频库 thumb | poster-sm 32×48 | 用户说"过小" |
| 审核台 PendingCenter | poster-lg 80×120 | 用户说"裁剪"，实际 cover fit 但视觉量级感觉不够 |
| VideoEditDrawer POSTER | inline 32×48 不走 Thumb | CHG-DESIGN-12 遗留欠账 |
| AdminShell main | padding `var(--space-5)` (20px) | 单一 padding，无 page-section 区分 |
| VideoListClient PAGE_STYLE | padding `'20px 24px 0'` | 裸值，与 main padding 叠加 |
| ModerationConsole SplitPane | 280 + 1fr(min 400) + 300 | 1376px viewport 下完整；窄屏右栏被推 |
| ModListRow | padding `'10px 12px'`，无 token | 裸值散落 |

---

## §2 现状盘点

### §2.1 行密度 / 间距 token 现状

primitives 层：
- `space.ts`：21 档（px/0/0.5..24）
- `size.ts`：9 档（xs..5xl）

admin-layout 层：
- `table.ts`：`row-h: 40px` / `row-h-compact: 32px` / `col-min-w: 80px` —— 仅 3 个槽位
- `density.ts`：`density-comfortable: 1` / `density-compact: 0.75` —— 仅作 calc() 缩放因子

**散落的裸值（不一致）**：

| 场景 | 现状 | 出现位置 |
|---|---|---|
| Page 容器外 padding | `var(--space-5)` (20px) | AdminShell MAIN_STYLE |
| Page 容器内 padding | `'20px 24px 0'` 裸值 | VideoListClient PAGE_STYLE / ModerationConsole 等 |
| Page 区段 gap | `'12px'` 裸值 | VideoListClient PAGE_STYLE.gap |
| Toolbar 内 padding | `'10px 12px'` 裸值 | dt-styles `[data-table-toolbar]` |
| Filter chips padding | `'8px 12px'` 裸值 | dt-styles `[data-table-filter-chips]` |
| Foot padding | `'6px 12px'` 裸值 | dt-styles `[data-table-foot]` |
| List-row padding | `'10px 12px'` 裸值 | ModListRow / RejectedTabContent |
| Detail card padding | `'14px 18px'` / `'16px'` 等 | PendingCenter / VideoEditDrawer 等 |

### §2.2 封面尺寸现状

`packages/admin-ui/src/components/cell/thumb.tsx` 硬编码 5 size：

```ts
case 'poster-md': return { width: 38, height: 56, radius: 'var(--radius-sm)' }
case 'poster-lg': return { width: 80, height: 120, radius: 'var(--radius-sm)' }
case 'banner-sm': return { width: 64, height: 36, radius: 'var(--radius-sm)' }
case 'square-sm': return { width: 28, height: 28, radius: 'var(--radius-md)' }
case 'poster-sm':
default:         return { width: 32, height: 48, radius: 'var(--radius-sm)' }
```

**用户痛点**：
- 视频库 `poster-sm` 32×48 — 用户主观感受"显示过小"，期望更大封面（48×72 或 56×84）
- 审核台 `poster-lg` 80×120 — 用户主观感受"裁剪"（实际 cover fit 无裁剪，但视觉量级 vs 中央 ~500px 区域占比小）

**遗留问题**：
- VideoEditDrawer.tsx line 37 `POSTER` inline 32×48，未走 Thumb 共享组件（CHG-DESIGN-12 遗留欠账）
- 5 size 散落在 thumb.tsx 函数内，未沉淀到 design-tokens 真源

### §2.3 圆角"左圆右直角"根因

实测（playwright）：

```js
// dt computed style: borderRadius: '8px', overflow: 'hidden'
// dt rect: 277..1288 (1011px wide), in viewport
// dt-scroll: scrollWidth 1230, clientWidth 987 → 横向溢出 243px
```

**真因**：
1. frame 自身 `border-radius: 8px` + `overflow: hidden` 应该 4 角圆
2. 但 frame 内 `[data-table-scroll]` 横向溢出 243px → 出现底部横向 scrollbar
3. 横向 scrollbar 占据 frame 底部 → **遮挡右下角圆角**
4. thead 行被 frame overflow:hidden 切到右边缘 → cell 右 border 显示成竖直线 → **视觉感受"右上也是直角"**

**这不是 CSS borderRadius bug，是「列宽设计 → 横向溢出」连锁问题**。修复方向：让列宽弹性化（避免横滚）。

### §2.4 表格列头展开问题

VideoListClient 13 列定义全部固定 `width: <px>`，**无 1fr 弹性列**：

```ts
{ id: 'cover', width: 60, ... },
{ id: 'title', width: 320, minWidth: 220, ... },  // 应该弹性
{ id: 'type', width: 90, ... },
{ id: 'source_health', width: 100, ... },
{ id: 'probe', width: 140, ... },
{ id: 'image_health', width: 100, ... },
{ id: 'visibility', width: 120, ... },
{ id: 'review_status', width: 90, ... },
{ id: 'actions', width: 170, ... },
```

`buildGridTemplate` 已支持弹性列：`tracks.push(width ? '${width}px' : 'minmax(${minWidth}px, 1fr)')`。**只需删掉 title 的 width 即可获得 minmax(220px, 1fr) 弹性**。

### §2.5 审核台 layout 现状

ModerationConsole 用 SplitPane 三栏（pending Tab）：
- 280px 列表
- `1fr` 中央（min 400）
- 300px 右栏

最小总宽 980px + gap 24 ≈ 1004px。用户截图（18.40.14）窗口 ~ 859px → SplitPane 布局崩溃，右栏被推走。

**RejectedTabContent** 用 flex 两栏：
- 280 + 1fr — 仅 2 栏，无右栏（设计如此）

---

## §3 设计目标

1. **统一管理间距 / 行密度 / 封面尺寸**：design-tokens admin-layout 层新增对应槽位，消费方零硬编码
2. **修复表格列宽弹性问题**：VideoListClient title 列改弹性 1fr；后续新模块遵循"至少 1 列弹性"约定
3. **修复圆角问题**：根因是横向溢出 → 弹性列消除横滚后右下角圆角自然恢复
4. **重新规划封面尺寸**：扩展 Thumb size variant（视频库选 md+ / 审核台中央选 xl）
5. **审核台窄屏 layout**：维持 SplitPane 现状但补响应式断点（< 1100px 时 RightPane 折叠）
6. **可扩展**：新增 page / list / card 同类元素时，token 复用，不再写裸值

---

## §4 token 层方案

### §4.1 新增 admin-layout 间距槽位

新建 `packages/design-tokens/src/admin-layout/spacing.ts`：

```ts
/**
 * admin layout 间距规范（CHG-UX2-01 / SEQ-20260505-01）
 *
 * 与 primitives space 的关系：
 *   - primitives space 提供原子刻度（4px / 8px / 12px / 16px / 20px / 24px ...）
 *   - admin-layout spacing 提供「场景命名」语义槽位（page / section / list / card / toolbar）
 *
 * 设计稿真源：reference.md §3 「间距系统」 + components.css `.dt__toolbar / .dt__bulk`
 *
 * 5 类槽位：
 *   - page-padding-x / page-padding-y：页面级最外层 padding（AdminShell main 内的 PAGE_STYLE）
 *   - section-gap：页面内大区段之间（head / toolbar / table / foot）
 *   - list-row-padding-x / list-row-padding-y：列表行（ModListRow / NotificationItem 等）
 *   - card-padding-x / card-padding-y：卡片型容器（KpiCard / DecisionCard / detail card 等）
 *   - toolbar-padding-x / toolbar-padding-y：toolbar / footer 类水平条
 */
export const adminSpacing = {
  // page 级（与 AdminShell main 的 var(--space-5)=20px 协同）
  'page-padding-x': '24px',  // 页面左右内边距
  'page-padding-y': '20px',  // 页面上下内边距
  'section-gap': '12px',      // 页面内大区段间距

  // list-row（ModListRow / NotificationItem 等）
  'list-row-padding-x': '12px',
  'list-row-padding-y': '10px',

  // card（KpiCard / DecisionCard / detail card）
  'card-padding-x': '18px',
  'card-padding-y': '14px',

  // toolbar / foot（dt-styles 既有值的语义化）
  'toolbar-padding-x': '12px',
  'toolbar-padding-y': '10px',
  'foot-padding-x': '12px',
  'foot-padding-y': '6px',
} as const

export type AdminSpacingToken = keyof typeof adminSpacing
```

CSS 变量产出（自动）：
- `--page-padding-x` `--page-padding-y` `--section-gap`
- `--list-row-padding-x` `--list-row-padding-y`
- `--card-padding-x` `--card-padding-y`
- `--toolbar-padding-x` `--toolbar-padding-y` `--foot-padding-x` `--foot-padding-y`

### §4.2 扩展 admin-layout/table.ts 行高槽位

```ts
export const adminTable = {
  'row-h': '40px',           // 既有
  'row-h-compact': '32px',   // 既有
  'row-h-relaxed': '48px',   // 新增：详情/list 行用（ModListRow 当前 40px+padding 实际 ~52）
  'col-min-w': '80px',       // 既有
} as const
```

### §4.3 新增 admin-layout 封面尺寸槽位

新建 `packages/design-tokens/src/admin-layout/cover.ts`：

```ts
/**
 * admin 封面尺寸规范（CHG-UX2-01 / SEQ-20260505-01）
 *
 * 真源：v2.1 后台设计稿 components.css `.tbl-thumb` + reference.md §10
 *
 * 5 size variant 比例 2:3（标准海报）+ 16:9 banner + 1:1 square；
 * 消费 thumb.tsx ThumbSize union（保持向后兼容）；
 * 数值进入 design-tokens 真源后，thumb.tsx 改为 var() 引用。
 *
 * size 选用语境：
 *   - poster-sm 32×48：紧凑列表行（如 ModListRow 左侧缩略图）
 *   - poster-md 48×72（CHG-UX2-01 校准 — 原 38×56 太接近 sm）：视频库列表 thumb 列（用户痛点"过小"）
 *   - poster-lg 80×120：审核台中央 / 详情页主图（视觉量级中等）
 *   - poster-xl 120×180（CHG-UX2-01 新增）：详情页 hero / 全屏预览（用户痛点"裁剪"备选）
 *   - banner-sm 64×36 / square-sm 28×28：保持不动
 */
export const adminCover = {
  'cover-poster-sm-w': '32px',
  'cover-poster-sm-h': '48px',
  'cover-poster-md-w': '48px',  // 校准 38 → 48（与视频库视觉量级期望对齐）
  'cover-poster-md-h': '72px',  // 校准 56 → 72
  'cover-poster-lg-w': '80px',
  'cover-poster-lg-h': '120px',
  'cover-poster-xl-w': '120px', // 新增
  'cover-poster-xl-h': '180px', // 新增
  'cover-banner-sm-w': '64px',
  'cover-banner-sm-h': '36px',
  'cover-square-sm-w': '28px',
  'cover-square-sm-h': '28px',
} as const

export type AdminCoverToken = keyof typeof adminCover
```

CSS 变量产出（自动）：`--cover-poster-{sm|md|lg|xl}-{w|h}` / `--cover-banner-sm-{w|h}` / `--cover-square-sm-{w|h}`

### §4.4 不动

- `space.ts` / `size.ts` primitives 不动（语义层增加，刻度层稳定）
- `density.ts` 不动（与本批解耦）
- `radius.ts` 不动（圆角问题不是 token 问题）

### §4.5 typography fontSize 扩展（设计稿对齐）

设计稿 `tokens.css` 字号：`--fs-11/12/13/14/15/16/18/20/24/28/32`（11 档）
当前 primitives `typography.fontSize`：`xs(12)/sm(14)/base(16)/lg(18)/xl(20)/2xl(24)/3xl(30)/4xl(36)/5xl(48)`（9 档）

**差异**：
- 缺 5 档：10（业务在用）/ 11 / 13 / 15 / 28
- 不一致 2 档：3xl=30 vs 设计 28 / 4xl=36 vs 设计 32（grep 验证业务层 0 处直接消费 var(--font-size-3xl/4xl/5xl)，可安全调整数值）
- 业务层 99 处 inline fontSize 裸值需迁移

**修订后 fontSize**（向后兼容 + 数字 4 档新增 + 大档校准）：

```ts
fontSize: {
  '2xs':       '0.625rem',   // 10px — 新增（业务 TabLines / VideoListClient 已在用）
  xxs:         '0.6875rem',  // 11px — 新增（设计 --fs-11；count badge / meta）
  xs:          '0.75rem',    // 12px ✓ 设计 --fs-12
  'sm-tight':  '0.8125rem',  // 13px — 新增（设计 --fs-13；37 处业务在用）
  sm:          '0.875rem',   // 14px ✓ 设计 --fs-14（默认 body）
  'sm-loose':  '0.9375rem',  // 15px — 新增（设计 --fs-15；5 处业务在用）
  base:        '1rem',       // 16px ✓ 设计 --fs-16
  lg:          '1.125rem',   // 18px ✓ 设计 --fs-18
  xl:          '1.25rem',    // 20px ✓ 设计 --fs-20
  '2xl':       '1.5rem',     // 24px ✓ 设计 --fs-24
  '3xl':       '1.75rem',    // 28px — 校准 30 → 28（对齐设计 --fs-28）
  '4xl':       '2rem',       // 32px — 校准 36 → 32（对齐设计 --fs-32）
  '5xl':       '3rem',       // 48px ✓ 保留（设计稿无但 hero 场景预留）
} as const
```

向后兼容：
- 既有 6 个抽象 key（xs/sm/base/lg/xl/2xl）值零变化 ✓
- 新增 4 个新 key（2xs/xxs/sm-tight/sm-loose）— 0 破坏
- 校准 2 个 key（3xl/4xl）— 业务层 0 处直接消费（grep 验证），仅 dist/tokens.css 输出值变化

`build-css.ts` 自动展开为 CSS 变量：
- 新增：`--font-size-2xs` `--font-size-xxs` `--font-size-sm-tight` `--font-size-sm-loose`
- 校准：`--font-size-3xl: 1.75rem` `--font-size-4xl: 2rem`

### §4.6 业务 99 处 inline fontSize 全量迁移

迁移规则表（含本卡顺手 lineHeight 对齐）：

| inline 裸值 | 替换为 | 出现次数 |
|---|---|---|
| `fontSize: '10px'` / `fontSize: 10` | `var(--font-size-2xs)` | ~5 |
| `fontSize: '11px'` / `fontSize: 11` | `var(--font-size-xxs)` | ~50 |
| `fontSize: '12px'` / `fontSize: 12` | `var(--font-size-xs)` | ~25 |
| `fontSize: '13px'` / `fontSize: 13` | `var(--font-size-sm-tight)` | ~37 |
| `fontSize: '14px'` / `fontSize: 14` | `var(--font-size-sm)` | ~10 |
| `fontSize: '15px'` / `fontSize: 15` | `var(--font-size-sm-loose)` | ~5 |
| `fontSize: '16px'` / `fontSize: 16` | `var(--font-size-base)` | ~3 |
| `fontSize: '18px'` / `fontSize: 18` | `var(--font-size-lg)` | ~2 |
| `fontSize: '20px'` / `fontSize: 20` | `var(--font-size-xl)` | ~3 |
| `fontSize: '24px'` / `fontSize: 24` | `var(--font-size-2xl)` | ~2 |

**已存在的 admin-shell-surfaces 单点定义**：
- `'admin-count-font-size': '11px'` —— 与新 `--font-size-xxs` 重复；保留作为别名（语义层），但**优先消费 `--font-size-xxs`**；`admin-count-font-size` 标记为 deprecated（CHG-UX-EXT 触发清理）

**不动 fontSize 但同时消费的 lineHeight**：
- 本卡只迁移 fontSize；lineHeight 当前抽象 5 档 (tight/snug/normal/relaxed/loose) 已够用；裸值 `lineHeight: 1.4` / `1.6` 等留作下批扫尾

---

## §5 消费方迁移方案

### §5.1 thumb.tsx 接入 token + 扩展 poster-xl

```ts
// 改前：硬编码 case
case 'poster-md': return { width: 38, height: 56, radius: 'var(--radius-sm)' }
case 'poster-lg': return { width: 80, height: 120, radius: 'var(--radius-sm)' }

// 改后：var() 引用 + 加 poster-xl
case 'poster-md': return { widthVar: 'var(--cover-poster-md-w)', heightVar: 'var(--cover-poster-md-h)', radius: 'var(--radius-sm)' }
case 'poster-lg': return { widthVar: 'var(--cover-poster-lg-w)', heightVar: 'var(--cover-poster-lg-h)', radius: 'var(--radius-sm)' }
case 'poster-xl': return { widthVar: 'var(--cover-poster-xl-w)', heightVar: 'var(--cover-poster-xl-h)', radius: 'var(--radius-md)' }
```

`ThumbSize` union 加 `'poster-xl'`；`SizeSpec` 改 `widthVar/heightVar`（CSS 变量字符串）；render 时直接放 inline style。

### §5.2 视频库改用 poster-md + title 列弹性化

`apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`：

```ts
// 改前：
{ id: 'cover', width: 60, minWidth: 56, ..., cell: ({ row }) => <Thumb src={row.cover_url} size="poster-sm" /> },
{ id: 'title', width: 320, minWidth: 220, ..., cell: ... },

// 改后：
{ id: 'cover', width: 80, minWidth: 60, ..., cell: ({ row }) => <Thumb src={row.cover_url} size="poster-md" /> },  // poster-md 48×72，列宽 80 给余白
{ id: 'title', minWidth: 220, ..., cell: ... },  // 删 width → minmax(220px, 1fr) 弹性，撑满剩余空间
```

效果：
- thumb 从 32×48 升 48×72（用户痛点"过小"解决）
- title 列弹性，容器宽时撑满，窄时压缩 → **横向溢出消失** → 圆角"右下被 scrollbar 切"问题**自动消失**（核心连锁修复）

### §5.3 VideoEditDrawer POSTER 接入 Thumb（CHG-DESIGN-12 欠账闭环）

```tsx
// 改前 line 37-40 + 201-203：
const POSTER = { width: '32px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', ... }
{video.cover_url ? <img src={video.cover_url} alt="" style={POSTER} /> : <div style={POSTER} aria-hidden="true" />}

// 改后：
import { Thumb } from '@resovo/admin-ui'
<Thumb src={video.cover_url} size="poster-md" decorative={false} alt={video.title} />
```

### §5.4 PendingCenter 中央海报评估

当前 `poster-lg` 80×120。如果用户实测仍嫌"裁剪/小"，本卡保持不动；登记触发型 follow-up CHG-UX2-EXT-A：升 `poster-xl` 120×180。

### §5.5 inline padding 裸值收敛（高优先消费方）

| 文件 | 改前 | 改后 |
|---|---|---|
| VideoListClient PAGE_STYLE | `padding: '20px 24px 0', gap: '12px'` | `padding: 'var(--page-padding-y) var(--page-padding-x) 0', gap: 'var(--section-gap)'` |
| dt-styles toolbar | `padding: 10px 12px` | `padding: var(--toolbar-padding-y) var(--toolbar-padding-x)` |
| dt-styles filter-chips | `padding: 8px 12px` | `padding: 8px var(--toolbar-padding-x)` |
| dt-styles foot | `padding: 6px 12px` | `padding: var(--foot-padding-y) var(--foot-padding-x)` |
| ModListRow ROW_BASE | `padding: '10px 12px'` | `padding: 'var(--list-row-padding-y) var(--list-row-padding-x)'` |
| RejectedTabContent 列表行 | `padding: '10px 12px'` | 同上 |
| ModerationConsole 各内 padding | 多处裸值 | section-gap / card-padding 替换 |

### §5.6 不在范围

- 散落到几十个文件的所有 inline padding 全量替换 — 本卡只做"高频痛点 + 设计稿 §3 间距系统对齐"，扫尾留下批
- `density.ts` / 主题响应式断点等长期工作

---

## §6 实施分卡

序列 ID：**SEQ-20260505-01** · 总计 5 卡 + 1 收口

### CHG-UX2-01 · token 层：spacing / 扩展 table / cover / typography fontSize
- 范围：
  - 新增 `packages/design-tokens/src/admin-layout/spacing.ts`（10 槽位）
  - 扩展 `admin-layout/table.ts`（加 `row-h-relaxed`）
  - 新增 `admin-layout/cover.ts`（11 槽位，含 poster-xl）
  - `admin-layout/index.ts` 导出
  - 修改 `packages/design-tokens/src/primitives/typography.ts` fontSize（+4 新档 / 校准 2 档）
  - `scripts/build-css.ts` 自动级联（typography 已在 PREFIX_MAP；spacing/cover 加入 themeIndependent）
  - 重生成 tokens.css
  - 单测：4 组形态测试（spacing / cover / table 扩展 / typography 新档）+ CSS 变量产出
- 不动：thumb.tsx / 业务消费方（迁移留 -02b/-03/-05）
- 建议模型：sonnet
- 子代理：spawn `arch-reviewer` (claude-opus-4-7) 审 token 槽位边界 + 与 primitives 关系 + typography 校准向后兼容

### CHG-UX2-02 · thumb.tsx token 接入 + 加 poster-xl
- 范围：
  - thumb.tsx `sizeSpec` 改 var() 引用
  - thumb.types.ts ThumbSize union 加 `'poster-xl'`
  - poster-md 数值校准 38×56 → 48×72（向后兼容评估：如有消费方依赖 38 → 接受视觉变化）
  - 单测：5 size 渲染断言（含 xl）
- 依赖：CHG-UX2-01
- 建议模型：sonnet

### CHG-UX2-02b · 业务 99 处 inline fontSize 全量迁移
- 范围：
  - admin-ui 内部 fontSize 裸值（`packages/admin-ui/src/components/**` + `packages/admin-ui/src/shell/**`）
  - apps/server-next/src/app/admin/** fontSize 裸值
  - 按 §4.6 迁移规则表批量替换
  - 完成判据：`grep -rn "fontSize: '\(10\|11\|12\|13\|14\|15\|16\|18\|20\|24\)\(px\)\?'" packages/admin-ui apps/server-next` 命中 = 0
  - 视觉零回归（除 §4.5 已说明的 28/32 校准）
- 依赖：CHG-UX2-01
- 建议模型：sonnet

### CHG-UX2-03 · VideoListClient title 列弹性化 + cover 列 poster-md
- 范围：
  - VideoListClient title 列删 `width: 320`（保留 minWidth: 220）→ 弹性
  - cover 列 `width: 60` → `width: 80`，size 从 poster-sm → poster-md
  - PAGE_STYLE padding/gap 接入 token
- 完成判据：横向 scrollbar 消失（实测 dt-scroll scrollWidth ≤ clientWidth）；frame 4 角圆角完整可见
- 依赖：CHG-UX2-02
- 建议模型：sonnet

### CHG-UX2-04 · VideoEditDrawer POSTER 接入 Thumb（CHG-DESIGN-12 欠账闭环）
- 范围：
  - VideoEditDrawer.tsx 删 inline POSTER，改 `<Thumb size="poster-md" />`
  - 测试同步
- 依赖：CHG-UX2-02
- 建议模型：sonnet

### CHG-UX2-05 · 高频 inline padding 裸值收敛
- 范围：
  - dt-styles.tsx 4 处（toolbar/filter-chips/foot 等）
  - ModListRow / RejectedTabContent 列表行 padding
  - PendingCenter / ModerationConsole 部分 card padding
- 完成判据：grep 关键 padding 裸值消除 ≥ 80%；视觉零回归
- 依赖：CHG-UX2-01
- 建议模型：sonnet

### CHG-UX2-06 · 收口 + arch-reviewer 全序列评级
- 范围：
  - 视觉走查（playwright 重测视频库 + 审核台 layout）
  - ADR-113 落盘（density / spacing / cover token 体系）
  - audit report 归档
  - 序列 task-queue / changelog 收口
- 子代理（强制）：spawn `arch-reviewer` (claude-opus-4-7) 全序列评级
- 完成判据：A 或 B+ → 收口；C → BLOCKER
- 建议模型：opus

---

## §7 不在本序列范围

- 行密度切换功能（comfortable ↔ compact 用户运行时切换）— 留 admin-ui Settings 立项
- 业务页所有 inline padding 全量收敛（本批 ~30%，留下批）
- 审核台窄屏响应式断点（< 1100 折叠 RightPane）— 独立 UX 序列触发
- ADR-111 §后续清单 Y2 OKLCH→hex 快照单测 — 留下批（与本批不强相关）

---

## §8 验收标准

1. typecheck / lint / unit / tokens:validate / verify-token-references 全绿
2. 视觉验收（playwright，1376px viewport）：
   - 视频库表格 [data-table-scroll].scrollWidth ≤ clientWidth（无横向溢出 → 圆角恢复）
   - 视频库 thumb 实测 48×72（升级前 32×48）
   - 视频库 title 列弹性撑满 main 可用宽度
3. arch-reviewer A 或 B+ → 收口

---

## §9 关键约束（违反 = BLOCKER）

- ❌ 修改 primitives space / size / radius（本批只在 admin-layout 层加槽位）
- ❌ 业务文件写裸值 padding（必须 var()）
- ❌ thumb.tsx 数值硬编码（必须 var(--cover-*)）
- ❌ 跳过 token 层直接改业务文件
- ❌ 修改 thumb.tsx 既有 ThumbSize 已有值的"size key 名"（向后兼容；只能加 poster-xl 新值）

---

## §10 关联

- 上一序列：SEQ-20260504-01 ✅ A- PASS CONDITIONAL
- 前序：SEQ-20260503-01 §后续批次登记"第二批：行密度 / 封面尺寸 / 间距 token 对齐"
- 拟产出 ADR-113（density / spacing / cover token 体系）
- 真源：`docs/designs/backend_design_v2.1/reference.md` §3 §6.1 §10 / `components.css` `.tbl-thumb` / `.dt__toolbar`
