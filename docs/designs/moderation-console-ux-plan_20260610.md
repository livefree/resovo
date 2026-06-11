# 内容审核台优化方案（SEQ 拆卡规划）

## Context

内容审核台（`apps/server-next/src/app/admin/moderation/`）当前信息密度低、冗余信息多、交互效率不足。目标：移除冗余信息、提升信息密度、优化 UX、提高审核效率。本方案对用户提出的 12 项逐一核查现状，给出落地路径，并按"前端低风险 → 信息密度 → 功能增强（含后端）"三阶段拆成原子化任务卡，注册为新 SEQ。

> ✅ 时序（已按第二轮审核更新）：**SRCHEALTH-P1-1-B 已于 2026-06-10 13:50 完成**，SRCHEALTH SEQ 主体收口，工作台当前**空闲**。本 SEQ 复核通过、注册 `task-queue.md` 后**可立即启动首卡**（无需等待）。
>
> 📌 本文件为 **v2 修订稿**：已吸收尾部两轮审核意见（见文末「修订说明 v2」逐条对照）。

### 用户已定决策
1. **标题治理**：全后台统一治理（共享 PageHead 规约，一次到位）。
2. **快速编辑**：类型 + 题材 + 年代 + 地区 全做（枚举字段一键，年代/地区内联输入免开面板）。
3. **列表过滤**：加 年代 + 富集状态（需后端补 query 参数）。

---

## 现状核查结论（按 12 项，附 file:line）

| # | 项 | 现状 | 结论 |
|---|----|------|------|
| 1 | 键盘流 | J/K/A/R/S 原生 `addEventListener` 实装于 `PendingPaneController.tsx:113-117`；共享 `packages/admin-ui/src/shell/keyboard-shortcuts.tsx` 存在但未用 | 迁移共享 hook + 扩快捷键 + help 浮层 |
| 2 | 前台预览 404 | `getVideoDetailHref`(`packages/types/src/url-helpers.ts:23-26`) 生成 `/{segment}/{slug}-{shortId}` **无 locale 前缀**；web-next `localePrefix` 默认 `always`（`routing.ts`）。preview 走 ADR-160 双因素（cookie role + `?preview=admin`→Bearer），跨端/域无 cookie 时降级 public → 未发布 `notFound()`（`detail-page-factory.tsx:34`） | 复现定位（locale 缺失 / 跨端 cookie 降级）+ 修复 |
| 3 | 列表过滤 | 后端 `PendingQueueQuerySchema`(`moderation.ts:26-35`) 含 type/sourceCheckStatus/doubanStatus/hasStaffNote/needsManualReview **+ `q` 标题搜索**(CHG-350)；共享类型 `PendingQueueQuery`(`packages/types/src/admin-moderation.types.ts:472`)；**年代/富集需补后端 + 类型 + 富集枚举语义** | 后端补参/类型/枚举 + 前端筛选弹层（窄列表不内联，与 q 搜索/预设协调） |
| 4 | 列表单元格布局 | `ModListRow.tsx:32-113` 信息全挤左侧（标题/类型+年/双信号+富集+badge） | 分区重构，利用列宽 |
| 5 | 标题重复 + 紧凑化 | `ModerationConsole.tsx:385` h1 与顶栏面包屑重复；`VideoListClient.tsx:323` 等多页同病；page-head 含今日统计+键盘提示占位(`:386-390`) | 全后台 PageHead 统一治理 + 提示转 hover |
| 6 | 筛选/保存预设 | **已完整实装**：`use-filter-presets.ts:144-280` + `FilterPresetPopover` + `SavePresetModal`，DB+localStorage 双源 | 调查确认可用，微调收敛 |
| 7 | 详情 tab | 状态三元组 = 3 行 `DetailRow`(`TabDetail.tsx:152-154`)；富集(`EnrichmentBadgeCluster`)/豆瓣(`:176`)/外部源(`ExternalMetaPanel`) 信息重叠 | 三元组→1 行 3 `Pill`；去冗余 |
| 8 | 类似 tab | `TabSimilar.tsx` identity/legacy 双源 + merge(`buildMergeHref`)/reject；**无客户端阈值，全量显示** | 阈值过滤低相关 + 合并为主 |
| 9 | 快速编辑 | `PendingCenter.tsx:124-126` 只读；审核台已有 `PATCH /admin/moderation/:id/meta`(`moderation.ts:243`，**pending-only 守卫**) schema=title/year/type/genres，**无 country**；枚举源 `getVideoTypeOptions`/`getVideoGenreOptions` 已有；`Segment` 可单击 | 唯一写路径扩 `/meta`（补 country）+ 4 字段内联快编 |
| 10 | 线路按钮 | 清除失效/刷新 = `lines-panel.tsx:417-422` → `useSourceLinesController` actions，**已接通后端** | 调查确认 + 反馈一致性微调 |
| 11 | 播放器上方线路提示 | `DecisionCard`(`PendingCenter.tsx:80`) 决策建议 banner(`decision-card.tsx:162-165`) 独占整行 | 降为精简 inline，不独占行，重规划文案 |
| 12 | 播放器上方标题冗余 | `DecisionCard` 标题 h3(`decision-card.tsx:160`) 与下方 h2(`PendingCenter.tsx:120`) 重复 | 移除 DecisionCard 标题，保留 h2 |

