# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-29
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

**任务 ID**：CHG-DESIGN-02
**标题**：DataTable frame 扩展（toolbar 内置搜索 / saved views / 表头集成菜单 / row flash / 列固定 sticky / framed surface）
**状态**：🔄 进行中
**开始时间**：2026-04-29
**执行模型**：claude-opus-4-7
**子代理调用**：`arch-reviewer / claude-opus-4-7 (agentId: a7b85e22e65b58653)` — CONDITIONAL PASS，5 必修 + 5 应修 + 7 步实装顺序；评审结论已收录入本任务卡执行计划，主循环按其条款落地

**所属序列**：SEQ-20260429-02（设计稿对齐改造，第 2 卡 / 共 10 卡）
**关联文档**：`docs/designs/backend_design_v2.1/reference.md` §4.4 + §5.3 + §6.0 / 设计稿真源 `app/datatable.jsx` `styles/components.css §489-654`

**目标**：

把 `packages/admin-ui` 的 `DataTable` 从"纯网格 + 排序 + 选择 + 分页"扩展到"完整 framed table 系统"，与设计稿 `.dt` 框架对齐。视频库与后续所有列表页（用户/审计/字幕/暂存）共用同一基座。

**功能增量（与 reference.md §4.4 一致）**：

1. Framed surface：外层 `bg2 + border + radius r-3 + overflow hidden + height:100% + min-height:0`
2. 内置 280px search slot（`dt__toolbar` 之内）
3. Saved views（personal/team scope）+ 「保存当前为 personal/team 视图」入口
4. 表头集成菜单（点击表头 cell 弹出 popover：升降序 / 过滤 / 固定到左 / 隐藏此列）
5. Row flash 动画（`flashIds` prop 控制行短暂高亮，1.5s ease-out，乐观更新场景）
6. `pinnedSticky` 列固定（左侧 sticky 列，使用 `position: sticky` + `z-index`）
7. `bulkSlot` 表内 sticky bottom（替代当前外置浮条 SelectionActionBar）
8. 表脚 sticky `dt__foot`：左侧 "共 N 条 · 当前 a-b"，右侧 select + 紧凑分页器（24px 高页码）

**架构约束（reference.md §0-7）**：

- **不引入** `TableFrame` 新抽象层，扩展现有 `DataTable` props
- 阈值：DataTable props > ~20 个时退回 frame 路线
- 现有 props（`rows / columns / rowKey / mode / query / onQueryChange / totalRows / loading / error / emptyState / selection / onSelectionChange / onRowClick / density`）保持向后兼容；新 props 全部 optional，默认 off
- Sidebar 自包含教训：所有 layout-critical 行为走 inline / 组件本地，不依赖外部 CSS 注入

**文件范围（暂定）**：

- `packages/admin-ui/src/components/data-table/data-table.tsx`（主文件扩展）
- `packages/admin-ui/src/components/data-table/types.ts`（新增 props 类型 + TableView / FlashIds 等）
- `packages/admin-ui/src/components/data-table/header-menu.tsx`（新建：表头集成菜单 popover）
- `packages/admin-ui/src/components/data-table/views-menu.tsx`（新建：saved views 切换 + 保存）
- `packages/admin-ui/src/components/data-table/dt-styles.tsx`（新建：dt 框架专用 CSS 注入，参照 admin-shell-styles 模式但 DataTable 自包含）
- `packages/admin-ui/src/components/data-table/index.ts`（导出新增）
- `packages/admin-ui/src/components/data-table/table-query-store.ts`（视图持久化扩展）
- `tests/unit/components/admin-ui/data-table/`（覆盖新功能的单测）

**子代理协议（必须执行）**：

按 task-queue 序列约束 + CLAUDE.md "强制升 Opus 子代理"#1（定义新的共享组件 API 契约），**先 spawn `arch-reviewer (claude-opus-4-7)` 审 API 契约草案，PASS 后再实装**。

子代理输入：本任务卡 + reference.md §4.4 + 设计稿 datatable.jsx + 现有 data-table.tsx 全文。
子代理输出：API 契约决策（props 命名 / 类型 / 默认值 / 向后兼容策略 / saved views 持久化 schema）。

**验收要点**：

- 视频库（VideoListClient）+ 用户管理 + 审计日志 至少 1 处接入新 props，视觉对齐设计稿
- DataTable props 总数 ≤ 20（保留扩展余量）
- typecheck / lint / test 全绿
- 新增单测覆盖：表头菜单交互 / saved views CRUD / row flash / pinned sticky / bulk slot
- arch-reviewer PASS（必填：commit hash 写入 commit trailer）

**备注**：无

---
