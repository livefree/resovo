# UI 现状盘点清单（2026-03-27）

> status: archived
> owner: @engineering
> scope: current frontend/admin/system ui inventory for governance and design-system migration
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 目的

本清单用于在前后台 UI 统一治理启动前，完整盘点当前仓库中的：

1. 页面入口
2. 共享基础组件
3. 页面模式
4. 并行实现
5. 硬编码视觉值热点
6. 状态反馈分裂点
7. 迁移优先级

本文件是后续 design system、模式层抽象、lint 规则和样板页迁移的底稿。

---

## 2. 总览

### 2.1 代码规模摘要

当前扫描结果：

1. `src/app` 下 `page.tsx` / `layout.tsx` 页面入口共 38 个。
2. `src/components` 下 UI 相关组件文件共 160 个。
3. UI 结构已经出现明确分层雏形，但还未形成统一系统：
   - 前台内容浏览组件
   - 后台 shared 组件
   - 后台业务组件
   - 播放器独立子系统
   - 系统控制台专用组件

### 2.2 当前最重要结论

1. 后台在“表格、分页、下拉、批量栏、页面壳”上已有半套 shared system。
2. 前台在“导航、搜索筛选、浏览筛选、卡片、详情、播放器”上仍以页面/模块局部实现为主。
3. 播放器是视觉和交互最独立的子系统，存在大量硬编码样式与独立组件。
4. 系统页尤其是 crawler-site 已形成高度复杂的专用组件群，和后台通用 shared 层有交叉但尚未完全收口。
5. 状态反馈、状态色、弹层、确认机制、错误展示、toast 呈现仍未统一。

---

## 3. 页面入口盘点

## 3.1 全部页面入口

### 根布局

1. `src/app/layout.tsx`
2. `src/app/page.tsx`
3. `src/app/[locale]/layout.tsx`

### 前台内容页

1. `src/app/[locale]/(home)/page.tsx`
2. `src/app/[locale]/browse/page.tsx`
3. `src/app/[locale]/search/page.tsx`
4. `src/app/[locale]/watch/[slug]/page.tsx`
5. `src/app/[locale]/movie/[slug]/page.tsx`
6. `src/app/[locale]/series/[slug]/page.tsx`
7. `src/app/[locale]/anime/[slug]/page.tsx`
8. `src/app/[locale]/variety/[slug]/page.tsx`
9. `src/app/[locale]/others/[slug]/page.tsx`

### 认证页

1. `src/app/[locale]/auth/login/page.tsx`
2. `src/app/[locale]/auth/register/page.tsx`

### 静态信息页

1. `src/app/[locale]/about/page.tsx`
2. `src/app/[locale]/help/page.tsx`
3. `src/app/[locale]/privacy/page.tsx`
4. `src/app/[locale]/dmca/page.tsx`

### 后台主页面

1. `src/app/[locale]/admin/layout.tsx`
2. `src/app/[locale]/admin/page.tsx`
3. `src/app/[locale]/admin/403/page.tsx`
4. `src/app/[locale]/admin/analytics/page.tsx`
5. `src/app/[locale]/admin/content/page.tsx`
6. `src/app/[locale]/admin/crawler/page.tsx`
7. `src/app/[locale]/admin/moderation/page.tsx`
8. `src/app/[locale]/admin/sources/page.tsx`
9. `src/app/[locale]/admin/submissions/page.tsx`
10. `src/app/[locale]/admin/subtitles/page.tsx`
11. `src/app/[locale]/admin/users/page.tsx`
12. `src/app/[locale]/admin/videos/page.tsx`
13. `src/app/[locale]/admin/videos/new/page.tsx`
14. `src/app/[locale]/admin/videos/[id]/edit/page.tsx`

### 后台系统页