---

## SEQ 拆卡方案（建议 ID：SEQ-20260610-03 / 前缀 MODUX）

### Phase 1 — 快速修复与去冗余（前端为主，低风险先行）

**MODUX-P1-0 全后台标题现状盘点 + 规约定调（item 5 前置）** ⚠ Opus
- 不写业务代码，仅产出盘点表 + 规约：①已用 `PageHeader`(`packages/admin-ui/src/components/page-header/page-header.tsx`，已导出、20+ 页消费) 的页面清单；②手写 raw `<h1>` 的页面（实测 5 非 dev 页：`SettingsContainer` / `AnalyticsView` / `DashboardClient` / `VideoListClient:323` / `ModerationConsole:385`）；③dev 页豁免（design-tokens / components / visual×2 / fallback-preview 共 5）；④需保留独立标题的例外页。
- **关键规约决策（Opus 子代理）**：顶栏面包屑末项已含页面名 → 页面内标题去留规则（建议：保留 `PageHeader`（常带操作/统计槽），由其统一标题；移除 raw `<h1>`，面包屑末项不再加粗重复）；a11y heading 层级（确保每页仍有唯一 h1 语义）。
- 产物：规约写入方案/ADR 草案 + -A/-B 拆卡边界定死。**不新建 PageHead**（避免与 PageHeader 两套 API）。

**MODUX-P1-1-A 复用/扩展 PageHeader + 审核台/视频库迁移（item 5）** ⚠ 若改 PageHeader Props 则 Opus
- 按 P1-0 规约：必要时扩展 `PageHeader` Props（统计槽/紧凑模式）；`ModerationConsole:385` + `VideoListClient:323` 改用 `PageHeader`，移除 raw `<h1>` 与冗余提示（统计/键盘提示转 hover）。
- 改 `PageHeader` 公开 Props → **Opus 子代理 + commit trailer**（`packages/admin-ui/**/types.ts` 强制项）；仅消费不改 Props 则主循环。
- 验收：两页标题不与面包屑重复；page-head 高度收敛；已消费页无回归。

**MODUX-P1-1-B 其余非 dev 页迁移 + 已消费页规约核对（item 5）**
- `SettingsContainer` / `AnalyticsView` / `DashboardClient` 迁移到 `PageHeader`；已用 PageHeader 的 ~10 页按规约核对一致性；dev 5 页豁免。
- 验收：全后台（除豁免）标题规约一致；逐页核对面包屑映射（`inferBreadcrumbs`）防误删非冗余标题。

**MODUX-P1-2 播放器上方治理：DecisionCard 精简（item 11+12）** ⚠ 共享 cell 组件
- 移除 DecisionCard 冗余标题（`packages/admin-ui/src/components/cell/decision-card.tsx:160`），保留 `PendingCenter.tsx:120` h2 为主标题；决策 banner（`:162-165`）从整行降为精简 inline（图标+短文案，并入操作行或 LinesPanel 头），不独占行；重规划文案（健康/未就绪/冲突/失效）。
- **优先不改 `DecisionCardProps`（`decision-card.types.ts`）**（仅内部布局）；若需改公开 Props → Opus + trailer。
- 消费方核查：业务仅 `PendingCenter.tsx`；另有 `dev/visual` component-registry + mock-data 引用。同步 `decision-card` 单测。
- 验收：单视频内标题仅 1 次（h2）；播放器上方无独占整行提示条；**`dev/visual` 预览页渲染正常**。

**MODUX-P1-3 前台预览 404 调查+修复（item 2）**
- **两根因分开复现，不用一个补丁猜两个**：
  - 根因 A（locale）：打开**已发布**视频 `/movie/x?preview=admin`（不含 locale）是否仍 404 → 验证 `localePrefix:always` 重定向是否吞 query/preview。
  - 根因 B（鉴权降级）：打开**未发布**视频，检查 preview 头/cookie 是否抵达 web-next（`COOKIE_USER_ROLE`/`refresh_token` 作用域、dev 双端口可达性）→ 是否降级 public → `notFound()`(`detail-page-factory.tsx:34`)。
- **修复收口**：`getVideoDetailHref`(`packages/types/src/url-helpers.ts`) 是跨 app 纯函数，**不承载 web-next locale 策略**；新增 **admin preview 专用 URL builder**（置 `apps/server-next` lib 或 web route wrapper 层），负责注入 locale + `?preview=admin`；鉴权降级问题独立修。
- 验收：已发布/未发布视频"前台预览"均打开正确 preview 详情，非 404；纯函数 `url-helpers` 未被污染。

