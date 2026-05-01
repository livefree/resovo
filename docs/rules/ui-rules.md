# Resovo（流光） — 前后台 UI 实现规范

> status: active
> owner: @engineering
> scope: frontend and admin ui component and interaction rules
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-28
>
> 本文件由原"前端组件规范"升级而来，适用范围扩展至前台与后台。
> 升级依据：`docs/ui_governance_conflicts_20260327.md` §4.2 及 §5
>
> 前台布局、页面模板、shelf、token 分层与响应式约束以 `docs/frontend_design_spec_20260423.md`（已归档至 `docs/archive/m0-m6/`）为参考；当前前台 web-next 时代真源以 `apps/web-next` 为准。
>
> **2026-04-30 修订（CHG-DESIGN-11）**：适用范围扩到 server-next + admin-ui 时代。

> **适用范围**（2026-04-30 修订）：
> - 前台 v1（历史）：`apps/web/src/components/`、`apps/web/src/app/`
> - 前台 web-next（当前）：`apps/web-next/src/components/`、`apps/web-next/src/app/`
> - 后台 v1（历史，cutover 前生产）：`apps/server/src/components/`、`apps/server/src/app/`
> - **后台 server-next（当前重写主体）**：`apps/server-next/src/`（消费 `packages/admin-ui` 共享层 + `packages/design-tokens` token）
>
> AI 在编写任何前端组件前必须读取本文件。
>
> **后台 token 来源切换**：server-next 时代后台 CSS 变量来自 `packages/design-tokens`（admin-layout / semantic / primitives 三层 + brand 覆盖；详见 ADR-102），**不再**使用 `apps/server/src/app/globals.css`（v1 后台旧 token）。
>
> **后台共享组件**：server-next 任何新建后台 shared 组件先确认 `packages/admin-ui/src/components/` 与 `packages/admin-ui/src/shell/` 无等价实现；**不再**新增 `apps/server/src/components/admin/shared/` 内容（v1 已冻结）。新增共享组件直接落 `packages/admin-ui`（reference.md §4 通用组件 + §10 业务复合组件清单）。

---

## 主题与颜色

### CSS 变量（必须使用，禁止硬编码）

前台与后台当前使用两套独立的 CSS 变量体系，分别来自 `apps/web/src/app/globals.css`（前台）和 `apps/server/src/app/globals.css`（后台）。两套体系并存属于已知历史分叉，将在 token 层统一后收敛。在此之前，各区域必须使用对应体系内的变量，**不得跨体系混用，不得引入新的硬编码颜色值**。

#### 前台 CSS 变量（用于 `apps/web/src/components/` 前台组件）

```css
/* 背景 */
--background          /* 页面底色 */
--secondary           /* 卡片/次级容器背景 */

/* 文字 */
--foreground          /* 主文字 */
--muted-foreground    /* 次要文字、占位符 */

/* 边框 */
--border              /* 标准边框 */

/* 强调色 */
--accent              /* 金色主题色 */
--accent-foreground   /* accent 背景上的文字颜色（用于 accent 底色上的文字，不得用 black/white） */
--gold                /* 纯金色（类型徽章、评分标记） */

/* 状态语义色（前后台通用） */
--status-success      /* 成功/在线/已完成 */
--status-danger       /* 错误/离线/危险操作 */
--status-warning      /* 警告/待处理/注意 */
--status-info         /* 信息/进行中 */
```

#### 后台 CSS 变量（用于 `apps/server/src/components/admin/` 后台组件）

```css
/* 背景层级 */
--bg              /* 页面底色 */
--bg2             /* 卡片/面板背景 */
--bg3             /* 悬停/选中状态背景 */

/* 文字 */
--text            /* 主文字 */
--muted           /* 次要文字、标签 */

/* 边框 */
--border          /* 标准边框 */
--subtle          /* 弱边框、分隔线 */

/* 强调色 */
--accent          /* 主题色 */
--foreground      /* 高对比前景色（用于强调背景上的文字） */

/* 状态语义色（前后台通用） */
--status-success      /* 成功/在线/已完成 */
--status-danger       /* 错误/离线/危险操作 */
--status-warning      /* 警告/待处理/注意 */
--status-info         /* 信息/进行中 */
```