1. `src/app/[locale]/admin/system/cache/page.tsx`
2. `src/app/[locale]/admin/system/config/page.tsx`
3. `src/app/[locale]/admin/system/migration/page.tsx`
4. `src/app/[locale]/admin/system/monitor/page.tsx`
5. `src/app/[locale]/admin/system/settings/page.tsx`
6. `src/app/[locale]/admin/system/sites/page.tsx`

## 3.2 页面模式现状

### 已有明确模式

1. 后台主页面大量使用 `AdminPageShell`。
2. 前台首页/浏览/搜索已形成“导航 + 内容区 + 筛选/排序 + 卡片网格”模式。
3. 详情页已形成“Hero + Meta + Episode/Source/Related”模式。
4. 播放页已形成“播放器 + 右侧面板 + 恢复播放/弹幕/换源”模式。

### 尚未完成模式抽象

1. 前台搜索页和浏览页筛选体验相近，但分别由 `FilterBar` 和 `FilterArea` 独立实现。
2. 后台系统页虽然共享 `AdminPageShell`，但内容区仍高度分裂。
3. 设置页、表单页、详情页尚无统一页面模式组件层。

---

## 4. 组件结构盘点

## 4.1 当前组件域

### 前台通用域

1. `src/components/layout/*`
2. `src/components/video/*`
3. `src/components/browse/*`
4. `src/components/search/*`
5. `src/components/auth/*`
6. `src/components/ui/*`

### 播放器域

1. `src/components/player/*`
2. `src/components/player/core/*`

### 后台 shared 域

1. `src/components/admin/shared/layout/*`
2. `src/components/admin/shared/toolbar/*`
3. `src/components/admin/shared/form/*`
4. `src/components/admin/shared/feedback/*`
5. `src/components/admin/shared/dropdown/*`
6. `src/components/admin/shared/dialog/*`
7. `src/components/admin/shared/modal/*`
8. `src/components/admin/shared/batch/*`
9. `src/components/admin/shared/modern-table/*`
10. `src/components/admin/shared/table/*`

### 后台业务域

1. `src/components/admin/videos/*`
2. `src/components/admin/users/*`
3. `src/components/admin/content/*`
4. `src/components/admin/sources/*`
5. `src/components/admin/moderation/*`
6. `src/components/admin/dashboard/*`
7. `src/components/admin/system/*`

## 4.2 当前已存在的“共享基础设施”

### 后台页面壳

1. `src/components/admin/shared/layout/AdminPageShell.tsx`

现状：

1. 已形成“标题 + 可选说明 tooltip + actions + body”壳层。
2. 后台多个 page 入口已接入。
3. 仍只服务后台，尚未上升为跨前后台页面模式能力。

### 后台工具栏

1. `src/components/admin/shared/toolbar/AdminToolbar.tsx`

现状：

1. 已形成 actions + feedback 的最小组合。
2. 结构过轻，仅覆盖后台工具栏。
3. 尚未统一为筛选栏/工具栏模式层。

### 后台弹层

1. `src/components/admin/Modal.tsx`
2. `src/components/admin/shared/modal/AdminModal.tsx`
3. `src/components/admin/shared/dialog/AdminDialogShell.tsx`
4. `src/components/admin/ConfirmDialog.tsx`
5. `src/components/admin/content/ReviewModal.tsx`

现状：

1. 已有基础 Modal。
2. `AdminModal` 只是 wrapper。
3. `ConfirmDialog` 和 `ReviewModal` 基于 Modal 再封装。
4. 同时还存在 `AdminDialogShell`，说明弹层基础层尚未统一。

### 后台表格栈

1. `ModernDataTable`
2. `ColumnSettingsPanel`
3. `useAdminTableState`
4. `useAdminTableColumns`
5. `useAdminTableSort`
6. `useAdminColumnFilter`
7. `PaginationV2`
8. `AdminDropdown`
9. `SelectionActionBar`
10. Cell 组件库

现状：

1. 这是当前仓库最接近“真正 design system 子系统”的一块。
2. 但旧 `AdminTableFrame`、旧 `Pagination` 仍未清理完。
3. 表格体系只在后台成熟，未与前台共享底层视觉和交互规则。