**MODUX-P1-4 线路按钮 + 筛选预设 调查确认（item 10 + 6）**
- 结论登记：清除失效/刷新已接通；预设已完整实装（双源）。微调：清除失效二次确认/结果 toast 一致性；预设按钮随 P1-1 page-head 收敛。
- 验收：按钮反馈明确；预设保存/应用/设默认/导入本地正常（手测 + 既有单测）。

### Phase 2 — 信息密度与布局（前端）

**MODUX-P2-1 待审列表单元格 + page-head 紧凑化（item 4）**
- 重构 `ModListRow.tsx:32-113`：分区（封面 + 标题行 + 元信息行 + 信号/富集行），利用列宽，次要信息 hover 透出；移除审核台 page-head 占位/键盘提示（`ModerationConsole.tsx:386-390` → hover/精简）。
- 验收：280px 列内信息层级清晰；page-head 收敛。

**MODUX-P2-2 详情 tab 重设计（item 7）**
- 状态三元组（`TabDetail.tsx:151-154`）3 行 → 1 行 3 `Pill`（`packages/admin-ui/src/components/cell/pill.tsx`，variant ok/warn + dot），颜色标记。
- 去冗余：富集/豆瓣/外部源信息重叠收敛（豆瓣并入富集簇或外部源面板）。
- 验收：详情 tab 行数下降、状态一目了然、无重复信息块。

**MODUX-P2-3 键盘流完善（item 1）**
- 共享能力是**无渲染组件** `KeyboardShortcuts`（`packages/admin-ui/src/shell/keyboard-shortcuts.tsx`，**非 hook**）：在审核台**局部挂载** `<KeyboardShortcuts bindings={...}/>` 替换 `PendingPaneController.tsx:113-117` 原生 keydown（**不混入 AdminShell 全局快捷键职责**）。
- 扩充 bindings：E 编辑 / P 预览 / 数字键选集·线路 / F 筛选 / `/` 聚焦搜索 / `?` 帮助浮层；批量模式守卫 + `allowInInput` 控制输入框聚焦不误触。
- 验收：审核台快捷键统一经 `KeyboardShortcuts` 管理；与既有全局快捷键无冲突；help overlay 可呼出。

### Phase 3 — 功能增强（前后端，含 ADR 核验）

**MODUX-P3-1 后端：队列端点补 年代+富集 过滤（item 3 后端）**
- **先定义「富集状态」枚举语义**（建议 `missing`/`partial`/`complete`），并明确**从哪些 raw 字段/provenance 派生**（不得只按 UI `enrichmentSummary` 反推）。
- 改动面：①`moderation.ts` `PendingQueueQuerySchema`(:26-35) 加 year/decade + enrichmentStatus；②共享类型 `packages/types/src/admin-moderation.types.ts` 的 `PendingQueueQuery`(:472) 同步扩；③Service/DB queries 加过滤。
- **筛选预设兼容**：明确预设 JSON 快照是否保存新字段、旧预设缺字段如何向后兼容（`use-filter-presets.ts` 的 `FilterPresetQuery`）。
- **非新端点**（不触发 `verify:endpoint-adr`）；跑 `npm run verify:adr-contracts`，若队列端点有 ADR 契约则更新；涉查询变更同步 `docs/architecture.md`。
- 跨 schema/types/service/route 多层 → 按原子化拆 -A（枚举语义+类型+schema）/-B（query+预设兼容）。
- 验收：API 按 year/decade/enrichment 过滤正确；新旧预设均可用；契约核验通过。

**MODUX-P3-2 前端：待审列表筛选弹层（item 3 前端）**
- `PendingQueueToolbar` 加"筛选"按钮开弹层/抽屉（窄列表不内联），消费新参数 + 现有维度；与 URL/预设打通（`applyFiltersToUrl` 已有）。
- **窄 toolbar 布局协调**：与既有 `q` 搜索框（`DataTableSearchInput`）+ 预设按钮在 280px 列宽内不挤占（点名排布，必要时图标化/折叠）。
- 验收：筛选覆盖 类型/年代/富集/探测/豆瓣/备注/人工；与 q 搜索 + 预设三者联动且布局不溢出。

**MODUX-P3-3 类似 tab 合并优先 + 阈值过滤（item 8）**
- `TabSimilar.tsx`：相关度阈值过滤（identityScore/similarityScore < 阈值不显示/折叠）；"发起合并"为主操作（`buildMergeHref` 已有）。必要时后端 `listSimilar` 加排序/阈值参数。
- 验收：仅显示高相关候选；合并入口突出。

