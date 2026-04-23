# Resovo 前端设计规范（最终版）

> status: active
> owner: @engineering
> scope: frontend design system, layout system, component spacing, responsive rules, state patterns, accessibility, and token governance for `apps/web-next`
> source_of_truth: yes
> supersedes: docs/frontend_redesign_plan_20260418.md, docs/design_system_plan_20260418.md
> superseded_by: none
> last_reviewed: 2026-04-23

---

## 1. 文档角色

本文件是 Resovo 前台 Web 的正式设计规范，适用于 `apps/web-next` 的页面、布局、组件、交互状态与视觉实现。

本文件不是一次性方案，而是长期执行准则。所有前端页面与组件必须以本规范为准；若代码与本规范冲突，应优先修正代码或修订本规范，而不是继续添加局部例外。

本文件基于以下设计输入抽取而成：

1. `docs/handoff_20260422/designs/Global Shell.html`
2. `docs/handoff_20260422/designs/home-b-2.html`
3. `docs/handoff_20260422/designs/Site Design-2.html`
4. `docs/handoff_20260422/designs/Motion Spec.html`
5. `docs/handoff_20260422/packages/design-tokens/README.md`
6. `docs/handoff_20260422/Token Audit.md`

---

## 2. 适用范围

### 2.1 适用平台

1. 本规范优先定义桌面端 Web。
2. 移动端仅定义共享原则与必要差异，不从桌面端硬挤压推导。
3. 平板端默认沿桌面容器与移动交互之间的中间档处理。

### 2.2 适用页面

1. 全局 Shell：页眉、页脚、设置抽屉、全局搜索入口、全局播放器宿主。
2. 首页：Hero、Shelf、分类捷径、横向内容 row。
3. 分类浏览页：Breadcrumb、标题、筛选器、网格、分页。
4. 搜索浮层与搜索页。
5. 详情页。
6. Watch 页。

### 2.3 非目标

1. 后台管理端表格系统不在本文件主约束范围内。
2. 业务数据结构、API 契约、后台运营流程不在本文件定义。
3. Figma 组件组织方式不在本文件定义。

---

## 3. 核心原则

1. 先定义全站布局系统，再定义单页实现。页眉、页脚、首页、详情页都必须挂在同一套 App Shell 上。
2. 信息密度依靠收纳与优先级，而不是无限压缩控件尺寸。
3. 页面结构稳定优先于“自适应看起来都能塞下”。当桌面视口低于最小布局宽度时，进入整页横向滚动/固定画布模式，而不是让单个模块继续变形。
4. 首页 shelf 是编排骨架，不因数据为空而塌缩。空数据和数据不足都要保留占位。
5. 所有尺寸、间距、圆角、阴影、颜色、动效都必须来自 token，不得在页面或组件内部硬编码。
6. Primitive token 只定义一次；页面与组件只能消费 semantic alias 或 component alias。
7. 组件的缺省状态、空态、加载态、错误态必须先定义，再允许编码。
8. 视觉风格保持浅色优先、层级清晰、弱边框、轻毛玻璃、克制强调色，不走高噪声堆砌路线。

---

## 4. Token 治理

### 4.1 Token 分层

必须采用三层结构：

1. `primitives`
2. `semantic`
3. `components`

禁止出现：

1. 页面直接引用 primitive 拼装视觉。
2. 组件内部直接写颜色、px、阴影、z-index、duration。
3. 在 `apps/web-next` 内新建散落的 CSS 变量。

### 4.2 命名约束

1. Primitive 用中性命名：`space-*`, `radius-*`, `shadow-*`, `font-size-*`, `z-*`。
2. Semantic 用语义命名：`bg-*`, `fg-*`, `border-*`, `surface-*`, `state-*`, `layout-*`。
3. Component alias 用组件前缀：`header-*`, `footer-*`, `shelf-*`, `filter-*`, `search-*`, `detail-*`, `watch-*`。
4. 页面模板只读 semantic 与 component alias，不直接读 primitive。

