# 设计系统与 Tokens 集中管理方案

> status: proposed
> owner: @engineering
> scope: design tokens single-source-of-truth with brand layering, admin editor, build pipeline, theme switching, multi-brand readiness
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18

---

## 1. 背景

本次前端重新设计需要引入**可扩展、可集中编辑、支持多品牌分层的设计 Token 体系**。目前项目颜色/字号/间距等设计值散落在 Tailwind 配置和各组件 class 中，面临三个问题：

1. 改动需要同时 diff 多处代码，容易漏改。
2. 不支持可视化调整，设计与工程沟通靠"你改这个值试试"。
3. 浅色过白、深色不够精致等问题的根因是 Token 缺失，靠局部补丁解决会越补越乱。

此外，用户已确认未来会支持多品牌皮肤（见 `frontend_redesign_plan_20260418.md` 第 5 节），Token 体系必须从 day 1 就支持"基础层 + 品牌层"的分层结构，避免后期反悔重构。

用户已明确**不使用 Figma**，希望有一个**直观、集中、就地可视化**的编辑入口，并且不希望维护工作沉在代码里。

---

## 2. 目标

1. 建立 `tokens.json` **分层体系**（`base` + `brands/<brand>`）作为所有设计值的**单一真源**（Single Source of Truth）。
2. 提供 `/admin/design-system` 可视化编辑后台，分组表单 + 实时预览画布 + 品牌切换器。
3. `tokens.json` 变更通过构建脚本自动产出：按"品牌 × 主题"组合的 CSS 文件、Tailwind 配置注入、TS 类型。
4. 主题三态切换（浅 / 深 / 跟随系统）优雅、持久化、首屏无闪烁。
5. 品牌识别链（middleware）就绪，本轮只实装单一品牌 Resovo。
6. 提供渐进式迁移路径，旧组件不需一次性重写。

---

## 3. 非目标

1. **不引入** Figma / Tokens Studio / Style Dictionary 等外部工具链。
2. **不上来做**运行时动态主题（DB 存储 + 用户自定义），当前只做设计期 Token。
3. **不**重构现有已稳定的后台模块的 class 命名，只对外部样式输入口做迁移。
4. **不**替换 Tailwind，继续以 Tailwind 为工具类基础，Token 通过 CSS 变量桥接。
5. **不**实际上线第二个品牌，只做架构分层与预留。
6. **不**提供 `/admin/brands` 品牌管理后台（待第二个品牌上线时再做）。

---

## 4. 单一真源：`tokens.json` 分层结构

采用 **W3C Design Tokens Community Group** 规范（或其子集），并在其上建立"基础层 + 品牌层"分层模型。

### 4.1 文件布局

```
packages/design-tokens/
├── base.tokens.json                  基础层：品牌无关的结构性 Token
│
├── brands/                           品牌层：每个品牌的覆盖与专属 Token
│   ├── resovo.tokens.json            本轮唯一实装的品牌
│   └── _template.tokens.json         新增品牌的脚手架模板
│
├── schema/
│   └── tokens.schema.json            JSON Schema 校验
│
└── dist/                             构建产物（按品牌 × 主题组合）
    ├── resovo.light.css
    ├── resovo.dark.css
    ├── tailwind.tokens.ts
    └── tokens.d.ts
```

### 4.2 基础层（`base.tokens.json`）

**内容**：所有站点通用的结构性 Token，按 **Primitive → Semantic → Component** 三子层组织。层间引用规则：`Semantic` 只能引用 `Primitive`；`Component` 只能引用 `Semantic` 或 `Primitive`；禁止反向依赖。品牌层不允许直接覆盖 Primitive 数值（只能通过调整 Semantic 引用间接影响）。

#### Primitive 子层（原子值，无业务语义）