**MODUX-P3-4 审核主界面快速编辑（item 9）**
- **唯一写路径 = `PATCH /admin/moderation/:id/meta`**（`moderation.ts:243`，保留 pending-only 守卫）——**不**走 videos PATCH，避免 4 字段拆两套写路径。
- 后端：`MetaEditSchema`(`moderation.ts:68`) 已有 title/year/type/genres，**补 `country`** + service/类型/测试同步（非新端点）。
- 前端：`PendingCenter.tsx:124-126` 加内联快编——类型/题材一键切换（`Segment`/Pill popover + `getVideoTypeOptions`/`getVideoGenreOptions`），年代内联步进/输入、地区内联输入；乐观更新 + 失败回滚 + 队列联动刷新。
- 跨后端 schema + 前端 UI → 按原子化拆 -A（/meta 补 country：schema/service/types/test）/-B（前端 4 字段内联 UI）。
- 验收：4 字段免开面板即改、单写路径；类型一键；保存后队列/详情同步。

---

## 关键复用资源（避免重复造轮子）

- `packages/admin-ui/src/shell/keyboard-shortcuts.tsx` — 共享键盘 hook（item 1）
- `packages/admin-ui/src/components/cell/pill.tsx` — 8 variant Pill（item 7）
- `packages/admin-ui/src/components/segment/segment.tsx` — 单击分段控件（item 9）
- `getVideoTypeOptions`/`getVideoGenreOptions`（`packages/admin-ui/src/enums/`）— 枚举源（item 9）
- `use-filter-presets.ts` + `FilterPresetPopover` + `SavePresetModal` — 预设（item 3/6 联动）
- `buildMergeHref`（`apps/server-next/src/lib/merge/entry.ts`）— 合并深链（item 8）
- `EnrichmentBadgeCluster`/`ExternalMetaPanel`/`VisChip` — 详情徽标（item 7）

## 模型/ADR 标记
- **强制 Opus 子代理**：P1-0（全后台标题规约决策）；P1-1-A 若扩 `PageHeader` 公开 Props（`packages/admin-ui/**/types.ts` 强制项）；P1-2 若改 `DecisionCardProps`。
- **ADR 核验**：P3-1 跑 `verify:adr-contracts`（加 query 参数后向兼容，非新端点）+ 同步 `docs/architecture.md`（若涉查询/枚举派生）。
- 全程**无新增 admin route**（P3-4 复用既有 `/meta`、P3-1 扩既有 query）→ `verify:endpoint-adr` 不触发。
- 其余卡默认主循环 sonnet。

## 验证方式（每卡完成）
- 必跑：`npm run typecheck` / `npm run lint` / `npm run test:changed`（commit 前）。
- 域 E2E：`npm run test:e2e:admin`（审核台改动后）。
- 手测关键路径：
  - item 2：未发布视频"前台预览"非 404（dev 双端口）。
  - item 7/11/12：审核台单视频内标题仅 1 处；详情三元组单行 3 pill；播放器上方无独占行。
  - item 9：4 字段内联改 → 保存 → 队列/详情同步。
  - item 3：筛选弹层（含年代/富集）→ 列表正确过滤 + 预设保存复用。
  - item 1：快捷键（含新键）+ help 浮层；输入聚焦不误触。

## 风险/注意
- 标题治理跨多页 → 先 P1-0 盘点定调再 -A/-B 迁移，逐页核对面包屑映射（`inferBreadcrumbs`）防误删非冗余标题；**复用现有 `PageHeader`，绝不新建第二套**。
- DecisionCard / PageHeader 属 admin-ui 共享层 → 改动谨慎，优先不破公开 Props，配套单测 + `dev/visual` 预览同步。
- P3-1 后端过滤需先定富集枚举语义 + 同步共享类型/预设兼容/`docs/architecture.md`/ADR 契约。
- P3-4 唯一写路径 `/meta`，不得引入第二写路径。
- 单工作台：**工作台当前空闲**（SRCHEALTH-P1-1-B 已 06-10 13:50 完成）→ 本 SEQ 复核通过、注册 `task-queue.md` 后可立即启动首卡 **P1-0**。


---

## 独立审核意见（2026-06-10）

**结论**：方案方向基本成立，但建议标为“需修订后再注册 SEQ”。主要问题是部分卡片没有充分复用现有共享层，个别功能的写路径 / 契约边界不清，直接注册后执行者容易拆错卡或写出并行实现。

### 必须修订的问题

1. **P1-1 不应新建 PageHead，仓库已有 PageHeader**
   - 当前方案计划新建 `packages/admin-ui/src/shell/page-head.tsx`，但现有共享组件已是 `packages/admin-ui/src/components/page-header/page-header.tsx`，并已从 `@resovo/admin-ui` 导出，被多个 admin 页消费。
   - 修订建议：改为“复用 / 扩展现有 `PageHeader` + 迁移未使用页面”，避免形成 `PageHead` / `PageHeader` 两套 API。

2. **P1-1 全后台标题治理范围仍过大**
   - “全后台标题治理”同时涉及已用 `PageHeader` 的页面、手写 `<header data-page-head>` 的页面、面包屑末项映射、a11y heading 层级。
   - 修订建议：先增加盘点步骤，列出 raw header 页面、已用 `PageHeader` 页面、需要保留独立标题的例外页；再按页面组拆卡，避免误删非冗余标题。

