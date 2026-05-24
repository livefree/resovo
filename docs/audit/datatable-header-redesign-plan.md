# DataTable 表格头重设计方案

> **trigger**：用户复核反馈 `#UR-B1` / `#UR-B2` / `#UR-B3` / `#UR-B4`（docs/audit/user-review-2026-05-23.md）
> **status**：方案草案（待用户审核 → 通过后 spawn arch-reviewer Opus → 起 ADR → 起 CHG 实施）
> **owner**：@engineering / @livefree（审核）
> **scope**：`packages/admin-ui/src/components/data-table/` 表格头层；不动 cell / pagination / bulkActions / row 展开等其它部分
> **影响**：15 个 server-next 消费方 + DataTable 154 行测试

---

## 1. Context

server-next 15 个 admin 列表页用 DataTable 一体化组件。当前表格头存在 4 处分散的"过滤/列管理"入口：

| # | 入口 | 文件 | 问题 |
|---|---|---|---|
| 1 | toolbar 第二行 filter chips | `filter-chips.tsx` | 仅展示已选 / 同时是编辑入口 / 与列内过滤重复 |
| 2 | toolbar 内"已隐藏 N 列" chip | `data-table.tsx` + `hidden-columns-menu.tsx` | 仅有隐藏列时出现 / 用户视线在 thead，需回到 toolbar 找入口 |
| 3 | 列点击 popover（含升降序+过滤+隐藏） | `header-menu.tsx` | "点列名"应直接排序更直观 / 过滤入口混在 per-column popover 难一览 |
| 4 | `column.columnMenu.filterContent` prop | 消费方 | 消费方塞 filter UI 进 column → 散落 |

**用户实测反馈**：表头不一致 / 中文 IME 输入未处理 / 三点设置实装未达预期 / 列覆盖不全。

---

## 2. 改造目标

把"散落的过滤/列管理"统一到**两个入口**：

- **列名右侧 ⋯（列级三点）**：暴露该列的"即时操作"（排序 / 过滤 / 隐藏此列）
- **thead 右侧 ⋯（统一三点）**：暴露**全表配置矩阵**（一眼看哪些列可见/已过滤/已排序，批量管理）

toolbar 简化为左侧 search + 右侧 trailing；filter chips / 已隐藏 N 列 chip 全部删除。

---

## 3. 视觉 mockup

### 3.1 改造后 thead（v2 修订 2026-05-23）

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [搜索 ...]                  <消费方 trailing 槽位>                  ⋯  │  ← toolbar
├─────────────────────────────────────────────────────────────────────────┤
│ ☐  缩略图  标题 ↑ ⋯  类型 ⋯  评分 ⋯  国家 ⋯  创建时间 ⋯  操作       │  ← thead
└─────────────────────────────────────────────────────────────────────────┘
                                                                       ↑
                                                            统一三点（toolbar 右端）
```

- 列名点击：toggle asc ↔ desc（不可排序列点击无响应）
- 列名右侧 ⋯：列级三点（仅当列支持排序或过滤或可隐藏时显示）
- **统一三点位置（v2 修订）**：**toolbar 右端**，与搜索 / trailing 同行；不在 thead 行（避免列宽挤压 + 与列内 ⋯ 视觉冲突）
- toolbar 第二行 filter chips：**移除**
- 已隐藏 N 列 chip：**移除**

#### 3.1a trailing 槽位的定义（v2 新增）

`toolbar.trailing` 是**消费方塞自定义 ReactNode 的槽位**，DataTable 不内置任何按钮。常见消费方模式：

| 消费方场景 | trailing 内容（示例） |
|---|---|
| 视频库 `/admin/videos` | 「+ 添加视频」按钮（CHG-SN-8-FUP-VIDEO-MANUAL-ADD） |
| 用户管理 `/admin/users` | 「邀请用户」按钮 + role filter SegmentControl |
| 采集控制 `/admin/crawler/runs` | 「刷新」icon button + 「时间范围」select |
| 审计日志 `/admin/audit` | 「导出 CSV」按钮 + 「时间穿梭」按钮 |
| 视频审核台 `/admin/moderation` | 「批量模式」toggle + 「通过即上架」switch |

**约定**：trailing 内组件**不应承担过滤/排序/列管理职责**（这些走列级 ⋯ + 统一三点矩阵）；trailing 只放与"业务动作"相关的入口（新建 / 导出 / 刷新 / 业务模式切换 / 业务 segment）。各消费方迁移时遵循此约定，避免再次出现"表头过滤散落"问题。

### 3.2 列名右侧 ⋯ → 列级 popover

```
点击「标题」列名右侧 ⋯：