```
spacing/          0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96（4px 基线）
radius/           none / xs / sm / md / lg / xl / 2xl / full
border-width/     0 / hairline / 1 / 2
font-size/        xs / sm / base / lg / xl / 2xl / 3xl / 4xl / 5xl（1.125 比例）
font-weight/      regular(400) / medium(500) / semibold(600) / bold(700)
line-height/      tight(1.1) / snug(1.3) / normal(1.5) / relaxed(1.7)
letter-spacing/   tight / normal / wide
shadow/           xs / sm / md / lg / xl（原始阴影曲线）
z/                base(0) / dropdown(10) / sticky(20) / overlay(30) / modal(40) / toast(50)
duration/         instant(0) / fast(120) / normal(200) / slow(320) / deliberate(480)
easing/           linear / standard / emphasized / decelerate / accelerate / spring
breakpoint/       sm(640) / md(768) / lg(1024) / xl(1280) / 2xl(1536)
opacity/          5 / 10 / 20 / 40 / 60 / 80 / 95
blur/             xs / sm / md / lg（毛玻璃）
aspect/           poster(2:3) / backdrop(16:9) / square(1:1) / card(5:6) / ultrawide(21:9)
color-ramp/       neutral / accent-seed / success / warning / danger / info 各 50–950 共 11 档
```

#### Semantic 子层（语义别名，主题切换的主战场）

```
color.bg/           app / surface / surface-raised / surface-sunken / surface-hover / surface-active / inverse / overlay / scrim
color.fg/           primary / secondary / tertiary / disabled / placeholder / inverse / on-accent
color.border/       default / subtle / strong / focus
color.accent/       solid / solid-hover / solid-active / subtle / subtle-hover / fg
color.status.<s>/   solid / subtle / fg / border    （s = success | warning | danger | info）
color.link/         default / hover / visited
ring.focus/         color / width / offset
radius.scheme/      control / card / sheet / pill
shadow.scheme/      card / popover / dialog / player-overlay
typography.preset/  display / heading-1 / heading-2 / heading-3 / heading-4 / body / body-sm / caption / label
```

#### Component 子层（只收共享组件真正用到的，用出来一个收一个）

```
button/             size-sm|md|lg × { padding-x, padding-y, height, icon-gap, radius }
input/              height / padding-x / radius / border-color-default / focus-ring
card/               radius / padding / shadow
dialog|sheet/       radius / header-padding / overlay-opacity / max-width
player-control/     icon-size / button-hit-area / overlay-opacity / timeline-height
tab-bar/            height / icon-size / active-indicator-height / safe-area-padding
banner/             aspect / overlay-gradient-from / overlay-gradient-to
skeleton/           shimmer-duration / base-color / highlight-color
badge|chip/         height / padding-x / radius / font-size
```

### 4.3 品牌层（`brands/<brand>.tokens.json`）

**覆写与新增白名单**：

- **可覆盖** Semantic 层的引用目标（例如把 `color.accent.solid` 指向不同的 primitive ramp）
- **可覆盖** Component 层的个别字段（例如调整 `banner/overlay-gradient-*`）
- **可新增** `brand/*` 专属 Token
- **禁止** 直接覆盖 Primitive 层的具体数值（保持基座稳定，所有品牌共享同一结构语言）
- **禁止** 新增 Semantic/Component 层字段（这是 base 专属领域，新增走 base 的 PR）

#### 品牌身份（brand/ 前缀，与样式无关的业务字段）

```
brand/identity/name             品牌中文名
brand/identity/name-en          英文名
brand/identity/name-short       短名（logo fallback 首字）
brand/identity/tagline          副标语
brand/identity/description      SEO 描述

brand/asset/logo-url            主 Logo
brand/asset/logo-url-mono       单色版
brand/asset/logo-url-dark       深色 Logo（可选）
brand/asset/favicon             favicon
brand/asset/og-image            默认分享图

brand/footer/text               版权文本
brand/footer/icp                ICP 备案号
brand/footer/icp-police         公安备案（可选）
brand/support/email             客服邮箱
brand/social/*                  社交链接（键名自由）
```

#### 品牌调色与排版（影响 Semantic / Component 层取值）

```
brand/palette/accent-seed       主色种子（自动推导 accent 11 档色阶）
brand/palette/neutral-tint      中性色倾向：cool | neutral | warm（微调 neutral 11 档色相）
brand/palette/fallback-seeds[]  保底封面 SVG 的候选色数组

brand/typography/display-family 标题字体族（可选，未声明则继承 base）
brand/typography/body-family    正文字体族（可选）

brand/radius-scheme             sharp | standard | rounded（三选一，驱动 radius.scheme.* 的整体风格）
```

#### 允许品牌层直接覆写的 Semantic / Component 字段（建议白名单）