3. **P1-3 前台预览 404 的修复方向需要收口**
   - `getVideoDetailHref` 位于 `packages/types/src/url-helpers.ts`，是跨 app 纯函数，不应承载 web-next 当前 locale 策略。
   - 修订建议：新增 admin preview 专用 URL builder，放在 `apps/server-next` 或 web route wrapper 层；同时将“locale 缺失”和“跨端 cookie / preview token 失效”分开复现，不要用一个补丁同时猜两个根因。

4. **P3-1 后端过滤还需同步共享契约和预设格式**
   - 除 `PendingQueueQuerySchema` / DB query 外，还要扩 `packages/types/src/admin-moderation.types.ts` 的 `PendingQueueQuery`，并明确筛选预设 JSON 快照是否保存新字段、旧预设如何兼容。
   - “富集状态”需要先定义枚举语义，例如 `missing` / `partial` / `complete`，并说明从哪些 raw 字段派生，不能只按 UI 的 `enrichmentSummary` 反推。

5. **P3-4 快速编辑写路径不明确，尤其是 country**
   - 用户决策要求类型、题材、年代、地区都做；但审核台 `/admin/moderation/:id/meta` 当前 schema 只有 `title` / `year` / `type` / `genres`，没有 `country`。方案写“moderation meta 或 videos PATCH”会导致前端可能为 4 个字段拆两套写路径。
   - 修订建议：明确唯一写路径，优先扩审核台 `/admin/moderation/:id/meta`，保留 pending-only 守卫；同步 schema、类型、测试和乐观更新。

6. **P2-3 对 KeyboardShortcuts 的描述需校正**
   - 现有共享能力是无渲染组件 `KeyboardShortcuts`，不是 hook。
   - 修订建议：明确是在审核台局部挂载 bindings，还是扩 AdminShell 全局快捷键；避免和现有全局快捷键职责混在一起。

### 可保留的部分

- 阶段顺序基本合理：先去冗余 / 预览 / 反馈一致性，再做布局密度，最后做后端过滤和快速编辑。
- P1-2、P2-1、P2-2 的方向清晰。
- `npm run test:e2e:admin` 脚本存在，可以作为审核台域回归。

---

## 第二轮审核补充意见（2026-06-10，独立核验）

> 核验范围：抽查方案正文 file:line 声明（全部命中：`ModerationConsole.tsx:385` h1 / `decision-card.tsx:160` h3 + `:162-165` banner / `MetaEditSchema` 无 country / `getVideoDetailHref` 无 locale / SEQ-20260610-03 未占用）；上节"独立审核意见"6 条经独立验证**全部成立**。以下为既有审核未覆盖的新增问题。

### 1.（必须修订）时序前提已过期

- 方案 Context 写"当前 tasks.md 有进行中任务 SRCHEALTH-P1-1-B，待其完成后逐卡启动"。实际 task-queue.md 显示该卡已于 **2026-06-10 13:50 完成**，且 SRCHEALTH SEQ 可执行范围已全收口（15/17），剩余 P3-2 被"影子验证一周"硬前置阻塞至约 06-17、P3-4 依赖其后。
- **工作台当前实际空闲**，MODUX SEQ 注册后可立即启动首卡。Context 注记与"风险/注意"末条均需更新，避免执行者去等一个已完成的卡。

### 2.（建议补充）DecisionCard 真实位置与连带影响

- P1-2 未写全路径：`decision-card.tsx` 实际在 `packages/admin-ui/src/components/cell/`（共享 cell 层），且有独立 `decision-card.types.ts` —— 一旦改公开 Props 即命中 CLAUDE.md 的 Opus trailer 强制项（方案已正确预判）。
- 消费方核查：业务消费仅 `PendingCenter.tsx` 一处，外加 `dev/visual` 的 component-registry + mock-data。风险可控，但 P1-2 改内部布局后需同步核对 dev/visual 预览页渲染正常，建议写入该卡验收项。

### 3.（次要）现状表第 3 项遗漏 `q` 参数

- `PendingQueueQuerySchema` 除 5 个过滤维度外还有 CHG-350 的 `q` 标题模糊搜索（`moderation.ts:35-36`）。不影响结论，但 P3-2 筛选弹层需与既有搜索框、预设按钮在窄列表 toolbar 协调布局，建议在 P3-2 卡里点名。

### 4.（P1-1 拆卡具体数据）

- 全仓 `<h1` 残留共 10 个 admin 文件，其中 **5 个为 dev 页**（`dev/design-tokens`、`dev/components-demo`、`dev/visual` ×2、`dev/fallback-preview`），应直接列为豁免。
- 实际需治理约 5 页（Settings / Analytics / Dashboard / VideoList / Moderation）+ 已用 `PageHeader` 的约 10 页规约核对。
- 佐证上节意见 2 的"先盘点再拆卡"，且 -A/-B 边界可现在定死：**-A** = PageHeader 扩展 + 审核台/视频库迁移；**-B** = 其余 3 页迁移 + 已消费页核对；dev 页豁免。

