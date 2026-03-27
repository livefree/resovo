# 现代后台管理端可交互表格 (Modern Admin DataTable) 重设计与实现方案

> status: archived
> owner: @engineering
> scope: historical admin table redesign proposal
> source_of_truth: no
> supersedes: none
> superseded_by: docs/admin_table_ux_fix_plan_20260326.md
> last_reviewed: 2026-03-27
>
为了彻底解决目前后台管理表格在列宽拖拽、行高突变、交互跳转以及展示体验上的种种缺陷，本方案制定了一套详细且高度可落地的标准化表格体系。该方案旨在为后续的 AI 代码生成与业务开发提供严格的准则，保证开发不走样，同时兼顾代码的**高复用性**和**高可扩展性**。

---

## 1. 核心架构设计思想

现有的 `<table className="table-fixed">` 虽然具备基础结构，但在复杂动态交互场景下受限。新的架构应拆分出以下几个核心模块：
- **Headless 状态管理**：负责管理排序 (Sorting)、筛选 (Filtering)、分页 (Pagination) 和列宽 (Column Resizing) 等状态，建议使用 `Zustand` 或本地 Hook (如 `@tanstack/react-table`) 抽离逻辑。
- **纯样式组件定义库**：统一定义 `Table`, `Thead`, `Tbody`, `Tr`, `Th`, `Td` 等基础元素的 Tailwind CSS 类。
- **高阶单元格渲染器库 (Cell Renderers)**：将常用的业务逻辑（Copy-to-Clipboard, Switch, True/False Icon 等）封装为标准组件接入。

---

## 2. 痛点解决方案及功能细节

### 2.1 列宽计算与拖拽操作彻底重构 (参照 Google Spreadsheets)
**当前痛点**：拖动某一列影响其他列，默认列宽不合理。
**解决方案**：
1. **取消全局伸缩限制**：外部容器设置 `overflow-x-auto`，表格本身使用 `w-max` 或动态累加真实像素宽度（取代 `w-full`），允许表格总宽度超出屏幕。这样拉宽 A 列时，B 列的物理宽度不会被挤压，而是整体产生横向滚动条。
2. **绝对控制原则**：每一列必须有一个受控的 `width` 和 `minWidth`（使用内联 `style` 或 CSS 变量控制，而非依赖浏览器自动推断）。
3. **拖拽视觉与物理逻辑**：
   - 在表头列 (Th) 的右边缘放置一个拖拽把手 (Resizer)。
   - 拖拽时，监听 `onMouseMove` 记录当前列宽的 `deltaX`，实时改变该列状态中存储的 Width 数值。
4. **默认列宽体系**：内置标准的宽度档位并根据**内容类型**强绑定（例如：`id`: 80px, `status`: 100px, `date`: 160px, `url/title` 设为伸缩列或 300px）。

### 2.2 绝对一致的行高机制
**当前痛点**：由于某些单元格数据过长导致换行，撑破了单行高度。
**解决方案**：
1. **固定基准高**：对所有 `Tr` 和 `Td` 强行指定固定高度（如 `h-12`，即 48px基准），保证视觉上一眼望去的完美整齐。
2. **禁止折行**：所有文本单元格强制使用基础类 `whitespace-nowrap`。

### 2.3 内容溢出的规范化处理
**当前痛点**：内容可能会遮挡其他单元格，或引起破局。
**解决方案**：
1. **内容截断**：长文本使用 `overflow-hidden text-overflow-ellipsis` 截断。
2. **悬浮透出 (Tooltip/Popover)**：对被截断的长文本（特别是多语言文本或长描述），当鼠标 Hover 一定时长后，通过一个脱离文档流的浮层 (Tooltip) 完整展现，绝对不破坏原本的单元格占位。

### 2.4 多元化且零副作用的单元格交互
**当前痛点**：交互经常引发页面重新加载、滚动条归零等。
**解决方案**：
交互组件必须具备**局部 Optimistic (乐观) 更新**并在**后台执行 API**，保证页面“绝对不抖动”。

1. **Boolean Toggles (开启/关闭)**：
   - 提取为独立组件 `<ToggleCell />`。点击时变为 Loading 态并立即提交 API，成功后翻转本地状态。不需要也不允许触发外层数据整体 `refetch()`。
2. **Icon 切换 (如成人内容 True/False)**：
   - 提取为 `<IconToggleCell />`。同样使用乐观更新，采用视觉效果非常明确的两种 Icon（如 ✅ 与 ❌ 或具体图形）。
