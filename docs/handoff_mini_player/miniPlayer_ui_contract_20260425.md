# MiniPlayer UI Contract

> 版本：1.0
> 日期：2026-04-25
> 状态：执行基准（HANDOFF-31 / 32 开工前必读）
> 产品决策来源：2026-04-24 用户确认
> 超出本文档范围的变更须先修订本文档，再修改代码

---

## 1. 存在时机与平台边界

| 条件 | 行为 |
|------|------|
| 用户在 `/watch` 页面 | MiniPlayer **不渲染**（PlayerShell 全权负责） |
| 用户离开 `/watch` 页面，已有播放历史 | `hostMode = 'mini'`，MiniPlayer 渲染 |
| `@media (hover: none) and (pointer: coarse)`（触控屏/移动端） | MiniPlayer **不 mount**；若已 mount 则立即 `closeHost()`（防止隐藏后台播放） |
| `takeoverActive = true` | `display: none`（护栏优先级最高） |

---

## 2. 几何规则

### 2.1 尺寸约束

```
宽度（width）：由用户 resize 决定，clamp [240px, 480px]，初始 320px，持久化
视频区高度（videoH）：width × (9/16)（始终维持 16:9）
```

| 状态 | 总高度 |
|------|--------|
| Collapsed | `videoH`（header 叠加在视频上方，不增加总高） |
| Expanded | `videoH + 44px`（控制栏附加在视频区正下方） |

### 2.2 Header 叠加模型

Header（32px）通过 `position: absolute; top: 0; left: 0; right: 0` 叠加在视频区顶部，**不占用容器高度**。

- **默认状态**：`opacity: 0; pointer-events: none`（不可见，不捕获事件）
- **Hover 主体时**：`opacity: 1; pointer-events: all`（transition 150ms ease）
- **Header 本身 hover**：保持 `opacity: 1`（hover 离开主体时需 200ms 延迟消失，防止鼠标移到 header 时闪烁）

视频区 flex 布局：
```
container (position: fixed, overflow: hidden)
  ├── video-area (position: absolute, inset: 0 0 0 0 for Collapsed; 0 0 44px 0 for Expanded)
  ├── header-overlay (position: absolute, top: 0, z-index: 2)
  └── controls-bar (position: absolute, bottom: 0, height: 44px; display: none when Collapsed)
```

### 2.3 dock 与 resize

- **吸附角**（corner）：存入 `MiniGeometryV1.corner`，值为 `'tl' | 'tr' | 'bl' | 'br'`
- **Viewport resize**：无论是否越界，只要 `corner` 有值，重新按 `(corner, margin=16px)` 计算 `left/top` 并写入 DOM
- **用户 resize 后**：
  - 重新计算 `videoH = width × (9/16)`
  - 更新容器高度（Collapsed: `videoH`；Expanded: `videoH + 44`）
  - 保持当前 corner 贴边（重新 dock 计算）
- **Collapsed ↔ Expanded 切换后**：保持当前 corner，重新计算 `top` 使容器仍贴边

---

## 3. Header 规格

### 3.1 布局

```
[返回按钮 28×28] [标题区 flex-1] [展开/折叠 28×28] [关闭 28×28]
←8px→  ←gap 6px→                  ←gap 6px→         ←8px→
```

- 整体 padding：`0 8px`
- 高度：`32px`
- 背景：`var(--player-mini-header-bg)`（半透明，见 token 表）
- 按钮间 gap：`6px`

### 3.2 标题区（flex-1）

- 最大宽度：`flex-1; min-width: 0`（自动填充剩余）
- 标题文字：单行 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- 字体：`12px / --fg-muted`
- 内容组合规则：

| 有标题 | 有集数 | 显示 |
|--------|--------|------|
| ✓ | ✓ | `标题 · 第N集` |
| ✓ | ✗ | `标题` |
| ✗ | — | `正在播放` |

### 3.3 按钮规格

| 按钮 | 图标 | `aria-label` | 行为 |
|------|------|-------------|------|
| 返回 | `←`（arrow-left svg，16×16） | `返回播放页` | `router.push(\`/${locale}/watch/${hostOrigin.slug}\`)` |
| 展开/折叠 | `▼`/`▲`（chevron，14×14） | `展开` / `折叠` | toggle `isExpanded` |
| 关闭 | `✕`（x svg，14×14） | `关闭播放器` | `pause → src='' → closeHost()` |