┌──────────────────────────┐
│ ↑ 升序                    │  ← enableSorting 时显示
│ ↓ 降序                    │
│ × 清除排序                │  ← 仅当前列已排序时显示
├──────────────────────────┤
│ 过滤                      │  ← 有 filterContent 时显示
│ ┌──────────────────────┐ │
│ │ <text input> 模糊匹配 │ │  ← inline 渲染 column.filterContent
│ └──────────────────────┘ │
│ × 清除过滤                │  ← 仅当前列已过滤时显示
├──────────────────────────┤
│ ⊘ 隐藏此列                │  ← canHide && !pinned 时显示
└──────────────────────────┘
```

**与现有 `header-menu.tsx` 几乎一致**，差别仅在触发位置（列名整体可点 → 列名右侧 ⋯ 图标可点）+ 视觉去 popover header。

### 3.3 toolbar 右端 ⋯ → 统一矩阵 popover（v2 修订）

```
点击 toolbar 右端 ⋯：

┌───────────────────────────────────────────────────────────────────────────┐
│ 列设置                                                          [×]       │
├──────────────┬────────────┬─────────────────────────────┬──────────────┤
│ 列名          │ 可见性     │ 过滤                         │ 排序          │
├──────────────┼────────────┼─────────────────────────────┼──────────────┤
│ 缩略图        │  🔒        │  ─                           │  ─            │
│ 标题          │  [●─]on    │  [●─]on  已过滤: "黑客"     │  ↑ [↓] ×     │
│ 类型          │  [●─]on    │  [─●]off                    │  ↑    ↓  ×   │
│ 评分          │  [●─]on    │  [●─]on  已过滤: 8.0-10.0   │  ↑    ↓  ×   │
│ 国家          │  [●─]on    │  [●─]on  类型: 电影+3 项…   │  ─ (不支持)   │
│ 创建时间      │  [●─]on    │  [●─]on  近7天              │  ↑    ↓  ×   │
│ 描述          │  [─●]off   │  [─●]off                    │  ─            │
│ 操作          │  🔒        │  ─                           │  ─            │
└──────────────┴────────────┴─────────────────────────────┴──────────────┘
                                                                            
        [清除全部过滤]  [清除排序]  [恢复默认列可见性]   ← 底部批量操作行
```

**每格语义（v2 修订 — 过滤格统一为开关 UI）**：

| 格 | UI | 行为 | 不支持 |
|---|---|---|---|
| **可见性** | switch toggle | 切换列可见/隐藏 | pinned 列 disabled + 🔒 |
| **过滤** | switch toggle + 旁边摘要文本 | **关闭**=即时清除该列过滤值 + 隐藏摘要；**开启**=跳到列名右侧 ⋯ 进入 filterContent 编辑（矩阵不直接编辑过滤值） | 无 filterContent 显 "—" 灰，开关 disabled |
| **排序** | ↑ ↓ × 三按钮（互斥单列） | 点 ↑ 设该列 asc + 其他列清除；点 ↓ 同理 desc；× 清除该列排序 | enableSorting=false 显 "—" 灰 |

**过滤格摘要文本溢出处理（v2 新增）**：

- max-width: 200px / `text-overflow: ellipsis` / `white-space: nowrap`
- hover 显示 native `title` tooltip 全文
- 多值过滤（enum 多选 / range 复合）摘要折叠样式：
  - enum 单选：`类型: 电影`
  - enum 多选 ≤ 2 项：`类型: 电影, 电视剧`
  - enum 多选 > 2 项：`类型: 电影+3 项…`（tooltip 展开全 list）
  - range：`8.0-10.0`
  - date-range：`近7天` / `2026-05-01~05-23`
  - text：值长度 ≤ 30 显原值；> 30 截断 `"<前27字>…"` + tooltip 全文

**底部批量操作**（v2 保持）：清除全部过滤 / 清除排序 / 恢复默认列可见性（三按钮）

**关键约束**：矩阵 popover **不直接编辑过滤值**——用户看到"已过滤: 黑客"想改值，要点该列名旁 ⋯ 进 inline 编辑。矩阵承担"状态一览 + 开关启用/禁用 + 批量清除 + 可见性管理"。

---

## 4. API 契约变化（DataTable Props）

### 4.1 删除

```typescript
// types.ts DataTableProps<T>
enableHeaderMenu?: boolean   // ❌ 删（列名点击行为统一改为 toggle 排序；列级 ⋯ 始终启用）