### 后台表单栈

1. `AdminInput`
2. `AdminSelect`
3. `AdminFormField`
4. `AdminFormActions`
5. `AdminButton`

现状：

1. 已有 shared form 雏形。
2. 业务表单仍有不少直接手写 input/button/validation 实现。
3. 还没有形成“设置页模式”“表单分区模式”。

### 反馈栈

1. `useAdminToast`
2. `AdminTableState`
3. `AdminHoverHint`
4. `StatusBadge`

现状：

1. 已有 shared toast hook 与部分状态组件。
2. 但 toast 视觉、错误区块、成功提示、空态说明仍有大量局部实现。

---

## 5. 前台页面模式盘点

## 5.1 导航与基础布局

### 组件

1. `src/components/layout/Nav.tsx`
2. `src/components/layout/Header.tsx`
3. `src/components/layout/Footer.tsx`
4. `src/components/layout/FooterInfoPage.tsx`

### 现状

1. 导航栏是前台最重要的全局骨架，但 dropdown、搜索、语言切换、用户菜单都在 `Nav.tsx` 内局部实现。
2. `Nav.tsx` 手写了 click-away、ESC、焦点切换逻辑，没有复用统一 overlay primitive。
3. Footer 与信息页 Footer 有分化，但问题不大。

### 结论

导航是前台 overlay / trigger / active-state 规则的关键治理入口。

## 5.2 搜索与浏览

### 组件

1. `src/components/search/FilterBar.tsx`
2. `src/components/search/ActiveFilterStrip.tsx`
3. `src/components/search/SearchResultList.tsx`
4. `src/components/search/ResultCard.tsx`
5. `src/components/search/MetaChip.tsx`
6. `src/components/browse/FilterArea.tsx`
7. `src/components/browse/SortBar.tsx`
8. `src/components/browse/BrowseGrid.tsx`

### 现状

1. 搜索页和浏览页存在明显相似的筛选/排序/结果结构。
2. `FilterBar` 与 `FilterArea` 分别手写筛选按钮、输入框、激活态、边框、间距和交互。
3. 搜索页与浏览页尚未共用统一的 FilterToolbar pattern。
4. `BrowseGrid` 复用 `VideoCard`，但搜索结果卡片使用另一套 `ResultCard` 视觉结构。

### 结论

这是前台页面模式最先应该抽象的区域之一。

## 5.3 内容展示

### 组件

1. `HeroBanner`
2. `VideoGrid`
3. `VideoCard`
4. `VideoCardWide`
5. `VideoDetailHero`
6. `VideoDetailMeta`
7. `VideoMeta`
8. `EpisodeGrid`

### 现状

1. 已有明确的内容浏览视觉语言。
2. `VideoCard` / `VideoCardWide` 已具备共用潜力。
3. Hero、Meta、Detail 各自直接控制视觉，不是从同一基础展示层拼出。

### 结论

内容卡片与详情页可保留前台独特气质，但底层 badge、button、overlay、meta chip、section header 应逐步系统化。

## 5.4 认证

### 组件

1. `LoginForm`
2. `RegisterForm`

### 现状

1. 认证页有相似的字段、错误展示、按钮和容器结构。
2. 但错误态、边框高亮、提交按钮阴影仍为局部手写。
3. 尚未复用统一表单字段模式。

### 结论

认证页适合作为前台表单模式样板页。

## 5.5 播放器

### 组件

1. `PlayerShell`
2. `VideoPlayer`
3. `SourceBar`
4. `ResumePrompt`
5. `DanmakuBar`
6. `player/core/*`

### 现状

1. 播放器是独立子系统，有自己的按钮、tooltip、spinner、CSS tokens、状态与交互。
2. `Player.module.css` 中存在大量硬编码颜色、透明度、阴影、outline。
3. 这是当前最不适合直接强行并入普通前后台 shared 栈的部分。

### 结论

