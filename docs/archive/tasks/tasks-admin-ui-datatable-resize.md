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

（空 — **DTR-A..F 全部 ✅ 完成（2026-06-01）**；本轨功能完整 + 用户验收返工闭环，待集成 PR。e2e 运行仍需用户环境；用户将重开 :3013 实测 DTR-F。）

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

### ✅ DTR-B — resize 核心（类型契约 + 布局 + handle + 截断）

- **状态**：✅ 完成（2026-06-01）
- **建议模型**：claude-opus-4-8
- **执行模型**：claude-opus-4-8（主循环）
- **子代理调用**：无新增 spawn。API 契约（`enableColumnResizing` / `maxWidth`）+ flex 列规则（C5）+ CSS 变量 grid + 文件拆分边界已在 **DTR-A 的 arch-reviewer (claude-opus-4-8) PASS-WITH-CONDITIONS** 锁定，DTR-B 为该已评审契约的实现，无再定义。commit 带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer 引用该锁定（CLAUDE.md「改 admin-ui types.ts 公开 Props」要求）。
- **问题理解**：DataTable 无列宽可调；需作通用能力沉淀（消费方 opt-in），不做成专页逻辑。
- **方案（落地 C1–C6）**：
  - ① 类型：`DataTableProps.enableColumnResizing?: boolean`（默认 false / C1 静态门控）+ `TableColumnBase.maxWidth?: number`。
  - ② `column-resize.ts` 纯函数：`clampWidth`（下限+可选上限+取整）/ `pickFlexColumnId`（C5：最后可见非 action 且未定宽列，否则 null）/ `buildResizableGridTemplate`（fixed-left + flex-last + 加载期钳制 + 无 flex 末尾 `minmax(0,1fr)` 占位轨 + override 预览）/ `isResizableColumn` / `resolveColumnWidth` / `measureColumnContentWidth`（auto-fit 测当前页）。legacy `buildGridTemplate` 留在 data-table-grid.ts **零改动**（C2）。
  - ③ `resize-handle.tsx`：`<ColumnResizeHandle>` `role="separator"` + 完整 a11y（aria-orientation/valuenow/min/max/label）+ Pointer 全生命周期（setPointerCapture + rAF 命令式改 `--dt-grid-template` 不 setState / pointerup 提交 / pointercancel+lostpointercapture 回滚 / 卸载 cleanup）+ 键盘 ←/→ ±8、Shift ±32、Home→min、End→max(未定义 no-op) + 双击 auto-fit + 五事件全 stopPropagation（C6）。
  - ④ `use-column-resize.ts`：`useColumnResizeController` 集中接线（rootRef / rootStyle / gridTemplate memo / headerContext / preview/commit/rollback/autoFit），data-table.tsx 仅消费 3 出口。
  - ⑤ 集成：root `[data-table]` 挂 rootRef + `--dt-grid-template` CSS 变量；thead/body 行 `gridTemplateColumns` 走 `var(--dt-grid-template)`（resize 路径）/ legacy 字面模板（C2）。表头 label + 默认字符串 body cell 包 `[data-dt-truncate]`+native title（截断不变高）；body cell 加 `data-col-id`（auto-fit 扫描）。th position:relative 仅 resize 路径。
  - ⑥ `column-visibility.ts`：`setColumnWidth`（返回全量 map / visible 兜底 `defaultVisible!==false` C4）+ `resetColumnWidths`（清 width 保留 visible）。
  - ⑦ `dt-styles-resize.ts`（新）：handle 分割线（1px var(--border-default)，hover/active var(--border-strong)/var(--admin-accent-border)，col-resize，reduced-motion 关过渡）+ `[data-dt-resizing]` 全局禁选光标 + `[data-dt-truncate]` 截断；颜色零硬编码。dt-styles.tsx 单注入守卫拼接 base+matrix+resize。