```
color.accent.*                  品牌色直接影响
color.status.*                  可按品牌微调（通常保持不变）
radius.scheme.*                 受 brand/radius-scheme 驱动，也可单独覆写
typography.preset.display       标题字体 preset
typography.preset.heading-*     标题 preset
banner/overlay-gradient-*       品牌化 banner 遮罩
card/shadow                     品牌阴影偏好
player-control/overlay-opacity  播放器控件 overlay 强度
```

其他 Semantic / Component 字段保持 base 提供，避免品牌层爆炸；如果某品牌确实需要覆盖白名单之外的字段，走 base 的 PR 扩展白名单。

### 4.4 Token 条目结构

**每个 Token 的结构**（W3C 标准）：

```json
{
  "color/surface/base": {
    "$type": "color",
    "$value": {
      "light": "oklch(97% 0.005 250)",
      "dark":  "oklch(14% 0.006 250)"
    },
    "$description": "最底层面板背景色，页面背景基底"
  }
}
```

**命名规则**：

1. 分段使用 `/`，最终生成 CSS 变量时转 `--`：`color/surface/base` → `--color-surface-base`
2. 语义化优先，如 `color/content/primary` 而非 `color/gray-900`
3. 组件级 Token 独立前缀：`player/control-bg`、`card/poster-radius`
4. 状态后缀：`-hover` / `-active` / `-disabled` / `-focus`
5. 品牌专属 Token 一律 `brand/*` 前缀

**引用（Alias）**：允许 Token 引用其他 Token，格式 `{color/brand/primary}`。构建时解析。支持跨层引用（品牌层可引用基础层）。

**双主题存储**：每个颜色 Token 的 `$value` 为对象，含 `light` / `dark`。非颜色 Token 单值。

### 4.5 合并策略

构建时按 **base → brand → theme** 顺序深度合并：

```
最终 Token (light) = deepMerge(base.light, brand.light)
最终 Token (dark)  = deepMerge(base.dark,  brand.dark)
```

品牌层只需声明要覆盖或新增的 Token，未声明的继承自 base。

### 4.6 新增品牌的流程

1. 复制 `brands/_template.tokens.json` 为 `brands/<new>.tokens.json`
2. 填写该品牌的 Token 值（至少覆盖 `brand/*` 必填项）
3. 在 `config/brands.ts` 登记 `{ id, domain, enabled }`
4. `npm run tokens:build` 生成 `<new>.light.css` / `<new>.dark.css`
5. 完成。零代码改动。

### 4.7 数值策略：锁结构 + 种子值 + 迭代收敛

Token 的 **结构**（三子层、字段、命名、引用规则、品牌覆写白名单）在本方案定稿即锁定；**数值**（具体色卡、阴影曲线、radius 档位、typography 比例）分两步收敛，避免在没有实物之前反复纠结。

**步骤 A · 种子值**（随 Token 基座一起提交，目的是"先让组件能跑"）：

1. 中性色阶与字号比例参照 Radix Themes / shadcn 浅色基线
2. 圆角与阴影曲线参照 shadcn default preset
3. Duration / Easing 参照 Material Motion 标准曲线
4. `accent-seed` 先取当前现网主色的 OKLCH 等效值，只修正饱和度与亮度均匀性
5. 深色主题自动按 OKLCH 明度翻转 + 饱和度微降生成（脚本一次跑出，不手调）

**步骤 B · 迭代收敛**（第一批共享组件接入 Token 后一到两天内完成）：

1. 接入 Banner / VideoCard / Player 控制条 / 主 CTA Button / 搜索 Input 这 5 个代表性组件
2. 在后台预览画布对照真实数据调整，light / dark 并排对照
3. **只调 Semantic 层引用，不改 Primitive 数值**（例如把 `color.bg.app → neutral.50` 改为 `→ neutral.100`，而不是改 `neutral.50` 本身）
4. 收敛到"浅色不刺白、深色不黑死、主色与中性色对比度达 AA"即可封版
5. 定稿时生成 `packages/design-tokens/tokens.lock.json` 锚定当前值；后续 Token 值变动必须走 PR 审查

**明确不做**：任何 "在没有实物之前先追求 pixel-perfect" 的返工路径。

---

## 5. 后台页面 `/admin/design-system` 规格

### 5.0 MVP 与完整形态的边界

