# Resovo（流光）前后台 UI 统一治理总方案（2026-03-27）

> status: archived
> owner: @engineering
> scope: shared frontend/admin ui foundations, component system, page patterns, and governance workflow
> source_of_truth: no
> supersedes: docs/admin_ui_unification_plan.md, docs/admin_reusable_table_capability_inventory_20260327.md
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 背景

当前项目已经出现三类失控信号：

1. 同类页面使用多套视觉和交互实现，导致前台、后台、系统页之间缺少共同语言。
2. 组件复用停留在局部控件层，页面骨架、反馈方式、状态命名、加载与错误表达仍在散落实现。
3. AI 与人工开发都能绕过既有组件边界，直接在页面里拼样式、写硬编码、复制局部模式，导致失控扩散。

已有文档已覆盖：

1. 后台页面结构统一方向：`docs/ui_unification_plan_admin.md`
2. 后台表格能力清点：`docs/admin_reusable_table_capability_inventory_20260327.md`
3. 前台视觉改版方向：`docs/ui_implementation_plan_20260327.md`

但目前缺少一份上位方案，能够同时定义：

1. 前台与后台共用的 UI 基线
2. 组件系统边界
3. 页面模式层
4. 工程约束与 AI 开发约束
5. 渐进迁移与治理机制

本方案用于建立前后台共用的 UI 基线，统一的是系统，不是页面长得完全一样。

---

## 2. 总目标

### 2.1 必须统一

以下内容前台与后台必须共用同一套规则或同一套实现：

1. Design tokens
2. 语义颜色体系
3. 字号层级与排版比例
4. 间距体系
5. 圆角、阴影、边框、层级
6. 基础交互规则
7. 基础组件实现
8. 状态命名
9. 禁用、加载、错误、成功、空态反馈方式
10. 可访问性与键盘交互规则
11. 页面模式骨架组件
12. 对外唯一组件出口与 AI 使用约束

### 2.2 可以不同

以下内容允许前台与后台分化，但必须建立在同一套系统之上：

1. 信息密度
2. 页面模板
3. 内容优先级
4. 操作入口数量
5. 后台专用复杂组件
6. 面向消费内容的视觉氛围
7. 面向运营治理的高密度操作布局

### 2.3 结果定义

最终目标不是“所有页面长得一样”，而是：

1. 同源视觉语言
2. 同源交互逻辑
3. 同源状态表达
4. 不同业务场景下的受控变体

---

## 3. 核心原则

### 3.1 System First

先定义系统，再定义页面。任何页面不能反向发明基础样式。

### 3.2 Tokens First

所有视觉基础必须由 tokens 驱动，页面不得直接定义颜色、字号、边距、圆角、阴影常量。

### 3.3 Primitive First

页面只能组合基础组件、模式组件、业务组件，不能跳过中间层直接手写大量原生 DOM 样式。

### 3.4 One Behavior, One Pattern

同一种交互行为只允许一种默认规则。例如：

1. dropdown 的打开关闭规则只有一套
2. loading 按钮的视觉和不可点击行为只有一套
3. destructive action 的确认方式只有一套

### 3.5 Shared Core, Scoped Exceptions

允许前台、后台有不同密度和布局，但差异必须通过受控 variant 表达，不允许复制实现后各自演化。

### 3.6 AI Must Stay Inside the System

AI 不允许绕过统一出口直接散落实现。规则必须可被 lint、目录边界和评审清单共同约束。

---

## 4. 目标架构

建议建立四层 UI 系统：

```text
Layer 0: design-tokens
  ├─ 颜色、字号、间距、圆角、阴影、z-index、动效、断点

Layer 1: ui-primitives
  ├─ Button / Input / Select / Checkbox / Dialog / Tabs / Badge / Table / Tooltip / Toast
  ├─ 只负责基础视觉与基础交互

Layer 2: ui-patterns
  ├─ ListPageShell / FilterToolbar / DetailSection / SettingsFormSection / EmptyState / ErrorState
  ├─ 负责页面级组合模式

Layer 3: domain-components
  ├─ 前台业务组件：VideoCard / EpisodePicker / SourceSwitcher
  ├─ 后台业务组件：AdminDataTable / AdminFilterBar / BatchActionBar / ModerationPanel
  ├─ 只能基于 Layer 1 + Layer 2 构建

Layer 4: pages
  ├─ src/app/**
  ├─ 只负责装配业务数据与路由，不定义新的基础视觉规则
```

