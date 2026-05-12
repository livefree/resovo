# Resovo Design Tokens 审计 & 补齐方案

审计对象：`livefree/resovo@dev · packages/design-tokens/`
审计日期：2026-04-21
与之对齐的设计稿：`home-b.html`, `Site Design.html`, `Motion Spec.html`, `Global Shell.html`

---

## TL;DR

现有 tokens 体系**相当完善**，已覆盖视频站的主要设计维度（色彩、排版、海报堆叠、Takeover、Route stack、Tag、Player 三态）。本次设计稿需要的大多数能力都有对应 token，**仅需追加 4 组**小补丁即可完整落地：

1. **类型 chip**（电影/剧集/动漫/综艺/纪录片）— `tag.ts` 追加 10 条
2. **背景图案**（dots/grid/noise）— 新建 `semantic/pattern.ts`
3. **MiniPlayer 浮窗行为**（B 站风）— `components/player.ts` 扩展 `mini` 子节点
4. **PC 路由切换**（区别于移动端 route-stack）— 新建 `semantic/route-transition.ts`

附加 1 条 bugfix + 2 条建议。

---

## 1. 已覆盖 ✅（无需改动）

| 设计稿需求 | 现有 token |
|---|---|
| OKLCH 双主题 | `colors.*` + `bg/fg/border/accent` semantic |
| 动效时长 6 档 / 5 种 easing | `motion.duration.*` / `motion.easing.*` |
| 移动端页面栈（滑动返回） | `semantic/route-stack.ts` |
| 共享元素过渡（View Transitions） | `semantic/shared-element.ts` |
| Fast / Standard Takeover | `semantic/takeover.ts` |
| 播放器 full / mini / pip 三态 | `components/player.ts` |
| Tag lifecycle（5 子类）+ trending（4 子类） | `semantic/tag.ts` |
| Tabbar 移动端底栏 | `semantic/tabbar.ts` |
| 海报堆叠动效 | `semantic/stack.ts` |
| Skeleton 占位 | `semantic/skeleton.ts` |
| State（success/warning/error/info） | `semantic/state.ts` |
| Scrim 渐变 | `surface.scrim` |
| z-index 层级（player 1700 最高） | `primitives/z-index.ts` |

---

## 2. 需要补齐 ⚠️

### 2.1 类型 Chip — `semantic/tag.ts`

**场景**：VideoCard 下方显示「电影 / 剧集 / 动漫 / 综艺 / 纪录片」的小色标，扫视识别。
**现状**：目前 tag 只有 lifecycle + trending + spec，**没有 type chip**。
**设计稿值**：按类型色相区分，与 trending 调色板互不冲突。

**建议 diff**（追加到 `tag.light` 和 `tag.dark`）：

```ts
// src/semantic/tag.ts
export const tag = {
  light: {
    // … 现有字段 …

    // ── type chips ────────────────────────────────────────────────────────
    chipMovieBg:  colors.accent[100],     //   蓝
    chipMovieFg:  colors.accent[700],
    chipSeriesBg: colors.warning.light,   //   金
    chipSeriesFg: colors.warning.dark,
    chipAnimeBg:  'oklch(91% 0.08 320)',  //   紫
    chipAnimeFg:  'oklch(40% 0.14 320)',
    chipTvshowBg: colors.success.light,   //   绿
    chipTvshowFg: colors.success.dark,
    chipDocBg:    colors.gray[200],       //   灰
    chipDocFg:    colors.gray[700],
  },
  dark: {
    // … 现有字段 …
    chipMovieBg:  colors.accent[900],
    chipMovieFg:  colors.accent[100],
    chipSeriesBg: colors.warning.dark,
    chipSeriesFg: colors.warning.light,
    chipAnimeBg:  'oklch(35% 0.12 320)',
    chipAnimeFg:  'oklch(91% 0.08 320)',
    chipTvshowBg: colors.success.dark,
    chipTvshowFg: colors.success.light,
    chipDocBg:    colors.gray[800],
    chipDocFg:    colors.gray[300],
  },
}
```

生成的 CSS：
```css
--tag-chip-movie-bg / -fg
--tag-chip-series-bg / -fg
--tag-chip-anime-bg / -fg
--tag-chip-tvshow-bg / -fg
--tag-chip-doc-bg / -fg
```

---

### 2.2 背景图案 — 新建 `semantic/pattern.ts`

**场景**：主题要求"简单几何背景图（dots / grid）"，作为 `<body>` 或 `app-shell` 的底纹。
**现状**：没有任何 pattern 相关 token。