// types.ts ToolbarConfig
hideHiddenColumnsChip?: boolean   // ❌ 删（chip 整段移除）
hideFilterChips?: boolean         // ❌ 删（filter chips 整段移除）

// types.ts TableColumn<T>
renderFilterChip?: (ctx) => ReactNode   // ❌ 删（filter chips 已无）
```

### 4.2 调整语义

```typescript
// types.ts ColumnMenuConfig
export interface ColumnMenuConfig {
  readonly canSort?: boolean
  readonly canHide?: boolean
  readonly filterContent?: ReactNode      // 保留：仍是列级 ⋯ popover 内 inline 渲染源
  readonly isFiltered?: boolean
  readonly onClearFilter?: () => void
  readonly filterSummary?: string         // ➕ 新增：矩阵"过滤状态"格摘要文本（"已过滤: 黑客" 等）
}
```

### 4.3 新增

```typescript
// types.ts DataTableProps<T>
/**
 * 列名右侧 ⋯ 图标的可见性策略（默认 'auto'）：
 *   - auto: 仅当该列 enableSorting 或 columnMenu.filterContent 或 canHide 时显示
 *   - always: 始终显示
 *   - never: 不显示（仅靠 thead 最右统一三点）
 */
readonly columnTriggerVisibility?: 'auto' | 'always' | 'never'

/**
 * 统一三点的位置（v2 修订：默认改为 toolbar-right）：
 *   - toolbar-right: toolbar 右端（默认 / 与搜索 / trailing 同行）
 *   - thead-right: 紧贴 thead 最后一列右侧（兼容备选 / 仅在 toolbar.hidden=true 时建议使用）
 */
readonly headerMenuTriggerPosition?: 'toolbar-right' | 'thead-right'
```

---

## 5. 文件改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `types.ts` | 改 | 删 4 个 prop / 新增 3 个 prop / ColumnMenuConfig 扩 filterSummary |
| `data-table.tsx` | 改 | 移除 toolbar 内 hidden columns chip 渲染 / 移除 filter chips 渲染 / 新增 thead 右侧统一 ⋯ 触发 / 列名渲染加右侧 ⋯ 图标（条件） / 列名点击改 toggle 排序 |
| `header-menu.tsx` | 改 | 触发逻辑从 column-click 改为 column-⋯-click / 移除 portal 计算的"列名 anchor" 改为"⋯ 图标 anchor" / 内容保留升降序+清除排序+过滤区块+隐藏 |
| `hidden-columns-menu.tsx` | 删 | 整文件 207 行删；功能迁移到 column-matrix-menu.tsx |
| `column-matrix-menu.tsx` | 新建 | 统一矩阵 popover（约 350-450 行）；portal / ESC / 点击外部关闭范式与原 hidden-columns-menu 一致；矩阵渲染 + 三个底部批量操作 |
| `toolbar.tsx` | 不动 | 槽位容器不变（仅 data-table.tsx 内不再塞 chip / filter-chips） |
| `filter-chips.tsx` / `filter-chip.tsx` | 删 | 248 行总；功能整合到矩阵"过滤状态"格 |
| `column-settings-panel.tsx` | 不动 | 历史 v1 外置组件；v1 维护期保留 |
| `dt-styles.tsx` | 改 | 新增矩阵 popover 样式（表格内表格 / 灰化态 / 锁定态）；删 filter chips 样式 |
| `index.ts` | 改 | export 新 column-matrix-menu / 删 filter-chip exports |

**总改动估算**：6 文件改 / 3 文件删 / 1 文件新建 / 总 diff ~1500-2000 行（含测试）

---

## 6. 消费方迁移（server-next 15 处）

按现有 props 使用情况分类：

### 类别 A：仅用 toolbar + 默认列管理（最简）

- 估算 8-10 个消费方
- **零迁移**（删 prop 后默认行为兼容）

### 类别 B：用 `enableHeaderMenu={true}`

- 估算 3-5 个消费方
- **删该 prop**（统一改为列级 ⋯ 始终启用模式）
- 行为变化：列名点击从"弹 popover"变为"toggle 排序"

### 类别 C：用 `column.renderFilterChip`

- 估算 1-2 个消费方
- **删 renderFilterChip 实装**；filter 摘要文案迁移到 `column.columnMenu.filterSummary`

### 类别 D：用 toolbar.hideFilterChips / hideHiddenColumnsChip

- 估算 0-1 个消费方（这些是兜底 prop，少有显式使用）
- **删 prop 引用**

**迁移工时**：每个消费方 ~5-15 分钟；总 15 处 ~2-3 小时

---

## 7. IME / debounce 处理（顺带闭合 #UR-B3）

虽然 search 不在本次表格头改造直接范围，但 `#UR-B3 中文 IME 未处理`同属表格头域，建议本次一并修：