### 4.1 目录治理建议

建议逐步收敛到以下结构：

```text
src/
├─ design-system/
│  ├─ tokens/
│  │  ├─ css/
│  │  ├─ semantic/
│  │  └─ motion/
│  ├─ primitives/
│  ├─ patterns/
│  ├─ icons/
│  ├─ docs/
│  └─ index.ts
├─ components/
│  ├─ admin/
│  ├─ frontend/
│  └─ shared/
└─ lib/ui/
   ├─ cn.ts
   ├─ theme/
   └─ feedback/
```

### 4.2 唯一出口约束

必须建立唯一公开出口：

1. 基础组件统一从 `@/design-system/primitives`
2. 页面模式统一从 `@/design-system/patterns`
3. 业务层只能 import 这些出口，不允许跨层 import 内部私有样式文件
4. 页面文件禁止直接 import 未封装的第三方 UI primitive，必须经过本地封装层

---

## 5. Design Tokens 规范

## 5.1 Token 分层

必须拆成三层：

1. Global tokens：原始设计尺度，如 `gray-50`、`space-4`、`radius-md`
2. Semantic tokens：语义映射，如 `surface-default`、`text-primary`、`status-danger-bg`
3. Component tokens：组件级映射，如 `button-primary-bg`、`card-border`、`input-focus-ring`

禁止页面直接消费 component token 以下的私有变量。

## 5.2 颜色体系

颜色必须分为以下语义组：

1. `bg.canvas`
2. `bg.surface`
3. `bg.surface-elevated`
4. `bg.surface-overlay`
5. `text.primary`
6. `text.secondary`
7. `text.tertiary`
8. `text.inverse`
9. `border.default`
10. `border.strong`
11. `border.focus`
12. `accent.primary`
13. `accent.primary-hover`
14. `accent.primary-active`
15. `status.success`
16. `status.warning`
17. `status.danger`
18. `status.info`
19. `status.*.bg`
20. `status.*.fg`
21. `status.*.border`

### 5.2.1 语义优先级

状态颜色必须按语义使用，禁止把“红色”当成“强调色”使用：

1. `accent` 只用于品牌强调与主行动作
2. `success` 只用于成功、正常、可用
3. `warning` 只用于风险提醒、待确认
4. `danger` 只用于破坏性操作、失败、不可逆风险
5. `info` 只用于解释、提示、状态说明

### 5.2.2 前后台差异方式

前台与后台不能重新定义颜色语义，只能调整使用密度：

1. 前台可更多使用 `bg.surface-elevated`、氛围层叠、品牌 accent
2. 后台可更多使用 `border.default`、低饱和 surface、状态色点缀

## 5.3 字号与排版体系

建议统一排版层级：

1. `text.xs`
2. `text.sm`
3. `text.md`
4. `text.lg`
5. `text.xl`
6. `text.2xl`
7. `text.3xl`
8. `text.display`

同时定义：

1. 行高 token
2. 字重 token
3. 字间距 token
4. 标题与正文的最大行长规则

### 5.3.1 排版使用原则

1. 页面标题只能使用固定级别集合，禁止任意放大
2. 表格、筛选、表单标签使用统一正文层级
3. 辅助说明统一使用次级文本层级
4. Badge、Meta、Timestamp 使用同一最小文本体系

## 5.4 间距体系

统一使用 4px 基准倍数：

1. `space.1 = 4`
2. `space.2 = 8`
3. `space.3 = 12`
4. `space.4 = 16`
5. `space.5 = 20`
6. `space.6 = 24`
7. `space.8 = 32`
8. `space.10 = 40`
9. `space.12 = 48`
10. `space.16 = 64`

页面不得自行出现 13、18、22、26 等离散值，特殊值需要进入 token 层后才能复用。

## 5.5 圆角与阴影

圆角建议统一：