### 4.3 禁止硬编码

以下写法一律视为违规：

1. `style={{ gap: 16 }}`
2. `className="px-[20px]"`
3. `style={{ background: '#fff' }}`
4. `style={{ zIndex: 9999 }}`
5. `style={{ transitionDuration: '240ms' }}`

允许裸值的地方只有：

1. token 定义文件
2. token build 脚本
3. 兼容第三方库且无法引用变量的极少数桥接层，并且必须附注释

### 4.4 Tailwind Utility 使用规则

本项目通过 `tailwind-preset.ts` 将 design token 映射为 Tailwind utility。**Tailwind scale utility 属于 token 引用，不属于硬编码。**

| 写法 | 是否合规 | 说明 |
|---|---|---|
| `gap-4` | ✅ | → `var(--space-4)`，走 token |
| `text-fg-default` | ✅ | → `var(--fg-default)`，走 token |
| `max-w-shell` | ✅ | → `var(--layout-shell-max)`，需在 preset 中注册 |
| `style={{ gap: 'var(--shelf-gap)' }}` | ✅ | 显式 CSS 变量引用，在 Tailwind 无对应 utility 时允许 |
| `gap-[16px]` | ❌ | Tailwind arbitrary value，等价于硬编码 |
| `max-w-[1440px]` | ❌ | Tailwind arbitrary value，等价于硬编码 |
| `style={{ gap: 16 }}` | ❌ | 裸值，违规 |

**Layout utility 注册规则**：所有 `--layout-*` token 必须同步在 `tailwind-preset.ts` 的 `extend.maxWidth` 中注册对应 utility（如 `max-w-shell`、`max-w-page`），页面代码不得使用 arbitrary value 代替。

---

## 5. Primitive Tokens

以下是本项目正式的空间与布局基础刻度。若现有 token 包缺项，必须补齐，而不是回退到硬编码。

### 5.1 Space Scale

| Token         |  Value |
| ------------- | -----: |
| `--space-0`   |  `0px` |
| `--space-0-5` |  `2px` |
| `--space-1`   |  `4px` |
| `--space-1-5` |  `6px` |
| `--space-2`   |  `8px` |
| `--space-2-5` | `10px` |
| `--space-3`   | `12px` |
| `--space-3-5` | `14px` |
| `--space-4`   | `16px` |
| `--space-5`   | `20px` |
| `--space-6`   | `24px` |
| `--space-7`   | `28px` |
| `--space-8`   | `32px` |
| `--space-10`  | `40px` |
| `--space-12`  | `48px` |
| `--space-14`  | `56px` |
| `--space-16`  | `64px` |
| `--space-20`  | `80px` |
| `--space-24`  | `96px` |

### 5.2 Radius Scale

| Token           |    Value |
| --------------- | -------: |
| `--radius-none` |    `0px` |
| `--radius-sm`   |    `4px` |
| `--radius-md`   |    `8px` |
| `--radius-lg`   |   `12px` |
| `--radius-xl`   |   `16px` |
| `--radius-2xl`  |   `20px` |
| `--radius-full` | `9999px` |

### 5.3 Size Scale

| Token              |  Value |
| ------------------ | -----: |
| `--control-h-sm`   | `32px` |
| `--control-h-md`   | `36px` |
| `--control-h-lg`   | `40px` |
| `--control-h-xl`   | `44px` |
| `--control-h-2xl`  | `56px` |
| `--icon-xs`        | `12px` |
| `--icon-sm`        | `14px` |
| `--icon-md`        | `16px` |
| `--icon-lg`        | `18px` |
| `--icon-xl`        | `20px` |
| `--hit-target-min` | `40px` |

### 5.4 Z-Index

| Token         |  Value |
| ------------- | -----: |
| `--z-base`    |    `0` |
| `--z-sticky`  | `1100` |
| `--z-overlay` | `1200` |
| `--z-modal`   | `1300` |
| `--z-popover` | `1400` |
| `--z-tooltip` | `1500` |
| `--z-toast`   | `1600` |
| `--z-player`  | `1700` |