```typescript
// 新增 packages/admin-ui/src/components/data-table/search-input.tsx
// 内置 debounce 300ms + composition 事件处理
export function DataTableSearchInput({
  value, onChange, placeholder, debounceMs = 300, ...
}: DataTableSearchInputProps): React.ReactElement {
  // - onCompositionStart: 暂停 onChange 传播
  // - onCompositionEnd: 恢复 + 立即触发一次
  // - 非 composition 期间 debounce
  // - Enter 立即提交（绕过 debounce）
}
```

消费方迁移：从自己写 `<input onChange>` 改为塞 `<DataTableSearchInput>` 到 `toolbar.search`。

---

## 8. 实施分步（建议拆 4 子卡）

| 卡 | 范围 | 工时 | 依赖 |
|---|---|---|---|
| `EP-1` 矩阵原语 + Props 契约 | types.ts API + column-matrix-menu.tsx 新建 + dt-styles.tsx 新增矩阵样式 + 单测 | 0.5w | ADR PASS |
| `EP-2` 列级 ⋯ + 列名 toggle 排序 | header-menu.tsx 改造（anchor 切换）+ data-table.tsx 列名渲染加 ⋯ 图标 + 点击列名改 toggle 排序 | 0.4w | EP-1 |
| `EP-3` 删除旧入口 | data-table.tsx 删 hidden-columns chip + filter-chips 渲染 / 删 hidden-columns-menu.tsx + filter-chips.tsx + filter-chip.tsx / 改 toolbar.tsx / 删除废 props | 0.3w | EP-2 |
| `EP-4` 消费方迁移 + IME search | 15 消费方按类别 A/B/C/D 处理 + DataTableSearchInput + 各消费方接入 + e2e | 0.6w | EP-3 |

**总工时**：约 1.8w（不含 ADR 起草 0.3w 与 arch-reviewer 评审）

---

## 9. ADR 必要性

按 CLAUDE.md §模型路由：

> 主循环在以下工作前必须通过 Task 工具 spawn Opus 子代理完成决策后再落地：
> 1. 定义新的共享组件 API 契约（Props 类型、事件签名、生命周期）

本方案修改 DataTable 公开 Props 契约（删 4 + 新增 3 + ColumnMenuConfig 扩 1）+ 涉及 15 消费方 → **必须起 ADR + 强制 arch-reviewer Opus 评审**。

ADR 草拟内容：
- 决策 1：列级三点 vs 列名点击 popover（决策点 #UR-B2）
- 决策 2：矩阵 popover 仅状态指示 vs 直接编辑过滤（决策点 #UR-B1）
- 决策 3：filter chips 整段废除 vs 保留作"已选展示"（决策点 #UR-B1 补）
- 决策 4：search IME 处理纳入本 ADR vs 独立 follow-up（决策点 #UR-B3）

---

## 10. 测试要求（✅ 强前置）

按 `#UR-M03` 工程流程修订原则："✅ 必须经过用户走读 ≥ 1 次"：

1. **单测**：`packages/admin-ui/src/components/data-table/` 加 ~50 个 case 覆盖
   - 矩阵 popover：渲染 / pinned 灰化 / 不支持过滤灰化 / 不支持排序灰化 / toggle 可见性 / × 清除过滤 / 切换排序方向 / 互斥单列
   - 列级 ⋯：anchor 计算 / 升降序 / 清除排序 / inline filterContent / 隐藏此列
   - 列名点击：toggle 排序 / 不可排序列无响应
   - search IME：compositionstart 暂停 / compositionend 触发 / debounce / Enter 立即
2. **dev server 实测**：跑 `npm run dev:server-next`，逐个走 15 个消费方页面
3. **用户走读**（@livefree）：选 3-5 个代表性页面（videos / sources / moderation / submissions / users）走完
   - 中文 IME 输入"黑客"全程不刷新
   - 排序点列名循环
   - 过滤从列级 ⋯ inline 编辑
   - 矩阵一览状态 + 清除全部过滤
   - 隐藏列 + 恢复默认