1. `radius.sm`
2. `radius.md`
3. `radius.lg`
4. `radius.xl`
5. `radius.full`

阴影建议统一：

1. `shadow.xs`
2. `shadow.sm`
3. `shadow.md`
4. `shadow.lg`
5. `shadow.overlay`

后台不应大量自定义阴影，而应更多使用边框、轻阴影、层级对比。

## 5.6 动效与响应时间

统一动效 token：

1. `motion.duration.fast`
2. `motion.duration.normal`
3. `motion.duration.slow`
4. `motion.ease.standard`
5. `motion.ease.emphasized`

统一要求：

1. dropdown、dialog、tooltip、toast、hover card 使用同一时长尺度
2. loading skeleton 脉冲速度统一
3. 页面切换和数据刷新避免各自定义独立节奏

---

## 6. 基础交互规则

## 6.1 状态命名统一

组件与页面状态统一使用以下命名：

1. `idle`
2. `loading`
3. `success`
4. `error`
5. `empty`
6. `disabled`
7. `readonly`
8. `submitting`
9. `pending`
10. `selected`
11. `active`
12. `inactive`

禁止在不同模块混用：

1. `busy` / `loading`
2. `failed` / `error`
3. `enabled` / `active`
4. `hidden` / `invisible` / `collapsed`

如果确需区分，必须建立明确语义：

1. `disabled` = 用户不可操作
2. `readonly` = 可见不可改
3. `loading` = 首屏或区域加载
4. `submitting` = 提交动作进行中
5. `pending` = 后端异步状态未结束

## 6.2 交互反馈规范

### Hover

1. 所有 hover 反馈必须受同一时长和同一色阶控制
2. 非点击元素不得假装按钮 hover

### Focus

1. 所有可交互元素必须有可见 focus ring
2. focus ring 颜色统一使用 `border.focus`
3. 前后台不可分别发明不同焦点样式

### Active / Pressed

1. 按钮按下态必须有统一深度变化
2. Toggle、Tabs、SegmentedControl 的选中态必须语义一致

### Disabled

1. disabled 组件必须同时满足视觉降级和交互不可达
2. 不允许只降低 opacity 但依然可点击

### Loading

1. Button loading：保留按钮尺寸，不跳动，不替换为任意文案
2. 区域 loading：优先 skeleton，不用整块 spinner 覆盖列表
3. 页面 loading：优先页面骨架，不用白屏等待

### Error

1. 表单字段错误贴近字段显示
2. 区域数据错误显示在区域内
3. 全局错误用 toast 或页面级 error state，不允许静默失败

### Success

1. 成功反馈不应长期驻留
2. destructive action 成功后可结合 toast + 列表回写

### Empty

1. empty state 必须区分“无数据”“无搜索结果”“无权限”“功能未启用”
2. 禁止所有空态都写成同一句“暂无数据”

## 6.3 破坏性操作规则

统一分三级：

1. 一级风险：直接执行，例如取消筛选
2. 二级风险：轻提示确认，例如下架、停用
3. 三级风险：强确认，例如删除、批量删除、恢复不可逆操作

确认方式统一：

1. 单条低频破坏操作使用 confirm dialog
2. 高频批量治理操作使用 sticky action bar + confirm dialog
3. 不允许有的页面 `window.confirm`，有的页面自绘弹层

## 6.4 时间、状态、反馈文案统一

1. 时间默认显示相对时间，悬停显示绝对时间
2. Badge 的状态词必须统一字典
3. Toast 文案遵循“动作 + 对象 + 结果”，避免模糊句式

---

## 7. 基础组件层规范

## 7.1 必须建立的基础组件清单

### Inputs

1. `Button`
2. `IconButton`
3. `TextInput`
4. `Textarea`
5. `Select`
6. `Combobox`
7. `Checkbox`
8. `RadioGroup`
9. `Switch`
10. `SegmentedControl`
11. `DateRangePicker`
12. `SearchInput`

### Feedback

1. `Badge`
2. `InlineMessage`
3. `Toast`
4. `EmptyState`
5. `ErrorState`
6. `Skeleton`
7. `Progress`
8. `Spinner`

### Overlay