本节 5.1–5.7 描述 Token 编辑后台的 **完整目标形态**。本轮落地只做 **MVP 版本**，在完整形态基础上按下列规则收敛；V2 再补齐。

**MVP 必须包含**：

1. **三栏布局**：左栏品牌切换器（灰态，仅 Resovo 可选）+ 分组导航；中栏表单编辑区；右栏实时预览 iframe
2. **读**：从 `base.tokens.json` + `brands/resovo.tokens.json` 合并后渲染表单
3. **字段覆盖**：Primitive / Semantic / Component / Brand 四类按 4.2–4.3 枚举
4. **类型化控件**：color（OKLCH/Hex 输入 + 取色器 + light/dark 分栏）、dimension、duration、shadow、fontFamily、url、string；alias 引用下拉
5. **继承指示**：每个字段标注 "继承自 base" 或 "brand-override"，品牌层允许 "解除继承 / 重置回继承"（仅白名单内字段）
6. **实时预览**：右栏 iframe 加载 `/internal/token-preview?brand=<id>&theme=<t>`，内含体检组件（清单见 5.0 尾段）
7. **校验**：保存前跑 ①WCAG AA 对比度 ②字段完整性（brand 必填）③alias 引用闭环 ④禁改 Primitive 数值（只能通过 Semantic 重新引用）
8. **保存链路**：写回 JSON → 触发 `tokens:build` → 预览 iframe reload
9. **Diff 辅助**：保存前显示 JSON diff 和关键组件渲染对比，生成建议 commit message（不直接 push，不直接写生产）
10. **主题切换**：预览头部 light / dark 切换、并排对比；断点切换（mobile / desktop）
11. **权限**：仅超级管理员；MVP 生产环境只读（保存 API 在生产返回 403，前端按钮禁用并提示）

**MVP 明确不做（归入 V2）**：

1. 版本历史 / 一键回滚（v1 依赖 git）
2. 导入 / 导出 tokens.json（v1 依赖 git）
3. 新增品牌向导 UI（v1 手动复制 `_template.tokens.json`）
4. Token 新增 / 重命名 / 删除（v1 只改值，新增走代码 PR）
5. 多人协作冲突检测
6. WYSIWYG 可视化拖拽
7. 生产环境保存写回（生产只读）
8. 视觉回归快照对比
9. 非 CSS 场景（canvas / SVG）的运行时 Token 面板

**MVP 四个路由**：

- `/admin/design/tokens`（主编辑页，三栏布局）
- `/admin/design/preview`（独立组件 Gallery 全屏页，供 iframe 嵌入和独立预览复用）
- `/admin/design/diff`（保存前 diff 对比页）
- `/admin/design/brands`（品牌列表只读；新建品牌 V2 再做）

**MVP 预览画布的 "体检组件" 清单**（控制在 10 个以内）：

1. Button（primary / secondary / ghost / danger 四种 × sm|md|lg）
2. Input + 搜索 Input
3. Card（poster 与 backdrop 两种）
4. Badge / Chip
5. Dialog + BottomSheet 静态态
6. Player 控制条片段
7. Banner 缩略片段（含遮罩渐变）
8. BottomTabBar 片段
9. FallbackCover（四种 aspect）
10. Typography preset 清单（display / heading / body 全打样）

其余组件的打样留到 V2 或在共享组件落地过程中按需追加。

---

### 5.1 路由与权限

- 路径：`/admin/design-system`
- 权限：超级管理员
- 入口：后台主导航新增菜单项"设计系统"

### 5.2 页面布局

四栏布局（桌面）/ 折叠（移动）：

```
┌────────┬─────────────┬──────────────────────────┬─────────────┐
│ 品牌切换 │ 分组导航     │ 表单编辑区                │ 实时预览     │
│         │             │                           │             │
│ Resovo ▾│ 基础         │ 当前组的 Token 列表       │ 组件样本     │
│ （灰态） │  ├ 颜色      │ 每行：name / 值 / 预览   │ 画布         │
│ 未来品牌 │  ├ 字体      │ 描述                      │             │
│         │  ├ 间距      │ 继承层级指示（base/brand）│ 浅/深切换    │
│         │  └ ...       │                           │ 断点切换     │
│         │ 品牌         │                           │             │
│         │  ├ 身份      │                           │             │
│         │  ├ 调色板    │                           │             │
│         │  └ 文案      │                           │             │
└────────┴─────────────┴──────────────────────────┴─────────────┘
```