### 处理建议

按上节 6 条 + 本节第 1、2 条修订后再注册 task-queue.md。核心三处改动：P1-1 改"复用/扩展 PageHeader"、P1-3 改用 admin 专用 preview URL builder、时序注记更新为"可立即启动"。

---

## 修订说明 v2（2026-06-10，逐条对照两轮审核）

> 本节记录方案正文针对两轮审核的落实位置；审核原文（上两节）保留不动。

### 第一轮 6 条

| # | 审核意见 | 落实 |
|---|---------|------|
| 1 | 不应新建 PageHead，已有 PageHeader | 已核验 `PageHeader` 存在/导出/20+ 页消费；P1-1 改为 **P1-1-A 复用/扩展 PageHeader**，删除"新建 page-head.tsx"；风险节加"绝不新建第二套" |
| 2 | 标题治理范围过大 | 新增前置卡 **P1-0 盘点 + 规约定调**（列 PageHeader 页/raw `<h1>` 页/dev 豁免/例外页），再 -A/-B 拆 |
| 3 | 404 修复方向需收口 | P1-3 改：**两根因分开复现**（locale / 鉴权降级）+ 不污染纯函数 `url-helpers`，**新增 admin preview 专用 URL builder** 置 server-next/wrapper 层 |
| 4 | 后端过滤需同步共享契约 + 预设格式 + 富集枚举语义 | P3-1 改：补 `admin-moderation.types.ts:472 PendingQueueQuery`、**先定富集枚举语义(missing/partial/complete)+raw 派生**、预设 JSON 快照向后兼容 |
| 5 | 快速编辑写路径不明确（country） | 已核验 `/meta` schema 无 country；P3-4 改：**唯一写路径 = `/admin/moderation/:id/meta`**（扩 country，保留 pending-only），不走 videos PATCH |
| 6 | KeyboardShortcuts 是组件非 hook | P2-3 改：明确**无渲染组件**，审核台局部挂载 bindings，不混 AdminShell 全局 |

### 第二轮 2 条（必须/建议）

| # | 审核意见 | 落实 |
|---|---------|------|
| 1 | 时序前提过期（P1-1-B 已完成、工作台空闲） | 已核验 task-queue 1871 行 P1-1-B ✅13:50；Context 注记 + 风险节均改为"可立即启动首卡 P1-0" |
| 2 | DecisionCard 路径/连带影响 | P1-2 补全 `components/cell/` 路径 + `decision-card.types.ts`；消费方核查（PendingCenter + dev/visual registry/mock）；验收加"dev/visual 预览渲染正常" |
| 3（次要） | 现状表遗漏 `q` 参数 | 现状表 item 3 已补 `q`(CHG-350)；P3-2 加"与 q 搜索/预设在窄 toolbar 协调布局" |
| 4（数据） | P1-1 拆卡数据（10 个 h1，5 dev 豁免） | 已实测确认（5 非 dev：Settings/Analytics/Dashboard/VideoList/Moderation）；写入 P1-0/-A/-B 边界 |

### 修订后卡片清单（共 12 卡）
P1-0（盘点·Opus）→ P1-1-A / P1-1-B → P1-2 → P1-3 → P1-4 → P2-1 / P2-2 / P2-3 → P3-1（-A/-B）/ P3-2 / P3-3 / P3-4（-A/-B）。

> 状态：**v2 已吸收全部审核意见，待二次复核通过后注册 `task-queue.md`**。

---

## 第三轮复核（2026-06-10 22:04，注册前终审）

**结论：✅ 通过，注册 SEQ-20260610-03。**

核验记录：
1. **工作流前提全部成立**：task-queue.md 无活跃 🚨 BLOCKER；tasks.md 工作台空闲（SRCHEALTH 15/17 收口，剩余 P3-2/P3-4 时序阻塞至 ~06-17，与本 SEQ 无文件冲突）；SEQ-20260610-03 与 MODUX 前缀均未占用。
2. **v2 修订真实落地**：逐条比对「修订说明 v2」8 项与正文，全部落实（P1-0 前置卡 / PageHeader 复用 / preview URL builder 收口 / 富集枚举语义前置 / `/meta` 唯一写路径 / KeyboardShortcuts 组件语义 / 时序注记 / q 参数补录）。
3. **file:line 抽查全部命中**：`decision-card.tsx:160` h3 + `:162-165` banner / `moderation.ts:26-35` query schema（含 q）+ `:68` MetaEditSchema 无 country + `:243` PATCH /meta / `url-helpers.ts:23-26` 无 locale / `admin-moderation.types.ts:472` PendingQueueQuery / PageHeader 已导出 / `keyboard-shortcuts.tsx` 无渲染组件（return null）/ h1 盘点 10 文件（5 dev + 5 非 dev）与方案一致 / `PendingCenter.tsx:80/:120/:124-126`、`ModerationConsole.tsx:385/:386-390` 命中。
4. **勘误 2 处（不阻塞，注册时已修正）**：
   - 方案正文 `ModerationConsole.tsx` / `PendingCenter.tsx` / `PendingPaneController.tsx` / `ModListRow.tsx` / `TabDetail.tsx` / `TabSimilar.tsx` 等审核台文件实际位于 `apps/server-next/src/app/admin/moderation/_client/` 子目录（方案路径缺 `_client/` 段，行号全部准确）。任务卡文件范围已写全路径。
   - 「修订后卡片清单（共 12 卡）」计数有误：P1×6 + P2×3 + P3×6（P3-1/P3-4 各拆 -A/-B）= **15 卡**。注册按 15 卡落账。