**建议新文件**：

```ts
// src/semantic/pattern.ts
export interface PatternTheme {
  dotsBg:   string   // CSS background-image 值（radial-gradient 点阵）
  gridBg:   string   // CSS background-image 值（linear-gradient 网格）
  noiseBg:  string   // CSS background-image 值（SVG data URL）
  dotsSize: string   // background-size
  gridSize: string
}

export interface PatternToken {
  light: PatternTheme
  dark:  PatternTheme
}

export const pattern: PatternToken = {
  light: {
    dotsBg:   'radial-gradient(oklch(86.9% 0.009 247) 1px, transparent 1px)',
    gridBg:   'linear-gradient(oklch(92.9% 0.006 247) 1px, transparent 1px), linear-gradient(90deg, oklch(92.9% 0.006 247) 1px, transparent 1px)',
    noiseBg:  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    dotsSize: '20px 20px',
    gridSize: '40px 40px',
  },
  dark: {
    dotsBg:   'radial-gradient(oklch(23.0% 0.010 247) 1px, transparent 1px)',
    gridBg:   'linear-gradient(oklch(16.5% 0.008 247) 1px, transparent 1px), linear-gradient(90deg, oklch(16.5% 0.008 247) 1px, transparent 1px)',
    noiseBg:  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    dotsSize: '20px 20px',
    gridSize: '40px 40px',
  },
}
```

在 `semantic/index.ts` 追加 export。

生成的 CSS：
```css
--pattern-dots-bg
--pattern-grid-bg
--pattern-noise-bg
--pattern-dots-size
--pattern-grid-size
```

使用：
```css
body {
  background-color: var(--bg-canvas);
  background-image: var(--pattern-dots-bg);
  background-size: var(--pattern-dots-size);
}
```

---

### 2.3 MiniPlayer 行为 token — 扩展 `components/player.ts`

**场景**：B 站风右下角浮窗，可拖、可关、需要默认位置和吸附行为。
**现状**：`player.mini` 已有颜色/radius/shadow，但**没有几何与交互参数**。

**建议 diff**：

```ts
// src/components/player.ts — 扩展 mini
export const player = {
  // … full, pip 不变 …
  mini: {
    // 现有字段保持
    bg: colors.gray[950],
    overlay: `color-mix(in oklch, ${colors.gray[1000]} 55%, transparent)`,
    controlsFg,
    progressTrack,
    progressFill: accent.dark.default,
    bufferFill,
    radius: radius.lg,            // 🔸 md → lg，更圆润
    shadow: shadow.xl,            // 🔸 lg → xl，浮感更强
    paddingX: space[2],
    paddingY: space[2],
    zIndex: zIndex.player,

    // 🆕 几何
    width:           '320px',      // 默认宽
    height:          '180px',      // 16:9
    minWidth:        '240px',
    maxWidth:        '480px',
    aspectRatio:     '16 / 9',
    dockX:           '16px',       // 默认右侧边距
    dockY:           '16px',       // 默认底部边距（在 tabbar 之上）
    snapThreshold:   '48px',       // 拖动吸附到 4 个角的触发距离

    // 🆕 交互
    dragHandleHeight: '32px',      // 顶部拖拽条高度
    closeButtonSize:  '24px',
    resizeHandleSize: '16px',      // 右下角缩放柄
    transitionIn:     '240ms cubic-bezier(0.34, 1.56, 0.64, 1)', // spring
    transitionOut:    '180ms cubic-bezier(0.4, 0, 1, 1)',
  },
}
```

生成的 CSS：
```css
--player-mini-width / height / min-width / max-width / aspect-ratio
--player-mini-dock-x / dock-y / snap-threshold
--player-mini-drag-handle-height
--player-mini-close-button-size
--player-mini-resize-handle-size
--player-mini-transition-in / -out
```

**注**：`build-css.ts` 需要支持 player.mini 的新字段扁平化为 CSS 变量（如果目前的脚本是白名单式）。

---

### 2.4 PC 路由过渡 — 新建 `semantic/route-transition.ts`

**场景**：`route-stack.ts` 是移动端侧滑返回的参数。PC 端页面切换需要另一套（fade / shared-element），和移动端参数独立。
**现状**：没有 PC 专用的路由过渡 token。

**建议新文件**：