### 5.3 品牌切换器

- 顶部 dropdown，默认"Resovo"
- 本轮只有一个品牌可选，控件灰态显示，点击提示"当前仅支持 Resovo，未来版本开放多品牌编辑"
- 架构层已接通品牌切换逻辑，激活第二个品牌时零代码改动

### 5.4 分组与表单字段

按"基础 / 品牌"两大类分 tab。每个字段提供：

- 名称（不可改）
- 描述（可编辑，更新到 `$description`）
- **继承指示**：显示该值来自哪一层（base 或 brand-override）；品牌层可"解除继承"改为自有值，或"重置继承"回到 base
- 值（根据 `$type` 提供不同控件）
  - `color`：Hex / OKLCH / RGB 三种输入 + 取色器 + 浅色/深色独立编辑
  - `dimension`：数值 + 单位（px / rem）
  - `duration`：数值（ms）+ 预览一个动画示例
  - `cubicBezier`：可视化贝塞尔曲线编辑器（或从 5 个预设选）
  - `shadow`：x / y / blur / spread / color 多字段
  - `fontFamily`：下拉选 + 自定义输入
  - `url`（品牌层 Logo / favicon / og-image 等）：上传或填写 URL，预览
  - `string`（品牌文案）：文本输入，多语言预留（本轮单语言）
- 引用 Token（下拉选择已存在的 Token，自动转为 alias）

### 5.5 实时预览画布

右侧固定画布，展示**约 20 个典型组件样本**，分三组：

1. **基础原子**：Button（5 variants）、Input、Chip、Badge、Avatar、Skeleton、Tooltip
2. **领域组合**：PosterCard、EpisodeCard、FilterBar、Banner 片段、PlayerControl 片段、FallbackCover（样板图四种比例）
3. **布局**：Header 片段、BottomTabBar、EmptyState、Footer 片段

样本组件订阅 CSS 变量 + 品牌上下文，Token 编辑后**即时**反映（无需保存）。

画布顶部：
- 主题切换（浅 / 深 / 并排对比）
- 断点切换（移动 / 平板 / 桌面）
- 对比模式（展示修改前后 diff）

### 5.6 保存与版本管理

- **编辑**：所有修改暂存在本地 state（未保存标识）
- **保存**：调用 `PUT /api/admin/design-tokens?brand=<brandId>` 写回对应 `tokens.json`
- **导出**：下载当前品牌的 `tokens.json` 或合并后的 `tokens.css` 产物
- **导入**：上传 `tokens.json` 覆盖当前（需二次确认）
- **版本历史**：每次保存在 DB 记录一条快照（`brand_id / snapshot / created_at / editor_id`，仅保留最近 20 条），可一键回滚
- **发布**：保存即生效于开发环境；生产生效需要重新 build（纳入 CI）

### 5.7 编辑安全

- 所有 Token 名称固定，不允许新增或删除（防止破坏已使用的变量）
- 新增 Token 需要通过 PR（代码评审），后台只负责**值的调整**
- 非法值（如空颜色）前端阻断
- 每次保存自动运行 `tokens:validate` 脚本（schema 校验 + alias 循环检测 + 品牌必填项检查）
- **品牌身份字段（name、Logo、ICP 等）**标记为必填，保存时缺失则阻断

---

## 6. 构建管线

`base.tokens.json` + `brands/*.tokens.json` 是源，构建脚本产出多类文件。

### 6.1 流程图

```
base.tokens.json
       │
       ├──┐
       │  ▼
       │  merge  ◀──  brands/resovo.tokens.json
       │  │
       │  ▼
       │  build
       │  │
       │  ├─→ dist/resovo.light.css    （:root 下的 CSS 变量）
       │  ├─→ dist/resovo.dark.css     （[data-theme="dark"] 下的变量）
       │  │
       │  （未来新增品牌时同样生成 brand-b.light.css / brand-b.dark.css）
       │
       ├─→ dist/tailwind.tokens.ts     （Token 名 → CSS var 映射；品牌无关）
       │
       └─→ dist/tokens.d.ts            （TS 类型，TokenName 联合）
```

### 6.2 触发时机