---

## 附录 A — MODUX-P1-0 产物：全后台标题治理盘点表 + 规约（2026-06-10，arch-reviewer claude-opus-4-8 裁决）

> 本附录为 **MODUX-P1-1-A / P1-1-B 的执行真源**。规约条文 T-1~T-12 为 Opus 子代理裁决原文，主循环按其实施。

### A.1 盘点表

**① 已用 PageHeader 的页面级消费方（14 处，全部默认 headingLevel=1，title=页面名 string）**：
audit/AuditClient · crawler/CrawlerClient · crawler/runs/[id]/CrawlerRunDetailView（hidden 路由，无面包屑）· external-resources/ExternalResourcesClient · home/HomeOpsClient · image-health/ImageHealthClient · merge/MergeClient · messages/MessageCenterClient · source-line-aliases/SourceLineAliasesClient · sources/SourcesClient · staging/StagingPageClient（error 态 + 正常态 2 处）· submissions/SubmissionsListClient · subtitles/SubtitlesListClient · user-submissions/UserSubmissionsClient · users/UsersListClient。
（grep 误命中纯注释 4 处：AutoCrawlSummaryCard / CrawlerAdvancedMenu / RunInlinePanel / VideoFilterFields——非消费方。）

**② raw `<h1>` 非 dev 页（5 处，待迁移）+ 冗余判定（Opus 实测纠正）**：

| 文件 | h1 文案 | 面包屑末项 | 冗余？ |
|---|---|---|---|
| `videos/_client/VideoListClient.tsx:323` | 视频库 | 视频库 | **是** |
| `settings/_client/SettingsContainer.tsx:157` | 站点设置 | 站点设置 | **是** |
| `moderation/_client/ModerationConsole.tsx:385` | {M.title} | 内容审核 | 按文案判定 |
| `_client/DashboardClient.tsx:226` | 早上好，Yan — 今天有 N 待处理 | 管理台站 | 否（动态问候） |
| `_client/AnalyticsView.tsx:334` | 数据看板 | 管理台站 | 否 |

**关键结构事实**：AnalyticsView **不是独立路由页**——它是 `DashboardClient` 在 `activeTab==='analytics'` 时渲染的子内容（`DashboardClient.tsx:266`），与 overview tab 的问候 h1 在 `/admin` 同路由内互斥渲染。

**③ dev 豁免（5 页）**：dev/design-tokens · dev/components-demo · dev/fallback-preview · dev/visual ×2。

**④ 例外页**：hidden 路由详情页（crawler/runs/[id]，无面包屑 → 页内标题必须保留）；Dashboard 问候（标题 ≠ nav label，信息非冗余）。

### A.2 规约条文（T-1 ~ T-12，Opus 裁决原文）