#### 前台 / 后台变量对照表

| 语义 | 前台变量 | 后台变量 |
|------|---------|---------|
| 页面底色 | `--background` | `--bg` |
| 次级背景（卡片/面板） | `--secondary` | `--bg2` |
| 三级背景（悬停/选中） | — | `--bg3` |
| 主文字 | `--foreground` | `--text` |
| 次要文字 | `--muted-foreground` | `--muted` |
| 高对比前景（强调背景上） | — | `--foreground` |
| 标准边框 | `--border` | `--border` |
| 弱边框/分隔线 | — | `--subtle` |
| 主题强调色 | `--accent` | `--accent` |
| 强调色前景 | `--accent-foreground` | `--foreground` |
| 纯金色（徽章/评分） | `--gold` | — |
| 卡片背景 | `--card` | — |
| 卡片前景文字 | `--card-foreground` | — |
| 互动主色（按钮/链接） | `--primary` | — |
| 互动主色前景 | `--primary-foreground` | — |
| 焦点环 | `--ring` | — |
| 输入框边框 | `--input` | — |
| 状态色：成功 | `--status-success` | `--status-success` |
| 状态色：危险/错误 | `--status-danger` | `--status-danger` |
| 状态色：警告 | `--status-warning` | `--status-warning` |
| 状态色：信息 | `--status-info` | `--status-info` |

> `--status-*` 为前后台共用语义色，直接用于文字/图标颜色。不得将其用于大面积背景（对比度依赖场景）。

### 主题切换
```tsx
// ✅ 正确：使用 CSS 变量
<div style={{ color: 'var(--foreground)', background: 'var(--secondary)' }}>

// 或 Tailwind + CSS 变量
<div className="bg-[var(--secondary)] text-[var(--foreground)]">

// ✅ 正确：需要半透明混合时
<div style={{ borderColor: 'color-mix(in srgb, var(--foreground) 10%, transparent)' }}>

// ❌ 错误：硬编码颜色
<div style={{ color: '#e8e6e1', background: '#17171e' }}>
<div style={{ color: 'black' }}>       // ❌ 不跟随主题
<div className="bg-gray-900 text-gray-100">  // ❌ 不跟随主题
```

---

## 组件规范

### 组件文件结构
```tsx
// 1. 类型定义（放文件顶部）
interface VideoCardProps {
  video: Video
  onClick?: () => void
  className?: string
}

// 2. 组件主体
export function VideoCard({ video, onClick, className }: VideoCardProps) {
  // 3. hooks 在最顶部
  const theme = useThemeStore()

  // 4. 事件处理函数
  const handleClick = () => { ... }

  // 5. 渲染
  return (
    <div className={cn('...', className)} onClick={handleClick}>
      ...
    </div>
  )
}
```

### Props 规范
```tsx
// ✅ 可选 props 给默认值
function Button({
  variant = 'default',
  size = 'md',
  disabled = false,
  children
}: ButtonProps) { ... }

// ✅ 扩展 HTML 原生属性时使用 ComponentProps
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent' | 'ghost'
}
```

### className 合并
```tsx
// ✅ 使用 cn() 合并 className（来自 clsx + tailwind-merge）
import { cn } from '@/lib/utils'

<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  className  // 允许外部覆盖
)}>
```

---

## 播放器组件规范

播放器相关组件在 `apps/web/src/components/player/` 目录，有特殊规范：

### 状态管理
```tsx
// 播放器状态集中在 playerStore，不用 useState 分散管理
import { usePlayerStore } from '@/stores/playerStore'

const { isPlaying, currentEpisode, setEpisode, toggleTheater } = usePlayerStore()
```

### 控制栏按钮
```tsx
// 每个控制栏按钮必须：
// 1. 有 title 属性（悬停提示）
// 2. 有 data-shortcut 属性（快捷键说明）
// 3. 使用 .ib 基础样式类

<button
  className="ib"
  title="字幕 (C)"
  data-shortcut="C"
  onClick={toggleCC}
>
  <CCIcon />
</button>
```