```ts
// src/semantic/route-transition.ts
export interface RouteTransitionToken {
  // 'fade' 默认：普通页面切换
  fadeDuration:       string
  fadeEasing:         string

  // 'slide' 备选：横向滑入（更有层次感）
  slideDuration:      string
  slideDistance:      string
  slideEasing:        string

  // 'shared' 共享元素：海报 → 详情页的连续过渡
  // （与 sharedElement 保持一致，但此处为 PC 语义别名）
  sharedDuration:     string
  sharedEasing:       string

  // reduced-motion 模式下的退化时长
  reducedDuration:    string
}

export const routeTransition: RouteTransitionToken = {
  fadeDuration:    '200ms',
  fadeEasing:      'cubic-bezier(0, 0, 0.2, 1)',

  slideDuration:   '320ms',
  slideDistance:   '32px',
  slideEasing:     'cubic-bezier(0.4, 0, 0.2, 1)',

  sharedDuration:  '360ms',
  sharedEasing:    'cubic-bezier(0.4, 0, 0.2, 1)',

  reducedDuration: '80ms',
}
```

在 `semantic/index.ts` export。

---

## 3. 建议修正 🔧

### 3.1 Bug · 西里尔字母污染

文件：`semantic/tag.ts`
字段：`lifecycleDеlistingBg` / `lifecycleDеlistingFg`

`Dеlisting` 中间那个 `е` 是**西里尔字母 U+0435**，不是拉丁 `e` (U+0065)。现在任何 TS 代码用 `tag.light.lifecycleDelistingBg`（拉丁 e）会报 `undefined`。

**修复**：

```ts
// 错：lifecycleDеlistingBg  （西里尔 е）
// 对：lifecycleDelistingBg  （拉丁 e）
```

写一个一次性 codemod 或手改全 3 处（tag.light + tag.dark + 可能的消费端）即可。

### 3.2 建议 · 卡片 hover shadow

`primitives/shadow.ts` 目前只有 `sm/md/lg/xl`。卡片 hover 升高建议单独一档，避免消费端用 `xl` 过重：

```ts
// src/primitives/shadow.ts
export const shadow = {
  // …
  cardHover: '0 8px 24px -8px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.08)',
}
```

---

## 4. 落地步骤

### 推荐 PR 拆分

**PR #1 · tokens 补齐**（独立 PR，先合）
- 分支：`feat/design-tokens-v2`
- 改动：`tag.ts` (+10) · 新 `pattern.ts` · `player.ts` (+12) · 新 `route-transition.ts` · `shadow.ts` (+1) · `semantic/index.ts` (+2 export)
- 验证：`pnpm --filter @resovo/design-tokens build` 生成新 css，肉眼 diff `tokens.css`
- **没有破坏性改动**，所有现有 key 保持原样

**PR #2 · bugfix 西里尔字母**（可捎带在 PR #1 或独立）
- `lifecycleDеlisting*` → `lifecycleDelisting*`

**PR #3 · 消费 tokens 的组件改造** —— 见 `Integration Plan.md`

---

## 5. 完整新 CSS 变量清单（以 PR #1 为准）

```
/* type chips */
--tag-chip-movie-bg / -fg
--tag-chip-series-bg / -fg
--tag-chip-anime-bg / -fg
--tag-chip-tvshow-bg / -fg
--tag-chip-doc-bg / -fg

/* patterns */
--pattern-dots-bg / -size
--pattern-grid-bg / -size
--pattern-noise-bg

/* miniplayer geometry + interaction */
--player-mini-width
--player-mini-height
--player-mini-min-width / -max-width
--player-mini-aspect-ratio
--player-mini-dock-x / -dock-y
--player-mini-snap-threshold
--player-mini-drag-handle-height
--player-mini-close-button-size
--player-mini-resize-handle-size
--player-mini-transition-in / -out

/* route transitions (PC) */
--route-transition-fade-duration / -easing
--route-transition-slide-duration / -distance / -easing
--route-transition-shared-duration / -easing
--route-transition-reduced-duration

/* shadow */
--shadow-card-hover
```

共新增 **~30 个 CSS 变量**，不影响现有变量。

---

## 6. 验收清单（PR #1）

- [ ] `pnpm --filter @resovo/design-tokens build` 成功
- [ ] `tokens.css` 新增变量齐全，light/dark 均有
- [ ] `scripts/validate-tokens.ts` 通过
- [ ] 西里尔字母 bug 修复，消费端搜索 `lifecycleDelisting`（拉丁 e）无错误
- [ ] 新增 `pattern` / `routeTransition` 在 `semantic/index.ts` 有 export
- [ ] 没有改动任何现有 token 的值
