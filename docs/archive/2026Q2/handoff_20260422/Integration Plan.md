# Resovo 前端落地方案

本文配合 `Token Audit.md` / `Motion Spec.html` / `Global Shell.html` 使用。面向开发者，描述如何把设计稿稳定地推进到 `livefree/resovo` 代码库。

---

## 1. 仓库现状

```
resovo/
├── apps/
│   ├── web/          Next.js PC + 移动端 web
│   └── native/       React Native（iOS/Android）
└── packages/
    ├── design-tokens/      ← 本次 4 组补丁的落地点
    ├── ui-web/             ← PC/移动 web 组件库
    ├── ui-native/          ← RN 组件库
    └── features/           ← 业务组件（PlayerShell / PosterCard / Takeover 等）
```

token 由 `design-tokens` 导出 TS 对象 + 生成 `tokens.css`（web）和 StyleSheet fragment（native），两端共同消费。

---

## 2. 分支策略（4 个 PR，按顺序合）

### PR-1 `feat/tokens-v2-additions`（≈ 1 天）

**目标**：补齐 tokens，不碰任何消费端。

- `packages/design-tokens/src/semantic/tag.ts` → 追加 10 条 chip 字段（参见 Audit §2.1）
- `packages/design-tokens/src/semantic/pattern.ts` → 新文件（参见 Audit §2.2）
- `packages/design-tokens/src/semantic/route-transition.ts` → 新文件（参见 Audit §2.4）
- `packages/design-tokens/src/components/player.ts` → 扩展 `mini` 字段（参见 Audit §2.3）
- `packages/design-tokens/src/primitives/shadow.ts` → 追加 `cardHover`
- `packages/design-tokens/src/semantic/index.ts` → 新增 2 条 export
- `packages/design-tokens/src/build-css.ts` → 白名单若有，需加入 `pattern` / `routeTransition` / 新 `mini` 字段

**顺带修** Bug：`lifecycleDеlisting*`（西里尔 е）→ `lifecycleDelisting*`（拉丁 e）。grep 全仓确认没有消费端引用了错误拼写。

**验收**：
- `pnpm --filter @resovo/design-tokens build` 成功
- `tokens.css` diff 只有新增变量，无删改
- CI 的 `scripts/validate-tokens.ts` 通过
- Storybook 里 token 展示页能看到新变量

### PR-2 `feat/miniplayer-shell`（≈ 2 天）

**目标**：B 站风 MiniPlayer + 全局 PlayerShell。

- `packages/features/PlayerShell/` — 新增 `MiniPlayer.tsx` + `MiniPlayer.module.css`
- `packages/features/PlayerShell/index.tsx` — 维护 `<video>` 单例，三态（full/mini/pip）仅切换容器 DOM，不重建媒体源
- `apps/web/app/layout.tsx` — 挂载 `<PlayerShell />` 到 body 层（z-index 1700）
- state：Zustand store `usePlayerStore`（currentMedia, mode, position, size）

**交互细节**（参见 `Global Shell.html` 源码）：
- 拖拽：`pointerdown` 顶部 32px 条 → 记录 offset → `pointermove` 改 `left/top` → `pointerup` 吸附
- 吸附：松手时计算到 4 个角的距离，最近的那个 snap（`transition` spring 260ms）
- 缩放：右下 16×16 柄 → 240–480px 宽，保持 16:9
- 关闭：✕ 按钮 → store.mode = 'hidden'；x 秒 localStorage 持久化位置
- **视频源不变**：mini → full 用 `document.body.appendChild()` 移动同一 `<video>` 节点，进度不重置

**验收**：
- 浏览页点任意卡片进入 /watch，返回列表 → 自动 minimize 为浮窗
- 浮窗内播放不中断，可继续拖/缩/关
- 浮窗位置刷新页面后保持
- 屏幕尺寸变化时 snap 到最近合法位置

### PR-3 `feat/route-transitions`（≈ 1 天）

**目标**：PC fade/slide + 移动 route-stack 侧滑 + shared element。

- `apps/web/lib/transitions/` — 新增 3 个 hooks：`useFadeTransition`、`useSlideTransition`、`useSharedElement`
- 共享元素用 View Transitions API（Chrome 111+，Safari 18+），fallback 用 FLIP
- 移动端 route-stack 用现有 `framer-motion` 的 `AnimatePresence` + 手势库（`@use-gesture/react` 已在 deps）
- reduced-motion：所有 duration 从 token 读 `routeTransition.reducedDuration`（80ms）

### PR-4 `feat/background-patterns-and-chips`（≈ 0.5 天）

**目标**：消费 tokens 补丁的两处小改动。

- `packages/ui-web/AppShell/AppShell.tsx` — 增加 `pattern` prop: `"dots" | "grid" | "noise" | "none"`
- `packages/ui-web/Tag/ChipType.tsx` — 新组件，入参 `type: "movie" | "series" | "anime" | "tvshow" | "doc"`
- VideoCard 里把原先 hardcoded 的类型 badge 替换成 `<ChipType>`

---

## 3. 文件清单（代码改动快查）

### 新增文件
```
packages/design-tokens/src/semantic/pattern.ts
packages/design-tokens/src/semantic/route-transition.ts
packages/features/PlayerShell/MiniPlayer.tsx
packages/features/PlayerShell/MiniPlayer.module.css
packages/features/PlayerShell/usePlayerStore.ts
packages/ui-web/Tag/ChipType.tsx
apps/web/lib/transitions/useFadeTransition.ts
apps/web/lib/transitions/useSlideTransition.ts
apps/web/lib/transitions/useSharedElement.ts
```