1. `Dialog`
2. `Drawer`
3. `Popover`
4. `Tooltip`
5. `DropdownMenu`
6. `CommandPalette`

### Navigation

1. `Tabs`
2. `Breadcrumb`
3. `Pagination`
4. `SidebarNav`
5. `TopNav`

### Data Display

1. `Card`
2. `StatCard`
3. `KeyValueList`
4. `Table`
5. `List`
6. `Avatar`
7. `Image`
8. `Tag`

## 7.2 组件 API 规范

所有基础组件必须满足：

1. 有明确 variant 集合
2. 有明确 size 集合
3. 有统一 disabled / loading / invalid / readonly prop
4. 有一致的 `className` 覆盖策略
5. 有测试 id 规范，仅在必要处暴露
6. 有键盘交互和 aria 语义

不允许：

1. 某个页面独占一个“看起来像 Button 但不是 Button”的实现
2. 某个业务组件自己处理 dropdown 的 click-away、ESC、portal，而不复用统一实现

## 7.3 现有组件映射

建议保留并升级以下已有后台能力，迁移进统一系统：

1. `ModernDataTable` → 统一 `Table` / `DataTable` 能力层
2. `AdminDropdown` → 统一 `DropdownMenu`
3. `SelectionActionBar` → 统一 `BatchActionBar` pattern
4. `PaginationV2` → 统一 `Pagination`
5. `ColumnSettingsPanel` → `TableColumnSettings`

原有命名可在后台领域层保留 wrapper，但底层实现必须共用。

---

## 8. 页面模式层规范

页面一致性不能只停留在单个控件，必须把页面级模式组件化。

## 8.1 必须提供的页面模式组件

1. `ListPageShell`
2. `FilterToolbar`
3. `DataToolbar`
4. `DetailPageShell`
5. `DetailSection`
6. `SettingsPageShell`
7. `FormSection`
8. `DashboardShell`
9. `MetricGrid`
10. `SplitPanelLayout`
11. `ActionPanel`
12. `StatusPanel`

## 8.2 标准列表页模式

统一结构：

1. PageHeader
2. Summary or Status strip（可选）
3. FilterToolbar
4. DataToolbar
5. DataTable
6. Pagination
7. BatchActionBar（按需）

必须由模式组件装配，禁止每个页面自己拼一遍。

## 8.3 详情页模式

统一结构：

1. PageHeader
2. Hero summary or key meta
3. DetailSection 列表
4. Related data section
5. Action rail or side panel（可选）

## 8.4 设置页模式

统一结构：

1. PageHeader
2. Settings group intro
3. FormSection
4. Sticky action footer（按需）
5. Inline validation and save feedback

## 8.5 仪表盘模式

统一结构：

1. PageHeader
2. MetricGrid
3. Alerts / Trends
4. Detail table or activity list

---

## 9. 前台与后台的差异化约束

## 9.1 前台允许的方向

1. 更强的品牌氛围和视觉层次
2. 更低的信息密度
3. 更强调沉浸式浏览
4. 更突出的媒体内容与封面表达

但仍必须共用：

1. 颜色语义
2. Button/Input/Dialog/Tabs 等基础实现
3. loading、error、empty、disabled 规则
4. 页面模式层的基础骨架能力

## 9.2 后台允许的方向

1. 更高的信息密度
2. 更多筛选和批量操作入口
3. 更强的状态可视化
4. 更复杂的治理组件和运维组件

但仍必须共用：

1. tokens
2. 基础组件实现
3. 状态命名
4. 表单与反馈规则
5. dropdown/dialog/toast/table/pagination 的交互基础

## 9.3 后台专用复杂组件

允许保留后台专用组件，例如：

1. `AdminDataTable`
2. `BatchActionBar`
3. `ColumnSettingsPanel`
4. `ModerationReviewPanel`
5. `SchedulerStatusPanel`

但这些组件必须建立在统一 primitives 和 patterns 上，而不是自成体系。

---

## 10. AI 与人工开发约束

## 10.1 强制规则