播放器需要“共享基础原则 + 独立皮肤层”的治理策略，不能简单按后台 shared 模式硬改。

### 本轮治理边界

根据当前项目约束：

1. 播放器模块暂不纳入本轮 UI 统一治理实施范围。
2. 原因：该模块来自另一个独立开发项目，当前优先保持其边界稳定。
3. 本轮仅记录其接口边界与视觉隔离现状，不推动对 `src/components/player/**` 的统一改造。

---

## 6. 后台页面模式盘点

## 6.1 已初步统一的后台页面壳

接入 `AdminPageShell` 的页面包括：

1. `admin/page`
2. `admin/analytics`
3. `admin/content`
4. `admin/moderation`
5. `admin/sources`
6. `admin/users`
7. `admin/videos`
8. `admin/system/migration`

说明：

1. 后台 page-level header 已经有统一雏形。
2. 但 `crawler`、部分 system 页面仍较为特殊。

## 6.2 后台列表页

### 主要列表页

1. `VideoTable`
2. `UserTable`
3. `SubmissionTable`（content）
4. `SubtitleTable`
5. `InactiveSourceTable`
6. `sources/SubmissionTable`
7. `CrawlerSiteTable`

### 现状

1. 多数已经接入 `ModernDataTable + PaginationV2`。
2. 行操作大多已接入 `AdminDropdown`。
3. 列设置和状态持久化已有 shared hook。
4. 这是当前全站最成熟的可复用模式。

### 遗留

1. `AdminTableFrame` 仍存在于 `AdminCrawlerPanel`、`CacheManager`、`PerformanceMonitor`。
2. 旧 `Pagination` 仍存在。
3. 某些页面依然有手写状态色、错误条、空态文案。

## 6.3 后台表单与详情页

### 主要组件

1. `AdminVideoForm`
2. `VideoDetailDrawer`
3. `ModerationDetail`
4. `SiteSettings`
5. `ConfigFileEditor`
6. `CrawlerSiteFormDialog`

### 现状

1. 都具备“分区 + 字段 + 操作区”的共同形态。
2. 但尚未抽象为统一 `FormSection` / `DetailSection`。
3. 错误态、成功反馈、按钮区布局存在明显分裂。

## 6.4 系统页与控制台页

### 主要组件

1. `AdminCrawlerPanel`
2. `CrawlerSiteManager`
3. `CacheManager`
4. `PerformanceMonitor`
5. `DataMigration`
6. `ConfigFileEditor`
7. `SiteSettings`

### 现状

1. 系统页业务复杂度高，保留了更多专用组件。
2. `crawler-site` 已形成二级子系统，组件数量多，模式丰富。
3. 但也因此最容易出现 shared 层之外的局部 UI 规则扩散。

---

## 7. 并行实现盘点

## 7.1 表格容器并行

并行实现：

1. `ModernDataTable`
2. `AdminTableFrame`
3. 局部手写 `<table>`

当前证据：

1. `AdminCrawlerPanel` 仍使用 `AdminTableFrame`
2. `PerformanceMonitor` 仍使用 `AdminTableFrame`
3. `CacheManager` 仍使用 `AdminTableFrame`

结论：

后台表格尚未完全完成唯一栈收口。

## 7.2 分页并行

并行实现：

1. `PaginationV2`
2. `Pagination`

结论：

旧分页未彻底退出。

## 7.3 弹层并行

并行实现：

1. `Modal`
2. `AdminModal`
3. `AdminDialogShell`
4. `ConfirmDialog`
5. `ReviewModal`
6. `VideoDetailDrawer`
7. `CrawlerSiteFormDialog`

结论：

已有基础弹层能力，但未形成真正的统一 overlay system。

## 7.4 状态标签并行

并行实现：

1. `StatusBadge`
2. `TableBadgeCell`
3. `AdminCrawlerPanel` 内部局部 `StatusBadge`
4. 多个页面自己写 `text-red-* / text-green-* / bg-amber-*`

结论：

