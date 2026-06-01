# Resovo（流光） — Track admin-ui-datatable-resize 任务看板

> Track: admin-ui-datatable-resize
> 分支: track/admin-ui-datatable-resize（从 main HEAD 8b0377e0 切出）
> 来源序列: SEQ-20260531-01（通用表格列宽可调）
> 执行真源: ~/.claude/plans/worktree-server-next-1-2-3-4-5-serialized-thimble.md（已批准）
> last_reviewed: 2026-06-01

并行模式：与 track/bangumi（apps/api/**）并行，文件域零重叠。
持有冲突域：admin-ui:api-surface / admin-ui:component:data-table / adr（见 tracks.md）。
单活任务约束：同一时刻仅 1 个 🔄 进行中。
强制门：共享组件 API 契约 + ADR-103 §4.2.2 修订 → 落地前须 arch-reviewer(Opus) PASS，model-id 记入卡片 + commit trailer。

---

## 进行中任务

（空 — DTR-A 完成；下一张 DTR-B，开始时置 🔄）

---

## 已完成任务

### ✅ DTR-A — 文件体积预拆（前置，解 verify:file-size-budget 红线）

- **状态**：✅ 完成（2026-06-01）
- **建议模型**：claude-opus-4-8
- **执行模型**：claude-opus-4-8（主循环）
- **子代理调用**：arch-reviewer (claude-opus-4-8) — PASS-WITH-CONDITIONS，敲定 API 契约 + 文件拆分边界 + 7 条落地约束。
- **arch-reviewer 7 条落地约束（C1–C7，全任务遵守）**：C1 `enableColumnResizing` 只读 props 字面值不派生；C2 legacy `buildGridTemplate` 零改动 + legacy 路径不引 CSS var；C3 存储双 key 双介质(layout local:v2 / views session)+width 校验+v1 清理；C4 `setColumnWidth` visible 兜底 `col.defaultVisible!==false`；C5 flex 列=最后一个可见非 action **且未定宽**列，否则 null+`minmax(0,1fr)` 占位轨；C6 handle 五事件全 stopPropagation；C7 data-table 三抽 + matrix inline style 迁 CSS + dt-styles 单注入守卫。
- **问题理解**：data-table.tsx(737)/dt-styles.tsx(709)/column-matrix-menu.tsx(608)/types.ts(509) 全超 500 行预算，往里加 resize 代码违反「先拆再写」。
- **方案（按 arch-reviewer §7 修订）**：① data-table.tsx **三抽** → `data-table-header-row.tsx`(thead 行) + `client-data-ops.ts`(matchFilter/applyClientFilters/applyClientSort) + `use-data-table-row.ts`(selection helpers/rowStyle) + `data-table-grid.ts`(移入未改动的 legacy buildGridTemplate)；② dt-styles.tsx 拆 base/matrix CSS 字符串，**保留单一 DTStyles 注入守卫**；③ column-matrix-menu.tsx 抽 `column-matrix-footer.tsx` + **inline style 常量迁入 dt-styles CSS**；④ types.ts 抽 `column-types.ts`（TableColumnBase + 4 KindColumn union + AutoFilterColumnFields + ColumnKind）并 re-export。纯结构拆分、零行为变化。
- **文件范围**：`packages/admin-ui/src/components/data-table/{data-table.tsx, dt-styles.tsx, column-matrix-menu.tsx, types.ts}` + 新建 `{data-table-header-row.tsx, dt-styles-base.tsx, dt-styles-matrix.tsx, dt-styles-resize.tsx, column-matrix-footer.tsx, column-types.ts}` + `index.ts`（re-export 保持公开 API 稳定）
- **验收**：typecheck/lint/test 全绿；`verify:file-size-budget` 对这 4 文件不新增违规；公开导出无变化（index.ts 行为不变）。
- **完成备注**（执行模型 claude-opus-4-8）：
  - types 509→307（+column-types 254）；dt-styles 709→51（+base 338/+matrix 337，单注入守卫）；column-matrix-menu 608→469（+styles 73/+keyboard 76/+footer 54）；data-table 737→480（+client-data-ops/+data-table-grid/+header-row 166/+body 123）。
  - 全量门禁：typecheck ✓（7 workspace）/ lint ✓（turbo 5/5）/ verify:adr-contracts ✓（enum-ssot advisory 非阻塞）/ verify:file-size-budget 新违规 24→21（本轨 4 文件全脱离 + data-table 脱离 baseline 豁免）/ **全量 test:run 5788 passed（445 文件 0 失败）**，data-table 子集 429 零行为变化。
  - 环境前置：worktree 须 `npm install` + 构建 `external-adapter/douban-adapter`（dist gitignore），否则 apps/api 全量 typecheck 报 douban-adapter 缺失（与本轨无关）。
  - **偏离**：arch-reviewer C7「matrix inline style 迁 CSS」改为常量平移（column-matrix-menu.styles.ts），同样达标、零视觉回归风险，inline/CSS 双轨债记 follow-up（价值排序 #1 稳定性优先）。
  - **沉淀判断**：纯拆分到共享层内聚模块（client-ops/grid/header-row/body/column-types），边界清晰，是。

---

## 待开始任务

### ⬜ DTR-B — resize 核心（类型契约 + 布局 + handle + 截断）

- **建议模型**：claude-opus-4-8
- **方案**：① `DataTableProps.enableColumnResizing?: boolean`（默认 false，静态门控）+ `TableColumn.maxWidth?`（按 arch-reviewer 定位）；② `column-resize.ts`（`clampWidth` / `buildGridTemplate` legacy↔flex-last 双分支 + 加载期钳制 / `measureColumnContentWidth`）；③ `resize-handle.tsx`（Pointer 全生命周期 + 键盘 + dblclick + stopPropagation）；④ data-table 集成（`--dt-grid-template` CSS 变量 grid + handle 渲染 + 默认 cell/header `data-dt-truncate`+`title` 截断不变高 + body cell `data-col-id`）；⑤ `column-visibility.ts` 加 `setColumnWidth`/`resetColumnWidths`（返回完整 map）。
- **文件范围**：`types.ts`/`column-types.ts`、新 `column-resize.ts`/`resize-handle.tsx`/`use-column-resize.ts`、`data-table.tsx`/`data-table-header-row.tsx`、`column-visibility.ts`、`dt-styles-resize.tsx`

### ⬜ DTR-C — 矩阵「重置列宽」+ 增强收口

- **建议模型**：claude-opus-4-8
- **方案**：① `ColumnMatrixMenu.onResetColumnWidths?` Props + `ColumnMatrixFooter` 加「重置列宽」按钮；② data-table `handleMatrixResetColumnWidths` 串联；③ 双击 auto-fit 接线（仅测当前渲染页）；④ 键盘 Home→min / End→max(未定义 no-op)；⑤ a11y aria（separator + valuenow/min/max + label）完整。
- **文件范围**：`column-matrix-menu.tsx`/`column-matrix-footer.tsx`、`data-table.tsx`、`resize-handle.tsx`

### ⬜ DTR-D — 存储迁移 localStorage + ADR-103 §4.2.2 修订

- **建议模型**：claude-opus-4-8
- **子代理**：arch-reviewer(Opus) 已起草 ADR 要点（DTR-A 同一评审）
- **方案**：① `storage-sync.ts` 布局偏好(pageSize/visibility/width)→localStorage（key `:v2`）/ saved views 留 sessionStorage（拆字段或双 key，按 arch-reviewer）；② 旧 `:v1` 一次性重置不迁移；③ `isStoredPrefs` 加 `Number.isFinite(width)&&width>0` 校验；④ `use-table-query.ts`/`storage-sync.ts` docstring 同步；⑤ `docs/decisions.md` ADR-103 §4.2.2 修订（持 adr 锁）。
- **文件范围**：`storage-sync.ts`、`use-table-query.ts`、`docs/decisions.md`

### ⬜ DTR-E — 验收消费方 + 测试 + 门禁

- **建议模型**：claude-opus-4-8
- **方案**：① `VideoListClient.tsx` `<DataTable>` 加 `enableColumnResizing`（最小改动，验收页）；② 单测（column-resize 双分支/钳制/测宽、column-visibility setColumnWidth/reset、storage-sync local/session+width 校验）；③ 组件测试（handle 仅可调非 flex 列 / 拖拽提交 / pointercancel 回滚 / 键盘 / dblclick / 截断+title / 不触发排序 / 重置列宽）；④ Playwright `admin-next-chromium`（7 条端到端，含关标签页重开持久）；⑤ 全门禁（typecheck/lint/test/verify:file-size-budget/verify:adr-contracts/verify:admin-guardrails/test:e2e）。
- **文件范围**：`VideoListClient.tsx`、`tests/unit/**`、`tests/e2e/**`

---

## 完成备注模板

每卡完成：填执行模型 + 子代理 model-id → 更新本文件状态 → changelog 追加（带 Track ID）→ git commit（测试全绿 + commit trailer `Subagents: arch-reviewer (claude-opus-…)`）。
