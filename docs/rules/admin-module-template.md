# Admin Module Template Rule

> status: active
> owner: @engineering
> scope: admin module implementation checklist and constraints
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


更新时间：2026-03-20 01:33

## 适用范围

- `apps/server/src/components/admin/system/*`
- 后续新增或重构的 admin 业务模块

## 目标

- 统一模块目录结构
- 降低入口层业务耦合
- 确保任务可按模块粒度回滚

## 目录模板

```text
module/
  components/
    XxxTable.tsx
    XxxFilters.tsx
    XxxActions.tsx
  hooks/
    useXxxList.ts
    useXxxFilters.ts
  utils/
    *.ts
  types.ts
```

## 约束

1. 页面入口层只做模块装配，不写业务逻辑。
2. 业务状态优先下沉到 `hooks/`，避免堆积在容器组件。
3. 解析/映射/格式化逻辑下沉到 `utils/`。
4. 单任务单 commit，不混入无关改动。
5. 新记录统一追加到文档尾部（append-only）。
6. UI 改动禁止触碰：数据结构、字段、API 调用顺序、异步流程、权限逻辑。
7. UI 改动仅允许：DOM 结构调整、按钮位置调整、样式与视觉层级调整。
8. 任一 PR 仅允许一个维度（shared / UI / 逻辑），禁止混提。
9. v2 范围内禁止直接使用 `confirm()`，删除类操作必须使用 `ConfirmDialog`。
10. v2 范围内 toast 计时关闭必须使用 `useAdminToast`，禁止 `toast + setTimeout` 自管。

## 验收清单

- `npm run typecheck`
- `npm run lint`
- `npm run verify:admin-guardrails`
- `npm run test:run -- <受影响测试>`
- 手动回归关键交互（按任务定义）
- 对表格类改动，必须补充：
  - 列宽拖拽像素级一致（允许 ±1px）
  - 刷新后滚动位置保持
  - sticky header 无抖动
  - selection 勾选状态不丢失

## 备注

- 本规则对存量代码采用增量收敛策略，不强制一次性迁移。

---

## 后台数据表格六项规范（硬约束）

> **2026-04-30 修订（CHG-DESIGN-11）**：本节六项规范的**适用范围限定为 apps/server v1**（已存在的 admin 模块）。
> **apps/server-next（M-SN-2+）以 `packages/admin-ui` DataTable + `docs/designs/backend_design_v2.1/reference.md` §4.4 + `docs/task-queue.md` SEQ-20260429-02 为准**，**不再使用** ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar 三件套作为新模块模板。DataTable 一体化骨架 CHG-DESIGN-02 Step 1–6 + 7A 已全部落地（2026-04-30），可调用的内置 props：
>
> - `toolbar?: ToolbarConfig`（search / trailing / viewsConfig + 兜底 `hideHiddenColumnsChip` / `hideFilterChips`）
> - `bulkActions?: React.ReactNode`（`.dt__bulk` sticky bottom）
> - `flashRowKeys?: ReadonlySet<string>`（行 flash 动画）
> - `enableHeaderMenu?: boolean`（表头集成菜单）
> - `pagination?: PaginationConfig`（`.dt__foot`；三态语义：省略 prop → summary-only foot；显式 `{...}` → 完整 foot；`{ hidden: true }` → 不渲染。**消费方选择一体化分页时显式传 `{...}` 并同时移除外置 PaginationV2，避免双 pager**）
> - 隐藏列 chip + `HiddenColumnsMenu` popover（pinned 显示"已锁定"）
> - filter chips slot（6 种 FilterValue 默认 formatter + `column.renderFilterChip` 逃生口）
>
> 完整体验"body 独立滚动"需父级提供 height 约束；否则走 `min-height: 240px` 防御性兜底。后续 Step 7B（视频库消费切换）/ CHG-DESIGN-08（视频库视觉对齐）/ CHG-DESIGN-12（cell 复合组件沉淀）。
>
> 即：本节规范仅约束 apps/server v1 时代的现存模块；server-next 新增模块禁止套用本节"v1 ModernDataTable"语义。

所有 **apps/server v1** 后台数据表格必须同时满足以下 6 项（每项均为硬约束，不允许部分完成却标记已完成）：

| # | 规范项 | 要求 | 禁止 |
|---|--------|------|------|
| 1 | 基座 | `ModernDataTable` | `AdminTableFrame` |
| 2 | 列设置 | `ColumnSettingsPanel` + ⚙ overlay | 内联实现 / 缺失 |
| 3 | 行操作（2+ 个动作） | `AdminDropdown`（portal 渲染） | 直接堆砌 button |
| 4 | 批量操作 | `SelectionActionBar variant="sticky-bottom"` | 内联实现 |
| 5 | 分页 | `PaginationV2` | 旧版 `Pagination` |
| 6 | 排序 | 服务端排序（`sortField` / `sortDir` API 参数） | 本地排序 |

验收时必须逐项检验。以"typecheck / lint 通过"代替逐项验收，视为验收未完成。

> 来源：CLAUDE.md §"后台表格规范"（2026-04-12 迁入）


---

## 有序列表规范（ADR-049，M5-ADMIN-BANNER-01）

所有需要用户手动排序的 admin 模块（Banner、来源优先级、轮播位等）必须遵守：

1. **唯一入口**：使用 `SortableList`（`apps/server/src/components/admin/shared/SortableList.tsx`），不得直接使用 `@dnd-kit` 原语
2. **依赖边界**：`@dnd-kit/core` + `@dnd-kit/sortable` 仅允许在 `apps/server` 中引入，`❌ web-next / api / player` 禁止引入
3. **持久化**：拖拽结束后必须立即调用后端排序 API 写回 `sort_order`，不得仅维护前端状态
4. **性能**：分页内排序（单次请求 ≤ 100 条）；大量 item（> 50）须做虚拟化或分批提示
5. **无障碍**：`SortableList` 已内置键盘导航（↑↓ 移位）和 `aria-roledescription`，消费方不得覆盖这些属性
6. **Props 签名**（不得擅自修改 SortableList 的 prop 接口，需走 CHG 流程）：

```tsx
interface SortableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (newItems: T[]) => void
  renderItem: (item: T, index: number) => React.ReactNode
  disabled?: boolean
  'data-testid'?: string
}
```