状态色与状态标签是当前最明显的分裂点之一。

## 7.5 toast / 成功失败反馈并行

并行实现：

1. `useAdminToast`
2. 页面局部 `showToast`
3. 页面局部 `setError`
4. 页面直接渲染红字错误条
5. `alert(...)`

证据：

1. `AdminCrawlerPanel` 仍有 `alert(...)`
2. `ConfigFileEditor`、`SiteSettings`、`CrawlerSiteManager` 使用不同 toast 呈现
3. 多个页面仍直接写 `text-red-400` 错误文案

结论：

反馈系统尚未统一。

## 7.6 筛选栏并行

并行实现：

1. `FilterBar`
2. `FilterArea`
3. `VideoFilters`
4. `AdminToolbar`
5. `CrawlerSiteTopToolbar`
6. `CrawlerSiteAdvancedFilters`
7. `ColumnMenu`
8. `ColumnFilterPanel`
9. `AdminColumnFilterContainer`

结论：

1. FilterToolbar / DataToolbar 模式尚未收口。
2. 表格列筛选下拉与页面外部下拉当前不是同一套外观与行为。
3. `ColumnMenu + ColumnFilterPanel` 属于局部自定义菜单，而 `AdminDropdown` 是另一套菜单实现。
4. 后续治理必须统一的是“外观风格 + 打开关闭行为 + 可交互控件风格”，不要求所有场景共用完全相同的 API。

---

## 8. 硬编码视觉值热点

## 8.1 全局 theme 变量现状

`src/app/globals.css` 已有较完整的颜色变量：

1. `--background`
2. `--bg`
3. `--bg2`
4. `--bg3`
5. `--foreground`
6. `--text`
7. `--muted`
8. `--muted-foreground`
9. `--card`
10. `--secondary`
11. `--accent`
12. `--gold`
13. `--primary`
14. `--border`
15. `--input`
16. `--subtle`

结论：

1. 已有 theme 变量基础。
2. 但变量层级混合了基础值与语义值。
3. 还未形成正式的 token 分层。

## 8.2 重点硬编码热点

### 播放器

主要文件：

1. `src/components/player/core/Player.module.css`
2. `src/components/player/PlayerShell.tsx`
3. `src/components/player/DanmakuBar.tsx`

问题：

1. 大量 `#000`、`#fff`、`rgba(...)`、独立 tooltip / progress / overlay 颜色。
2. 弹幕颜色选择器直接使用十六进制。
3. 播放器内部形成独立视觉 token，尚未与全站映射。

### 认证与前台内容页

主要文件：

1. `src/app/[locale]/auth/login/page.tsx`
2. `src/app/[locale]/auth/register/page.tsx`
3. `src/components/auth/LoginForm.tsx`
4. `src/components/auth/RegisterForm.tsx`
5. `src/components/video/HeroBanner.tsx`
6. `src/components/video/VideoDetailHero.tsx`
7. `src/components/search/FilterBar.tsx`

问题：

1. 使用 `via-[#0a0a0a]`、`rgba(232,184,75,...)`、`text-black`、`shadow-[...]` 等局部视觉值。
2. 前台品牌高光和 hover glow 尚未进入共享 token。

### 后台状态色

主要文件：

1. `src/components/admin/StatusBadge.tsx`
2. `src/components/admin/AdminCrawlerPanel.tsx`
3. `src/components/admin/dashboard/QueueAlerts.tsx`
4. `src/components/admin/sources/SourceHealthAlert.tsx`
5. `src/components/admin/shared/batch/SelectionActionBar.tsx`
6. `src/components/admin/system/*`

问题：

1. 大量 `text-red-* / text-green-* / bg-amber-* / border-red-*` 直接散落在页面和业务组件。
2. 状态色没有统一语义出口。

---

## 9. 状态与反馈现状

## 9.1 错误反馈

当前形态并存：

1. 页面内红字
2. 区块顶部红色提示条
3. 字段级错误
4. toast
5. `alert(...)`