1. 页面文件禁止硬编码颜色、字号、圆角、阴影、间距
2. 页面文件禁止直接书写长段 `className` 以定义新的基础控件
3. 页面文件禁止直接 import 第三方 primitive 并自建变体
4. 页面文件只能使用统一封装出口
5. 页面骨架必须使用页面模式组件
6. 状态反馈必须使用统一 `EmptyState/ErrorState/Skeleton/Toast/InlineMessage`

## 10.2 允许例外的条件

仅当满足以下条件时才允许新增例外：

1. 现有组件库无法表达业务需求
2. 已在文档中补充新增模式
3. 新增能力被提升到 primitives 或 patterns，而不是停留在单页

## 10.3 对 AI 的工程化约束手段

必须配套建立以下约束：

1. ESLint 规则：禁止硬编码颜色和离散 spacing
2. ESLint 规则：限制 import 边界，禁止页面直接引第三方基础组件
3. AST 检查：禁止页面出现超过阈值的原子类硬编码
4. Storybook 或文档站：给 AI 与人工提供标准组件目录
5. PR 模板：要求说明是否复用 primitives/patterns
6. Review checklist：检查是否绕过组件出口

## 10.4 建议新增的仓库规则

建议将以下规则补入 `docs/rules/ui-rules.md` 后续版本：

1. 只有 `design-system` 可定义基础视觉规则
2. `src/app/**/page.tsx` 只能装配模式与业务组件
3. 同类反馈组件命名必须一致
4. 每新增一个业务模式，必须评估能否提升为 pattern

---

## 11. 工程实施方案

## 11.1 Phase 0：盘点与冻结

目标：

1. 完成前台、后台、系统页全部组件与页面模式盘点
2. 冻结新增“临时风格组件”

动作：

1. 建立组件清单、页面模式清单、状态词清单
2. 全仓扫描硬编码颜色、圆角、间距、阴影
3. 全仓扫描重复交互实现：dropdown、dialog、toast、table、filter bar
4. 标记并行体系：旧表格、旧分页、旧表单反馈、旧弹层

产出：

1. UI debt inventory
2. component duplication inventory
3. state naming inventory

## 11.2 Phase 1：建立共享基线

目标：

1. 先把共用底座建立起来

动作：

1. 定义 tokens 文件结构与命名
2. 建立语义颜色映射
3. 建立 typography、spacing、radius、shadow、motion 规范
4. 建立 `primitives` 最小集
5. 建立基础反馈组件

验收：

1. 前台与后台都能从同一出口消费 Button/Input/Dialog/Tabs/Toast

## 11.3 Phase 2：模式层收口

目标：

1. 让一致性从控件扩展到页面骨架

动作：

1. 建立 `ListPageShell`
2. 建立 `FilterToolbar`
3. 建立 `DetailSection`
4. 建立 `SettingsFormSection`
5. 建立 `DashboardShell`

验收：

1. 新增页面不得直接拼页面壳
2. 至少 2 个前台页面、2 个后台页面接入模式层

## 11.4 Phase 3：后台先行迁移

后台更依赖高密度一致性，建议优先迁移：

1. 列表页
2. 审核页
3. 系统配置页
4. 控制台页

优先事项：

1. `AdminTableFrame` 等旧容器彻底退出
2. 统一到 `Table/DataTable + Pagination + DropdownMenu + BatchActionBar`
3. 筛选栏、批量栏、状态反馈、详情分区统一

## 11.5 Phase 4：前台接入共享底座

动作：

1. Header/Nav 接入统一 tokens 与 overlay primitives
2. Auth、Detail、Browse、Watch 接入统一页面模式
3. 前台卡片、标签、按钮、弹层、分页全部回收到底座

验收：

1. 前台可保留独特气质，但不再使用独立基础视觉规则

## 11.6 Phase 5：治理自动化

动作：

1. lint 规则上线
2. import boundary 检查上线
3. 视觉回归与交互回归基线建立
4. 组件文档与示例页完善

验收：

1. 新增页面无法轻易绕过系统
2. AI 生成代码默认被导向统一组件出口

---

## 12. 现阶段建议的优先落地包

建议将大改拆成 6 个治理包：