### 浮层组件
```tsx
// 浮层必须：
// 1. 支持 Esc 关闭
// 2. 点击外部关闭
// 3. 使用 CSS transform 动画（不用 display:none/block 切换）

useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  if (isOpen) document.addEventListener('keydown', handleKey)
  return () => document.removeEventListener('keydown', handleKey)
}, [isOpen])
```

---

## 国际化规范

```tsx
// ✅ 正确：使用 next-intl
import { useTranslations } from 'next-intl'

function SearchPage() {
  const t = useTranslations('search')
  return <h1>{t('title')}</h1>
}

// ❌ 错误：硬编码中文字符串
function SearchPage() {
  return <h1>搜索</h1>
}
```

翻译 key 命名规范：
```
{页面/模块}.{组件}.{元素}

示例：
search.filterBar.label.type     → "类型"
player.controls.tooltip.subtitle → "字幕 (C)"
video.meta.label.director        → "导演"
```

---

## 响应式规范

```tsx
// 移动端优先，使用 Tailwind 断点
// sm: 640px / md: 768px / lg: 1024px / xl: 1280px

// ✅ 正确：移动端基础样式，大屏覆盖
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5">

// 播放页侧边栏在移动端隐藏
<aside className="hidden lg:flex w-80 flex-col">
```

---

## 性能规范

```tsx
// ✅ 列表使用虚拟滚动（超过 50 项）
// 使用 @tanstack/react-virtual

// ✅ 图片使用 Next.js Image 组件
import Image from 'next/image'
<Image src={cover} alt={title} width={200} height={300} />

// ✅ 按需懒加载重型组件
const PlayerShell = dynamic(() => import('@/components/player/PlayerShell'), {
  ssr: false  // 播放器不需要 SSR
})

// ❌ 不在播放器组件中使用 SSR
```

---

## Admin Table 规范

后台数据表格的 6 项硬性约束定义在 **CLAUDE.md 第三层 › 后台表格规范（Admin Table）**，此处不重复列举。

新建或修改后台列表页时，验收前必须逐项对照 CLAUDE.md 中的 6 项规范检验（不允许以"typecheck / lint 通过"代替逐项验收）。

---

## 浮层与 Portal 实现规范

### 唯一浮层实现模式（强制）

所有需要"脱离文档流"的浮层组件（下拉菜单、浮动面板、Popover、Tooltip 等）**必须使用以下标准模式**，不允许使用其他方式（如绝对定位叠加、`position: fixed` 直接写入组件、第三方浮层库未经封装直接使用）：

```tsx
// ✅ 标准浮层模式：createPortal + DOMRect + mousedown/Escape
'use client'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

// 位置计算（参考 AdminDropdown.tsx）
function calcPosition(rect: DOMRect): { top: number; right: number } {
  return {
    top: rect.bottom + window.scrollY + 4,
    right: window.innerWidth - rect.right,
  }
}

// 关闭行为（参考 AdminDropdown.tsx）
useEffect(() => {
  if (!isOpen) return
  function handleMouseDown(e: MouseEvent) {
    if (triggerRef.current?.contains(e.target as Node)) return
    if (menuRef.current?.contains(e.target as Node)) return
    setIsOpen(false)
  }
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') setIsOpen(false)
  }
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [isOpen])

// 渲染（避免 SSR 报错）
{typeof document !== 'undefined' && createPortal(panel, document.body)}
```

**参考实现：**
- server-next（当前真源）：`packages/admin-ui/src/components/dropdown/`（如尚未抽到 admin-ui，CHG-DESIGN-12 cell 沉淀阶段补齐）
- server v1（仅维护期）：`apps/server/src/components/admin/shared/dropdown/AdminDropdown.tsx`

### 禁止行为

- ❌ 新建浮层组件时绕过现有 `AdminDropdown` 等已封装实现（先确认有无可复用）
- ❌ 使用 `position: fixed` + `z-index` 直接在组件内定位（跳过 portal 导致堆叠问题）
- ❌ 在 `overflow: hidden` 容器内放置浮层（必须使用 portal 逃离边界）

---

## 后台共享组件边界规范

