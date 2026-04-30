# Backend Design v2.1 Reference（合并稿）

状态：合并参考文献 — 2026-04-29
适用范围：`apps/server-next` 后台页面、`packages/admin-ui` admin 专属组件、后续 M-SN-3+ 任务卡视觉验收。

设计源状态：`Wireframes.html` 是上游低保真结构意图，`index.html` 是 hi-fi 草案实现，但当前并未完整覆盖 `Wireframes.html` 的所有交互与复用组件细节；两者都仍处于演进中。当两份不一致时，**以 index.html 与 `app/*.jsx` 渲染结果为准**；Wireframes.html 仅作意图参考。

代码真源：颜色、间距、布局变量落地时以 `packages/design-tokens` 输出变量为最终可消费真源；不兼容时可以接受近似字体、字号和颜色，但必须补 token 或在任务卡中记录映射理由，**不能在页面内自由硬编码**。

> 本文整合两份独立调查（原 `docs/designs/design_reference_v2.1.md` + 原同位 `reference.md`），是后续修复与开发的唯一参考。原 A 文件已收敛为本文件的指针。

---

## 0a. 设计 vs 实现状态读法（2026-04-30 增补 / CHG-DESIGN-11）

本文件是**目标设计稿**，描述 server-next 后台收敛态形态。**所描述的能力不等于已落地能力**。当前实现进度由 `docs/task-queue.md` SEQ-20260429-02（CHG-DESIGN-01..12）跟踪，凡设计稿提及但未落地的细节，**不得**在调用代码 / 文档时按"已存在"假设使用。

DataTable 一体化契约的当前阶段（截至 2026-04-30）：

- ✅ **已实现**（CHG-DESIGN-02 Step 1–6 落地，单测覆盖）：toolbar / bulkActions（`.dt__bulk` sticky bottom） / flashRowKeys / enableHeaderMenu（含 sort / hide / clear filter） / saved views menu —— 这部分内置 props 在 `packages/admin-ui/src/components/data-table/types.ts` 已暴露并可调用
- 🔄 **计划实现**（CHG-DESIGN-02 Step 7A，仍待开工）：本文件 §4.4 / §6.0 / 表格视觉契约里描述的 `.dt__foot` 内置 pagination（`PaginationConfig` prop） / `.dt__body` 独立滚动（thead sticky + tbody overflow-y） / 隐藏列 chip / filter chips slot —— 这部分**当前尚未写入** `packages/admin-ui` 的 DataTable 类型与运行时；`data-table.tsx` 文件头明示"不内置 Pagination / ColumnSettingsPanel"。在 Step 7A 落地之前，消费方仍需外置 `PaginationV2` / 外置 filter chips 作为过渡形态，**不要按"已存在 prop"调用**。

凡是引用本文件的工程文档（CLAUDE.md / ADR-103 §4.1 / `docs/rules/admin-module-template.md` / `docs/rules/ui-rules.md` / `docs/server_next_plan_20260427.md`）均已同步该两阶段标注。

---

## 0. 当前裁决与优先级

本节记录 2026-04-29 人工裁决，**优先级高于设计稿草案中的矛盾处**。

1. **表格设计以"视频库"页面表格的视觉语言为准**。
   *视觉语言*指：framed surface、toolbar 模式、sticky header、密度、hover/selected/empty/error/loading 状态、pagination、bulk bar、scrollbar、行高、cell padding。**这一层全站统一**。
   **不要求各表列完全相同**：列集合、列宽、列内 cell 组件（DualSignal、VisChip、pill、progress 等）按业务实际需要选择和调整；但**同一语义在多页应使用同一 cell 组件**（例如「探测/播放双信号」不可一页用 DualSignal、另一页用 raw 文本）。
2. 后台 brand 主色以**当前实现**为准。设计稿中的 amber/orange accent 不再作为强制修复目标；只有 warn/danger/ok/info 等状态色仍按状态语义处理。具体值由 token `--accent-default` 决定（文档不锁死十六进制 / oklch）。
3. 侧边栏展开/收缩必须补**过渡动效**，并避免**图标纵向跳跃**。展开态有分区标题，折叠态也要保留**等高分区占位或等高 divider**，不得因标题挂载/卸载改变各组图标的 Y 坐标。
4. **Tokens 按需求补全**。遇到 design token 与实现 token 不兼容时，可以先用已存在 token 做近似映射，但必须优先补缺失 token 和 token completeness 校验。
5. **管理台站不直接套普通 KPI 卡片**，需要设计并实现具体卡片类型，包括异常关注、工作流、指标、活动、站点健康、分析图表、卡片库与全屏态。
6. **滚动条宽度全站统一为 6px**，与设计稿 sidebar 一致；不沿用全局 10px。所有 admin 滚动容器（sidebar / DataTable body / Drawer body / popover / split pane / card body 内部 scroll）统一遵守。
7. **DataTable 改造路径**：扩展现有 `packages/admin-ui` 的 DataTable + 周边 primitives，**不引入 `TableFrame` 新抽象层**；仅当 DataTable props 超过 ~20 个时退回 frame 路线。
8. 复用组件仍未统一时，以本文件的"组件视觉契约 + 页面列规范"为后续修正依据，而不是继续按页面自由发挥。

---

## 1. 使用规则

1. 新增或修复后台页面前，先按 §0 裁决、§4 通用组件、§5 页面库存与 §6 表格列规范确认设计口径。
2. 表格类页面必须采用同一套表格视觉语言（见 §0-1）。可以由 `DataTable`、组合组件实现，但**外观、密度、toolbar、pagination、bulk、hover/selected/empty/error/loading 不能分裂成多套**。
3. 复用通用组件时，以本文件的组件特征为验收口径。实现可以使用 `packages/design-tokens` 的变量名，但视觉角色必须对应后台实现侧 token 和本文件裁决。
4. 页面级功能不应自行定义新的按钮、输入框、表格、badge、Drawer 视觉。**缺组件能力时，先补 `packages/admin-ui` 或登记任务卡，不在业务页局部拼凑**。
5. 视觉验收至少覆盖：字体尺寸、背景层级、边框、圆角、密度、滚动容器、hover/active/selected、空态/加载/错误态、图标入口与键盘提示。

---

## 2. 设计源索引

### 2.1 文件索引

| 真源文件 | 关键内容 |
|---|---|
| `Wireframes.html` | 上游低保真结构意图：IA、导航、管理台站编辑模式、通用表格规范、审核三栏、视频编辑统一 Drawer、采集、消息、弹层规范。 |
| `index.html:50-66` | 15 个路由入口：dashboard、moderation、staging、videos、sources、merge、subtitles、home、submissions、crawler、image-health、analytics、users、settings、audit、login。 |
| `info.md:1-13` | 10 个模块说明：IA、导航、管理台站、通用表格、内容审核、视频编辑 Drawer、采集控制、消息/任务、开发者模式、弹层规范。 |
| `styles/tokens.css:4-73` | v2.1 设计稿原始 token：dark-first surfaces、状态色、字体、spacing、radius、sidebar/topbar/row layout。 |
| `styles/components.css:7-239` | Shell、Sidebar、Topbar、页面头、顶栏搜索、用户菜单、折叠、scrollbar。 |
| `styles/components.css:249-486` | Button、Segmented control、Pill、Input、Card、KPI、普通 Table、Selection bar、Modal、CmdK、Filter chip。 |
| `styles/components.css:489-654` | DataTable v2 旗舰规格：内部 toolbar、搜索、保存视图、表头菜单、sticky header、row flash、bulk bar、pager。 |
| `styles/components.css:655-677` | Split pane 与 mini spark。 |
| `app/shell.jsx` | Sidebar、Topbar、CmdK、AdminShell 交互形态。 |
| `app/datatable.jsx` | 通用 DataTable 的功能和 DOM 结构参考。 |
| `app/video-edit-drawer.jsx` | 视频编辑 Drawer、全屏模式、4 个 Tab、quick header、footer。 |
| `app/notifications.jsx` | 通知面板、后台任务面板、Toast。 |
| `app/screens-1.jsx:5-160` | Dashboard。 |
| `app/screens-1.jsx:705-958` | Moderation Console（含 165-704 辅助组件）。 |
| `app/screens-2.jsx` | Sources、Staging、Crawler、Home Ops、Image Health、Merge。 |
| `app/screens-3.jsx` | Videos、Users、Settings、Audit、Submissions、Subtitles、Analytics、Login。 |

### 2.2 设计源优先级

1. 本文件 §0 中的人工裁决。
2. 当前实现已明确生效的品牌色和 token 可消费边界。
3. `Wireframes.html` 的结构、交互和复用组件意图。
4. `index.html` / `app/*.jsx` 的 hi-fi 草案细节。
5. `styles/*.css` 的具体数值。数值可近似，但必须保持角色、密度和组件层级一致。