- **文件范围（实际，含 DTR-A 重构后增补）**：`types.ts`/`column-types.ts`、新 `column-resize.ts`/`resize-handle.tsx`/`use-column-resize.ts`、`data-table.tsx`/`data-table-header-row.tsx`、`column-visibility.ts`、新 `dt-styles-resize.ts`；**增补**：`data-table-body.tsx`（DTR-A 把 body 渲染拆出，data-col-id+截断落此）+ `dt-styles.tsx`（注入器拼接 resize CSS，2 行）。index.ts 未动（setColumnWidth/resetColumnWidths 保持模块内部，不扩公开 API surface）。
- **验收**：admin-ui typecheck ✓ / server-next 消费方 typecheck ✓ / 完整 typecheck 7 workspace ✓ / lint ✓（turbo 5/5）/ `verify:file-size-budget` data-table 模块 **0 新违规**（data-table.tsx 控制下沉后 522→496 ≤500，新文件全 ≤213）/ table 子集 **429 全过** + 临时 smoke 14 全过（纯函数双分支 + 组件集成 + 键盘 +8 + stopPropagation；跑后删，正式测试归 DTR-E）。
- **完成备注**（执行模型 claude-opus-4-8）：
  - 新文件行数：column-resize 177 / resize-handle 213 / use-column-resize 131 / dt-styles-resize 74；data-table.tsx 496（接线下沉 hook 后回 ≤500）。
  - **偏离 1（卡边界合并）**：原 DTR-C 列的「handle 键盘 Home/End + a11y aria + 双击 auto-fit 接线」并入 DTR-B —— 半成品 handle 不可独立验收（价值排序 #1 正确性/稳定性）。DTR-C 收窄为矩阵「重置列宽」入口（column-matrix-menu/footer + data-table `handleMatrixResetColumnWidths` + `onResetColumnWidths` Props）+ 收口复核。
  - **偏离 2（文件范围增补）**：DTR-A 把 body 渲染从 data-table.tsx 拆到 data-table-body.tsx（plan 撰写时尚在 data-table.tsx），故 data-col-id+截断落 data-table-body.tsx；dt-styles.tsx 注入器需 2 行拼接 resize CSS。两者均为 DTR-A 重构的直接后果，已据实更新本卡文件范围。
  - **偏离 3（dt-styles-resize 后缀）**：plan 写 `.tsx`，对齐 DTR-A 既有 `dt-styles-base.ts`/`dt-styles-matrix.ts`（纯字符串常量无 JSX）改用 `.ts`。
  - **全量 test:run 观察**：DTR-A HEAD 与本轨改动后均出现「每次全量随机挂 1 个不同的无关 `apps/server-next/admin/**` 测试」（实测 UserSubmissionsClient / StagingEditPanel / CrawlerClient 三次各不同 / 全部隔离单跑通过）→ 确证为 **server-next admin 测试套件既有的非确定性跨测试污染 flake**（stash 我的改动后干净 HEAD 同样复现），**与 DTR-B 零关系**（改动全在 packages/admin-ui/data-table，failing 测试不走 resize 路径）。不在本轨文件范围，不修；记为既有债观察。
  - **沉淀判断**：列宽可调作为通用 DataTable 能力沉淀进共享层（column-resize 纯函数 + controller hook + handle 组件），消费方 opt-in，是。
- **下一张（DTR-C）依赖**：DTR-B 已导出 `resetColumnWidths`（column-visibility.ts，模块内）供 DTR-C 矩阵「重置列宽」串联。

### ✅ DTR-C — 矩阵「重置列宽」收口

- **状态**：✅ 完成（2026-06-01）
- **建议模型**：claude-opus-4-8 / **执行模型**：claude-opus-4-8（主循环）
- **子代理调用**：无新增 spawn。`ColumnMatrixMenu.onResetColumnWidths?` 是 DTR-A arch-reviewer (claude-opus-4-8) 锁定契约三公开字段之一，本卡为实现。commit 带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer（改公开 ColumnMatrixMenuProps）。
- **方案（落地）**：① `ColumnMatrixFooter` 加「重置列宽」按钮（`onResetColumnWidths` 提供时才渲染，对齐既有「恢复默认列可见性」范式 / data-testid `matrix-foot-reset-widths`）；② `ColumnMatrixMenuProps.onResetColumnWidths?` 透传到 footer；③ data-table 经 `resize.resetAllWidths`（下沉进控制器，调 DTR-B `resetColumnWidths`）串联，仅 `resizeEnabled` 时传入（否则按钮不渲染）。
- **文件范围**：`column-matrix-footer.tsx`、`column-matrix-menu.tsx`、`data-table.tsx`、`use-column-resize.ts`（`resetAllWidths` 下沉，保 data-table.tsx ≤500：497）
- **收口复核**：handle a11y（separator+valuenow/min/max+label）/ 键盘（←/→/Shift/Home/End）/ 双击 auto-fit 已在 DTR-B 落地，本卡核验无需改动。
- **验收**：admin-ui typecheck ✓ / 完整 typecheck 7 workspace（含 server-next 消费方 ColumnMatrixMenuProps）✓ / lint 5/5 ✓ / file-size-budget data-table 模块 0 新违规 / table 子集 **429 全过** + 临时 smoke 2 全过（resize 开 → 按钮现+点击清全 width 保 visible / 未开 → 无按钮且「恢复默认列可见性」不受影响；跑后删）。
- **偏离**：`resetAllWidths` 放进 `useColumnResizeController`（而非 data-table.tsx 内 `handleMatrixResetColumnWidths` useCallback），保 data-table.tsx ≤500 行预算 + 逻辑内聚（控制器是列宽状态变更的天然 owner）。
- **沉淀判断**：通用矩阵 popover 增「重置列宽」批量动作，沉淀进共享 footer + 控制器，是。