> **2026-04-30 修订（CHG-DESIGN-11）**：本节描述的目录为 **apps/server v1**（已冻结）的历史共享组件清单，仅适用于 v1 维护期 bug 修复。**server-next 新模块禁止套用本节清单**，必须改去 `packages/admin-ui/src/components/` + `packages/admin-ui/src/shell/` 寻找等价实现，未抽出的待 CHG-DESIGN-12 cell 沉淀完成后引用 reference.md §10 业务复合组件清单。

### 新建共享组件前的强制检查

#### server-next（当前真源）

在 `packages/admin-ui` 下新建任何组件之前，**必须先确认**以下目录中是否已有等价实现：

```
packages/admin-ui/src/
  components/data-table/   ← DataTable 一体化骨架（CHG-DESIGN-02 Step 1–6 + 7A 已全部落地）：toolbar / bulkActions / flashRowKeys / enableHeaderMenu / saved views / pagination(.dt__foot) / .dt__body 独立滚动 / 隐藏列 chip / filter chips slot
  components/             ← 其他 v2 通用原语（reference.md §4 通用组件清单）
  shell/                  ← AdminShell + Sidebar + Breadcrumbs（ADR-103a）
```

> **完整体验需父级 height 约束**：`.dt__body` 独立滚动只有在父容器提供 height 约束（如 `calc(100vh - topbar - footer)`）时才完全生效；未提供时 DataTable 走 `min-height: 240px` 防御性兜底，page-level 滚动取代 body 内部滚动。视频库等消费方在 Step 7B / CHG-DESIGN-08 完成 height 约束接入。

未抽出的业务复合组件（DualSignal / VisChip / Spark / KpiCard / thumb / pill / inline xs actions 等）由 CHG-DESIGN-12 沉淀（详见 `docs/designs/backend_design_v2.1/reference.md` §10）。

#### apps/server v1（仅维护期）

在 `apps/server/src/components/admin/shared/` 下新建任何组件之前（**仅限 v1 维护期 bug 修复**），**必须先确认**以下目录中是否已有等价实现：

```
apps/server/src/components/admin/shared/
  batch/          ← 批量操作：SelectionActionBar
  button/         ← 通用按钮：AdminButton
  dialog/         ← 弹窗：AdminDialogShell
  dropdown/       ← 下拉菜单/浮层：AdminDropdown
  feedback/       ← 反馈状态：AdminHoverHint、AdminTableState
  form/           ← 表单：AdminFormField、AdminInput、AdminSelect
  layout/         ← 页面骨架：AdminPageShell
  modal/          ← 模态框：AdminModal
  modern-table/   ← 表格体系：ModernDataTable、TableColumn、cells/
  table/          ← 旧表格辅助（逐步废弃中）：ColumnSettingsPanel*
  toolbar/        ← 工具栏：AdminToolbar
```

> \* `ColumnSettingsPanel` 正在被 `TableSettingsTrigger + useTableSettings` 替代（SEQ-20260328-42）

### 禁止行为

- ❌ 在业务页面内联实现已有共享组件的功能（如手写下拉菜单、手写分页）
- ❌ 新建并行实现后不更新此清单
- ❌ 同一功能存在 3 处以上重复使用时不提取为共享组件

---

## 后台交互设计原则（强制，Pipeline Overhaul 起适用于所有新后台页面）

> 优先级高于"最容易实现"，必须在方案选择阶段就纳入决策，不得在功能实现后以"后续优化"为由推迟。

### 核心原则：用户体验 > 实现便利

**每次选择交互方式时，必须问自己**：
> 这个方案是因为对用户最直观，还是因为对我最容易写？

如果答案是后者，必须重新评估，找到对用户更好的方案。

---

### 原则一：就地操作，避免跳页打断

用户在完成一项任务过程中，切换页面意味着丢失当前上下文（滚动位置、选中状态、筛选条件）。

| 场景 | ❌ 避免 | ✅ 优先选择 |
|------|--------|-----------|
| 编辑单条记录的少量字段 | 跳转到独立编辑页 | Inline 编辑（点击字段直接编辑）或侧滑 Drawer |
| 查看关联详情（如视频的源列表） | 跳转到源管理页 | 行展开 / 侧滑面板 |
| 填写简短补充信息（如拒绝原因） | 全屏表单页 | 行内展开 / 小型 Popover |
| 确认低风险操作 | `window.confirm()` 或独立确认页 | 行内 confirm chip（操作→确认两步）或 Undo Toast |