---

## 3. 全局视觉语言

### 3.1 色彩层级

设计稿是 dark-first，页面层级靠**五档 surface** 区分，不靠大面积渐变。实现侧不强制回到设计稿 amber 主色，brand 主色以当前 `packages/design-tokens` / server-next 实现为准。

| 设计稿变量 | 设计角色 | 典型用途 |
|---|---|---|
| `--bg0` | canvas | app 背景、主内容底色。 |
| `--bg1` | shell | Sidebar、Topbar、Drawer 外壳。 |
| `--bg2` | card/table | Card、DataTable、普通表格主体。 |
| `--bg3` | row hover/input | 输入框、hover、内部次级块、progress track。 |
| `--bg4` | popover/elevated | UserMenu、CmdK、NotificationPanel、浮层。 |
| `--border` / `--border-subtle` / `--border-strong` | 分割线层级 | 表格行线、卡片边框、popover 边框。 |
| `--text` / `--text-2` / `--muted` / `--muted-2` | 文本层级 | 标题、正文、辅助说明、弱标签。 |
| `--accent` | 设计稿主强调；实现侧以当前 brand accent 为准 | active nav、primary button、当前页码、重点计数。 |
| `--ok/warn/danger/info` + `*-soft` | 状态色 | pill、KPI、异常卡、任务状态、双信号。 |
| `--probe` / `--render` | 双信号 | HEAD/Content-Type 探测与真实播放渲染状态。 |

当前 `packages/design-tokens` 使用 `--bg-canvas / --bg-surface / --bg-surface-raised / --bg-surface-elevated` 等 semantic 名称。实现时**必须明确映射到上表角色**。**不能把一个页面全部用同一个 surface token 铺开**，否则会丢掉 v2.1 的密度和层次。

**Brand 裁决**：后台主按钮、active nav、当前页码、强调数字使用实现侧 brand accent（取自 `--accent-default`，源 `packages/design-tokens/src/primitives/color.ts`）；不要为追设计稿草案把当前主色改回 amber。warn 状态仍使用 warning 语义，不和 brand 强行绑定。

> Brand 切换的视觉验收要点（§A 待补）：login 页 radial-gradient、sidebar logo 渐变、active 行/链接边条、accent-soft 选中行——这些在原设计稿是 amber 系，切到当前 brand（蓝）后需视觉签收。

### 3.2 字体与密度

设计稿默认字体栈为系统中文 UI 字体：`-apple-system`、`BlinkMacSystemFont`、`PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`Helvetica Neue`、`Source Han Sans CN`。代码侧 `packages/design-tokens` 目前使用 Noto + 系统 fallback，两者**可接受**。字体、字号、颜色在不兼容时可近似，但应保持后台工具的紧凑密度与层级，不应向营销页式的大字号和大留白漂移。

| 设计用途 | 设计稿尺寸 |
|---|---|
| body | 14px / line-height 1.5 |
| Topbar crumbs / search / table body | 12px |
| 表头 / meta / KPI delta / buttons small | 11px |
| Sidebar section title | 10px uppercase, letter spacing 1.2px |
| Page title | 20px, 700 |
| Card title | 13px, 600 |
| KPI value | 26px, 700 |
| Login brand | 18px |

实现偏差风险：当前 admin-ui 大量使用 `--font-size-sm` 即 14px，DataTable body 13px，Pagination 13px，**视觉会比设计稿松**。列表页和工具页优先采用 11/12/13px 密度；如果因 token 体系没有精确字号而使用近似值，应补 token 或在组件注释/任务卡说明。

### 3.3 间距、圆角、阴影

设计稿 spacing 为 4/8/12/16/20/24/32/40px。常用间距是 8、10、12、14、16px，**页面不使用大留白**。

| 元素 | 设计稿形态 |
|---|---|
| Sidebar nav item | padding 7px 10px, margin 1px 0, radius 6px |
| Topbar | height 52px, padding 0 18px, gap 12px |
| Page container | padding 20px 24px 64px |
| Page head | margin-bottom 16px, actions gap 8px |
| Button | padding 6px 12px, radius 6px, font 12px/500 |
| Small button | 3px 8px, font 11px |
| XS button | 2px 6px, font 10px |
| Input | padding 6px 10px, radius 6px, font 12px |
| Card | radius 8px, border 1px |
| Table cell | padding 8px 12px |
| Poster thumbnail | normal 38x56, small 32x48, radius 4px |
| Drawer | width 680px, max 90vw, shadow-lg |

圆角以 4/6/8/12px 为主。**除 pill、avatar 外，不要随意把后台控件做成大圆角**。

### 3.4 滚动策略与滚动条

`info.md` 明确后台列表采用统一范式：页面滚动承载 topbar、工具栏和筛选区，表格内部滚动承载数据，thead sticky，分页和批量操作在表格底部 sticky。审核三栏是例外，三栏各自滚动。

**滚动条统一规范（§0-6 裁决）**：

```css
:root { --scrollbar-size: 6px; }

::-webkit-scrollbar {
  width: var(--scrollbar-size);
  height: var(--scrollbar-size);
}
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 999px;
  border: 2px solid var(--bg-surface);    /* 视觉 padding，避免 6px 太瘦 */
}
::-webkit-scrollbar-thumb:hover { background: var(--fg-disabled); }

