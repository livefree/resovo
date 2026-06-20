# design-sync 仓库笔记 — @resovo/admin-ui

> 首次导入：2026-06-17。主体 = `packages/admin-ui`（React 组件库），token = `packages/design-tokens`。

## 构建与解析

- **admin-ui 是纯源码包**（`main: ./src/index.ts`），无 `dist/`、无 build 脚本 → 转换器走 **synth-entry 模式**（从 `src/` 合成入口，esbuild 直接打包）。
- `--node-modules` 用 **仓库根 `node_modules`**（hoist；admin-ui 自身无 node_modules）。react / react-dom / zustand / @resovo/types 均解析自根。
- `@resovo/types` 是 workspace 包（`node_modules/@resovo/types -> ../../packages/types`），esbuild 可解析。
- admin-ui tsconfig 无 `paths` 别名，无需 `cfg.tsconfig` 处理 `@/` 别名。

## 样式架构（运行时自带样式 / CSS-in-JS）

- admin-ui **零 `.css` 文件**。样式两路：
  1. **内联 `React.CSSProperties` + `var(--*)`**（叶子组件如 AdminButton；随 JS bundle，自动生效）。
  2. **`<style>` 注入块**（`AdminShellStyles` / `DTStyles` / interaction-styles，用 `dangerouslySetInnerHTML`），处理 hover / 伪元素 / 过渡，由父组件内部渲染。
- 唯一静态 CSS = design-tokens。预计 validate 报 `[CSS_RUNTIME]`（非阻塞，self-styling bundle 正常）。

## Token 来源与缺口（重要）

- app 真正加载的是 `@import '@resovo/design-tokens/css'` → **`packages/design-tokens/src/css/tokens.css`**（488 行，:root + [data-theme=dark]）。`tokensGlob` 指向它。
- `dist/tokens.css` 是另一套**更小子集**（281 行，缺 admin-layout / components token），**勿用**。
- **design-tokens 的 CSS 构建（`scripts/build-css.ts`）只发射 components 层的 `player`，漏发 `button/input/table/modal` 层** → 以下被 admin-ui 引用但未进 CSS 的 token（约 25 个）会触发 `[TOKENS_MISSING]`：
  `--button-padding-x` `--input-padding-x` `--fg-danger/-ok/-warn/-secondary` `--bg-subtle/-surface-hover/-bg3` `--border-danger/-ok/-warn` `--state-danger(-fg/-border)/-ok(-soft)` `--accent-on/-soft` `--font-mono` `--radius-pill/-xs` `--shadow-xs` `--z-shell`
  - 动态内联设值的非 token（正常忽略）：`--cover-*` `--state-*`(部分) `--dt-grid-template` `--dt-autofilter-max-height`
  - **解决策略**：从 design-tokens 源 `src/components/{button,input,table,modal}.ts` + `src/admin-layout/surfaces.ts` 取真值，author 一张补充 CSS 放 `.design-sync/`，并入 `tokensGlob`（不臆造数值）。validate 的 `[TOKENS_MISSING]` 给权威缺失清单。
- `--bg-surface-hover` 等 hover 态 token 仅交互时用，静态预览低风险。

## 字体决策（用户确认 2026-06-17）

- 品牌字体 Noto Sans / Noto Sans SC 由 app 的 `next/font/google` **运行时注入** `--font-noto-sans(-sc)` 变量；JetBrains Mono 为 mono 栈首选（有系统回退）。仓库无静态 woff2。
- 用户选择**视为 host 运行时注入** → `cfg.runtimeFontPrefixes = [Noto, PingFang, Hiragino, "Microsoft YaHei", "JetBrains Mono", "SF Mono"]` 抑制 `[FONT_MISSING]`。**不随包上传字体**。
- 后果：Claude Design 预览/设计用系统字体（macOS 下 PingFang SC / SF Mono，与 app 首屏几乎一致）。若日后要 on-brand，可改用 `cfg.extraFonts` 上传 Noto Sans SC + JetBrains Mono woff2。

## Token 缺口最终判定（重要）

- 前述 ~25 个被引用 token（`--button-padding-x` `--fg-danger` `--font-mono` `--accent-soft` `--radius-pill` 等）在 design-tokens（CSS 与 JS-token 对象）、admin-ui、app globals **处处未定义** = **真实产品 latent gap**（design-tokens `components/button.ts` 等是结构化 JS token 对象，从不产出 `--button-padding-x` 这类扁平 CSS 变量；`build-css.ts` 也只发射 components 层的 `player`）。
- **决策（已落地）：忠实别名桥接，非臆造**。solo 标定证实：用规范名（`--state-error-fg`）的组件（KpiCard）正常，仅用**别名**（`--fg-danger`）的组件（AdminButton danger / admin-input/select/card/textarea / segment / code-text / pickers，~10 个核心 primitive）失样。
- 解决：新增 **`packages/design-tokens/src/css/_ds-sync-aliases.css`** —— 把别名映射到 design-tokens **已有的 theme-aware 规范值**（`--fg-danger: var(--state-error-fg)` 等，全部 var() 引用既有 token，不写死任何颜色 → 单 `:root` 块自动覆盖 light/dark）。`tokensGlob` 放宽为 `src/css/*.css` 拾取它。
- **真实 app 不受影响**：globals.css 仅 `@import '@resovo/design-tokens/css'`（= tokens.css 单文件），不走 glob，桥接文件不进 app 运行时。
- 影响范围：danger/ok/warn 前景+边框、state-danger 别名链、accent-soft（segment 未选中）、font-mono（code-text/textarea）、bg-subtle、radius-pill 等。
- 若 design-tokens 日后正式补齐 → 删除桥接文件 + 收回 glob。
- validate 只扫静态 CSS 闭包 → 桥接前报"2 missing, below threshold"，非阻塞。