---

## 6. Semantic Layout Tokens

以下 token 为页面和组件允许直接消费的布局别名。

### 6.1 Container Tokens

| Token                  |    Value | 用途                         |
| ---------------------- | -------: | ---------------------------- |
| `--layout-shell-max`   | `1440px` | Header、Footer、全局 Shell   |
| `--layout-page-max`    | `1280px` | Browse、Search、标准内容页   |
| `--layout-feature-max` | `1200px` | Home、Detail、Feature 型页面 |
| `--layout-wide-max`    | `1600px` | Watch 顶部黑场播放器区       |
| `--layout-shell-inset` |   `32px` | Shell 左右内边距             |
| `--layout-page-inset`  |   `24px` | 页面主容器左右内边距         |
| `--layout-min-desktop` | `1200px` | 桌面端最小布局宽度           |

### 6.2 Page Rhythm Tokens

| Token                 |  Value | 用途                         |
| --------------------- | -----: | ---------------------------- |
| `--page-section-gap`  | `56px` | 首页 section 之间            |
| `--page-block-gap`    | `48px` | 大段落之间                   |
| `--page-subblock-gap` | `24px` | 中型区块之间                 |
| `--page-stack-gap`    | `20px` | 纵向列表/结果卡之间          |
| `--page-inline-gap`   | `16px` | 标题区、工具栏、同层横向元素 |
| `--page-caption-gap`  |  `8px` | 标题与副文案、meta 之间      |

### 6.3 Shelf Tokens

| Token                      |   Value | 用途                 |
| -------------------------- | ------: | -------------------- |
| `--shelf-gap`              |  `16px` | 横向 row 内卡片间距  |
| `--shelf-bottom-padding`   |   `8px` | 横向滚动轨道底部留白 |
| `--shelf-card-w-portrait`  | `170px` | 海报 row             |
| `--shelf-card-w-landscape` | `300px` | 横版卡 row           |
| `--shelf-card-w-top10`     | `170px` | Top10                |
| `--shelf-empty-opacity`    |  `0.32` | 空占位卡可见度       |
| `--shelf-empty-min-slots`  |     `4` | 缺省最小占位数       |

---

## 7. App Shell 规范

### 7.1 全局层级

统一采用：

`Header` → `Main` → `Footer` → `Global Player Host` → `Overlay/Popover Layer`

禁止页面自身再包一层伪 Shell。

### 7.2 桌面端最小布局宽度

1. 全站桌面端最小布局宽度为 `--layout-min-desktop = 1200px`。
2. 当视口宽度低于此值时，应用 Shell 进入统一横向滚动/固定画布模式。
3. 进入该模式后，Header、Main、Footer 一起保持布局宽度，不允许只有某个模块单独压缩。
4. 横向滚动是全站策略，不是页眉或某个 section 自己的策略。

### 7.3 页面外层

1. `html, body` 不做局部宽度补丁。
2. `body` 使用 `canvas` 背景层。
3. 允许全站背景图案，但必须走 token，如 `pattern-dots`, `pattern-grid`, `pattern-noise`。
4. 主内容区由容器 token 决定，不允许页面自己写新的 `max-width`。

---

## 8. 页眉规范

页眉是全站级稳定壳层，不是业务区块。

### 8.1 结构

从左到右固定为：

1. 品牌
2. 分类导航
3. 搜索
4. 主题/设置

### 8.2 尺寸与间距

| 部位                    | 规则                                 |
| ----------------------- | ------------------------------------ |
| Header 高度             | `72px`                               |
| Shell 容器              | `max-width: var(--layout-shell-max)` |
| 左右内边距              | `var(--layout-shell-inset)`          |
| Header 内主 gap         | `24px`                               |
| 品牌内部 gap            | `10px`                               |
| 导航项间距              | `4px`                                |
| 导航项 padding          | `8px 14px`                           |
| 搜索输入高度            | `40px`                               |
| 搜索输入 padding        | `0 16px 0 42px`                      |
| 右侧组件组 gap          | `8px`                                |
| Theme toggle 内 padding | `2px`                                |
| 设置按钮尺寸            | `40px` 命中区最小不低于 `40px`       |