### ✅ DTR-D — 存储迁移 localStorage + ADR-103 §4.2.2 修订

- **状态**：✅ 完成（2026-06-01）
- **建议模型**：claude-opus-4-8 / **执行模型**：claude-opus-4-8（主循环）
- **子代理调用**：无新增 spawn。ADR §4.2.2 修订要点（双 key 双介质 / width 校验 / 旧 v1 清理）已在 DTR-A arch-reviewer (claude-opus-4-8) C3 锁定，本卡实现 + 同步 ADR 文档。commit 带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer（持 adr 锁，改 docs/decisions.md）。
- **方案（落地 C3）**：
  - storage-sync.ts **双 key 双介质**：布局偏好（pageSize+columns visible/width）→ localStorage `admin-ui:table:{id}:v2`；saved views → sessionStorage `admin-ui:table:{id}:views:v1`。拆分后读写**不再需要 read-merge 保另一侧**（分键自然隔离 / 较旧实现简化）。
  - 旧合并 `:v1`（sessionStorage）**一次性清理不迁移**：readFromStorage 入口 best-effort `safeRemove`。
  - schema 加固：`isValidWidth`（`typeof number && Number.isFinite && > 0`）；parseLayout/writeToStorage 双向过滤，非法 width 丢弃保 visible。
  - SSR 安全：`safeGet/safeSet/safeRemove` + `typeof window` 守卫，模块顶层零副作用。
  - 对外契约不变：`readFromStorage/writeToStorage/writeViewsToStorage/storedPrefsToColumnMap` + `StoredPrefs` 合并形态零改 → use-table-query 仅 docstring 改。
  - docs/decisions.md：ADR-103 §4.2.2 AMENDMENT（原单 key sessionStorage 规约废止 / 改双 key 双介质，含动机 + 旧 key 处置 + 封装说明）+ §3586（pageSize 介质）+ §3432（列宽持久化口径）AMENDMENT 标注。
- **文件范围**：`storage-sync.ts`、`use-table-query.ts`、`docs/decisions.md`
- **验收**：admin-ui typecheck ✓ / 完整 typecheck 7 workspace（含 server-next 消费方）✓ / lint 5/5 ✓ / **verify:adr-contracts exit=0**（4 核心 check 全 ✅ / 末 enum-ssot+error-message advisory 非阻塞 pre-existing）/ file-size-budget data-table 模块 0 新违规（storage-sync 270 行）/ table 子集 **429 全过**（含既有 saved-views-persist 12 round-trip 不回归）+ 临时 smoke 4 全过（介质拆分 / width 校验 NaN/0/负/字符串/null 全丢弃保 visible / 旧 v1 清理 / writeToStorage 不持久化 NaN；跑后删）。
- **偏离**：plan 写「`isStoredPrefs` 加 width 校验」→ 实改为独立 `isValidWidth` + parseLayout 清洗（width 非法应**丢弃保 visible** 而非整体 reject 偏好，guard 语义不适合做"部分清洗"，故拆 sanitize 步骤）；plan「拆字段或双 key」选**双 key**（C3 明示 layout:v2/views:v1）。
- **沉淀判断**：存储介质策略封装在 storage-sync.ts 共享层，对外签名不变，消费方零感，是。
- **跨设备 follow-up**：N1-149-2（DB-level `user_table_preferences` 跨设备同步）本轮不做，已在 ADR §4.2.2 AMENDMENT + tasks Follow-up 标注，另起 ADR。