1. `UI-01 Tokens 基线`
2. `UI-02 Primitives 基础组件`
3. `UI-03 Feedback 与状态统一`
4. `UI-04 Page Patterns 页面模式`
5. `UI-05 Admin 列表/表单/反馈迁移`
6. `UI-06 Frontend 页面骨架与共享基础回收`

### UI-01 Tokens 基线

交付：

1. 全局 token 命名
2. 语义 token 映射
3. Tailwind / CSS variables 对齐层

### UI-02 Primitives 基础组件

交付：

1. Button
2. Input 家族
3. Dialog / Drawer / Tooltip / DropdownMenu
4. Tabs / Pagination / Badge / Card

### UI-03 Feedback 与状态统一

交付：

1. Toast
2. InlineMessage
3. EmptyState
4. ErrorState
5. Skeleton
6. 状态命名字典

### UI-04 Page Patterns 页面模式

交付：

1. ListPageShell
2. FilterToolbar
3. DetailSection
4. SettingsFormSection
5. DashboardShell

### UI-05 Admin 迁移

交付：

1. Admin 列表页统一模式
2. Admin 表单区与详情分区统一
3. Admin 反馈、批量操作、确认流程统一

### UI-06 Frontend 迁移

交付：

1. 前台导航、卡片、详情、播放、认证等页面接入统一基础
2. 保留前台独特视觉，但底层规则统一

---

## 13. DoD（完成定义）

一个页面或组件只有满足以下条件，才算完成迁移：

1. 所有颜色、间距、圆角、阴影均来自 tokens
2. 所有基础控件都来自统一 primitives
3. 页面结构来自统一 patterns
4. 状态命名符合统一词典
5. loading、error、empty、success 反馈方式符合统一规范
6. 不再依赖旧组件体系
7. 有单测或交互测试覆盖关键路径
8. 有视觉验收基线

---

## 14. 风险与边界

## 14.1 主要风险

1. 试图一次性大重写，导致业务中断
2. 只做视觉统一，不做交互与状态统一
3. 只做基础组件，不做页面模式，最终还是页面各自拼装
4. 规则只有文档，没有 lint、目录边界和评审机制支撑

## 14.2 控制策略

1. 渐进迁移，不追求一次性替换全站
2. 先底座，后模式，再迁移业务
3. 每个阶段都建立“禁新增旧模式”的门槛
4. 每迁移一个高频页面，就同步沉淀 pattern，而非仅修单页

---

## 15. 与现有文档关系

1. `docs/admin_ui_unification_plan.md` 继续作为后台页面结构参考，但其上位约束以本方案为准。
2. `docs/admin_reusable_table_capability_inventory_20260327.md` 继续作为“表格领域盘点”参考，但后续治理范围以上升到整个 UI 系统。
3. `docs/ui_implementation_plan_20260327.md` 仍可作为前台视觉改版输入，但必须落在本方案的 tokens、primitives、patterns 范围内执行。

---

## 16. 下一步建议

在本方案正式并入规则层之前，下一步必须按以下顺序执行：

1. 先完成 `docs/rules/ui-rules.md` 与本方案的冲突收口，明确唯一执行优先级。
2. 先补一份“现状盘点清单”，覆盖前台、后台、系统页全部基础组件与页面模式重复项。
3. 再更新 `ui-rules.md`，把已经具备执行条件的治理条目收进规则层。
4. 然后再创建 `design-system/tokens` 与 `design-system/primitives` 的目录骨架，不要先改页面。
5. 再选 1 个后台列表页、1 个后台设置页、1 个前台详情页作为三类样板迁移页。
6. 同步补 lint/import-boundary 规则，否则 AI 与人工都会继续绕开系统。

---

## 17. 执行回顾与方案修正（2026-03-28）

> 本章为 SEQ-20260328-42 完成后的阶段性修正记录，优先级高于第 11 章的原始 Phase 规划。

### 17.1 SEQ-20260328-42 实际交付（已完成）

SEQ-20260328-42（UI 治理：TableSettingsPanel + Admin 表格设置统一）完成了以下工作：