### 8.3 交互与视觉

1. 页眉固定 sticky。
2. 使用轻毛玻璃与弱底边框。
3. Active 分类使用强调色文字与底部 underline。
4. underline 必须完整可见，不允许被 header 边框、overflow、mask 遮挡。
5. 分类导航始终单行，不允许垂向滚动，不允许被压成两行。
6. 分类数量问题通过“更多”解决，不通过导航区内部滚动解决。

### 8.4 响应式收纳

1. 分类先逐步收入“更多”。
2. 搜索框先缩宽，再在窄宽度下退化为搜索按钮。
3. ThemeToggle 在空间不足时收入口设置抽屉。
4. 但收纳只做到 `--layout-min-desktop` 为止；再窄由全站横向滚动承接。

---

## 9. 页脚规范

### 9.1 角色

页脚是第二层站点导航与法务信息区，不是单行版权尾巴。

### 9.2 结构

1. 上层：品牌列 + 多列导航
2. 下层：版权 + 法务/语言入口

### 9.3 尺寸与间距

| 部位                   | 规则             |
| ---------------------- | ---------------- |
| 页脚顶部与主内容间距   | `80px`           |
| 页脚上半区 padding     | `48px 32px 32px` |
| 页脚下半区 padding     | `20px 32px`      |
| 上半区列间 gap         | `40px`           |
| 品牌列文案与 logo 间距 | `12px`           |
| 社交按钮组 gap         | `8px`            |
| 下半区法务 nav gap     | `20px`           |

### 9.4 行为

1. 页脚与 Header 同属 Shell Container。
2. 页脚不参与页面切换动画。
3. 页脚列结构在桌面端稳定，不因内容减少而挤压成不规则高度。

---

## 10. 首页模板规范

### 10.1 基本结构

首页结构固定为：

1. Header
2. Hero
3. 主内容容器
4. 分类捷径
5. 多个 shelf section
6. Footer

### 10.2 Hero

| 部位            | 规则                                   |
| --------------- | -------------------------------------- |
| Hero 高度       | `520px`                                |
| Hero 内容容器   | `max-width: var(--layout-feature-max)` |
| Hero 左右 inset | `24px`                                 |
| Hero 底部留白   | `56px`                                 |
| 标题最大宽度    | `640px`                                |
| 简介最大宽度    | `520px`                                |
| CTA 组 gap      | `12px`                                 |
| 指示器距右边    | `24px`                                 |
| 指示器距底部    | `56px`                                 |

### 10.3 首页主内容容器

| 部位         | 规则                                   |
| ------------ | -------------------------------------- |
| 容器宽度     | `max-width: var(--layout-feature-max)` |
| 左右 inset   | `24px`                                 |
| 顶部 padding | `48px`                                 |
| 底部 padding | `80px`                                 |
| section 间距 | `56px`                                 |

### 10.4 分类捷径

| 部位             | 规则             |
| ---------------- | ---------------- |
| 行内 grid        | `repeat(5, 1fr)` |
| 项间距           | `12px`           |
| 卡片 padding     | `16px 18px`      |
| 图标盒尺寸       | `44px`           |
| 图标盒与文本 gap | `12px`           |

---

## 11. Shelf 与 Empty Shelf 规范

### 11.1 Shelf 是布局骨架

1. 首页 row 无论是否有数据，都必须保留 section 标题区。
2. row 轨道高度和槽位宽度由 `shelf template` 决定，不由数据条数决定。
3. 数据不足时，剩余槽位渲染 empty placeholder card。
4. 数据为 0 时，整行轨道仍存在，渲染最小占位数。

### 11.2 Shelf Template

必须定义以下模板：