- 按钮样式：`width: 28px; height: 28px; border: none; border-radius: 4px; background: transparent; cursor: pointer`
- `color`：`var(--player-mini-btn-color)`
- `:hover`：`background: var(--player-mini-btn-hover-bg)`
- `:focus-visible`：`outline: 2px solid var(--accent-default); outline-offset: 1px`
- `:active`：`opacity: 0.7`
- 所有按钮：`onPointerDown={e => e.stopPropagation()}` 防止触发 drag

### 3.4 返回按钮 disabled 条件

`hostOrigin?.slug` 不存在时：`opacity: 0.4; pointer-events: none`

---

## 4. 视频区规格

### 4.1 布局

```
position: absolute
inset: 0 0 0 0（Collapsed）
inset: 0 0 44px 0（Expanded，为控制栏留出 44px）
background: var(--player-video-area-bg)
cursor: pointer
```

实际 `<video>` 元素：`position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain`

### 4.2 Hover / 状态 Overlay

所有 overlay 通过 `position: absolute; inset: 0 0 0(controls-adjusted) 0; z-index: 1` 叠加。

**播放/暂停图标 overlay**（`class="mini-video-overlay"`）

| 条件 | 显示 |
|------|------|
| 正在播放 + hover 视频区 | 半透明背景 + 40×40 pause 图标（居中） |
| 已暂停（无论 hover） | 半透明背景 + 40×40 play 图标（始终可见） |
| 正在播放 + 未 hover | 隐藏 overlay |

- 背景：`var(--player-mini-overlay-bg)`（`oklch(0% 0 0 / 0.40)`）
- 图标颜色：`var(--player-mini-overlay-icon)`（白色）
- 图标尺寸：40×40px
- 动画：`opacity` transition `150ms ease`（受 `--motion-scale` 驱动）

**加载中 overlay**（`data-testid="mini-loading"`）

- 居中显示 spinning circle（24px，`border: 2px solid var(--player-mini-overlay-icon); border-top-color: transparent`）
- 不显示播放/暂停图标

**错误 overlay**（`data-testid="mini-error"`）

```
居中 flex-col gap-8px：
  - 错误图标（⚠ 20px，var(--player-mini-danger-fg)）
  - 文案：'播放失败'（12px，var(--fg-muted)）
返回/关闭按钮仍可用（header hover 可触及）
```

**无播放源**（`src` 为 `null/undefined` 且非 loading）

- 不显示播放图标
- 中心显示：`暂无可用播放源`（12px，`var(--fg-muted)`）
- 不可点击触发播放（`cursor: default`）

**自动播放被阻止**（`autoplay-blocked`）

- 中心显示 40×40 play 图标（与暂停 overlay 同款）
- 文案：`点击播放`（10px，`var(--fg-muted)`），图标下方
- 点击触发 `video.play()`

### 4.3 点击行为

| 事件 | 条件 | 行为 |
|------|------|------|
| `click` | 有 src，非 loading，非 error | toggle play/pause |
| `click` | 无 src | 无动作 |
| `click` | 拖拽结束误触（pointerdown→pointermove→pointerup < 5px 视为 drag） | 忽略 |

拖拽判定：`pointerdown` 时记录坐标，`pointerup` 时若移动距离 < 5px 且 duration < 300ms 则为点击，否则为拖拽结束，不触发 play/pause。

---

## 5. 控制栏规格（Expanded 态）

### 5.1 布局

```
position: absolute; bottom: 0; left: 0; right: 0; height: 44px
display: flex; align-items: center; padding: 0 8px; gap: 8px
background: var(--player-mini-ctrl-bg)
```

| 区域 | 大小 | 内容 |
|------|------|------|
| 左 | 32×32 | play/pause 按钮 |
| 中 | flex-1 | 进度条 |
| 右 | ~80px | `mm:ss / mm:ss` + 静音按钮（24×24） |

### 5.2 Play/Pause 按钮

- 尺寸：32×32px，`border-radius: 4px`
- 图标：16×16 svg（play ▶ / pause ⏸）
- `aria-label`：`播放` / `暂停`
- `color: var(--player-mini-ctrl-fg)`
- `:hover background: var(--player-mini-btn-hover-bg)`
- `:focus-visible`: 同 header 按钮
- `disabled`（无 src 或 error 时）：`opacity: 0.4; pointer-events: none`

### 5.3 进度条