**例外**：编辑字段多（>8个）、需要复杂校验、或操作不可逆（删除/发布）→ 可用 Modal 或独立页面，但必须支持 Esc 关闭。

---

### 原则二：渐进披露，不堆砌信息

页面的信息密度应与用户当前的操作阶段匹配。默认只展示决策所需的最少信息，细节按需展开。

```
✅ 正确：列表 → 展开行 → 侧滑详情 → 深度编辑
   每一步只多展示用户已准备好消费的信息

❌ 错误：列表行包含20列字段、4个操作按钮、内嵌状态图表
   用户扫视成本极高，关键信息被噪音淹没
```

**具体规则**：
- 列表页默认展示列不超过 **7 列**（不含操作列）；其余列通过列设置面板按需显示
- 状态信息用 **badge / icon + 颜色** 代替长文字描述（3个字以内）
- 操作按钮超过 2 个时必须收进 `AdminDropdown`，主操作（最高频）单独露出
- 折叠块（Accordion）：默认展开第一块，其余折叠——不要把所有内容默认全展开

---

### 原则三：即时反馈，不让用户猜

操作发出后，用户必须在 **200ms 内** 看到视觉响应。不能让用户疑惑"我点了没有？"

```tsx
// ✅ 操作按钮：发出请求后立即进入 loading 态
const [loading, setLoading] = useState(false)
async function handlePublish() {
  setLoading(true)
  try {
    await apiClient.post(...)
    // 成功：更新行状态（乐观或重新拉取）
    toast.success('已发布')
  } catch {
    toast.error('发布失败，请重试')
  } finally {
    setLoading(false)
  }
}

// ❌ 无 loading 态，用户多次点击
async function handlePublish() {
  await apiClient.post(...)
}
```

**反馈层级**：
- **轻量成功**（如保存字段、切换开关）→ Toast（2秒自动消失）
- **重要完成**（如发布视频、批量操作）→ Toast（含数量，如"已发布 12 条"）
- **可撤销操作** → Toast + [撤销] 按钮（5秒窗口）
- **破坏性操作**（如拒绝、删除）→ inline confirm（不用 Modal）：操作按钮变为「确认拒绝？[是] [取消]」

---

### 原则四：状态可视化，用颜色和图标承载语义

状态字段（审核状态/源健康/豆瓣匹配）必须用视觉编码，不能只输出文字。

**后台状态 Badge 规范**：

| 状态语义 | 颜色变量 | 图标 | 示例文字 |
|---------|---------|------|---------|
| 成功 / 可达 / 已发布 | `--status-success`（绿） | `●` 或 `✓` | 已发布 / 3条可达 |
| 警告 / 部分 / 候选 | `--status-warning`（橙） | `⚠` 或 `?` | 部分可达 / 候选 |
| 错误 / 失效 / 阻塞 | `--status-danger`（红） | `✕` | 全部失效 / 阻塞 |
| 中性 / 待处理 / 未检验 | `--muted`（灰） | `○` | 未检验 / 待匹配 |
| 进行中 | `--status-info`（蓝） | 旋转 spinner | 同步中 |

```tsx
// ✅ 状态 badge 实现参考
function DoubanStatusBadge({ status }: { status: DoubanStatus }) {
  const config = {
    matched:   { color: 'var(--status-success)', icon: '✓', label: '已匹配' },
    candidate: { color: 'var(--status-warning)', icon: '?', label: '候选' },
    unmatched: { color: 'var(--status-danger)',  icon: '✕', label: '未匹配' },
    pending:   { color: 'var(--muted)',          icon: '○', label: '待检' },
  }[status]
  return (
    <span style={{ color: config.color }} className="flex items-center gap-1 text-xs">
      <span>{config.icon}</span>{config.label}
    </span>
  )
}
```

---

### 原则五：批量操作的交互模式

批量操作必须遵循"选择→确认→执行→反馈"的完整流程，不能让用户误触。