1. `featured-grid`
2. `top10-row`
3. `poster-row`
4. `landscape-row`

每个 template 至少包含：

1. 轨道类型：`grid` 或 `horizontal-scroll`
2. 槽位数
3. 卡片宽度
4. 卡片比例
5. gap
6. empty placeholder 规则

### 11.3 Empty Placeholder

1. 占位卡保留真实卡片比例和边界。
2. 占位卡使用静态 empty visual，不使用 shimmer。
3. 占位卡内部可以保留标题条、meta 条、封面面层虚框，但透明度降低。
4. 占位卡不可点击。
5. 若 section 完全无内容，可在 RowHeader 旁显示 `即将上线` 类标签，但不得移除整段空间。

### 11.4 RowHeader

| 部位             | 规则   |
| ---------------- | ------ |
| 标题区与轨道间距 | `20px` |
| 标题与 badge gap | `10px` |
| 标题与副标题 gap | `4px`  |
| 右侧操作区 gap   | `8px`  |
| 箭头组 gap       | `4px`  |

### 11.5 Horizontal Shelf

| 部位             | 规则    |
| ---------------- | ------- |
| 卡片 gap         | `16px`  |
| 轨道底部 padding | `8px`   |
| Portrait 卡宽    | `170px` |
| Landscape 卡宽   | `300px` |
| Top10 卡宽       | `170px` |

---

## 12. 分类浏览页规范

### 12.1 页面容器

| 部位         | 规则                                |
| ------------ | ----------------------------------- |
| 容器宽度     | `max-width: var(--layout-page-max)` |
| 左右 inset   | `24px`                              |
| 顶部 padding | `32px`                              |
| 底部 padding | `80px`                              |

### 12.2 标题区

| 部位                   | 规则   |
| ---------------------- | ------ |
| Breadcrumb 与标题间距  | `8px`  |
| 标题与计数 gap         | `16px` |
| 标题块下方与筛选器间距 | `24px` |

### 12.3 Filter Bar

| 部位               | 规则       |
| ------------------ | ---------- |
| 面板 padding       | `8px 20px` |
| 行 padding         | `10px 0`   |
| 维度标签宽度       | `48px`     |
| 标签列与选项列 gap | `16px`     |
| 选项间 gap         | `4px`      |
| 选项 padding       | `4px 12px` |

### 12.4 网格与分页

| 部位           | 规则   |
| -------------- | ------ |
| 网格列数       | `5`    |
| 网格 gap       | `20px` |
| 分页与网格间距 | `48px` |
| 分页项 gap     | `8px`  |
| 分页按钮尺寸   | `36px` |

---

## 13. 搜索规范

### 13.1 搜索浮层

| 部位                 | 规则        |
| -------------------- | ----------- |
| 面板宽度             | `640px`     |
| 面板圆角             | `16px`      |
| 输入区 padding       | `18px 20px` |
| 分组 padding         | `12px 8px`  |
| 分组标题 padding     | `8px 12px`  |
| 单条结果 padding     | `10px 12px` |
| 单条结果内缩略图宽   | `40px`      |
| 单条结果内主信息 gap | `12px`      |

### 13.2 搜索页

| 部位                 | 规则                                |
| -------------------- | ----------------------------------- |
| 页面容器             | `max-width: var(--layout-page-max)` |
| 顶部搜索框高度       | `56px`                              |
| 顶部搜索框 padding   | `14px 20px`                         |
| 顶部搜索框内元素 gap | `12px`                              |
| Tab 区与结果区间距   | `24px`                              |
| Tab padding          | `10px 14px`                         |
| Tab 内文字与数字 gap | `6px`                               |
| 结果卡 gap           | `20px`                              |
| 结果卡 padding       | `20px`                              |
| 结果卡封面宽         | `120px`                             |
| CTA 组 gap           | `8px`                               |

### 13.3 搜索内容规则

1. 搜索浮层用于快速跳转，不承载复杂筛选。
2. 完整搜索页承载类型切换、结果浏览、摘要高亮。
3. 摘要最多 2 行。
4. 结果卡高度由内容自然撑开，但同级纵向 gap 固定，不因短文案变密。