- **Track 高度**：4px（视觉），**可拖拽热区**：上下各扩展 6px（`padding: 6px 0`，总点击高度 16px）
- **Track 颜色**：`var(--player-mini-progress-track)`
- **已播 fill**：`var(--player-mini-progress-fill)`（accent 色）
- **Buffered**：`var(--player-mini-progress-buffer)`（介于 track 和 fill 之间）
- **拖拽时**：track 高度放大到 6px（scale 过渡 150ms）
- **duration 未知时**（`isNaN(duration)` 或 `duration === 0`）：进度条显示 `pointer-events: none; opacity: 0.4`（不可拖拽）
- **ARIA**：
  ```
  role="slider"
  aria-label="播放进度"
  aria-valuemin={0}
  aria-valuemax={Math.round(duration) || 0}
  aria-valuenow={Math.round(currentTime)}
  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
  tabIndex={0}
  ```
- 键盘：`←/→` 步进 5s，`Home` 归 0，`End` 跳结尾

### 5.4 时间显示

- 格式：`mm:ss`（不足 1 小时）；`h:mm:ss`（≥ 1 小时）
- duration 未知：显示 `--:--`
- 组合：`currentTime / duration`，字体 `11px var(--player-mini-ctrl-fg)`，`min-width: 72px; text-align: center`

### 5.5 静音按钮

- 尺寸：24×24px
- 图标：16×16 svg（有声 🔊 / 静音 🔇）
- `aria-label`：`静音` / `取消静音`
- 行为：仅 toggle `video.muted`（不显示音量 slider，设备音量控制交给系统）
- `color: var(--player-mini-ctrl-fg)`

---

## 6. 折叠/展开切换

| 属性 | 规则 |
|------|------|
| 默认状态 | Collapsed |
| 持久化 | `isExpanded` **不持久化**，每次 mount 从 Collapsed 开始 |
| 切换动画 | 容器 `height` transition `200ms ease`（受 `--motion-scale` 驱动） |
| 切换后 dock | 保持当前 corner，根据新高度重新计算 `top`（防止超出 viewport） |
| Expanded 时控制栏状态 | 保持（播放状态、进度、静音不重置） |
| resize 后 Expanded | `videoH` 重新按宽度算，控制栏仍固定 44px，容器高度更新 |

---

## 7. 错误与空状态汇总

| 状态 | 触发条件 | 视频区显示 | 可用操作 |
|------|---------|-----------|---------|
| 无播放源 | `src` 为 null/undefined，非加载中 | `暂无可用播放源`（文案居中） | 返回、关闭 |
| 加载中 | `readyState < 3` 且 `src` 有值 | spinner | 返回、关闭 |
| 播放失败 | `video error` 事件 | `播放失败` + ⚠ | 返回、关闭 |
| 自动播放被阻止 | `play()` 抛出 `NotAllowedError` | play 图标 + `点击播放` | 点击播放、返回、关闭 |
| 视频已下架 | API 返回 404 | `视频已下架` | 关闭 |

所有错误状态下：
- 播放/暂停按钮（控制栏）：`disabled`
- 进度条：不可拖拽
- 返回/关闭按钮：始终可用

---

## 8. Token 映射表

所有 MiniPlayer 颜色通过以下 token 消费，**禁止内联颜色字面量**。

| Token | 用途 | 推荐值（添加到 globals.css HANDOFF-31 区块） |
|-------|------|------|
| `--player-mini-bg` | 容器背景 | `var(--bg-canvas)` |
| `--player-mini-border` | 容器边框 | `var(--border-default)` |
| `--player-mini-shadow` | 容器阴影 | （已存在） |
| `--player-mini-header-bg` | Header 背景（半透明） | `oklch(from var(--bg-surface) l c h / 0.92)` 或 `color-mix(in oklch, var(--bg-surface) 92%, transparent)` |
| `--player-mini-btn-color` | Header/控制栏按钮颜色 | `var(--fg-muted)` |
| `--player-mini-btn-hover-bg` | 按钮 hover 背景 | `color-mix(in oklch, var(--fg-default) 8%, transparent)` |
| `--player-mini-overlay-bg` | 视频区 hover/pause 遮罩背景 | （已存在，`oklch(0% 0 0 / 0.40)`） |
| `--player-mini-overlay-icon` | overlay play/pause 图标颜色 | `oklch(100% 0 0)` |
| `--player-mini-chip-bg` | （已存在，Phase 3 重命名可选） | — |
| `--player-mini-chip-fg` | （已存在，Phase 3 重命名可选） | — |
| `--player-mini-ctrl-bg` | 控制栏背景 | `color-mix(in oklch, var(--bg-canvas) 95%, transparent)` |
| `--player-mini-ctrl-fg` | 控制栏文字/图标 | `var(--fg-muted)` |
| `--player-mini-progress-track` | 进度条 track | `color-mix(in oklch, var(--fg-default) 20%, transparent)` |
| `--player-mini-progress-fill` | 进度条已播区域 | `var(--accent-default)` |
| `--player-mini-progress-buffer` | 进度条已缓冲区域 | `color-mix(in oklch, var(--fg-default) 40%, transparent)` |
| `--player-mini-danger-fg` | 错误状态图标/文字 | `var(--color-danger, oklch(55% 0.2 25))` |