3. **Url / Text 可复制控件**：
   - 提取 `<CopyableURLCell />`。
   - 默认展示截断后的 Domain 或路径。Hover 时呈现可点击手势；点击后触发 `navigator.clipboard.writeText`，并在鼠标点击处附近闪现 "Copied!" 提示或 Icon 闪动。

### 2.5 快捷强大的过滤与筛选操作
要求功能向 Excel 或企业级 BI 报表看齐：
1. **表头内联过滤 (Column-level Filters)**：表头不仅仅包含标题，点击表头某 Icon 可以展开一个 Popover 筛选面板（针对该列）。如果是枚举类型，展示 Checkbox 列表；如果是文本，展示含糊匹配搜索框。
2. **全局搜索区域**：独立于表格之上的快搜栏，使用防抖技术 (Debounce) 实现即时搜索，且筛选条件通过 URL Params 构建（实现可分享），但是列表渲染使用 Shallow Update 或局部监听。

---

## 3. 基础代码与接口规范 (For AI & Devs)

在实现此机制时，需参考以下接口定义确保高层次的可复用性：

### 3.1 `ColumnDef` 列定义标准
未来在每个业务组件 (如 `VideoTable.tsx`) 编写列定义时，应采用如下约定结构：

```typescript
export interface TableColumn<T> {
  id: string;                    // 唯一标识
  header: string | ReactNode;    // 表头渲染
  accessor: (row: T) => any;     // 数据取值器
  width?: number;                // 默认宽度, 绝对像素值 (如: 120), 缺失则视为 flex-grow
  minWidth?: number;             // 防止过分缩小的极限值
  enableResizing?: boolean;      // 是否支持拖拽调整列宽高
  enableSorting?: boolean;       // 是否可排序
  cell?: (props: { row: T, value: any, updateRow: (newT: T)=>void }) => ReactNode; // 自定义单元格核心
}
```

### 3.2 常见基础 Cell 组件集 (不可篡改的基础库)
要求系统预设以下复用单元，业务侧直接调用，避免重复硬编码：
- `TableTextCell`: 处理 `nowrap` 和缺省 `Tooltips` 的普通字符串渲染。
- `TableSwitchCell`: 包含加载状态，处理 `boolean` 值与 API 回调。
- `TableUrlCell`: Hover 完全展开脱离文档流，Click 触发 Clipboard 工具。
- `TableDateCell`: 固定的短日期格式 / 相对时间格式，并保证宽度自适应最佳。
- `TableAvatarCell` / `TableImageCell`: 渲染缩略图的约束长宽（防止大图撑开行高）。

### 3.3 交互引起的副作用管理规范 (Critical Rule)
**这是解决“页面重载或回到顶部”现象的硬性要求：**
- **禁止使用 `<a href>` 跳转当前页面**来触发动作。对于外部资源使用 `<a target="_blank">`；对于内联更新，使用 `button` 加上明确的 `onClick` 处理事件流，并包含 `e.preventDefault()`, `e.stopPropagation()`。
- 当 API 触发成功后，若必须刷新列表数据，**保留当前的 Scroll 容器 `scrollTop` 和 `scrollLeft`**（使用由 Zustand 或 Ref 保留的滚动状态机制，或仅仅触发布局内部的 React State 局部合并）。更推荐直接由 `cell` 内部接管自己的局部渲染状态，不对外发散重新渲染整表的信号。

---

## 4. 实施与推进步骤

1. **底层重构**: 抽象并新建 `ModernDataTable`（可能替代或重写现有的 `AdminTableFrame`），引入拖拽 Resizer 以及基于 Flex/Grid 或带明确宽度的纯原生 Table 结构。
2. **状态分离**: 提供统一的 Hook 如 `useModernTable` 用于托管排序状态、宽度变更状态、和局部数据更新。
3. **沉淀规范组件**: 分别实现 `TableSwitchCell`, `TableUrlCell`, `TableTextell`。
4. **业务侧升级验证**: 挑选一个痛点最深的历史表格 (例如 Crawler的某些任务列表 或 VideoTable) 首先接入该组件。验证高度完美、拖拽完美、交互零闪白、筛选秒出，再全面铺开。

本蓝图为后续基于该功能重构表格交互体验的基础文档，请确保在生成对应 tsx文件 或 css 调整时，严格遵循以上所有对“宽度独立、高度锁定、组件隔离以及乐观更新”的核心要求。