---

## 14. 详情页规范

### 14.1 页面容器

| 部位         | 规则                                   |
| ------------ | -------------------------------------- |
| 容器宽度     | `max-width: var(--layout-feature-max)` |
| 左右 inset   | `24px`                                 |
| 顶部 padding | `40px`                                 |

### 14.2 首屏双栏

| 部位                  | 规则        |
| --------------------- | ----------- |
| 双栏列宽              | `280px 1fr` |
| 双栏 gap              | `40px`      |
| 首屏与下一区块间距    | `48px`      |
| 标题与副标题 gap      | `4px`       |
| 评分/按钮区 gap       | `24px`      |
| CTA 组 gap            | `12px`      |
| Meta table column gap | `20px`      |
| Meta table row gap    | `8px`       |
| Source pill 组 gap    | `8px`       |

### 14.3 下半区

| 部位             | 规则    |
| ---------------- | ------- |
| 大 section 间距  | `48px`  |
| 简介与主创区间距 | `28px`  |
| 主创 grid gap    | `16px`  |
| 主内容与侧栏 gap | `40px`  |
| 侧栏宽度         | `320px` |
| 相关作品列表 gap | `12px`  |

### 14.4 选集区

| 部位                | 规则              |
| ------------------- | ----------------- |
| 标题与范围切换 gap  | `16px`            |
| 范围切换项 gap      | `4px`             |
| Episode grid        | `repeat(10, 1fr)` |
| Episode item gap    | `8px`             |
| Episode button 高度 | `42px`            |

---

## 15. Watch 页规范

### 15.1 顶部播放器区

| 部位               | 规则                                |
| ------------------ | ----------------------------------- |
| 顶层容器           | `max-width: var(--layout-wide-max)` |
| 左右 inset         | `40px`                              |
| 默认播放器比例     | `16 / 9`                            |
| 播放器圆角         | 默认 `12px`，影院模式 `0`           |
| 顶部遮罩栏 padding | `16px 20px`                         |
| 底部控件栏 padding | `20px 20px 16px`                    |
| 进度条高度         | `4px`                               |
| 控件组 gap         | `14px`                              |

### 15.2 详情与侧栏

| 部位             | 规则        |
| ---------------- | ----------- |
| 下半区容器宽度   | `1280px`    |
| 下半区左右 inset | `24px`      |
| 主次栏比例       | `1fr 360px` |
| 主次栏 gap       | `24px`      |

### 15.3 Episode Panel

| 部位                   | 规则        |
| ---------------------- | ----------- |
| Panel header padding   | `16px 20px` |
| Panel body padding     | `16px`      |
| Episode item 高度      | `36px`      |
| Episode item gap       | `8px`       |
| Continue strip padding | `14px 20px` |
| Continue strip gap     | `10px`      |

---

## 16. 组件级间距规范

以下规则覆盖当前设计稿涉及的主要前台组件。

| 组件                | 外层间距                 | 内层间距                                  |
| ------------------- | ------------------------ | ----------------------------------------- |
| `Header`            | 与主内容无额外 margin    | 内部主 gap `24px`                         |
| `Footer`            | 顶部 `80px`              | 上半区列 gap `40px`                       |
| `Hero`              | 底部与主内容 `48px`      | CTA gap `12px`                            |
| `RowHeader`         | 下方 `20px`              | title/badge `10px`                        |
| `TypeShortcutCard`  | grid gap `12px`          | padding `16px 18px`                       |
| `PosterCard`        | 卡间距由父 grid/row 提供 | 标题区 padding `12px 14px`                |
| `Top10Card`         | 同 row gap `16px`        | meta 区 `margin-top: 10px`, gap `4px`     |
| `FilterBar`         | 与标题区 `24px`          | 行 `10px 0`, 标签组 gap `4px`             |
| `SearchOverlayItem` | 分组内 `0`               | 条目 padding `10px 12px`, 内部 gap `12px` |
| `SearchResultCard`  | 纵向 gap `20px`          | 卡内 padding `20px`, CTA gap `8px`        |
| `DetailMetaTable`   | 与 CTA 区 `24px`         | row gap `8px`, col gap `20px`             |
| `EpisodeGrid`       | 与标题区 `16px`          | item gap `8px`                            |
| `SettingsDrawer`    | 与 viewport 贴边         | header `20px 24px`, group `16px 24px`     |