- 后台保存 → 立即触发增量构建（仅该品牌）
- `npm run dev` 启动前预构建（所有启用品牌）
- `npm run build` 生产构建前强制重建
- 纳入 `npm run typecheck` 前置（产物若缺失则构建）

### 6.3 品牌 CSS 加载

运行时只加载 `currentBrand × currentTheme` 的一份 CSS，按 layout 动态插入 `<link>`：

```tsx
// app/layout.tsx（示意）
const brand = await detectBrandFromHost();  // middleware 注入
const theme = await readThemeCookie();
return (
  <html data-brand={brand} data-theme={theme}>
    <head>
      <link rel="stylesheet" href={`/design-tokens/${brand}.${theme}.css`} />
    </head>
    <body>...</body>
  </html>
);
```

### 6.4 `tokens.css` 输出示例

```css
:root {
  --color-surface-base: oklch(97% 0.005 250);
  --color-content-primary: oklch(20% 0.02 250);
  --color-brand-primary: oklch(60% 0.18 250);
  --radius-md: 12px;
  --motion-duration-base: 220ms;
  /* ... */
}

[data-theme="dark"] {
  --color-surface-base: oklch(14% 0.006 250);
  --color-content-primary: oklch(95% 0.01 250);
  --color-brand-primary: oklch(68% 0.18 250);
  /* 仅覆盖与浅色不同的 Token */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-base: 0ms;
    /* ... */
  }
}
```

### 6.5 `tailwind.tokens.ts` 使用

```ts
// tailwind.config.ts
import { tokens } from '@resovo/design-tokens';

export default {
  theme: {
    extend: {
      colors: tokens.colors,           // 映射到 var(--color-*)
      borderRadius: tokens.radius,
      spacing: tokens.spacing,
      // ...
    }
  }
};
```

Tailwind 类名如 `bg-surface-base` 编译为 `background-color: var(--color-surface-base)`。组件**品牌无关**，Token 在运行时按当前品牌 CSS 覆写 CSS 变量。

### 6.6 TS 类型

```ts
export type ColorTokenName = 'surface/base' | 'surface/elevated-1' | /* ... */;
export type BrandTokenName = 'brand/name' | 'brand/logo/url' | /* ... */;

export function token(name: ColorTokenName): string;     // 返回 var(--color-surface-base)
export function brandToken(name: BrandTokenName): string; // 返回品牌层值（从 useBrand() 取）
```

---

## 7. 主题切换实现

主题切换与品牌切换**正交独立**：品牌决定色彩身份，主题决定明暗。

### 7.1 三态语义

- **light**：强制浅色
- **dark**：强制深色
- **system**：跟随 `prefers-color-scheme`

### 7.2 存储

- **`localStorage`**：`resovo.theme` = `'light' | 'dark' | 'system'`
- **Cookie**：同名同值，`SameSite=Lax`，SSR 可读，30 天过期
- Cookie 不区分品牌（同一用户跨品牌主题偏好一致）

### 7.3 首屏无闪烁

在 `<head>` 注入 **blocking inline script**（必须最早执行，早于任何 CSS 加载）：

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('resovo.theme') || 'system';
      var resolved = t === 'system'
        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t;
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.style.colorScheme = resolved;
    } catch (e) {}
  })();