| 交付项 | 内容 |
|---|---|
| 新建共享机制 | `useTableSettings` hook + `TableSettingsPanel` + `TableSettingsTrigger`（portal 渲染）+ `ModernDataTable.settingsSlot` prop |
| 迁移表格 | UserTable、SubmissionTable(sources)、SubmissionTable(content)、VideoTable、InactiveSourceTable、CrawlerSiteTable、SubtitleTable、AdminAnalyticsDashboard（共 8 个） |
| 删除旧组件 | `ColumnSettingsPanel.tsx` |
| 架构决策 | ADR-CHG-308（列设置统一）、ADR-021（治理策略调整） |
| 数据迁移 | `migrateFromLegacy` 提供老 localStorage key 单次迁移路径 |

### 17.2 已知技术债（SEQ-20260328-42 遗留）

**债务 1：双重 hook 共存（结构性，不影响功能）**

除 CrawlerSiteTable 外，所有迁移表格仍同时运行三套 hook：

- `useAdminTableColumns`：列宽存储（`setColumnWidth`）+ 为 sort 提供 `columnsState`
- `useAdminTableSort`：排序状态管理，依赖上面的 `columnsState`
- `useTableSettings`：列可见性（新系统）

根因是 `useTableSettings` 尚未支持列宽持久化，`useAdminTableSort` 尚未从 `useAdminTableColumns` 解耦。两套系统并行写入不同 localStorage key，存在潜在的状态不一致风险（详见 ADR-021）。

**债务 2：AdminTableFrame 尚未退场（规范违反，3 处）**

```
src/components/admin/AdminCrawlerPanel.tsx        — 596行，手写表格+手写列设置+客户端排序
src/components/admin/system/monitoring/CacheManager.tsx     — 使用旧 hook 体系
src/components/admin/system/monitoring/PerformanceMonitor.tsx — 使用旧 hook 体系
```

这 3 个组件违反 CLAUDE.md 后台表格规范第 1 条（基座必须用 ModernDataTable）。

### 17.3 原方案修正：放弃 Phase 顺序，采用双轨并行

**修正依据**：Phase 1（tokens 基线）属于全局架构重建（涉及 globals.css + 全量 Tailwind 配置 + 所有组件样式），在项目业务快速迭代阶段风险过高，投入产出比低。Phase 3 的后台治理已经开始，不应等待 Phase 1 完成后再继续。

**调整后执行方式：**

```
轨道 A（近期，高优先级）            轨道 B（长期，低优先级）
AdminCrawlerPanel 迁移（CHG-309）    CSS 变量体系盘点与对齐（CHG-315）
CacheManager 迁移（CHG-310）        ESLint 禁硬编码颜色规则（CHG-316）
PerformanceMonitor 迁移（CHG-311）
useAdminTableSort 解耦（CHG-312）
useTableSettings 加列宽（CHG-313）
删除旧 hook（CHG-314）
```

轨道 A 完成后：`AdminTableFrame`、`useAdminTableColumns`、`useAdminTableSort` 全部退出生命周期。

### 17.4 暂不推进的方向

以下属于原方案 Phase 2/4/5 的内容，暂不安排：

- `ListPageShell`、`FilterToolbar` 等模式层组件（Phase 2）
- 前台页面接入共享底座（Phase 4）
- lint/import-boundary 治理自动化（Phase 5，除 CHG-316 的颜色规则外）

触发条件：轨道 A 完成 + 业务模块基本稳态后，再评估是否进入 Phase 2。

### 17.5 CHG-309 特别说明（AdminCrawlerPanel 迁移）

`AdminCrawlerPanel.tsx` 是当前后台最复杂的手写表格（596行），包含：
- 手写 `<thead>` / `<tbody>` / `<tr>` 结构
- 手写列可见性 checkbox 面板（内联于组件内）
- 客户端排序（任务数量少，不需要服务端排序）
- 触发类型筛选、站点筛选、状态筛选（多个 filter 逻辑内联）

**CHG-309 执行前必须先将其拆分为至少 2 个原子任务**，避免单次 commit 改动范围过大：
1. 表格基座替换（AdminTableFrame → ModernDataTable）+ 行操作整理
2. 列设置迁移（手写 checkbox panel → useTableSettings + settingsSlot）

拆分细节由执行任务时的"开发前四步"确认，此处不预先规定。