---

## 17. 状态规范

### 17.1 状态类型

所有页面与组件必须先定义以下状态：

1. `ready`
2. `empty`
3. `partial`
4. `loading`
5. `error`
6. `disabled`
7. `overflow`

### 17.2 区分规则

1. `empty`：没有数据，但布局保持。
2. `partial`：数据不足，保留真实内容并补占位。
3. `loading`：使用 skeleton/shimmer，不能伪装成 empty。
4. `error`：必须有错误说明与恢复动作。
5. `overflow`：通过截断、收纳、菜单、滚动承接，但不可破坏布局。

### 17.3 首页专属

1. 首页 section 不允许在 `empty` 时直接隐藏。
2. Shelf 在 `partial` 时保留目标槽位。
3. Hero 若无内容，允许 fallback 至静态品牌 Hero，但不能移除 Hero 区高度。

---

## 18. 响应式规范

### 18.1 桌面端

1. `>= 1200px`：标准桌面布局。
2. `< 1200px`：保持固定布局宽度，页面整体横向滚动。

### 18.2 移动端原则

1. 移动端不复用桌面容器宽度。
2. 顶部导航切成 `logo + actions + chips / bottom sheet`。
3. 底部导航和 Watch 页移动布局按单独模板定义。

### 18.3 禁止行为

1. 不允许某个局部组件自己设一个神秘 `min-width` 而脱离全局。
2. 不允许首页空 shelf 因为窄宽度只剩两张卡就塌成小块。
3. 不允许页眉继续无限压缩，把 underline、标题、搜索、设置挤坏。

---

## 19. Motion 规范

### 19.1 基本原则

1. Header/Footer 不参与主内容切换的主体动画。
2. 同层页面切换以 fade/stagger 为主。
3. 下钻以 shared element + 内容延迟入场为主。
4. 所有动画需尊重 `prefers-reduced-motion`。

### 19.2 默认时长

| Token               |   Value |
| ------------------- | ------: |
| `--duration-fast`   | `120ms` |
| `--duration-base`   | `200ms` |
| `--duration-slow`   | `320ms` |
| `--duration-slower` | `480ms` |

### 19.3 适用场景

1. hover：`120ms`
2. 面板/菜单/抽屉：`200-280ms`
3. 页面切换：`200-320ms`
4. 主题切换：`480ms` 内完成

---

## 20. 无障碍规范

1. 所有点击目标最小命中区不低于 `40px`。
2. hover 状态必须有 focus-visible 对应态，不能只做鼠标交互。
3. 颜色对比必须满足可读性要求，弱文字仅用于辅助信息。
4. 搜索、更多菜单、设置抽屉、主题切换、播放器控件必须具备键盘可达性。
5. 所有弹出层必须支持 `Esc` 关闭。
6. 全局动效必须支持 reduced motion 降级。
7. 占位卡和 skeleton 不得被读屏误判为真实内容。

---

## 21. 实现约束

### 21.1 页面不得做的事

1. 不得直接写 `max-width`、`padding`、`gap` 裸值。
2. 不得为了解决局部问题绕开 token。
3. 不得把空数据直接 `return null`。
4. 不得让组件在数据不足时擅自改模板。

### 21.2 组件必须做的事

1. 声明自身消费的 component alias。
2. 明确 empty/loading/error 行为。
3. 明确可截断字段与最大行数。
4. 对外暴露的 variant 必须有限制，不允许自由组合成失控样式。

### 21.3 新增 token 的流程