### 修改文件
```
packages/design-tokens/src/semantic/tag.ts        +10 chip fields × 2 themes, bugfix 西里尔 е
packages/design-tokens/src/components/player.ts   +12 mini fields
packages/design-tokens/src/primitives/shadow.ts   +1 cardHover
packages/design-tokens/src/semantic/index.ts      +2 export
packages/design-tokens/src/build-css.ts           加字段白名单（若需要）
packages/ui-web/AppShell/AppShell.tsx             +pattern prop
packages/ui-web/VideoCard/VideoCard.tsx           替换 type badge 为 ChipType
apps/web/app/layout.tsx                           挂载 <PlayerShell/>
```

---

## 4. 技术要点

### 4.1 MiniPlayer 视频源不中断

关键：**同一 `<video>` DOM 节点在不同容器间移动**，React 的 portal 解决不了（会 unmount）。做法：

```tsx
// PlayerShell 根层
<div id="player-full" />
<div id="player-mini" />
<div id="player-pip-unused" />

// 维护 video ref 和一个 mount 函数
useEffect(() => {
  const video = videoRef.current
  const target = document.getElementById(`player-${mode}`)
  if (video && target && video.parentElement !== target) {
    target.appendChild(video)   // 不 unmount，仅移动
  }
}, [mode])
```

### 4.2 吸附算法（B 站风）

**总是吸附**，而不是仅在阈值内吸附。浮窗永远贴四个角之一。这更符合用户的空间记忆：

```ts
function nearestCorner(left, top, w, h) {
  const m = 16
  const corners = [
    { left: m, top: m },                                 // tl
    { left: innerWidth - w - m, top: m },                // tr
    { left: m, top: innerHeight - h - m },               // bl
    { left: innerWidth - w - m, top: innerHeight - h - m }, // br
  ]
  return corners.reduce((best, c) =>
    hypot(c.left - left, c.top - top) < hypot(best.left - left, best.top - top) ? c : best
  )
}
```

### 4.3 View Transitions 回退

Safari < 18 / Firefox 没有 `document.startViewTransition`。用特性检测：

```ts
if (document.startViewTransition) {
  document.startViewTransition(() => navigate(href))
} else {
  // FLIP fallback：记录 from rect → navigate → 记录 to rect → transform animate
  flipTransition(heroPoster, () => navigate(href))
}
```

---

## 5. 验收清单（交付给 QA）

### Tokens
- [ ] `tokens.css` 包含 §5 全部 30 条新变量
- [ ] 所有新变量 light / dark 都有值
- [ ] 西里尔字母 bug 修复，grep 全仓 `lifecycleDеlisting` 返回空

### MiniPlayer
- [ ] /watch minimize → 右下角 spring pop-in，默认 320×180
- [ ] 拖拽顶部条移动流畅（60fps）
- [ ] 松手吸附到最近角，动画 260ms spring
- [ ] 右下缩放柄 240–480px，保持 16:9
- [ ] ✕ 关闭，位置 localStorage 持久化
- [ ] 主视图 ⇄ 浮窗切换，视频不 reload 不跳进度
- [ ] z-index 在全站最高（高于 Takeover）
- [ ] 移动端不显示浮窗（改用 tabbar 区域的 docked bar，本次范围外）

### 路由过渡
- [ ] PC 同层切换 fade 200ms
- [ ] PC 海报 → 详情 shared element 360ms
- [ ] Mobile push 240ms，左滑 20px 触发返回
- [ ] `prefers-reduced-motion: reduce` 全退化为 80ms

### 背景
- [ ] AppShell `pattern="dots" | "grid" | "noise"` 正确生效
- [ ] dark 主题下 pattern 对比度合理（见 Global Shell.html）

### 类型 chip
- [ ] 5 种类型颜色清晰可辨
- [ ] light / dark 都有足够对比度（> 4.5:1）
- [ ] 色盲模拟下仍可辨（靠位置和文字，不仅靠色）

---

## 6. 时间估算

| PR | 内容 | 估时 |
|---|---|---|
| PR-1 | Tokens 补齐 + bugfix | 1 d |
| PR-2 | MiniPlayer + PlayerShell | 2 d |
| PR-3 | Route transitions | 1 d |
| PR-4 | Pattern + ChipType | 0.5 d |
| QA | 全量走查 | 0.5 d |
| **合计** | | **5 d** |

---

## 7. 风险

- **View Transitions 兼容**：Firefox 至今（2026.04）仍无 stable 支持。FLIP 回退必须测。
- **移动端浮窗策略**：iOS Safari 的 PiP API 只对原生 `<video>` 生效，Resovo 自定义控件会失效。移动端建议**不做浮窗**，仅在 tabbar 上方显示一条 docked mini bar（类似 Spotify）—— 这条在本次范围之外，建议单开 issue。
- **token build 脚本白名单**：如果 `build-css.ts` 是硬编码字段列表，新增的 `pattern.*` / `routeTransition.*` / `player.mini.*` 新字段需手动加入，否则不会生成 CSS 变量。建议这一版顺手改成扁平递归。
- **Takeover 与 MiniPlayer 冲突**：全屏 Takeover 进入时应隐藏 MiniPlayer（避免浮窗盖在全屏遮罩上）。store 里加 `takeoverActive` 标志位。

---

## 8. 跟进事项

- 移动端 docked MiniBar 设计（本次 scope 外，建议 v2.1）
- TV/车机端外壳（本次 scope 外）
- 多语言字体 fallback（中文 / 日文 / 韩文的 PingFang / Hiragino / AppleSD 排期）
- 视频广告插入点的外观（本次 scope 外）