</script>
```

SSR 模式下，服务端读 Cookie 同样设置 `data-theme`，避免 CSR 再次闪烁。

**品牌侧首屏**：middleware 识别品牌后通过 response header 或 cookie 注入，同样由 blocking script 读取并设置 `data-brand`。Token CSS 按 `data-brand` + `data-theme` 组合命中正确文件。

### 7.4 切换控件（UI）

位置：页眉用户区（未登录期间先放页眉右侧） + 未来设置页。

形态：**Segmented Control**，三段：`☀️ 浅 | 🌓 自动 | 🌙 深`

交互：
- 点击任一段立刻切换
- 配合 **View Transitions API** 做圆形扩散过渡（从按钮位置扩散新主题），约 480ms
- "自动"态悬浮时浮层提示"当前系统为深色"

### 7.5 系统主题变更监听

`window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`：用户选 `system` 时，系统切换即时响应。

---

## 8. 品牌上下文 Provider

### 8.1 组件契约

```ts
// src/lib/brand/types.ts
export interface BrandContext {
  id: string;                    // 'resovo' | 'brand-b' | ...
  name: string;                  // brand/name
  nameEn: string;
  nameShort: string;
  logo: { url: string; urlMono: string; urlDark?: string };
  favicon: string;
  ogImage: string;
  tagline: string;
  description: string;
  palette: {
    primary: string;
    accent: string;
    neutralHue: number;
    fallbackSeeds: string[];
  };
  footer: { text: string; icp: string; icpPolice?: string };
  support: { email: string };
  social: Record<string, string>;
}
```

### 8.2 使用

```tsx
const brand = useBrand();
<img src={brand.logo.url} alt={brand.name} />
<footer>{brand.footer.text} · {brand.footer.icp}</footer>
```

### 8.3 SSR 注入

- middleware 识别 → 写 cookie `resovo.brand=<brandId>`
- Root layout Server Component 读 cookie → 从构建产物加载对应品牌配置 → 传入 `<BrandProvider initialBrand={...}>`
- 首屏 React tree 即拥有正确品牌上下文，无水合闪烁

### 8.4 Token 访问的两种方式

- **样式（首选）**：CSS 变量 `var(--brand-primary)`，由当前品牌 CSS 文件提供，运行时切换零 JS 成本
- **运行时读值（少用）**：`useBrand().palette.primary`，用于 canvas/svg 内联填充、样板图生成等非 CSS 场景

---

## 9. 迁移策略

### 9.1 原则

**不要求**一次性改完所有组件。旧 Tailwind 硬编码（如 `bg-white`）与 Token 驱动类（如 `bg-surface-base`）可共存一段时间。

### 9.2 分阶段

**阶段 1（本方案范围内）**：
- 建立分层 `tokens.json` + 构建管线
- 搭建 `/admin/design-system` 后台（含灰态品牌切换器）
- 主题切换三态 + 首屏无闪烁
- `<BrandProvider>` + `useBrand()` primitive
- middleware 品牌识别链（仅路由到 `resovo`）
- **新写的组件**全部使用 Token 和 `useBrand()`

**阶段 2（随前端重新设计推进）**：
- 按页面/模块渐进替换：Header → Footer → 首页 → 详情页 → 播放页 → 后台表格
- Header / Footer / 样板图等品牌触点**优先迁移**
- 每个模块替换时同步更新测试快照

**阶段 3（收尾）**：
- 开启 ESLint 规则：禁止 `className` 中出现色相类名（`bg-white` / `bg-gray-*` 等），强制使用语义 Token
- 禁止组件内硬编码品牌字符串（如 `'Resovo'`），必须通过 `useBrand()`
- 残余硬编码视情况列入技术债清单

### 9.3 不迁移的部分

- 第三方组件库（若有）内部样式
- 已计划下线的旧模块
- 播放器 core 层（已隔离，只通过外部 Token 定制外观）

---

## 10. 里程碑拆分（建议 3 个任务卡）

### 任务 1：Token Schema 分层与构建管线（CHG-xxx）

- [ ] 新建 `packages/design-tokens/` workspace
- [ ] 定稿 `base.tokens.json` 初版
- [ ] 定稿 `brands/resovo.tokens.json` 初版（浅色 + 深色双套）
- [ ] 建立 `brands/_template.tokens.json` 脚手架
- [ ] 实现 `tokens:build:css` 脚本（支持 base × brand × theme 矩阵输出）
- [ ] 实现 `tokens:build:tailwind` 脚本
- [ ] 实现 `tokens:build:types` 脚本
- [ ] 实现 `tokens:validate` 脚本（schema + alias + 品牌必填项）
- [ ] 接入 `tailwind.config.ts` 与 `app/layout.tsx`
- [ ] 首屏无闪烁 blocking script 落地（主题 + 品牌）
- [ ] 单元测试：schema 校验、alias 解析、双主题生成、品牌合并

**文件范围**：`packages/design-tokens/**`、`tailwind.config.ts`、`postcss.config.mjs`、`app/layout.tsx`、`src/styles/tokens.css`、`src/middleware.ts`

### 任务 2：品牌上下文 + 主题切换控件（CHG-xxx）

- [ ] `<BrandProvider>` 与 `useBrand()` hook
- [ ] middleware 品牌识别链（域名映射 + query + cookie + 默认）
- [ ] `<ThemeProvider>` 与 `useTheme()` hook
- [ ] `<ThemeSwitcher>` Segmented Control 组件
- [ ] Cookie 同步（主题）+ SSR 读取
- [ ] View Transitions API 圆形扩散过渡
- [ ] 系统主题变更监听
- [ ] E2E 测试：三态切换 + 刷新保持 + 品牌识别链全部四条路径

**文件范围**：`src/components/shared/theme/**`、`src/components/shared/brand/**`、`src/lib/theme/**`、`src/lib/brand/**`、`src/middleware.ts`、`app/layout.tsx`

### 任务 3：Token 编辑后台（CHG-xxx）

- [ ] 路由 `/admin/design-system`
- [ ] 四栏布局 + 品牌切换器（灰态）+ 基础/品牌 Tab
- [ ] 各类型字段编辑器（含继承层级指示）
- [ ] 实时预览画布（20+ 组件样本 + 样板图）
- [ ] 保存 API（按品牌写回对应文件）/ 导入导出 / 版本历史
- [ ] 管理员鉴权
- [ ] 校验阻断（品牌必填项缺失 / schema 非法）
- [ ] E2E 测试：编辑 → 保存 → 预览更新 → 版本回滚

**文件范围**：`src/app/admin/design-system/**`、`src/api/routes/admin/design-tokens/**`、`src/api/services/DesignTokensService.ts`

---

## 11. 架构决策要点（需追加到 `docs/decisions.md`）

1. **选 CSS 变量 + Tailwind 桥接**，不选 Tailwind Plugin / CSS-in-JS：保留零运行时、SSR 友好、主题/品牌切换零 JS。
2. **选 W3C Design Tokens 格式**，不自造 schema：未来接入任何标准工具零成本。
3. **选 base + brand 两层分离**，不单文件分区：新增品牌零改动基础层，合并逻辑清晰。
4. **选双主题同文件存储**（`$value` 对象），不拆两个文件：避免新增 Token 时漏加深色值。
5. **选按品牌 × 主题组合构建**多份 CSS，不一份 CSS 内穷举所有品牌：运行时加载最小。
6. **选设计期 Token 优先，运行时 Token 暂缓**：先解决现有痛点，避免过度设计。
7. **选后台只改值不改名**：防止破坏代码依赖，新增 Token 走代码评审。
8. **选主题与品牌正交独立**：同一品牌可切浅/深；同一主题可切不同品牌。

---

## 12. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `tokens.json` 被后台保存损坏 | 每次保存前 schema 校验 + 自动备份到版本历史 |
| 生产环境后台保存是否写回文件？ | **默认不允许**，生产仅从构建产物读取；后台在生产为只读预览 |
| 浅色 Token 调过头导致关键组件失效 | 预览画布样本覆盖关键路径；CI 有视觉回归测试（后续任务） |
| 旧组件硬编码和新 Token 类混用期间视觉不一致 | 接受过渡期，以页面为单位推进迁移 |
| 构建管线出错导致 dev 启动卡住 | 产物缓存 + `tokens:build` 失败时退回上次产物 |
| 新增品牌时忘加 Token 导致空白值 | `_template.tokens.json` 列出所有必填项 + `tokens:validate` 阻断 |
| 单品牌初期投入分层结构造成冗余 | 基础层/品牌层划分让单品牌期间也更清晰；未来新增品牌时零成本 |

---

## 13. 待定问题

1. 是否将 `packages/design-tokens` 设计为可独立发布的 npm 包？（影响其他子项目如 `apps/admin` 是否复用）
2. 后台编辑是否支持多人协作冲突检测？（v1 暂不做，单管理员编辑）
3. Token 版本与 app 版本是否绑定发布？（建议绑定，避免生产运行时读到新 Token 但组件还没更新）
4. 品牌 Logo 等二进制资产是存 Git 还是图片 CDN？（建议 Git，与 Token 同步变更审计）

---

## 14. 关联文档

- 前端重新设计总方案：`docs/frontend_redesign_plan_20260418.md`
- 图片管线与样板图系统：`docs/image_pipeline_plan_20260418.md`
- 架构决策：`docs/decisions.md`（需追加 Token / 品牌相关 ADR）
- UI 规范：`docs/rules/ui-rules.md`（迁移完成后补充 Token 使用规则）