4. **e2e**（PLAYER/AUTH/SEARCH/VIDEO 受影响时）：跑 `npm run test:e2e`

**✅ 标准**：用户走读全部通过 + 4661/4661 单测 PASS + e2e PASS + 无 typecheck/lint 错误。

---

## 11. 风险与替代方案

### 11.1 已知风险

| 风险 | 缓解 |
|---|---|
| 15 消费方迁移工时被低估 | EP-4 拆 3 子任务（A/B/C 类别分别处理）+ 每类先试 1 个消费方再批量 |
| 矩阵 popover 在小屏（<1280px）拥挤 | dt-styles.tsx 加 max-width: 90vw + 横向滚动 / 列数 ≥ 8 时列名折行 |
| 列级 ⋯ 图标增加列宽占用 | ⋯ 仅 16px / 用 hover 才显示（鼠标进列名格才出现）/ 已排序/已过滤列恒显 |
| header-menu.tsx 改 anchor 后焦点丢失 | useLayoutEffect 重新计算 anchor 位置 / focus trap 范式不变 |

### 11.2 替代方案（不推荐）

- **替代 A**：不动 header-menu，仅添加矩阵作并行入口。**缺点**：双入口冗余，未解决 #UR-B1 表头不一致
- **替代 B**：filter chips 保留作"已选展示"（不可编辑）。**缺点**：与"矩阵一览"功能重复，视觉冗余
- **替代 C**：列名点击保留弹 popover（不改 toggle）。**缺点**：与 Excel/Notion/Linear 范式不符，#UR-B2 痛点不解

---

## 12. 你需要审核的关键点（v2 进度）

| # | 决策点 | 你的选择 | 状态 |
|---|---|---|---|
| 1 | 矩阵语义 | 状态指示 + 批量清除 | ✅ 通过 |
| 2 | 列名点击行为 | toggle asc ↔ desc 互斥（不可回无序） | ✅ 通过（Q1 答案） |
| 3 | 列名右侧 ⋯ 默认 | auto（仅可排序/可过滤/可隐藏列显示） | ✅ 通过 |
| 4 | IME search 范围 | 纳入 EP-4 一起修 | ✅ 通过 |
| 5 | 统一三点位置 | toolbar 右端（不在 thead 最右） | ✅ 通过（v2 已修订 §3.1 + API 默认） |
| 6 | 过滤格 UI | switch toggle + 摘要文本（关闭=即时清除） | ✅ 通过（v2 已修订 §3.3） |
| 7 | trailing 槽位定义 | 消费方塞业务动作；不放过滤/排序/列管理 | ✅ 通过（v2 已新增 §3.1a） |
| 8 | 摘要文本溢出 | max-width 200px + ellipsis + tooltip + 多值折叠 | ✅ 通过（v2 已新增） |
| 9 | viewsConfig 保留 | 不动 / 本次不改 | ✅ 默认（无反馈） |
| 10 | 底部批量按钮 3 个 | 清除全部过滤 / 清除排序 / 恢复默认列可见性 | ✅ 默认（无反馈） |
| 11 | **EP 子卡拆分粒度** | **待定** | ⏳ **待你回答** |

---

## 13. 流程下一步

按你的 workflow："规划方案 → 通过 → 制定任务执行 → 完成后复核 → 人工审核"：

1. **当前**：方案草案（本文件）
2. **你审核**：回答 §12 的 7 个关键点 + 整体大方向
3. **通过后**：
   - 我 spawn `arch-reviewer` (claude-opus-4-7) 独立评审本方案
   - 评审通过 → 起 ADR-149（草案）+ 起 CHG-SN-9-DT-HEADER-REDESIGN-ADR 卡
   - ADR PASS → 拆 EP-1/2/3/4 子卡按序实施
   - 每 EP 完成 → 单测 + dev server 自测 + 你走读
4. **全 EP 完成**：你最终人工审核 → 闭合 `#UR-B1/B2/B3/B4`

---

## v3 修订（arch-reviewer Opus R-149-1..9 消解 / 2026-05-23）

arch-reviewer (claude-opus-4-7) 完成独立评审，评级 **A− CONDITIONAL PASS**；9 条修订建议全部已在 `docs/decisions.md` ADR-149（line 11920） 内消解。本方案以下章节同步修订：

### 修订点 1 — §6 消费方分类按 Grep 实测重写（R-149-1 MUST）