---

## 9. 可访问性

### 9.1 键盘 Tab 顺序

```
[返回按钮] → [展开/折叠按钮] → [关闭按钮] → [进度条 slider] → [Play/Pause 按钮] → [静音按钮]
```

Header 按钮在 `opacity: 0` 时仍需设 `tabIndex={-1}`（不参与 Tab）；`opacity: 1` 时恢复 `tabIndex={0}`。

### 9.2 键盘行为

| 键 | 焦点位置 | 行为 |
|----|---------|------|
| `Escape` | 任意 | `closeHost()` |
| `Space` / `Enter` | 视频区容器 | toggle play/pause |
| `←` / `→` | 进度条 | 步进 ±5s |
| `Home` | 进度条 | 跳到 0 |
| `End` | 进度条 | 跳到 duration |
| `m` | 任意 | toggle mute |

### 9.3 ARIA

```tsx
// 容器
<div role="region" aria-label="迷你播放器" ...>

// 返回按钮（无 slug 时）
<button aria-label="返回播放页" aria-disabled={!hostOrigin?.slug} ...>

// 展开按钮
<button aria-label={isExpanded ? '折叠' : '展开'} aria-expanded={isExpanded} ...>

// 进度条
<div
  role="slider"
  aria-label="播放进度"
  aria-valuemin={0}
  aria-valuemax={Math.round(duration) || 0}
  aria-valuenow={Math.round(currentTime)}
  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
  tabIndex={0}
>
```

### 9.4 焦点环

所有可交互元素：
```css
:focus-visible {
  outline: 2px solid var(--accent-default);
  outline-offset: 1px;
  border-radius: 4px;
}
```

---

## 10. 移动端与响应式

```tsx
// 在 MiniPlayer 组件顶层
useEffect(() => {
  const mq = window.matchMedia('(hover: none) and (pointer: coarse)')
  if (mq.matches) {
    closeHost()
    return
  }
  const handler = (e: MediaQueryListEvent) => {
    if (e.matches) closeHost()
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [closeHost])
```

CSS 侧双保险：
```css
@media (hover: none) and (pointer: coarse) {
  [data-mini-player] { display: none !important; }
}
```

---

## 11. 验收测试要求

### 11.1 视觉快照（或手动截图）

| 场景 | 说明 |
|------|------|
| Collapsed / 暂停 / 未 hover | 只见视频画面（黑屏或封面帧），无 chrome |
| Collapsed / 暂停 / hover | header 出现，play overlay 可见 |
| Collapsed / 播放中 / hover | header 出现，pause overlay 可见 |
| Collapsed / 播放中 / 未 hover | 只见视频，无 chrome |
| Expanded / 播放中 | header（hover 时）+ 视频 + 控制栏 |
| Loading | spinner overlay |
| Error | ⚠ + 文案，返回/关闭可用 |
| 无播放源 | 文案，无播放按钮 |

### 11.2 e2e 几何断言（Playwright）

```
- MiniPlayer 渲染后，容器 bottom ≤ viewport.height - 16（不超出底部）
- MiniPlayer 渲染后，容器 right ≤ viewport.width - 16（不超出右侧）
- 拖拽到左上角后，left 约等于 16，top 约等于 16（±4px 容差）
- viewport resize 到 1024px 后，容器仍贴角（right ≤ viewport.width - 12）
- Expanded 状态下容器高度 = videoH + 44（±1px）
```

### 11.3 可访问性断言

```
- 容器存在 role="region" aria-label="迷你播放器"
- 进度条存在 role="slider" aria-valuenow / aria-valuemax / aria-valuetext
- 返回按钮 aria-label="返回播放页"
- Esc 键触发关闭（playerStore.hostMode → 'closed'）
```

---

## 12. 本文档不包含的内容

以下在 HANDOFF-32 或 Phase 3 后期处理，不在 HANDOFF-31 范围：

- FLIP full↔mini 过渡动画
- Resize handle 方向感知（按吸附角选对角 handle）
- Safe area / tabbar 高度避让
- 完整 sessionStorage 持久化协议（时间戳/音量/线路）
- PiP 边界清理（HANDOFF-32 范围）