/* Firefox */
* { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
```

适用范围（**禁止**单独 override 宽度）：

- AdminShell aside `nav` 滚动
- AdminShell main `<div class="page">` 滚动
- Drawer / Modal body 滚动
- DataTable `dt__body` overflow
- Notification / Task drawer list
- Cmd+K cmdk__list
- 任何自定义 `overflow: auto` 的 card body / split pane body

### 3.5 过渡与动效

| 用途 | duration | easing |
|---|---|---|
| sidebar width | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| sidebar 内容 opacity（标题 / 文字 / footer 文案） | 150ms | ease-out |
| modal/drawer 入场 | 240ms | spring `cubic-bezier(0.34,1.56,0.64,1)` |
| 行 hover bg 切换 | 80ms | linear |
| 按钮/输入 focus border | 120ms | ease |
| `prefers-reduced-motion` 命中 | 0ms | linear |

均通过 `--duration-*` token 取（已在 `packages/design-tokens/css/tokens.css` 第 104–113 行声明，复用即可）。`prefers-reduced-motion` 是硬约束，所有 transition 必须支持。

### 3.6 Tokens 诊断与补全清单

#### 3.6.1 当前实装的未定义引用（诊断）

以下变量被组件引用但**未在 token 输出中定义**，必须修：

- `--accent-subtle`（DataTable selected row、FilterChip active）
- `--bg-subtle`（DataTable hover row）
- `--bg-surface-hover`（部分组件 hover）
- `--state-error`（部分 state primitives；应是 `--state-error-fg/bg`）
- `--accent-on`（sidebar logo 文字色）

应统一改为已定义 semantic 名称（`--state-error-fg` / `--bg-surface-elevated` / `--admin-accent-soft` / `--fg-on-accent` 等），或在 token 层补上述别名。

#### 3.6.2 建设性补全清单

按需补全，不强求与设计稿 1:1，**字号、字体、颜色不兼容时可接受近似值**。

| # | 缺失项 | 建议补法 |
|---|---|---|
| 1 | `--bg-surface-popover`（对应设计稿 bg4） | 主题块内补；用于 popover / dropdown / dt__bulk 顶层浮层 |
| 2 | `--accent-soft / --accent-border` 别名 | `color-mix(in oklch, var(--accent-default) 18%, transparent)` 等 |
| 3 | `--ok / --warn / --danger / --info / --neutral` 短别名 | 主题块映射到 `--state-*-fg`，简化页面书写 |
| 4 | `--probe / --render` 短别名 | 映射到 `--dual-signal-*`；长名继续保留 |
| 5 | `--scrollbar-size`（6px 全站） | 见 §3.4 |
| 6 | `--pulse` keyframe + class | 移到 `packages/admin-ui` 全局样式表 |
| 7 | `.kbd / .pill / .seg / .fchip / .checkbox` 全局 utility | 通过 React 组件封装；或在 `admin-shell-styles.tsx` 定义对应 className |
| 8 | Token completeness 校验脚本 | 扫描 admin-ui / server-next 引用，与 token 输出 diff，CI 卡门 |

**字体/字号近似规则**：
- 设计稿 `--fs-11/12/13/14`（px） ≈ 实现 `--font-size-xs(12)/sm(14)/base(16)`（rem）— 11/13 在实现层缺失，列表表头 / pill 用 `font-size: 0.6875rem`（11px）/`0.8125rem`（13px）直写一次即可，不必新增 token。
- 设计稿 system-ui 字体栈 vs 实现 Noto Sans —**接受差异**。

---

## 4. 通用组件特征

### 4.1 Shell

设计稿 Shell 为 `.app { display:flex; min-height:100vh }`。Sidebar 是 `height:100vh` 的 sticky 左栏，Topbar 在右侧 main 内部，二者的底边线在左上形成十字交叉。

#### 4.1.1 Sidebar 关键特征

- 宽度 232px，折叠宽度 60px。
- 背景 `bg1`，右边线 `border`。
- Brand 高度固定为 `--topbar-h`，底边线与 Topbar 底边线共线。
- Logo 视觉以当前实现为准；尺寸和密度仍应贴近 26-32px、8px radius、文字 13px/800 的紧凑形态。
- 5 组导航：运营中心、内容资产、首页运营、采集中心、系统管理。
- nav link 为 13px，`text-2`，hover `bg3/text`，active `accent-soft/accent`，左侧 2px active indicator。
- count badge 10px/600，1px 6px，999px pill，warn/danger 使用 soft 背景。
- 折叠态显示 icon rail、pip、hover tooltip。
- 折叠按钮是全宽 subtle bar：icon + `收起边栏` label（**不是**当前实装的"折叠"）+ 右侧 `⌘B` kbd。
- Footer 是 `.sb__foot`：10px 12px、hover `bg3`、28px 紫色渐变头像、name 12px、role 10px（应显示"管理员 · admin"形态），含 chevron。
- UserMenu 在 footer 上方弹出，`bg4/border-strong/shadow-lg`，有 header、icon slot、separator、danger hover。

#### 4.1.2 Sidebar 三个必须修复的实装问题

**问题 A — 展开/折叠没有视觉过渡**

- `width` 直接跳变，需要 `transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1)`。
- Footer 内容（name / role / chevron）从 `display: ...` 直接消失，无淡出 — 改用 opacity 渐隐 150ms。
- Brand 标题文字同上。

**问题 B — 分区标题导致图标纵向跳跃**

设计稿 jsx：

```jsx
{!collapsed && <h4>{g.group}</h4>}
{collapsed && <div className="sb__divider" />}
```

展开态：组之间是 `<h4>` 占据约 22–24px；折叠态：完全不渲染。后果是**相同 NAV 组的图标在折叠/展开切换时纵向位置不一致**，肉眼可见跳跃。

修复原则：**保留等高分区占位或等高 divider/ghost title 承接原高度**，禁止条件 unmount section 标题。

修复 CSS 示意（最终值在 PR 中调）：

```css
.sb__section h4 {
  max-height: 32px;
  opacity: 1;
  overflow: hidden;
  transition: max-height 200ms ease, opacity 150ms ease, padding 200ms ease, margin 200ms ease;
}
.sb--collapsed .sb__section h4 {
  max-height: 0;
  opacity: 0;
  padding: 0;
  margin: 0;
  pointer-events: none;
}
.sb__section + .sb__section {
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
```

NavItem padding 在两态保持一致或同步过渡，icon 容器固定高度，确保两态视觉中心对齐。

**问题 C — active 状态颜色仍沿用旧 brand**

当前实装 active 用 `--state-warning-fg`（沿用 amber 时代）。既然 brand 已切到当前实现的蓝系，**active 应改用 `--accent-default` 前景 + `--accent-soft / --accent-muted` 背景**。

#### 4.1.3 Topbar 关键特征

- 高度 52px，背景 `bg1`，底边线 `border`，sticky top。
- 左侧 crumbs，12px，当前项 `text`/600。
- crumbs 后有 flex spacer，然后固定 420px 搜索触发器。
- 搜索框背景 `bg3`，radius 6px，padding 6px 10px，placeholder 12px，含搜索 icon 和 `⌘K`。
- 右侧 group `margin-left:auto`，32x32 icon buttons，hover `bg3/text`。
- 通知红点 7px，任务运行可用数字/pill。

#### 4.1.4 当前实现差异表

| 位置 | 已对齐 | 仍需注意 |
|---|---|---|
| `packages/admin-ui/src/shell/admin-shell.tsx` | AdminShell 已有 `topbarIcons`、`notifications/tasks`、Drawer 互斥、CmdK、快捷键、Shell flex 布局 | Main padding 使用 `--space-5`，与设计稿 page padding 20/24 接近但不完全；页面自身不要再叠加无依据大 padding |
| `sidebar.tsx` | 高度已是 `100vh`；Brand 已固定 `topbar-h`；count provider 优先级正确；CSS 注入补了 hover、scrollbar、active indicator、footer hover | §4.1.2 三问题待修；nav item padding/radius/active indicator 坐标与 `.sb__link` 不完全一致；折叠按钮文字是"折叠"而非"收起边栏"；无自定义 NavTip；footer role 文案未显示"管理员 · admin" |
| `topbar.tsx` | 图标注入、固定 420px 搜索框、spacer、右侧 group 顺序已落地 | 搜索和按钮 token 仍需检查是否映射到 `bg3`/`r-2`；任务/通知是否可用取决于 server-next 是否传入数据 |
| `admin-shell-client.tsx` | 注入 nav、crumbs、icons、health、countProvider | 当前**仍不传 `notifications/tasks`**，因此 Topbar 任务/通知可见但 disabled |

通知/任务面板：**保留当前 drawer 实装**，不再回滚到设计稿原始 popover 形态。

### 4.2 Button、Input、Pill、Segment

详细规格见设计稿 `components.css §249-486`。摘录关键约束：

- **Button**：默认 `bg3/text/border`、hover `bg4/border-strong`；Primary 使用实现侧 brand accent / on-accent；Danger 默认文字 danger，hover `danger-soft + danger border`；按钮应该用 icon + text 或纯 icon，不用解释性大段文字。
- **Input**：12px，`bg3`，border，radius 6px。Select 使用同一 `.inp` 视觉，仅增加箭头背景。
- **Pill**：11px/500，1px 7px，radius full，**必须含 6px dot**；状态必须使用 soft 背景，不要用实色大块。
- **Segment**：容器 `bg3/border/r-2`，padding 2px；active item `bg1/text/shadow-sm`，badge 在 active 时使用实现侧 accent soft/fg。
- **Filter chip**：`fchip__key`（muted 标签）+ value + `fchip__x`（×按钮）；active 用 `accent-soft / accent / accent-border`。
- **Checkbox**：14×14，三态（empty / checked / mixed）必须支持。
- **KBD**：11px mono，下边线加重 2px。

实装 drift 观察：

- `VideoFilterFields.tsx` 自定义 input/select 接近设计稿尺寸，但使用 `bg-surface-raised` 与 `radius-sm`，需要确认 token 映射。
- `FilterChip` 当前使用 `--accent-subtle`（未定义） — 改为 `--admin-accent-soft` 或对应 semantic。
- `AdminDropdown` 引用 `--state-error`、`--bg-surface-hover` 等未定义变量。

### 4.3 Card、KPI、Table 基础

**Card**：

- `bg2`、`border`、radius 8px、overflow hidden。
- Header padding 12px 14px，title 13px/600，sub 11px/muted。
- Body padding 14px。

**KPI**：

- `bg2/border/r-3`，padding 14px 16px。
- label 11px uppercase，letter spacing 1px。
- value 26px/700，数值使用 tabular number。
- delta 11px，状态色只用于 value/delta，**不改变整卡大面积背景**。
- spark 60×18 svg 在右下角 opacity .4。
- `.is-warn / .is-danger / .is-ok` 控制 border + value 染色。

**Table 基础视觉**（与 §6 表格契约对应）：

- 外层 `.tbl-wrap` 是 `bg2/border/r-3/overflow:hidden`。
- `table.tbl` 使用真实 table，body 12px。
- th sticky top，11px/600 uppercase，padding 8px 12px。
- td padding 8px 12px，行线 `border-subtle`。
- hover `bg3`，selected/active `accent-soft`，active 左边 2px accent。
- 行内 actions 默认 opacity 0，hover 行后出现。
- 小海报使用 32x48 竖版，**不是 16:9 横图**。

裁决：后台不再维护"普通表格"和"DataTable"两套视觉。`.tbl` 与 `.dt` 可以是不同实现层，但视觉应收敛到视频库表格。

### 4.4 DataTable v2

DataTable 是视频库和后续列表页的旗舰组件，不只是一个网格。**表格视觉以视频库页面内的表格设计为准**（§0-1）；设计稿 `app/datatable.jsx` 和 `.dt` CSS 只作为 hi-fi 草案参考，若与视频库标杆或当前裁决冲突，以视频库标杆和本文件 §0 为准。

#### 4.4.1 必备特征

- 外层 `.dt` 是一个完整 framed surface：`bg2/border/r-3/overflow:hidden/height:100%`。【🔄 计划：framed surface 已落地，`.dt__body`/`.dt__foot` 子结构待 Step 7A】
- 内置 `.dt__toolbar`：search、saved views、filter chips、hidden-columns chip、toolbar slot。【部分实现：toolbar slot / saved views ✅ Step 4–6；🔄 filter chips slot / hidden-columns chip 待 Step 7A】
- 搜索为 280px 固定基础宽度，输入左侧有 search icon。
- Saved views 支持 personal/team scope 和保存当前视图。【✅ Step 6 落地，sessionStorage 持久化】
- 表头内置菜单：排序、筛选入口、固定/取消固定、隐藏列；popover 使用 `bg4/border-strong/shadow-lg`。【✅ Step 3 落地（enableHeaderMenu prop）】
- 表头 sticky，body 独立滚动。【🔄 计划：thead sticky + tbody overflow-y 由 Step 7A 实现，当前 DataTable 是单一滚动容器】
- 行支持 hover、selected、乐观更新 flash。【✅ Step 5 落地（flashRowKeys prop）】
- 页脚 `.dt__foot` 内置 pagination 和计数。【🔄 计划：`pagination?: PaginationConfig` prop + `.dt__foot` 渲染由 Step 7A 实现，当前 `data-table.tsx` 不内置 Pagination；落地前消费方走外置 PaginationV2】
- 批量操作 `.dt__bulk` sticky bottom 在表格内部，顶部 accent border。【✅ Step 5 落地（bulkActions prop）】
- 选择全部匹配是 DataTable/SelectionActionBar 的一等交互，需要有 query-based bulk API 或明确的 ids 获取策略。

#### 4.4.2 改造路径（§0-7 裁决）

**扩展现有 `DataTable`，不引入 TableFrame 新抽象层**。增量加入的字段（落地状态以 `packages/admin-ui/src/components/data-table/types.ts` 为准）：

```ts
interface DataTableProps<T> {
  // 现有：rows / columns / rowKey / mode / query / onQueryChange / totalRows / loading / error / emptyState / selection / onSelectionChange / onRowClick / density
  // ✅ Step 1–6 已落地（CHG-DESIGN-02，签名以 packages/admin-ui/src/components/data-table/types.ts 为准）：
  flashRowKeys?: ReadonlySet<string>;   // 乐观更新闪烁（原拟名 flashIds，落地名 flashRowKeys）
  toolbar?: ToolbarConfig;              // 内置 toolbar 编排（search / trailing / viewsConfig 三槽位；落地为 ToolbarConfig 单形态，未支持 ReactNode 直传）
  bulkActions?: React.ReactNode;        // 选中后表内底部 sticky `.dt__bulk`（原拟名 bulkSlot；落地为 ReactNode 直传，**没有** BulkActionsConfig 类型）
  enableHeaderMenu?: boolean;           // 表头集成菜单（sort + hide + clear filter + pin）
  // saved views menu 已通过 useTableQuery + DataTable 集成，sessionStorage 持久化（不再需要 views 数组直传）
  // 🔄 Step 7A 计划落地（仍待开工）：
  // pagination?: PaginationConfig;     // .dt__foot 内置（当前 data-table.tsx 文件头明示"不内置 Pagination"，未在 types 暴露）
  // pinnedSticky?: boolean;            // 列左侧固定 sticky（与独立 body 滚动绑定）
  // hiddenColumnsChip / filterChipsSlot 与 body 独立滚动 / .dt__foot 框架同期落地
}
```

**阈值**：当 props 数量超过 ~20 个时，退回 frame 组合路线（仅作为兜底）。

#### 4.4.3 当前实现差异表

> **2026-04-30 增补**：本表"差异"列分两段维护——`【已闭合】` 标 CHG-DESIGN-02 Step 1–6 已落地的项；`【待 Step 7A】` 标 7A 计划闭合的项；其余未标注的差异为 7A 之外的后续 CHG 处理。

| 位置 | 已对齐 | 差异 |
|---|---|---|
| `DataTable` | server/client mode、sticky header、selection、sort、column visibility、loading/error/empty、row density；**【已闭合 Step 1–6】**：`.dt` framed surface 已落地（`dt-styles.tsx`）；toolbar / bulk bar 进入 DataTable 一体化；表头菜单（enableHeaderMenu sort+hide+clear filter）；saved views（sessionStorage）；row flash（flashRowKeys） | **【待 Step 7A】**：body 独立滚动（thead sticky + tbody overflow-y）；`.dt__foot` 内置 pagination；pin/hide popover；隐藏列 chip；filter chips slot；body cell 12px 密度（当前 13px）；selected/hover 用未定义 token（`--accent-subtle` / `--bg-subtle`，待 token 卡补齐） |
| `Toolbar` | 有 leading、columnSettings、trailing slot；**【已闭合 Step 4】**：DataTable 内置 toolbar slot（ToolbarConfig 支持 search / saved views / 自定义 ReactNode） | **【待 Step 7A】**：filter chips slot 仍未抽出；隐藏列 chip 待落地；外置 8px gap 容器形态保留作兜底（嵌入式场景） |
| `ColumnSettingsPanel` | 有 portal、focus trap、ESC、外部点击、列显隐；**【已闭合 Step 3】**：列显隐入口已迁到表头菜单（enableHeaderMenu） | **【待 Step 7A】**：隐藏列 chip 在 toolbar 中显示已隐藏列数 + 一键展开 |
| `Pagination` | 有页码窗口、pageSize、计数 | **【待 Step 7A】**：`.dt__pager` 内置 footer 与表格一体（24px 高页码按钮）；当前 `data-table.tsx` 不内置 Pagination prop，消费方仍走外置 `PaginationV2`（28px 按钮，外部 nav）作过渡 |
| `SelectionActionBar` | 有 selected count、page/all-matched 文字、actions、confirm；**【已闭合 Step 5】**：`.dt__bulk` 表格内 sticky bottom 形态（DataTable.bulkActions prop） | 设计稿仍保留 `.sel-bar` 浮动形态作为非 DataTable 场景兜底，外部 export 不取消 |

### 4.5 Drawer、Modal、Popover

**VideoEditDrawer 设计稿特征**：

- 右侧 Drawer：width 680px，max 90vw，`bg1`，左边线 `border`，shadow-lg，z-index 200。
- 支持 fullscreen：宽度 100vw、无 maxWidth。
- Header：title、close、fullscreen toggle。
- 内容区高度 100%，内部 flex column。
- 顶部 tabs 使用 `.seg`，4 个 Tab：基础信息、线路管理、图片素材、豆瓣/元数据。
- Quick header：32x48 poster、title、ID/type/year/source count、VisChip、DualSignal。
- Content padding 18px，底部预留 100px。
- Footer：最后编辑信息、取消、保存更改。

**当前视频编辑实现**：

- `VideoEditDrawer.tsx` 已可从视频行打开，并能加载/保存基础字段。
- Drawer width 是 **540px**，标题是"编辑视频基础信息"，没有 fullscreen、tabs、quick header、线路/图片/豆瓣页签，也没有设计稿 footer 的最后编辑信息。
- 字段覆盖是基础表单，不是设计稿的四域编辑工作台。后续不要把它视为 VideoEditDrawer 的完成态，**只能视作最小可用基础信息 drawer**。

**通知/任务/Toast 设计稿特征**：

- Topbar 两个入口分离：通知与后台任务。
- 面板宽度 400px，maxHeight 70vh，`bg4/border-strong/r-4/shadow-lg`。
- 通知有全部/未读 segment、未读 soft 背景、6px unread dot、行级 action。
- 任务有运行中 segment、progress bar、运行脉冲、失败重试。
- Toast 右下角堆叠，maxWidth 380，进出动画。

实装为 NotificationDrawer / TaskDrawer 侧滑（保留，不回滚）。

**Modal**：宽 640、bg2 + border-strong + radius r-4 + shadow-lg；head 14 16；body 16 + max-h 70vh；foot 10 16。

**Cmd+K**：宽 600，输入栏 14px 不带 border 内嵌 head；list max-h 420；底部提示行（↑↓移动 / ↵选择 / esc 关闭 / `v:` `u:` `!` 三种前缀）。

### 4.6 Split Pane

用于审核台和一些工作台式页面：

- `.split` 默认 360px + 1fr，gap 12px，高度 `calc(100vh - topbar-h - 40px)`。
- `.split__pane` 是 `bg2/border/r-3/flex column/overflow hidden`。
- pane head 10px 12px，pane body 独立 `overflow-y:auto`。

审核台是明确例外：**不走 DataTable 滚动策略**，左队列、中间预览、右详情各自滚动。

---

## 5. 页面清单与元素库存

### 5.1 管理台站 Dashboard

真源：`app/screens-1.jsx:5-160`。

**页面布局**（自上而下）：

```
1. page__head（问候式 title + 最后采集 sub + 全站全量采集 / 进入审核台 primary）
2. row1: grid 1.4fr 1fr gap 12  →  AttentionCard + WorkflowCard
3. row2: grid repeat(4, 1fr) gap 12  →  4 张 MetricKpiCard
4. row3: grid 1fr 1fr gap 12   →  RecentActivityCard + SiteHealthCard
```

#### 5.1.1 卡片类型（具体实现，不再用通用 StatCard 占位）

| 卡片 | 内容 | 样式与交互 |
|---|---|---|
| `AttentionCard` | 按优先级列出异常：采集失败、图片 404、合并候选、Banner 过期 | card header 带 warn/danger icon；行高紧凑，左侧状态 icon，右侧 xs action；异常行之间用 `border-subtle` |
| `WorkflowCard` | 采集入库 → 待审核 → 暂存待发布 → 已上架的进度 | 12px 文案，6px progress track，颜色使用 brand/warn/info/ok；底部保留审核/批量发布快捷按钮 |
| `MetricKpiCard` | 视频总量、待审/暂存、源可达率、失效源 | 采用 §4.3 KPI 视觉，支持 spark；状态只作用于 value/delta，不改变整卡背景 |
| `RecentActivityCard` | 系统/Yan/Mira 等最近操作流 | 每行 28px icon box，正文 12px，时间 11px muted，行间 `border-subtle` |
| `SiteHealthCard` | 站点健康列表 | 18px health square、站点名、type/format/last、60x18 spark、行级 xs action |
| `AnalyticsChartCard` | 管理台站内可选的数据看板卡片 | 卡片头部显示范围/刷新状态；主体可以是 spark/line/bar，但必须保留 card chrome |
| `CardLibraryDrawer` | 编辑态出现的卡片库，支持拖拽添加 | 按 Wireframes 意图实现：卡片类型、默认尺寸、数据源、是否团队共享 |
| `FullscreenCard` | 任一卡片全屏查看 | 进入后保留原卡片标题、筛选、actions；内容扩展，不改变数据语义 |

#### 5.1.2 卡片内部细节（mock 级蓝图）

**AttentionCard**：head `{warn icon}` + 标题 + sub「按优先级排序的当前异常」 + 右侧 xs btn「全部解决」；body padding 0；每条 12×16 高，从第二条起加 `border-top: 1px solid var(--border-subtle)`：sev icon + (title 13/600 + meta 11 muted) + xs btn。
Mock：4 个采集站点连失 / `img3.doubanio` 404 / 6 候选合并 / Banner 过期。

**WorkflowCard**：head `{sparkle icon}` + 标题 + sub「点击直达，进度可视化」；body flex column gap 10。每段 progress：label 12 + 数值 12（n / total）+ 6px bar。4 段：采集入库（accent）/ 待审核（warn）/ 暂存待发布（info）/ 已上架（ok）。底部 grid 1fr 1fr gap 8：sm btn 审核 / sm btn 批量发布。

**MetricKpiCard**（4 张）：

| label | value | delta | spark color | variant |
|---|---|---|---|---|
| 视频总量 | 695 | `↑ +47 今日` is-up | accent | — |
| 待审 / 暂存 | `484 / 23` | `较昨日 +18` | warn | is-warn |
| 源可达率 | 98.7% | `↑ 0.3pt 7d` is-up | ok | is-ok |
| 失效源 | 1,939 | `↓ -28 较昨日` is-down | danger | is-danger |

**RecentActivityCard**：每条 10×14：28×28 radius 6 bg3 + sev 配色 icon → strong who · what (12) + when (11 muted)。

**SiteHealthCard**：前 8 站，每行 8×14：18×18 radius 4 health 数字（>80 ok / >50 warn / else danger）+ name (12/600) + type · format · last (11 muted) + Spark 60×18 + xs btn（开机时"增量" / 关机时"重启"）。

#### 5.1.3 编辑态规则

管理台站支持团队/个人布局、拖拽、resize、关闭、全屏。**默认浏览态保持紧凑，编辑态才显示虚线网格、拖拽手柄、resize handle 和卡片库入口**。

#### 5.1.4 当前实现

- `DashboardClient` 是 tab 容器 + 三态 StatCard，未复刻 page head、attention card、workflow、KPI spark、最近活动、站点健康。
- analytics Tab 只是占位文案，未迁入设计稿 `AnalyticsView` 的 KPI、图表、源类型分布、最近任务表。
- Stats API 字段仍需核对，不应把接口成功渲染成 `—`。

### 5.2 内容审核 Moderation Console

真源：`app/screens-1.jsx:705-958`，辅助组件在同文件 `165-704`。

结构：

- 顶部 page head 显示今日处理、通过率、平均决策和键盘提示。
- Segment tabs：待审核、待发布、已拒绝，badge 计数。
- Pending tab 是三栏：左队列 280px，中间主预览，右详情 300px，可按视口隐藏。
- 左队列行有 active left border、健康汇总、poster、meta。
- 中间 pane head 有 J/K 进度、拒绝/跳过/通过快捷键按钮。
- 右 pane tabs：详情、历史、类似。详情里有豆瓣匹配、状态三元组、关键字段；历史为时间线；类似用于合并判断。
- Staging 与 Rejected tabs 是审核闭环，不是普通表格。

实现提醒：

- 审核台的三栏 pane、键盘流和状态三元组是核心，**不应退化成普通列表页**。
- 审核动作后必须合并后端返回的完整状态三元组。

### 5.3 视频库 Videos（表格标杆）

真源：`app/screens-3.jsx:5-87`，DataTable 真源 `app/datatable.jsx`。

结构：

- 页面高度：`calc(100vh - topbar-h - 32px)`，flex column，gap 12。
- page head：title「视频库」，sub「695 条视频 · 表头集成 · 视图保存 · 乐观更新」，actions 导出 CSV + 手动添加视频。
- 表格使用 DataTable v2，**视频库是 DataTable 标杆页**。
- Saved views：我的待审、本周、封面失效、团队新增上架。
- Bulk actions：批准、上架、重验源、修封面、隐藏。
- 列定义见 §6.1。

当前实现：

- 有真实 API、filters、URL/sessionStorage 状态、列设置、分页、批量公开/隐藏/通过/拒绝、基础编辑 drawer。
- 缺 page head/actions，Toolbar 与 filters 在表格外部，不是表头集成。
- 封面是 64x36 横图，设计稿是 32x48 竖版。
- 标题 cell 混入 `VideoStatusIndicator`，设计稿将可见性/审核拆列展示。
- 源健康是 raw `active/total`，设计稿有 dot + 文案。
- 图片健康是 raw poster/backdrop 状态，设计稿是 P0 pill。
- 行操作是 dropdown 触发器，设计稿是 inline xs actions。
- `isAdmin` 当前**硬编码 false**，admin-only 操作无法真实对齐。
- Row optimistic patch 只写单字段，后端状态机联动字段时会残留旧 badge。

### 5.4 播放线路 Sources

真源：`app/screens-2.jsx:5-131`。

- page head + actions：一键替换最相似 URL、批量验证。
- KPI 四列：总播放源、有效、失效、孤岛/用户纠错。
- Segment：按视频分组、仅失效、用户纠错、孤岛源。
- Filter bar：搜索视频名/URL/site key、站点 chip、健康 chip、排序说明。
- 表格按视频聚合，**可展开**；展开行显示线路矩阵：行是线路，列是集，颜色表示探测/播放双信号，含替换/复制/重验/删除全失效动作。
- 列定义见 §6.2。

实现提醒：表格视觉与视频库收敛（同 frame、行高、hover、pagination、scrollbar）；展开区可以使用内部 grid。

### 5.5 暂存发布 Staging

真源：`app/screens-2.jsx:134-238`。

- page head + actions：自动发布规则、批量发布选中。
- 上部 1.5fr/1fr：发布流水线 card + 自动发布规则 card。
- Segment：全部、就绪、警告、阻塞。
- 表格列定义见 §6.3。

### 5.6 采集控制 Crawler

真源：`app/screens-2.jsx:241-317`。

- page head + actions：导出、新增站点、全站全量。
- KPI 五列：站点、运行中、失败、本批视频量、平均时长。
- 主体 1fr/360px：实时任务时间轴 + 站点列表。
- 时间轴用横向 progress bars 表示每站任务窗口，运行状态用 dot/pulse 和 soft 状态背景。
- 站点列表是 card body scroll，站点行 8px dot、name/key/weight、增量/全量按钮。
- 此页**非标准 DataTable**，但要求遵守同款 surface、border、密度、scrollbar；列见 §6.8。

### 5.7 首页编辑 Home Ops

真源：`app/screens-2.jsx:320-406`。

- page head + actions：预览前台、新建编排。
- 主体 1fr/360px：左侧编排列表，右侧 sticky 前台实时预览。
- Segment：Banner、Top10、推荐位、分类入口。
- Banner item 是 10px padding、`bg3/border/r-2`，含 drag handle、序号、120x54 横图、title/meta/pills、edit/preview/delete。
- 预览卡保留前台视觉，不套后台表格语言。

### 5.8 图片健康 Image Health

真源：`app/screens-2.jsx:409-467`。

- page head + actions：重扫所有封面、批量切 fallback 域。
- KPI 四列：已上架视频、P0 封面失效、P1 背景图、7 天新增破链。
- 主体 1fr/1fr：TOP 破损域名（条形图列表，列见 §6.7）+ 破损样本（grid，2:3 ratio placeholder、danger dashed border、底部错误信息 overlay）。

### 5.9 合并/拆分 Merge

真源：`app/screens-2.jsx:470-545`。

- page head + action 合并审计日志。
- Segment：待审候选、已合并、已拆分。
- 候选 card：顶部置信度 pill + 标题 + 拒绝/确认。
- 中部 1fr/60px/1fr：左右视频卡对比，中间合并原因。
- 底部影响预览：线路、源、收藏、可回滚。

### 5.10 用户管理 Users

真源：`app/screens-3.jsx:90-136`。

- page head + actions：角色矩阵、邀请用户。
- KPI 四列：总数、活跃、今日新增、已封禁。
- 列定义见 §6.4。

### 5.11 站点设置 Settings

真源：`app/screens-3.jsx:139-217`。

- page head + actions：审计日志、保存所有更改。
- 主体 180px/1fr：左侧 card 内垂直 tab，右侧 card 内容。
- Tab item 使用 8px 10px、radius 4、active `accent-soft/accent`。
- Basic/Douban/Filter/Images 等配置区使用 card body、input、textarea、toggle、banner。

实现提醒：**system/settings 子页如果继续存在，侧栏不应暴露多个 system 子项**；设计稿是设置页内部 tab。当前 server-next 在 sidebar 暴露了 system/settings/monitor/cache/config/migration 多个子项，需收敛为一个入口 + 内部 tab。

### 5.12 审计日志 Audit

真源：`app/screens-3.jsx:220-269`。

- page head + actions：导出、时间穿梭。
- Filter bar：搜索、用户/类型/时间 chip、总数。
- 列定义见 §6.5。

### 5.13 用户投稿 Submissions

真源：`app/screens-3.jsx:272-310`。

- page head。
- Segment：失效源举报、求片、元数据纠错、已处理。
- Card list（**非表格**）：32px 状态 icon box、可选 poster、title、who/time、quote block、重验/查看视频/处理按钮。

### 5.14 字幕管理 Subtitles

真源：`app/screens-3.jsx:313-352`。

- page head + 上传字幕。
- KPI 四列：字幕总数、中文、英文、缺字幕视频。
- 列定义见 §6.6。

### 5.15 数据看板 Analytics

真源：`app/screens-3.jsx:355-425`。

- page head + period select + 导出报表。
- KPI 四列：视频总数、已上架、待审/暂存、源可达率，均带 Spark。
- 主体 2fr/1fr：采集任务量折线面积图 + 源类型分布。
- 下方 card：爬虫最近任务 table（列定义见 §6.9）。

当前实现：

- `/admin/analytics` 已 redirect 到 `/admin?tab=analytics`，方向与 IA 修订一致。
- `/admin?tab=analytics` 仍是占位，不满足设计稿的 analytics 内容迁入。

### 5.16 登录 Login

真源：`app/screens-3.jsx:428-447`。

- 全屏居中，背景含轻微 radial accent overlay。
- 登录 card 宽 400，padding 40，`bg2/border/r-4/shadow-lg`。
- Brand row 使用 36px logo、18px title、11px subtitle。
- 表单 input、remember checkbox、primary 登录、分隔线、SSO button、审计提示。

---

## 6. 表格视觉契约 + 各页面列规范

### 6.0 视觉契约（**全站统一，不可分裂**）

下列项目**全站统一**，不允许各页自由发挥（落地状态见 §0a 与 §4.4.1 标注）：

- framed surface（外层 bg2 + border + radius r-3 + overflow hidden）
- toolbar 模式（DataTable 内部含 search / saved views / filter chips / 隐藏列 chip / toolbar slot）【部分实现：toolbar / saved views ✅；filter chips / 隐藏列 chip 🔄 Step 7A】
- sticky thead；密度（th 8×12 padding / fs 11 uppercase / td 8×12 padding / fs 12）【🔄 thead sticky + body 独立滚动 Step 7A】
- hover bg3 / selected accent-soft / active 左侧 2px accent
- empty / error / loading 三态文案与样式
- pagination（`.dt__foot` 内置，24px 高页码按钮）【🔄 Step 7A 计划：当前 DataTable 不内置，消费方走外置 PaginationV2 过渡】
- bulk bar（表格内 sticky bottom + accent border-top）【✅ bulkActions prop 已落地】
- scrollbar（全站 6px，§3.4）
- 行高 40px 默认 / 32px compact / 24px 超紧凑
- cell padding 12px

### 6.1–6.9 各页面列定义（按业务需要选择和调整）

> **复用的是上面的视觉契约，不是列集合。** 每页 columns 数组按业务自由定义；但**同一语义在多页应使用同一 cell 组件**（如「双信号」必 DualSignal、「视频可见性+审核」必 VisChip、「类型」必 type pill、「源活跃」必 dot+count+文案）。

#### 6.1 视频库表格（标杆）

| key | 列名 | 宽 | render | sortable | filterable |
|-----|------|---|--------|----------|----|
| `_select` | ☐ | 40 | 14px checkbox 居中 | — | — |
| `thumb` | 封面 | 60 | `<img class="tbl-thumb tbl-thumb--sm">` 32×48 竖版 radius 4 | ❌ | ❌ |
| `title` | 标题 | flex (pinned) | `.tbl-title`（标题 12/600） + `.tbl-meta.mono`（`{shortId} · {year}` 11 muted） | ✅ | ✅ |
| `type` | 类型 | 90 | `<span class="pill">{type}</span>`（中性 / 类型映射） | ✅ | ✅ enum |
| `sources` | 源活跃 | 100 | dot（`>10` ok / `>3` warn / else danger） + `<strong>{n}</strong>` + `<span muted fs10>{活跃/一般/稀少}</span>` | ✅ desc | ✅ range |
| `probe` | 探测/播放 | 140 | `<DualSignal probe={} render={} />` | ❌ | ✅ enum (ok/partial/dead) |
| `image` | 图片 | 100 | `<span class="pill pill--{danger if 封面失效 else ok}"><dot/>P0 {失效\|活跃}</span>` | ❌ | ✅ enum |
| `visibility` | 可见性 | 120 | `<VisChip visibility review />` | ✅ enum | ✅ enum |
| `review` | 审核 | 90 | `<span class="pill pill--{ok\|warn\|danger}"><dot/>{已通过\|待审\|已拒}</span>` | ✅ enum | ✅ enum |
| `actions` | 操作 | 170 | xs btn ×5：编辑 / 前台 / 播放 / 补源 / **上架(primary)**；hover 时浮现 | ❌ | ❌ |

#### 6.2 播放线路表格（视频分组、行可展开）

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `_select` | ☐ | 40 | checkbox |
| `video` | 视频 | flex | `chevR(展开旋转 90°) + tbl-thumb--sm + tbl-title + tbl-meta(type · year · 集数)` |
| `lines` | 线路 | 90 | `<strong>{lines}</strong> <span muted fs11>条</span>` |
| `sources` | 集·源 | 100 | `<strong>{sources}</strong> <span muted fs11>个</span>` |
| `probe` | 探测 | 110 | `pill ok\|warn\|danger`（"全部可达 / 部分 / 全失效"） |
| `render` | 播放 | 110 | `pill ok\|warn\|danger\|""`（"可播 / 部分 / 不可播 / 未测"） |
| `updated` | 更新 | 80 | muted fs 11 |
| `actions` | 操作 | 120 | btn--xs ×3：refresh / zap / more |

行展开内容（独立子区，不算表格列）：

- 文案 muted「线路矩阵 — 行：线路 / 列：集 · 颜色：探测 ✕ 播放 双信号」
- grid `100px repeat(8, 1fr) 80px`：左线路名 + 8 集色块（24h ok / warn / danger，含 ✓/!/✕）+ 替换按钮
- 底部三 xs 按钮：复制线路 / 重验全部 / **删除全失效(danger)**

#### 6.3 暂存发布表格

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `_select` | ☐ | 40 | checkbox |
| `video` | 视频 | flex | `tbl-thumb--sm + tbl-title + tbl-meta(type · year)` |
| `type` | 类型 | 90 | `pill`（movie / series） |
| `douban` | 豆瓣 | 70 | 评分 accent 600 / `—` muted |
| `signal` | 探测/播放 | 140 | `<DualSignal>` |
| `dwell` | 暂存时长 | 90 | muted "N 分钟" |
| `ready` | 就绪状态 | 200 | `pill ok\|warn\|danger + " · " + 原因`（"通过全部规则 / 豆瓣未匹配 / 线路全失效"） |
| `actions` | 操作 | 130 | **发布(primary xs)** / 编辑 / more |

#### 6.4 用户管理表格

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `user` | 用户 | flex | avatar(30×30 linear-gradient hue 由 index 决定) + name(12/600) + `@username`(11 muted) |
| `role` | 角色 | 110 | `pill pill--{danger\|warn\|info\|info\|""}`（admin / moderator / editor / crawler / viewer） |
| `email` | 邮箱 | 200 | mono muted |
| `scope` | 权限范围 | 140 | text |
| `last_login` | 最后登录 | 110 | muted fs 11 |
| `2fa` | 2FA | 80 | `pill ok` 已开 / `pill warn` 未开 |
| `actions` | 操作 | 110 | xs ×3：edit / shield / **trash(danger)** |

#### 6.5 审计日志表格

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `time` | 时间 | 110 | muted fs 11 nowrap |
| `user` | 用户 | 110 | `<strong>` |
| `action` | 操作 | 160 | `pill pill--{info\|ok\|warn\|danger}`（事件类型 dot key，如 `video.approve`） |
| `target` | 对象 | flex | mono |
| `change` | 变更 | 200 | text-2 fs 11（如 `review: pending → approved`） |
| `ip` | IP | 110 | mono muted fs 11 |
| `actions` | 操作 | 130 | xs「查看 diff」/「**回滚(danger)**」 |

#### 6.6 字幕管理表格

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `video` | 视频 | flex | `tbl-thumb--sm + tbl-title` |
| `lang` | 语言 | 110 | `pill pill--info`（简体中文 / English / ...） |
| `format` | 格式 | 70 | mono `srt / ass / vtt` |
| `source` | 来源 | 130 | muted fs 11（OpenSubtitles / 用户上传 / ...） |
| `quality` | 同步质量 | 130 | `60×6 progress(ok)` + `<span fs11>{N}%</span>` |
| `size` | 大小 | 90 | muted fs 11（KB） |
| `actions` | 操作 | 110 | xs ×3：eye / edit / **trash(danger)** |

#### 6.7 图片健康 · TOP 破损域名（条形图列表，非真表格）

非 DataTable，是 card list；遵守同 frame、padding、border-subtle；列示意：

| 列 | 宽 | 内容 |
|----|---|------|
| 序号 | 24 | muted `#N` |
| 域名 | flex | mono fs 12 |
| 量条 | 120 | `120×14` bar，填充 `var(--{warn\|danger})` |
| 数量 | 40 | right，warn / danger 染色 |
| 操作 | — | `btn--xs` 「切 fallback」 |

#### 6.8 采集控制（实时任务时间轴 + 站点列表，非表格）

| 区块 | 内容 | 样式 |
|---|---|---|
| 实时任务时间轴 | 站点名、时间轴、任务窗口、last | card body 内横向 progress；站点名 12px/600；状态 dot/pulse；任务块 soft 背景 + 状态边框 |
| 站点列表 | on/off dot、name、key/weight、增量/全量 | card body scroll；行 padding 8px 14px；key mono 10px muted；actions xs |

#### 6.9 数据看板 · 爬虫最近任务（次表）

| key | 列名 | 宽 | render |
|-----|------|---|--------|
| `site` | 资源站 | flex | `<strong>{name}</strong>` |
| `status` | 状态 | 90 | `pill ok\|danger\|warn`（成功 / 失败 / 运行中） |
| `start` | 开始 | 110 | muted fs 11 |
| `end` | 结束 | 110 | muted fs 11 |
| `videos` | 新增视频 | 110 | `<strong color:ok>+{n}</strong>` |
| `sources` | 新增源 | 110 | `<strong color:accent>+{n}</strong>` |
| `dur` | 耗时 | 80 | text "{n}s" |

### 6.10 非表格页面说明

管理台站、内容审核、首页编辑、合并拆分、用户投稿、登录**不是标准表格页**。它们可以包含表格片段，但主布局分别按卡片工作台、split panes、编排卡片、对比卡、card list、登录 card 执行。

---

## 7. 业务复合组件清单（必抽至 `packages/admin-ui`）

CLAUDE.md 强制 3 处复用即抽 shared。下列均已在 ≥3 页使用，**目前全部未抽**：

| 组件 | 说明 | 出现页面 |
|---|---|---|
| `<DualSignal probe render>` | 探测（cyan probe pill）+ 播放（violet render pill）双胶囊；state: ok / partial / all_dead / unknown | 视频库 / 暂存 / 审核台 / 播放线路 |
| `<VisChip visibility review>` | 可见性 × 审核状态联动单 chip | 视频库 / 审核台 / 视频编辑 Drawer |
| `<Spark data color width=60 height=18>` | svg 折线，opacity .4 | Dashboard / Analytics / 站点健康 |
| `<KpiCard label value delta spark variant>` | 现 DashboardClient 自造 StatCard 应升级为此 | Dashboard / Analytics / Sources / Image Health / Users / Subtitles / Crawler |
| `<DecisionCard probe render>` | 三态 banner：all_dead → danger / 信号冲突 → warn / 健康 → ok | 审核台 |
| `<EpisodeSelector total current onSelect>` | 集数选择器，>20 集分页 | 审核台 / 视频编辑 Drawer |
| `<LinesPanel videoId>` | 拖拽 + 启停 + 双信号 + 重测 | 审核台 / 视频编辑 Drawer |
| `<ModListRow>` | 审核台左栏行 | 审核台（多 tab 复用） |

`.btn / .seg / .pill / .fchip / .inp / .kbd / .checkbox / .banner / .card` 全局类同样需要 React 组件或 className utility 化。

---

## 8. 当前实现差异清单

这些差异不是单个视频库页面的问题，而是**通用语言未收束导致的跨页风险**。

| 范围 | 当前状态 | 对后续的影响 |
|---|---|---|
| Token 映射 | design v2.1 的 `bg0-bg4` 与 packages semantic token 没有一张工程可执行映射表；一些组件仍引用未定义变量（§3.6.1） | 字体、颜色、hover、selected、badge 跨页面漂移，视觉验收假绿。按需补 token，可以接受近似但不能接受 undefined |
| Brand 颜色 | 设计稿 amber 与当前实现 brand accent 不一致 | 当前裁决以实现为准，不把 amber 回迁作为视频库或表格修复内容 |
| Shell | 功能契约基本补齐，但仍是 inline style + 局部 CSS 注入，离 `.sb/.tb` 细节有差距 | 新页面看到的第一层视觉不稳定，尤其 sidebar、footer、collapse、UserMenu |
| Sidebar collapse | 展开/收缩缺少过渡，且分区标题改变图标纵向位置 | 每次切换侧栏都造成图标跳跃，人工可见 |
| Table language | **【已闭合 Step 1–6】** framed surface / toolbar / saved views / header menu(enableHeaderMenu) / bulk(.dt__bulk) / row flash 已收进 DataTable 一体化；**【待 Step 7A】** body 独立滚动 / `.dt__foot` pagination / 隐藏列 chip / filter chips slot 仍待落地，落地前消费方走外置 PaginationV2 等过渡形态 | Step 7A 落地前后续列表页不能完全 mirror 视频库标杆；切勿按"已存在 prop"假设调用未实现的 DataTable.pagination |
| 表格密度 | 当前 DataTable 13px body、外部分页 28px 按钮，设计稿 table/dataTable 主体 12px、th 11px【🔄 与 Step 7A 一同闭合】 | 视觉显松，行高与 poster/操作列比例不稳 |
| Scrollbar | 设计稿和当前实现存在 10px/6px 混用 | 同页多个滚动容器宽度不同，视觉不统一 |
| Poster 缩略图 | 视频库使用 64x36 横图 | 与设计稿"视频资产库"识别核心 32x48 竖版海报冲突 |
| Row actions | 视频库 dropdown 化 | 设计稿强调 hover 行内 xs actions，批量管理场景扫描效率下降 |
| Drawer | 只有基础信息表单，540px | 不能作为全局 VideoEditDrawer 标杆 |
| Dashboard | 用卡片 API demo 替代管理台站布局 | 缺具体卡片设计：异常关注、工作流、指标、活动、站点健康、分析图表、卡片库与全屏态 |
| Analytics | Redirect 已做，内容未迁 | IA 上收敛，但业务/视觉仍为空 |
| Notifications/tasks | AdminShell 支持，但 server-next 不传数据 | Topbar mock 状态与设计稿不同，人工会看到 disabled |
| Settings/system 子项 | sidebar 暴露 settings/monitor/cache/config/migration 多入口 | 设计稿是设置页内部 tab，应收敛为单入口 |
| 视频库表格列 | 缺 page__head / DualSignal / P0 图片 pill / VisChip 联动 / dot+文案 源活跃 / inline xs actions | 视频库识别度差，不达标杆 |

---

## 9. 跨页面通用语言 Checklist（开发任务前必读）

新页面 / 新任务在动笔写代码前，请逐项核对：

- [ ] 颜色全部走 `var(--*)`，禁止 `#hex / rgb()`（CLAUDE.md）
- [ ] 用实现层 token：`--accent-default / --state-*-fg/bg / --dual-signal-*`，不用未定义变量（`--accent-subtle / --bg-subtle / --bg-surface-hover / --state-error` 等已知坏引用）
- [ ] 所有列表页用 page__head（标题 + 副标题 + actions）开头
- [ ] 主操作 = `btn--primary`；危险/删除 = `btn--danger`
- [ ] 行高 / 圆角 / 间距走 token，不写 magic number
- [ ] 容器 / 抽屉 / Modal / 弹层 z-index 走 `--z-*` token
- [ ] 状态 pill 走 `pill--ok/warn/danger/info/probe/render`，文本伴随 dot
- [ ] DataTable 必须使用 `@resovo/admin-ui` 的 DataTable + 周边 primitives，禁止自造 table
- [ ] 列定义遵守 §6.0 视觉契约；列内容按业务自由设计，但**同一语义必须用同一 cell 组件**（DualSignal / VisChip / Spark / KpiCard）
- [ ] 一个 UI pattern 在 3 处出现 → 立即抽 shared 组件（CLAUDE.md "共享组件"约束）
- [ ] 涉及视频源探测/播放，必须用 DualSignal 双 pill 表达
- [ ] 涉及视频可见性 + 审核 = 必须 VisChip 联动单 chip
- [ ] 任何"乐观更新"必须配 `flashIds` 短暂高亮（实装后）
- [ ] 任何 scrollable 容器：**禁止**单独 override 滚动条宽度，统一 6px (§3.4)
- [ ] Sidebar 折叠/展开：**禁止**条件 unmount section 标题 (§4.1.2 问题 B)
- [ ] 所有 transition 必须命中 `prefers-reduced-motion` 时降为 0ms
- [ ] sidebar 暴露的入口不应包含本属于"设置内 tab"的子项（如 system/monitor/cache/config/migration）

---

## 10. 后续任务开发的硬性参考口径

1. **列表页默认选择**：
   - 视频库和可复用大列表：DataTable，以视频库表格为视觉标杆。
   - Sources/Staging/Users/Audit/Subtitles/Analytics recent tasks：同一套表格视觉，列内容按 §6 各页规范。
   - Moderation：split panes，非标准表格页。
2. **每个列表页必须明确**：
   - page head 是否存在。
   - toolbar 在页面级还是 DataTable 内部。
   - 表格滚动容器是谁。
   - bulk action 在表格内部 sticky 还是外部浮条。
   - 行操作是 inline xs buttons 还是 dropdown。**设计稿已指定时按设计稿。**
3. 状态展示必须用统一 pill / dual-signal / VisChip，不用 raw enum 文本代替。
4. 视频类素材默认**竖版 32×48 poster**。只有 Home Ops banner / 前台预览等横向运营位使用横图。
5. 任何新增颜色、阴影、radius、font-size：
   - 先查 `packages/design-tokens` 是否已定义。
   - 如果只是 v2.1 设计稿里的 admin 专属值，补 admin-layout/admin-shell token。
   - 如果是全站语义，走 ADR / 任务卡，不在页面硬编码。
6. 代码评审时把"人工可见变化"作为独立验收项，不只看 typecheck/test。
7. 侧边栏改动必须验证展开/收缩的过渡和 icon 纵向稳定性。
8. 新任务卡的完成标准应引用本文件相应章节，例如「视频库列视觉按 §5.3 / §6.1，Table frame 按 §4.4」。

---

## 11. 修复顺序建议

1. **Token completeness**：补未定义变量检测，清掉 `--accent-subtle`、`--bg-subtle`、`--bg-surface-hover`、`--state-error` 等未定义引用；按需补 table / scrollbar / surface-hover 等角色 token。
2. **Table frame**：以视频库表格为标杆，扩展现有 DataTable 支持 toolbar 内置 search / saved views / column header menu / bulk bar / row flash / pinned sticky / frame surface（§4.4 路径，**不引入 TableFrame 抽象层**）。
3. **Scrollbar unification**：所有 admin scroll containers 统一 **6px** 宽度和低对比 thumb。
4. **Sidebar transition**：补 width/opacity 过渡，保留分区标题等高占位，确保展开/收缩时 icon Y 坐标稳定（§4.1.2）。
5. **Shell visual pass**：把 Sidebar / Topbar / UserMenu / Collapse 的几何、字号、hover、footer、tooltip 与本文件裁决对齐；brand 色保持实现侧；折叠按钮文字「折叠」改「收起边栏」；admin-shell-client 接入 notifications/tasks 真实数据。
6. **Settings 入口收敛**：sidebar 移除 system/monitor/cache/config/migration 多入口，改回「站点设置」单入口 + 内部 tab。
7. **Dashboard card pass**：按 §5.1 具体卡片类型补管理台站，不用通用 StatCard 占位；先实现浏览态，编辑态（CardLibraryDrawer / FullscreenCard）后置。
8. **Video library pass**：在 Table frame 完成后再修视频库列、poster、page head、actions、row state merge、admin role。
9. **Analytics pass**：把 `/admin?tab=analytics` 内容按 §5.15 迁入。
10. **VideoEditDrawer pass**：从 540px 基础表单扩到 680px + fullscreen + tabs + quick header + footer。

---

## §A. 待决议项（暂无决议，留待后续）

A1. **Brand 切色后的视觉签收清单**：login 页 radial-gradient、sidebar logo 渐变、active 行/链接边条、accent-soft 选中行——这些原设计稿是 amber 系，切到当前 brand（蓝）后需视觉签收，由设计师明确"是否接受蓝色版本"或提供新视觉。

A2. **Wireframes.html → index.html 的 gap 清单**：Wireframes.html 提到的部分内容（如管理台站编辑模式的卡片库 schema、内容审核违规标签快捷键、采集站点展开 DAG）在 index.html 没有完整实现。需要设计师明确"放弃 / 延后"。

A3. **CardLibraryDrawer 数据契约**：管理台站编辑态卡片库的拖拽来源、卡片元数据 shape（type / defaultSize / dataSource / teamShared）尚未定义。

A4. **DataTable views 后端 schema**：saved view（personal / team scope）的存储位置、共享语义、迁移策略未定。

A5. **Notification / Task drawer 数据接入**：AdminShell 已支持 prop，server-next 未传入；需要决定 mock vs 真实接入的优先级。

---

## §B. 相关文件索引

| 文件 | 行数 | 用途 |
|---|---|---|
| `docs/designs/backend_design_v2.1/index.html` | 131 | 视觉真源入口（render jsx mocks） |
| `docs/designs/backend_design_v2.1/Wireframes.html` | 2255 | 早期线框图（部分未落地，仅作意图参考） |
| `docs/designs/backend_design_v2.1/styles/tokens.css` | 138 | 设计 token 真源 |
| `docs/designs/backend_design_v2.1/styles/components.css` | 677 | 设计稿 CSS 真源 |
| `docs/designs/backend_design_v2.1/app/shell.jsx` | 300 | AdminShell 范式 |
| `docs/designs/backend_design_v2.1/app/datatable.jsx` | 295 | DataTable v2 真源 |
| `docs/designs/backend_design_v2.1/app/screens-1.jsx` | 960 | Dashboard / Moderation |
| `docs/designs/backend_design_v2.1/app/screens-2.jsx` | 547 | Sources / Staging / Crawler / Home / ImageHealth / Merge |
| `docs/designs/backend_design_v2.1/app/screens-3.jsx` | 449 | **Videos（标杆）** / Users / Settings / Audit / Submissions / Subtitles / Analytics / Login |
| `docs/designs/backend_design_v2.1/app/video-edit-drawer.jsx` | 464 | 视频编辑 Drawer 4 Tab |
| `docs/designs/backend_design_v2.1/app/notifications.jsx` | 275 | NotifPanel + TasksPanel + Toast |
| `docs/designs/backend_design_v2.1/info.md` | 126 | 设计稿决策摘要 |
| `packages/design-tokens/src/css/tokens.css` | 427 | 当前 token 实装 |
| `packages/admin-ui/src/components/data-table/*` | ~1800 | DataTable v2 实装 |
| `packages/admin-ui/src/shell/*` | ~2900 | AdminShell 实装 |
| `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` | 356 | 视频库消费层 |