## 组件排除

- `InteractionStyles`（shell，`<style>` 注入器，非可视）→ `cfg.componentSrcMap.InteractionStyles = null`。最终 70 组件入库。

## 作者化 learnings（wave 1 折叠）

- **overlay 用 createPortal 到 document.body**（Drawer/Modal/Popover/AdminDropdown/AdminSelect）。预览里用受控 `open={true}` 渲染开态即可，截图能捕获（portal 内容在同页）。Drawer/Modal 已加 `cfg.overrides`（cardMode:single + viewport）以单卡呈现。Popover/AdminDropdown/AdminSelect 在受控开态下落位正常，未加 override（如日后越界再加）。
- **EnrichmentBadgeCluster `@deprecated`**（ADR-201，新代码指向 MetadataSourceIconCluster）；预览仍保留（兼容期消费点存在）。.d.ts 标 deprecated 是预期。
- **结构化入参必须给全**（否则塌陷/crash）：`MetadataStatusSummary.providers` 四来源全 entry；`EnrichmentSummary` 11 字段全填；`HealthSnapshot` crawler/invalidRate/moderationPending 全填（rate 传小数，组件转百分比）；`EnrichmentBadge` 是 discriminated union（kind=meta→score；kind=pinyin→isPinyin，false 时 return null）。
- **受控组件**（Pagination/Segment/Breadcrumbs/Popover）：传固定 value + noop 回调即可静态渲染；`onXxx` 省略会隐藏对应 UI（如 Pagination 省 onPageSizeChange 不渲染页大小选择）。
- **AdminCheckbox** indeterminate 经 ref 写 DOM，Playwright 静态截图可捕获原生横线。
- preview 布局 glue 用内联 style；真实中文后台内容（视频/审核/源/元数据）效果良好；字体走系统回退（PingFang SC），与 app 一致。

## 作者化 learnings（wave 2 折叠）

- **wide 组件需 `cardMode:column`**：DataTable / SelectionActionBar / Toolbar / KpiCard / Pagination / Segment（已入 cfg.overrides）。
- **DecisionCard `video` 嵌套字段枚举**（易错）：`doubanStatus` ∈ {pending,matched,candidate,unmatched}（非 ok/dead！）；`sourceCheckStatus` ∈ {pending,ok,partial,all_dead}（dead→all_dead）。子代理曾误用 ok/dead，已修。**子代理用 esbuild 编译不 typecheck → 必须 orchestrator 收尾跑 typecheck 抓此类 prop 类型错误。**
- **IdRef**：`id` 必填 string，`id=null/undefined` 触发 `batchFallback`（用 `id={null as unknown as string} batchFallback="批量"`，勿重复 id 属性）。
- **InlineRowActions**：默认 `opacity:0`（tr:hover 才显），预览必须传 `alwaysVisible={true}`。
- **Thumb**：`<img>` width/height 必须传 number（不能 var()）。
- **Spark**：必传 `data: number[]`（0 元素 return null → floor card 空白根因）。
- **SignalChip** `size`(xs/sm) 仅写 data-size，Pill 无 size prop → 视觉几乎无差（latent gap）。
- **DualSignal** 用 `--dual-signal-*` token，已在 tokens.css（488 行版）定义，无缺口。
- **RejectModal** 是 overlay（受控 open）→ cfg.overrides single。

## Known render warns（已三联确认合法，re-sync 勿误判为新）

- **DecisionCard** `[RENDER_ERRORS]`（2 caught）：Pill 组件 dev-mode console.warn（actions slot 内非 string ReactNode children 无 ariaLabel）。组件渲染完整正确（5 cells 全 good），非渲染失败。
- **ErrorState** `[RENDER_ERRORS]`（4 caught）：ErrorState 组件**按设计 console.error 记录其展示的错误**（403/服务异常等）。这是错误展示组件的固有行为，4 个 cell 均正确渲染错误 UI 并评 good。
- 两者 `.render-check.json` 标 `bad=true` 仅因有 caught pageerror，但 `rootEmpty=false` → 属 §3 非阻塞 RENDER_ERRORS，gate 视为通过（floor card + RENDER_ERRORS 不阻塞）。

## Re-sync 风险

- design-tokens 源若改动 → 跑 `cfg.buildCmd`（`npm run build -w @resovo/design-tokens`）重生成 `src/css/tokens.css`。
- 补充 token CSS 是手工映射 design-tokens 源值；design-tokens 改名/改值时需同步校验（drift 风险）。
- 真实 server-next app 可能也存在上述 token 缺口（latent），本同步只做忠实渲染，不修复上游。
