# 后台表格体验修复与统一实施计划（2026-03-26）

## 1. 背景与目标

本计划针对后台重设计后暴露的 10 个使用体验问题，目标是：

1. 统一后台表格基线组件与交互行为（列设置、下拉菜单、排序、分页、批量操作）。
2. 修复视频管理关键功能缺陷（来源筛选失效、类型筛选不全、批量栏遮挡）。
3. 清理旧实现残留，降低后续迭代分叉风险。

不在本计划中直接改代码；本文用于指导下一步实施。

---

## 2. 问题分组（按性质）

### A. 架构一致性问题

- 列设置入口和交互在不同页面实现不一致。
- 多套表格体系并存（`ModernDataTable` / `AdminTableFrame` / 旧 `DataTable` 与旧列表组件）。
- 下拉菜单关闭行为不一致，未统一 click-away。

### B. 功能正确性问题

- 视频管理“来源”筛选链路不正确（前端传 site key，后端按 `video_sources.source_name` 过滤）。
- 视频类型筛选未覆盖当前后端类型枚举。
- 排序仅在当前页前端数组生效，未作用于全量数据。

### C. 布局与可用性问题

- 批量操作栏在视频页与采集页位置、形态不一致。
- 视频页批量栏全屏 fixed，遮挡侧栏。
- 单元格内菜单被 `overflow` 裁切。
- 分页能力不足（缺少 page size、页码、跳页）。

---

## 3. 实施顺序（低风险 -> 高收益 -> 结构收敛）

## 阶段 0：冻结与基线确认（0.5 天）

1. 锁定“唯一表格基础组件”目标：`ModernDataTable`。
2. 定义统一行为规范：
   - 列设置入口位置（表头最后列内，统一图标/按钮样式）。
   - 下拉菜单 click-away + ESC 关闭。
   - 批量操作栏位置（内容区内 sticky bottom，不跨侧栏）。
3. 记录当前仍在线与残留组件清单，作为清理基线。

交付物：组件收敛决议 + 页面映射表。

## 阶段 1：先修“功能正确性”阻断项（1-1.5 天）

1. 修复视频“来源”筛选链路：
   - 后端从站点维度过滤（推荐基于 `videos.site_id -> crawler_sites.key`）。
   - 前端保持传 `site`（site key），但与后端语义对齐。
2. 视频类型筛选全量对齐后端枚举（同源常量生成）。
3. 排序改为服务端排序：
   - API 支持 `sortField/sortDir` 白名单。
   - 前端不再对当前页本地排序。

交付物：视频管理列表“筛选 + 排序”行为正确，跨页一致。

## 阶段 2：统一下拉与列设置（1.5-2 天）

1. 抽象统一下拉组件（建议 `AdminDropdown`）：
   - click-away、ESC、焦点恢复、层级 z-index。
   - portal 渲染避免裁切。
2. 抽象统一列设置面板（建议 `ColumnSettingsPanel`）：
   - 每列支持：显示、排序、过滤能力状态展示。
   - 不支持项禁用灰化。
   - 支持“重置默认”。
3. 页面接入优先级：
   - `VideoTable`
   - `CrawlerSiteTable`
   - `UserTable`
   - `content/SubmissionTable`、`content/SubtitleTable`

交付物：所有后台表格列设置/下拉行为一致。

## 阶段 3：统一批量操作栏与分页（1-1.5 天）

1. 抽象 `SelectionActionBar`：
   - 页面内 sticky，不遮挡侧栏。
   - 同一布局规范（信息区 + 主操作组 + 次操作组）。
2. 替换视频页与采集页两套批量条逻辑差异。
3. 升级分页为 `PaginationV2`：
   - `pageSize`：20 / 50 / 100。
   - 页码窗口（含省略号）。
   - 跳页输入。
   - 小屏/大屏自适应布局。

交付物：批量与分页交互统一，可用性提升。

## 阶段 4：残留清理与收口（0.5-1 天）