1. 先判断是否已有 primitive。
2. 若只是业务语义差异，新增 semantic alias。
3. 若是组件复用规则，新增 component alias。
4. 禁止为了一个页面单独新增孤立 token。

---

## 22. 验收清单

一项前台 UI 改动在合入前，至少满足：

1. 未新增硬编码颜色、间距、圆角、阴影、动效值。
2. 使用了正确的 container token。
3. 空态、部分数据态、加载态均已定义。
4. 首页 section 在空数据时仍保持 shelf 占位。
5. 桌面端窄宽度下不会出现局部变形；若低于最小宽度，整页统一横向滚动。
6. 页眉 underline、分类标题、搜索与设置布局稳定。
7. 组件具有 focus-visible 与键盘可达性。
8. 文案截断和信息优先级符合本规范。

---

## 23. 与现有代码的关系

1. 当前 `@resovo/design-tokens` 已具备基础色彩、排版、阴影、z-index、主题能力。
2. 本规范要求在现有 token 包基础上补齐布局与组件 alias，尤其是：
   `layout-*`, `page-*`, `header-*`, `footer-*`, `shelf-*`, `filter-*`, `search-*`, `detail-*`, `watch-*`。
3. `docs/rules/ui-rules.md` 继续作为编码规则文档存在；布局与设计层面的最终准则以本文件为准。

---

## 24. 实施决策（2026-04-23 锁定）

以下决策已与工程团队确认，所有后续任务必须遵循。

### 24.1 Space Token 策略

- 保留现有 `primitives/space.ts` 的 rem 单位体系（16px 基准下与本规范 px 值数值等价）。
- 扩充缺失步进：在 `space.ts` 追加 `1.5 / 2.5 / 3.5 / 5 / 7 / 10 / 14 / 20 / 24`，对应 `0.375rem` 至 `6rem`。
- 固定布局尺寸（`1440px`、`1280px`、`1200px`、`1600px` 等）**不走 space scale**，新建 `primitives/layout.ts` 用 `px` 单位单独存放。
- `semantic/layout.ts`（新建）存放 page-rhythm / shelf / inset alias，值引用 `var(--space-*)` 或固定 `px`。
- `build.ts` 新增静态 semantic 通道：`layout` 直接写入 `:root`（不分 light/dark）。

### 24.2 Tailwind 与 Token 边界

- 规则见 §4.4。
- `tailwind-preset.ts` 追加 `extend.maxWidth`：`shell / page / feature / wide`，引用对应 CSS 变量。
- 所有布局 token 在 preset 注册后，页面代码用 `max-w-shell` 等 utility，不用 `style={{ maxWidth: 'var(--layout-shell-max)' }}`。

### 24.3 Component Alias 生成方式

- `components/*.ts`（现有）是 TypeScript-only 对象，不生成 CSS 变量。
- 新增的 `header-* / footer-* / shelf-*` 等 alias 通过 `semantic/layout.ts` 静态通道生成 CSS 变量，供组件用 `var(--shelf-gap)` 消费。
- 将来若需要 component-scoped token（如 `--filter-label-width`），在 `semantic/layout.ts` 内以扁平命名加入，不新建独立 component token 文件。

### 24.4 实施顺序

```
HANDOFF-10  token 补齐（space 扩充 + primitives/layout.ts + semantic/layout.ts + build.ts + tailwind-preset）
HANDOFF-11  Nav 改造（72px / 32px inset / token 消费 / arbitrary value 清零）
HANDOFF-12  Footer 改造
HANDOFF-13  首页 Shell + Hero + 分类捷径
HANDOFF-14  Shelf 骨架（4 种 template + empty placeholder）
HANDOFF-15  Browse 页（FilterBar + 网格 + 分页）
HANDOFF-16  Search 浮层 + 搜索页
HANDOFF-17  Detail 页
HANDOFF-18  Watch 页
```

每个 HANDOFF 任务完成后，后续任务才能开工。不允许跨任务并行实施。