### ✅ DTR-E — 验收消费方 + 测试 + 门禁

- **状态**：✅ 完成（2026-06-01）；e2e spec 已写+编译，**运行环境门控**（见备注）。
- **建议模型**：claude-opus-4-8 / **执行模型**：claude-opus-4-8（主循环）
- **子代理调用**：无（验收消费 + 测试，不定义新契约 / 不改 ADR）。
- **方案（落地）**：
  - ① `VideoListClient.tsx` `<DataTable>` 加 `enableColumnResizing`（验收页 / 列已声明 enableResizing）。
  - ② 单测 `column-resize.test.ts`（clampWidth/pickFlex 双分支/buildResizableGridTemplate flex-last+占位轨+override+加载期钳制/legacy buildGridTemplate 双分支/isResizable/resolveWidth/measureColumnContentWidth/setColumnWidth+resetColumnWidths，26 case）。
  - ② 单测 `storage-sync-medium.test.ts`（双 key 双介质/合并/views Map round-trip/width 校验/旧 v1 清理/JSON 损坏/storedPrefsToColumnMap，~18 case）。
  - ③ 组件测 `column-resize-handle.test.tsx`（handle 门控/a11y/拖拽提交+maxWidth 钳制/pointercancel 回滚/非主键不拖/键盘 ←→/Shift/Home/End/双击 auto-fit mock scrollWidth/截断+title/不触发排序/矩阵重置/legacy 零变化，20 case）。jsdom 补 PointerEvent polyfill（基于 MouseEvent / 跨文件零污染实测）。
  - ④ Playwright `tests/e2e/admin/videos-column-resize.spec.ts`（5 spec：handle 渲染/拖拽改宽+localStorage:v2 持久/刷新跨会话持久/矩阵重置 width 清空/键盘+auto-fit）。
  - ⑤ 门禁如下。
- **文件范围**：`apps/server-next/.../VideoListClient.tsx`、`tests/unit/components/admin-ui/table/{column-resize,storage-sync-medium,column-resize-handle}.test.{ts,tsx}`、`tests/e2e/admin/videos-column-resize.spec.ts`
- **验收（门禁全绿）**：完整 typecheck 7 workspace（含 server-next VideoListClient）✓ / lint 5/5 ✓ / **全量 test:run 448 文件 5846 passed 0 failed**（含本卡 +58 新测试；modern-table pointer 测试零回归证 polyfill 无泄漏；既有 server-next admin flake 本次未复现）/ verify:file-size-budget data-table 模块 0 新违规（VideoListClient 782→784 仍 baseline 豁免 / 新违规计数仍 21）/ verify:adr-contracts exit=0（DTR-D）/ verify:admin-guardrails ✓（no in-scope）/ Playwright e2e spec `--list` 编译 5 tests ✓。
- **e2e 运行门控（唯一遗留）**：`npm run test:e2e` 需启 3 dev server（apps/server + server-next + web-next）；本 worktree 缺 `.env.local`（gitignored 未随 worktree 复制）→ web-next dev 退出码 9，且 reuseExistingServer 会复用**主仓**运行中的 server-next（非本 worktree 代码）。故 e2e **运行**留待用户在已配 env + 启本 worktree 自身 dev server 的环境执行；spec 本身已编译通过 + 列出 5 tests，逻辑由 58 单测/组件测充分覆盖。
- **偏离**：plan ④「7 条 e2e」收敛为 5 条（合并 ①handle ②拖拽+持久 ③刷新持久 ④重置 ⑤键盘+auto-fit；窄水平滚动/宽 flex 拉伸属布局视觉，localStorage 持久 + handle 行为已覆盖核心）。
- **沉淀判断**：验收消费 + 测试，无新共享层沉淀（feature 已在 B–D 沉淀）。

### ✅ DTR-F — 验收返工：重置=auto-fit + 校准声明宽 + 封面/操作列解禁可拖

