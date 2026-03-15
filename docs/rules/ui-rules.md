# Resovo（流光） — 前端组件规范

> 适用范围：`src/components/`、`src/app/` 所有前端文件
> AI 在编写前端组件前必须读取本文件

---

## 主题与颜色

### CSS 变量（必须使用，禁止硬编码）

```css
/* 背景层级 */
--bg          /* 页面底色 */
--bg2         /* 卡片/容器背景 */
--bg3         /* 输入框/次级容器背景 */
--bg4         /* 弹出层背景 */

/* 文字 */
--text        /* 主文字 */
--muted       /* 次要文字、占位符 */

/* 边框 */
--border      /* 标准边框 */
--subtle      /* 分隔线 */

/* 强调色 */
--accent      /* 金色主题色，深色：#e8b84b，浅色：#b8720a */
```

### 主题切换
```tsx
// ✅ 正确：使用 CSS 变量
<div style={{ color: 'var(--text)', background: 'var(--bg2)' }}>

// 或 Tailwind + CSS 变量
<div className="bg-[var(--bg2)] text-[var(--text)]">

// ❌ 错误：硬编码颜色
<div style={{ color: '#e8e6e1', background: '#17171e' }}>
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