1. 删除未使用旧组件（确认无引用后）：
   - `DataTable.tsx`
   - `AdminVideoList.tsx`
   - `AdminUserList.tsx`
   - `AdminSubtitleList.tsx`
   - `AdminSubmissionList.tsx`
   - 采集站点旧 lite/header/toolbar 备份实现（若未引用）
2. 清理 `src/components/admin/index.ts` 的旧导出。
3. 更新文档：后台表格规范、组件使用准则。

交付物：代码树无并行旧实现残留。

---

## 4. 影响文件清单（实施时重点）

### 4.1 立即改造（核心）

- `/Users/livefree/projects/resovo/src/components/admin/videos/VideoTable.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/videos/VideoFilters.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/videos/BatchPublishBar.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/system/crawler-site/hooks/useCrawlerSiteTableColumns.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/shared/modern-table/ModernDataTable.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/shared/modern-table/ModernTableBody.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/Pagination.tsx`

### 4.2 后端配套（视频列表排序/筛选）

- `/Users/livefree/projects/resovo/src/api/routes/admin/videos.ts`
- `/Users/livefree/projects/resovo/src/api/services/VideoService.ts`
- `/Users/livefree/projects/resovo/src/api/db/queries/videos.ts`

### 4.3 组件新增（建议）

- `/Users/livefree/projects/resovo/src/components/admin/shared/dropdown/AdminDropdown.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/shared/table/ColumnSettingsPanel.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/shared/batch/SelectionActionBar.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/PaginationV2.tsx`

### 4.4 清理候选（确认无引用后删除）

- `/Users/livefree/projects/resovo/src/components/admin/DataTable.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/AdminVideoList.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/AdminUserList.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/AdminSubtitleList.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/AdminSubmissionList.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx`
- `/Users/livefree/projects/resovo/src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx`

---

## 5. 统一设计规范（实施准则）

1. 表格基座统一 `ModernDataTable`，禁止新增并行表格容器。
2. 列设置入口统一位于表头最后可见列内。
3. 所有下拉必须使用统一组件，默认支持 click-away 与 ESC。
4. 菜单弹层必须使用 portal 或等效浮层定位，禁止被单元格裁切。
5. 批量操作栏统一为“内容区内 sticky”，不覆盖侧边栏。
6. 排序、分页、筛选均由服务端返回，前端仅负责参数与状态展示。

---

## 6. 回归测试清单

## 6.1 功能回归

1. 视频管理：类型筛选 11 类全部可筛。
2. 视频管理：来源筛选可命中对应站点数据。
3. 视频管理：排序跨页生效，翻页后顺序连续正确。
4. 采集站点：勾选后批量操作按钮状态正确。
5. 用户/内容审核/视频页：列设置显示/隐藏即时生效并持久化。

## 6.2 交互一致性回归

1. 所有下拉点空白区域都会关闭。
2. 所有下拉按 `Esc` 关闭。
3. 表格内“操作”菜单不被裁切。
4. 列设置在各页面位置一致、样式一致、行为一致。

## 6.3 布局回归

1. 视频批量栏不覆盖左侧导航。
2. 1366/1024/768 宽度下分页与批量栏不换行错位。
3. 分页在 total 很大时页码窗口正确折叠。

## 6.4 API 回归

1. `/admin/videos` 新增排序参数后仍兼容旧调用。
2. 非法 `sortField` 被白名单拒绝或降级默认排序。
3. 排序 + 筛选 + 分页组合查询结果稳定。

---

## 7. 验收标准

1. 10 个问题全部闭环，且无新增并行实现。
2. 后台所有表格页面采用同一“列设置 + 下拉 + 批量 + 分页”交互模型。
3. 移除未使用旧组件后，`rg` 检查无残留引用。
4. 关键路径通过：视频管理、采集站点、用户管理、内容审核。

---

## 8. 风险与注意事项

1. “来源筛选”修复可能涉及数据库字段语义调整，需先确定权威来源字段。
2. 排序下沉到后端会改变默认结果顺序，需在 PR 描述中明确行为变更。
3. 清理旧组件前必须做全局引用扫描并跑页面冒烟测试。