| Prop | 方案原估算 | Grep 实测 | 偏差 |
|---|---|---|---|
| `enableHeaderMenu` | 3-5 处（类别 B） | **9 处** | 严重低估 |
| `hideFilterChips` | 0-1 处（类别 D） | **8 处** | 严重低估 |
| `renderFilterChip` | 1-2 处（类别 C） | **0 处** | 高估 |
| FilterChipBar 外置（VideoListClient） | **未提及** | 1 处 | 完全遗漏 |

### 修订点 2 — EP 拆分改 5 段（R-149-8 MUST）

原 4 段在 EP-1 删 prop 后会触发 typecheck fail（9 消费方仍引用）。新 5 段：

- EP-1：types.ts 删 4 prop **改为标 @deprecated**（保 noop）+ 新增 3 prop + 矩阵原语
- EP-2：列级 ⋯ + 列名 toggle
- EP-3：删除旧入口（hidden-columns-menu / filter-chips / filter-chip 三文件删）
- **EP-4-A**：DataTableSearchInput + 5 高优消费方接入
- **EP-4-B**：剩余消费方删 deprecated prop + 类型 deprecated → 完全删除
- **EP-4-C**：用户走读 + 修复

总工时 1.8w → **~2.5w**（EP-4 拆 A/B/C 工时上调）。

### 修订点 3 — a11y 强制约束（R-149-7 MUST）

新增 D-149-12 决策项：矩阵 popover 必须实装 ARIA roles（dialog / grid / row / columnheader / rowheader / gridcell / switch / radiogroup / radio）+ 5 个键盘语义（ArrowUp/Down/Left/Right + Space + Esc + Tab）+ 焦点回流（previousFocus 保存 + Esc 关闭后 focus 回触发器）+ disabled 项 aria-label。

### 修订点 4 — trailing 槽位允许 read-only 摘要 chip（R-149-5 MUST）

原 §3.1a "trailing 不放过滤/排序/列管理" 改为 "**不允许编辑型 filter UI**（input/select/range slider），但**允许 read-only 摘要 chip**（如 VideoListClient 的 FilterChipBar，业务 key 摘要 + × 清除按钮 + 无内嵌输入控件）"。

### 修订点 5 — 列级 ⋯ onClick stopPropagation（R-149-6 MUST）

D-149-3 显式约束：列级 ⋯ 触发器 onClick 必须 `e.stopPropagation()`，否则点 ⋯ 会冒泡到列名 toggle 排序。

### 修订点 6 — `columnTriggerVisibility='auto'` 判定时机（R-149-2 MUST）

显式 static + dynamic 复合：`enableSorting || columnMenu.filterContent || columnMenu.canHide !== false || columnMenu.isFiltered === true || query.sort.field === col.id`。任一为 true 即显示。

### 修订点 7 — `headerMenuTriggerPosition` × `toolbar.hidden` 优先级（R-149-3 SHOULD）

显式规则：`toolbar.hidden===true && headerMenuTriggerPosition==='toolbar-right'` → 强制 fallback `'thead-right'`。

### 修订点 8 — `filterSummary` 类型锁定 string（R-149-4 SHOULD）

当前 `string`；富文本（chip 内嵌 icon / 颜色徽标 / 链接）走 N1-149-6 N1 follow-up。

### 修订点 9 — 测试 surface 上调 50 → 60-80（R-149-9 SHOULD）

- column-matrix-menu.tsx：~35 用例（含 a11y + 键盘 + 多值折叠 4 种 + 摘要溢出）
- header-menu.tsx：~10 用例（anchor 切换 + stopPropagation + 三态废除验证）
- data-table.tsx 集成：~10 用例（三 prop 三态 + toolbar.hidden + @deprecated 中间态）
- search-input.tsx：~12 用例（IME composition + debounce + Enter 立即 + SSR safe + 连续"黑客"不中断）
- **现存 154 用例必 PASS**（部分 sort-cycle 测试小幅更新 ~5-8）

### N1 follow-up（独立卡评估）

ADR-149 §9 列出 8 个 N1（149-1..149-8）：多列排序 / 列设置 DB 持久化 / 矩阵虚拟化 / video filter key namespace 对齐 / admin smoke e2e / filterSummary 富文本 / 列宽 resize / matrix → drawer 替代方案。

### 评级

**A− CONDITIONAL PASS** → @livefree 人工审核 PASS（2026-05-23）→ ADR-149 status 翻 ✅ Accepted → **EP-1 启动**。

ADR-149 位置：`docs/decisions.md` line 11942。