### 代表位置

1. `ModerationDetail`
2. `AdminVideoForm`
3. `ConfigFileEditor`
4. `DataMigration`
5. `AdminCrawlerPanel`
6. `LoginForm`
7. `RegisterForm`
8. `Player.tsx`

## 9.2 成功反馈

当前形态并存：

1. `useAdminToast`
2. 局部 `toast` 状态文字
3. 成功条
4. 静默成功后仅刷新数据

## 9.3 空态

当前形态：

1. 表格通过 `AdminTableState` 有局部统一
2. 前台列表、搜索结果、详情页空态仍多为局部实现

## 9.4 状态命名

当前已出现的状态词包括：

1. `active`
2. `inactive`
3. `pending`
4. `published`
5. `draft`
6. `running`
7. `paused`
8. `done`
9. `failed`
10. `cancelled`
11. `timeout`
12. `success`
13. `partial_failed`
14. `queued`

结论：

1. 业务状态词丰富，但缺少统一语义字典。
2. 同类状态未必通过同一 Badge 或反馈组件表达。

---

## 10. 国际化现状

### 已较好执行的区域

1. 全局 layout
2. 导航
3. 首页
4. 浏览页
5. 认证部分

### 仍有直接文案的区域

1. `FilterBar` 的类型与排序选项仍为硬编码中文
2. 大量后台组件直接写中文文案
3. 播放器与系统组件中存在中英文混杂

结论：

国际化在前台比后台执行得更稳定，后台与系统页仍需治理。

---

## 11. 当前最优先治理风险

## P0

1. 反馈机制分裂：toast、红字、提示条、alert 并存。
2. 状态色分裂：状态标签与状态色散落在页面和组件中。
3. 表格体系未彻底收口：`AdminTableFrame` 和旧 `Pagination` 仍在使用。
4. 前台筛选模式分裂：`FilterBar` 与 `FilterArea` 并行。
5. 下拉与筛选菜单分裂：`AdminDropdown`、`ColumnMenu`、导航菜单、页面筛选按钮组不是同一套行为和视觉风格。

## P1

1. 弹层体系并行：Modal / Dialog / Drawer / 专用表单弹层未统一。
2. 表单模式未统一：认证、后台设置、后台编辑器各自实现。
3. 页面模式层缺失：列表页、详情页、设置页尚未组件化。

## P2

1. 播放器独立视觉 token 尚未纳入治理映射。
2. 前台品牌 glow、gradient、shadow 尚未转成共享语义。
3. 国际化规则在后台和系统页执行不一致。

---

## 12. 建议的迁移顺序

## 12.1 样板迁移页建议

为了覆盖不同页面类型，建议优先选：

1. 后台列表页样板：`/admin/videos` 或 `/admin/users`
2. 后台设置页样板：`/admin/system/settings` 或 `/admin/system/config`
3. 前台列表页样板：`/browse` 或 `/search`
4. 前台详情页样板：`/movie/[slug]` 或 `VideoDetail*`

## 12.2 基础能力治理顺序

1. 先治理状态反馈与状态色
2. 再治理弹层与确认机制
3. 再收口筛选栏 / 工具栏模式
4. 再推进页面模式层
5. 最后处理播放器映射与特殊皮肤策略

---

## 13. 本轮应立即跟进的任务

1. 基于本清单补一份“重复能力合并任务表”。
2. 为状态色、toast、error/empty 反馈建立第一批共享规则。
3. 标记 `AdminTableFrame`、旧 `Pagination`、`alert(...)` 为待清理对象。
4. 抽象前台 `FilterToolbar` 目标，合并 `FilterBar` 与 `FilterArea` 的重复交互。
5. 抽象统一菜单/筛选浮层目标，覆盖 `AdminDropdown`、列筛选菜单、导航菜单与后续页面级下拉。
6. 为播放器建立“共享底层规则 + 独立皮肤层”的单独治理子计划，但不纳入本轮实施。