> **2026-05-01 修订（形态说明）**：
> - **server-next（当前真源）**：批量操作走 `DataTable.bulkActions` prop，渲染为**表内 sticky bottom**（`.dt__bulk`），由 DataTable 一体化管理。**不得**在 server-next 新模块外置独立 `SelectionActionBar` 浮条。
> - **apps/server v1（已冻结）**：批量操作仍使用外置 `SelectionActionBar variant="sticky-bottom"` 浮条形态（见下方描述），仅适用于 v1 维护期 bug 修复。
>
> 以下流程描述适用于 v1 外置形态；server-next 交互意图相同，但实现入口是 `DataTable.bulkActions`。

```
1. 选择阶段：
   - checkbox 列默认隐藏，鼠标悬停行时出现（或固定显示，取决于页面密度）
   - 选中任意一行后，页面底部出现 SelectionActionBar（sticky）
   - SelectionActionBar 显示：已选N条 + 可用批量操作按钮

2. 操作按钮设计：
   - 主要批量操作（如"批量发布"）：直接执行，Toast 确认
   - 高风险操作（如"批量拒绝"）：点击后 SelectionActionBar 内展开 inline 确认
     「确认拒绝 12 条？原因：[下拉] [确认] [取消]」—— 不弹 Modal

3. 执行反馈：
   - 成功：Toast「已对 N 条执行操作，M 条失败」+ 列表局部刷新
   - 失败项：保持选中状态，Toast 中显示失败原因摘要
```

---

### 原则六：空状态和错误状态不能是空白

每个数据列表/区块在加载中、空数据、请求失败三种状态下都必须有明确的 UI 呈现。

```tsx
// ✅ 三态处理
if (loading) return <TableSkeleton rows={5} />   // 骨架屏，不用 spinner 遮罩整个页面
if (error)   return <AdminTableState type="error" message="加载失败" onRetry={refetch} />
if (data.length === 0) return (
  <AdminTableState
    type="empty"
    message="暂无待审核视频"
    description="所有视频均已处理完毕"
    // 如有引导操作：
    action={{ label: '查看已审核', onClick: () => setTab('history') }}
  />
)
```

**骨架屏规则**：
- 首次加载用骨架屏（`animate-pulse` 占位块），不用全屏 Loading Spinner
- 分页切换、筛选条件变化用表格区域内的 loading overlay（半透明遮罩 + 小 spinner），不重置整个布局

---

### 原则七：侧滑 Drawer 使用规范

侧滑 Drawer 是"不离页查看/编辑详情"的标准模式，适用于字段数量适中（3-12个）的编辑场景。

```
✅ 适合 Drawer：
- 暂存队列的元数据编辑（标题/封面/分类/简介）
- 视频详情快览（含源列表、豆瓣信息）
- 审核历史单条详情

❌ 不适合 Drawer：
- 需要全屏布局的复杂表单（用独立编辑页）
- 内容超过一屏且无法分块的长表单
- 需要对比左右两个视图的场景（两栏布局更合适）
```

**Drawer 实现规范**：
- 宽度：`min(480px, 90vw)`，窄屏不超视口
- 打开动画：从右侧滑入，`transition: transform 200ms ease-out`
- 关闭方式：Esc / 点击遮罩 / 显式关闭按钮（三种都支持）
- 背景遮罩：`bg-black/40`，不阻止主列表的滚动
- 表单未保存时关闭：提示「有未保存更改，确认离开？[保留] [放弃]」——不允许静默丢失

---

### 原则八：键盘与快捷键

工作效率高的后台页面应支持键盘操作，减少鼠标依赖。

**必须支持**：
- `Tab` / `Shift+Tab`：焦点在表单字段间移动
- `Enter`：确认当前操作（表单提交、inline 编辑保存）
- `Escape`：取消/关闭浮层/Drawer/inline 编辑
- 列表选中行：`↑↓` 切换（审核台、补源结果列表等场景）

**推荐支持**（高频操作页面）：
- 审核台：`A` 通过暂存 / `P` 直接发布 / `R` 拒绝 / `←→` 切换视频（已有，保留）
- 表格：`Space` 勾选当前行

---

### 违反记录（每次评审时更新）

| 任务 | 违反原则 | 修复方案 | 状态 |
|------|---------|---------|------|
| _（执行过程中发现时在此记录）_ | | | |