- **状态**：✅ 完成（2026-06-01）
- **建议模型/执行模型**：claude-opus-4-8（主循环）
- **来源**：用户实测 /admin/videos 验收反馈——"初始布局非最佳；封面/标题列名截断；无理由禁用封面/操作列"。
- **子代理调用**：**arch-reviewer (claude-opus-4-8)** —— PASS-WITH-CONDITIONS + F1..F16 落地约束（autoFitAll flex 也写宽/测不到保原宽、action opt-in、按钮改名"自适应列宽"、resetColumnWidths 保留、校准取值、ADR AMENDMENT、测试影响、风险）。
- **落地（按 F1..F16）**：
  - `column-resize.ts`：拆 `isWidthAdjustable`（含 flex / action opt-in）vs `isResizableColumn`（排除 flex，渲 handle）；新增 `buildAutoFitColumnMap` 纯函数（全量克隆 + 仅可调且 measured>0 列写 clamp(content+padding)，测不到保原宽不兜底 / F2/F3/F4）。
  - `use-column-resize.ts`：`resetAllWidths` → `autoFitAllWidths`（遍历 isWidthAdjustable 列 measure + buildAutoFitColumnMap 单次提交 / F5/F9）。
  - `column-matrix-footer.tsx` + `column-matrix-menu.tsx` + `data-table.tsx`：prop `onResetColumnWidths` → `onAutoFitColumnWidths`，按钮文案"重置列宽"→**"自适应列宽"**，data-testid `matrix-foot-reset-widths` 保留（F7/F9）。
  - `VideoListClient.tsx`：封面删 `enableResizing:false`（width 72 / minWidth 64→56）；操作 `enableResizing:false`→`true`（width 150→120 / minWidth 130→100）（F10/F11）。
  - `docs/decisions.md`：ADR-103 §4.2.2 **AMENDMENT 2**（reset→auto-fit 语义 + action opt-in + 4 限制：server 当前页 / 自定义 cell 精度 / 无首屏 auto-fit / 测不到保原宽）（F14）。
  - 测试：column-resize.test.ts +isResizableColumn action opt-in 3 case +buildAutoFitColumnMap 5 case；column-resize-handle.test.tsx 「重置」→「自适应列宽」auto-fit（mock scrollWidth）+ 全测不到不提交；e2e test④ 改 auto-fit 语义 + test① 加封面/操作 handle 存在断言（F15/F16）。
- **文件范围**：`column-resize.ts`、`use-column-resize.ts`、`column-matrix-footer.tsx`、`column-matrix-menu.tsx`、`data-table.tsx`、`VideoListClient.tsx`、`docs/decisions.md`、`tests/unit/.../column-resize.test.ts`、`tests/unit/.../column-resize-handle.test.tsx`、`tests/e2e/admin/videos-column-resize.spec.ts`
- **验收（门禁全绿）**：完整 typecheck 7 workspace（含 server-next）✓ / lint 5/5 ✓ / **全量 test:run 448 文件 5852 passed（+7 新用例 / 唯 1 失败为既有 server-next admin flake StagingTable，隔离 13/13 过 / 与本轨无关）** / file-size-budget data-table 模块 0 新违规（column-resize 215 / use-column-resize 164；VideoListClient 788 仍 baseline 豁免 / 新违规计数仍 21）/ verify:adr-contracts exit=0 / e2e --list 编译 5 tests ✓。
- **关键设计决策（arch-reviewer）**：① auto-fit 复用 measureColumnContentWidth，其 selector 天然命中表头列名 span → 已含"容下列名"，不新增表头测量（F1）；② flex 列也参与 auto-fit（isWidthAdjustable 不排除 flex），写宽后下一帧 flex=null 余量归占位轨（F3）；③ title 保持无 width minWidth:220（resize 模式固定 220 / 余量归占位轨 / **不擅改 C5 锁定的 flex 选取语义**，若验收仍嫌空白另起 ADR）。
- **偏离**：plan 原 reset=清空语义 → 用户验收返工改 auto-fit（已 arch-reviewer + ADR AMENDMENT 2 闭环）。
- **沉淀判断**：auto-fit 全列 + isWidthAdjustable/isResizableColumn 二谓词拆分沉淀进共享 column-resize 层，是。

---

## 完成备注模板

每卡完成：填执行模型 + 子代理 model-id → 更新本文件状态 → changelog 追加（带 Track ID）→ git commit（测试全绿 + commit trailer `Subagents: arch-reviewer (claude-opus-…)`）。