- **T-1**　每个 admin nav 内页面（非 hidden、非 dev）的页内主标题统一由 `packages/admin-ui` 的 `PageHeader` 承载，`title` 传 string、`headingLevel` 用默认值 1，禁止页内再出现 raw `<h1>`。
- **T-2**　**面包屑零改动**：`packages/admin-ui/src/shell/breadcrumbs.tsx` 与注入点 `admin-shell-client.tsx:85` 在本治理中不修改（末项保持 `<strong>` 文本视觉，不降级、不升级为 heading）。面包屑是导航语义、PageHeader 是文档结构 heading，二者职责分离、并存。
- **T-3**　**冗余消解方式 = 保留标题而非删除**：当页内标题文案与面包屑末项 nav label 字面相同时（videos/settings），保留 PageHeader（subtitle/actions 布局锚点 + 唯一 h1），文案保持页面名——「面包屑分组路径 + 页内大标题」是 14 已消费页既定双层信息架构，**不视作需消除的冗余**。本治理不做面包屑末项与 h1 的去重删除。
- **T-4**　**每页有且仅有一个 `headingLevel=1`**：迁移后 5 页的 PageHeader 均 headingLevel=1；页内子区块标题（如 `PendingCenter.tsx:120` 的视频标题 h2）保持不变，形成 h1（页头）→ h2（卡片/列表项）层级，禁止跳级。
- **T-5**　**字号归一**：迁移时丢弃页面自带的 `font-size-xl` 标题样式（ModerationConsole:385），统一走 PageHeader 内置 `font-size-lg`/700/`--fg-default`。例外：PendingCenter:120 的 h2 属列表项标题非页头，保持原样。
- **T-6**　**ModerationConsole 今日统计 + 键盘提示行归入 PageHeader `subtitle` 槽**（ReactNode 形态），不新增 Props、不进 actions 槽（actions 留给右侧 preset 按钮组）。统计行内联样式已全部使用 CSS 变量，迁移时原样保留，禁止改成硬编码色值。
- **T-7**　**Dashboard 个性化问候判据**：当页内标题文案 ≠ 面包屑末项 nav label（动态问候/运营语）时不构成冗余，保留为 PageHeader `title`（ReactNode）。注意 ReactNode title 渲染为 `<div>` 非 heading（`page-header.tsx:111`），h1 处理见 T-8。
- **T-8**　**ReactNode title 页的 h1 兜底**：对必须用 ReactNode title 的页（Dashboard 问候、AnalyticsView），迁移后须保证该路由仍有唯一 h1。两种合规做法择一（P1-1-B 内裁定）：(i) 拆成 string 主标题 + ReactNode subtitle；(ii) ReactNode title 内部自带 `<h1>`。**禁止**出现「整页无 h1」。
- **T-9**　**同路由互斥 h1 唯一性**：`/admin` 路由 overview/analytics 两 tab 互斥渲染，任一 tab 激活时页面 h1 数量必须恰为 1。
- **T-10**　**hidden 路由例外**：无面包屑的 hidden 路由详情页（crawler/runs/[id] 先例）页内 PageHeader 是唯一标题，必须保留 headingLevel=1，不受 T-3 冗余讨论约束。
- **T-11**　**dev 页豁免登记**：5 个 dev 页不纳入治理，P1-1-B 备注登记豁免，不强制 PageHeader。
- **T-12**　**例外判据清单（机械套用）**：满足任一即「保留页内标题、不视作冗余、不删除」——① 标题文案 ≠ 面包屑末项 nav label；② hidden 路由（面包屑为空）；③ 标题为 ReactNode（承载交互/统计）。其余「string 标题 == nav label」一律走 T-3。

### A.3 关键裁决摘要（Q1–Q5）

- **Q1**：保留 PageHeader 为页面唯一标题真源 + **面包屑零改动**（否决「删页内标题、面包屑升级 h1」——`<nav>` 内 `<strong>` 文本充当 h1 违反 heading 语义；否决「末项降级」——破坏 14 页一致性且 shell 层改动半径大收益为零）。
- **Q2**：headingLevel 全默认 1；ReactNode-title 页走 T-8 兜底；PendingCenter h2 与页头 h1 构成正确层级不动。
- **Q3**：Dashboard 问候 = 例外①+③ 保留；hidden 路由 = 例外② 保留；Moderation 统计+键盘行 = **subtitle 槽**（T-6）。
- **Q4**：**不扩展 PageHeaderProps**——现有 title(ReactNode)/subtitle(ReactNode)/actions 三槽全覆盖 5 页需求。**P1-1-A 不触及 `packages/admin-ui/**/types.ts` 公开字段，不触发 CLAUDE.md 强制 Opus + commit trailer 项。** 若执行中发现槽不够 → 停下写 BLOCKER 重新起 Opus 评审，不得擅自扩。
- **Q5**：拆卡边界修正——**-A 删除「PageHeader 扩展」项**（Q4 判定不扩，零 admin-ui 改动）：-A = ModerationConsole（T-5/T-6）+ VideoListClient（T-3）；-B = Settings + Analytics + Dashboard 迁移（T-7/T-8/T-9，h1 兜底为实现难点）+ 14 已消费页一致性核对 + dev 5 页豁免登记。

### A.4 风险登记

- **R-1（P1-1-B 承接，中）**：Dashboard/AnalyticsView 直接传 ReactNode title 会丢 h1（渲染为 div）→ `/admin` 整页无 h1 a11y 回归；必须按 T-8 落实兜底 + 手测两 tab 各恰 1 个 h1。
- **R-2（P1-1-A 承接，中）**：ModerationConsole 统计行用 `dangerouslySetInnerHTML` 拼接含 CSS 变量的 `<strong style>`（:387）；迁移进 subtitle 槽时**原样搬运**，不得「顺手清理」引入硬编码颜色或扩大 XSS 面。
- **R-3（P1-0 已消解）**：原方案前提「页内标题均冗余于面包屑」不成立（仅 videos/settings 真冗余）；T-3/T-12 已将冗余消解定义为「保留标题、不删除」，规避误删 Dashboard 问候导致 h1 缺失。
