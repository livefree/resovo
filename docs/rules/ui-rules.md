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


> 适用范围：`src/components/`、`src/app/` 所有前端文件（前台 + 后台 + 系统页）
> AI 在编写任何前端组件前必须读取本文件

---

## 主题与颜色

### CSS 变量（必须使用，禁止硬编码）

前台与后台当前使用两套独立的 CSS 变量体系，均来自 `src/app/globals.css`。两套体系并存属于已知历史分叉，将在 token 层统一后收敛。在此之前，各区域必须使用对应体系内的变量，**不得跨体系混用，不得引入新的硬编码颜色值**。

#### 前台 CSS 变量（用于 `src/components/` 前台组件）

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

#### 后台 CSS 变量（用于 `src/components/admin/` 后台组件）

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

播放器相关组件在 `src/components/player/` 目录，有特殊规范：

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

**参考实现：** `src/components/admin/shared/dropdown/AdminDropdown.tsx`

### 禁止行为

- ❌ 新建浮层组件时绕过现有 `AdminDropdown` 等已封装实现（先确认有无可复用）
- ❌ 使用 `position: fixed` + `z-index` 直接在组件内定位（跳过 portal 导致堆叠问题）
- ❌ 在 `overflow: hidden` 容器内放置浮层（必须使用 portal 逃离边界）

---

## 后台共享组件边界规范

### 新建共享组件前的强制检查

在 `src/components/admin/shared/` 下新建任何组件之前，**必须先确认**以下目录中是否已有等价实现：

```
src/components/admin/shared/
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
