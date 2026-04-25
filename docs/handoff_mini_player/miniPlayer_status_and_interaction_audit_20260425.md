# MiniPlayer Status and Interaction Audit

> 日期：2026-04-25
> 状态：现状归档 / 问题审计
> 范围：`apps/web-next` MiniPlayer、GlobalPlayerHost、playerStore、route-player-sync、相关测试
> 关联：`miniPlayer_ui_contract_20260425.md`、ADR-054、HANDOFF-31 / HANDOFF-32

---

## 1. 当前结论

MiniPlayer 已从早期占位版推进到桌面浮窗 V1：

- 已有真实 `<video>` 元素、独立 `useMiniPlayerVideo()` hook、Header/Controls 拆分。
- 已接入 `GlobalPlayerHost` Portal 和 `playerStore.hostMode` 三态宿主模型。
- 已支持桌面端 fixed 浮窗、拖拽、缩放、四角吸附、localStorage 几何持久化。
- 已支持基础播放/暂停、静音、进度条 seek、autoplay-blocked 状态、loading/error/no-src overlay。
- 已实现移动端业务关闭防护：触控设备匹配时调用 `releaseMiniPlayer()`，CSS `display:none` 仅作视觉双保险。
- 已接受 ADR-054 限制：MiniPlayer v1 不做 `<video>` 跨容器 lift，full/mini 切换允许重建 `<video>`，通过进度恢复兜底。

但 MiniPlayer 还不能视为交互闭环完成。主要问题集中在 full 播放器状态同步、HLS 播放能力、全局快捷键作用域、返回 `/watch` 的切换时序、seek 后进度保存、E2E 稳定性和 UI Contract 细节偏差。

---

## 2. 已落地能力

### 2.1 宿主与路由

- `GlobalPlayerHost` 根据 `hostMode` 渲染：
  - `full` -> `GlobalPlayerFullFrame`
  - `mini` -> `MiniPlayer`
  - `pip` -> hidden `PipSlot`
- `RoutePlayerSync` 在离开 `/watch` 时尝试根据离开前播放状态决定进入 mini 或关闭。
- `/watch` 页面内由 `PlayerShell` 直接渲染 full player，`GlobalPlayerFullFrame` 在 watch 路由上返回 null，避免 fixed 全屏层覆盖页面。

### 2.2 MiniPlayer UI

- 容器使用 `position: fixed`，几何来源为 `playerStore.geometry ?? MINI_GEOMETRY_DEFAULTS`。
- collapsed 高度为 `width * 9 / 16`；expanded 高度为 `videoH + 44px`。
- Header overlay 默认透明、hover 后可见；按钮包含返回、展开/折叠、关闭。
- Expanded 控制栏包含 play/pause、进度条、时间、静音。
- 颜色基本通过 `--player-mini-*` token 消费。

### 2.3 视频逻辑

- `useMiniPlayerVideo()` 独立请求 `/videos/:shortId/sources?episode=N`。
- `activeSourceIndex` 越界时 fallback 到第一条源。
- `timeupdate` 以 250ms 节流写入 `playerStore.currentTime` 与 `saveProgress()`。
- `loadedmetadata` 时尝试恢复 `playerStore.currentTime`。
- autoplay 语义已实现为 best-effort，`NotAllowedError` 转为 `autoplay-blocked`。

### 2.4 关闭与清理

- `handleClose()` 执行：
  - `video.pause()`
  - `video.src = ''`
  - `releaseMiniPlayer()`
- `releaseMiniPlayer()` 清理 `shortId/currentTime/duration/isPlaying/activeSourceIndex`，然后 `closeHost()` 清 sessionStorage。

### 2.5 测试现状

已通过：

```bash
npm run test:run -- tests/unit/web-next/MiniPlayer.test.tsx tests/unit/web-next/mini-geometry.test.ts
```

结果：2 个测试文件通过，53 条用例通过。

已通过：

```bash
npm --workspace @resovo/web-next run typecheck
```

未通过：

```bash
npm run test:e2e -- --project=web-chromium tests/e2e-next/mini-player.spec.ts
```

结果：8 failed / 1 flaky / 2 passed。失败主要发生在 `page.goto('/')` 或 `page.reload()` 等待 `load` 超时，页面 snapshot 已渲染，失败点多发生在 MiniPlayer 行为断言之前。当前更像 E2E harness 等待策略或页面长期 pending 资源问题，但它仍然阻断了 MiniPlayer 浏览器级回归闭环。

---

## 3. 交互问题清单

### P0-1. 播放中离开 `/watch` 可能不会进入 MiniPlayer

`RoutePlayerSync` 依赖 `playerStore.isPlaying` 判断离开 `/watch` 时切 `mini` 还是 `closed`。但 full player 侧没有稳定把 play/pause 同步进 store：

- `PlayerShell` 只在 `onEnded` 时调用 `setPlaying(false)`。
- `VideoPlayer` / `@resovo/player-core` 的 public props 当前没有 `onPlay/onPause` 回调。
- 因此用户在 full 播放器里实际播放时，`playerStore.isPlaying` 可能仍为 false。

影响：

- 主路径“播放中离开页面自动浮窗”可能直接失败，离开页面后关闭播放器。
- MiniPlayer 的 autoplay 语义也依赖 `isPlayingStore` 快照，源头状态错会继续传导。

建议：

- 给 `player-core` 增加 `onPlayChange` 或 `onPlay/onPause` 回调。
- `PlayerShell` 在 full player 播放/暂停时同步 `playerStore.setPlaying()`。
- 为“播放中离开 `/watch` -> mini 可见”增加真实浏览器 E2E。

### P0-2. MiniPlayer 不复用 HLS 加载链路，`.m3u8` 源可能不可播

full player 通过 `player-core/useSourceLoader` 支持：

- 原生 HLS
- `hls.js` fallback
- HLS fatal error 处理

MiniPlayer 当前直接执行 `video.src = activeSrc`，没有 HLS fallback。桌面 Chrome 不原生支持大多数 `.m3u8`，如果线上源以 HLS 为主，MiniPlayer 可能无法播放。

影响：

- full player 可播，mini 不可播，播放能力不一致。
- 用户离开 `/watch` 后看到 loading/error，误以为源失效。

建议：

- 短期：在 MiniPlayer hook 中抽取/复用 `useSourceLoader` 等价能力，至少支持 `.m3u8 + hls.js`。
- 中期：推进 ADR-054 的 video lift，让 full/mini 共用同一个 video/source-loader 实例。

### P1-1. 全局快捷键作用域过宽

MiniPlayer mount 后在 `document` 上监听：

- `Escape` -> close
- `m/M` -> toggle mute

当前没有检查事件目标是否在 `input/textarea/select/contenteditable`，也没有处理 Settings/Search/Dialog 等浮层优先级。

影响：

- 用户在搜索框输入 `m` 可能触发静音。
- 设置抽屉或其他弹窗打开时按 `Escape` 可能关闭播放器，而非关闭当前浮层。

建议：

- 增加 `isEditableTarget()` 守卫。
- 只在事件未被上层浮层消费时处理。
- 对 `Escape` 建立浮层优先级：modal/drawer/search > mini player。

### P1-2. 返回 `/watch` 存在短暂双实例/时序竞争

MiniPlayer 的返回按钮只执行 `router.push('/{locale}/watch/{slug}')`。`hostMode: mini -> full` 依赖 `/watch` 页面 mount 后 `useWatchSlugSync()` effect 再执行。

影响：

- WatchPage 的 `PlayerShell` 可能先渲染，MiniPlayer 仍短暂存在。
- 可能出现双 `<video>`、音频跳接、状态互相覆盖。

建议：

- 返回按钮点击时先执行显式过渡动作，例如 `setHostMode('full', hostOrigin)`，再 `router.push()`。
- 或为返回动作增加一个 `returningToWatch` 护栏，避免 WatchPage full player 与 MiniPlayer 并行过渡。

### P1-3. Mini seek 后不立即写 store/progress

进度条 seek handler 只设置 `video.currentTime`。`playerStore.currentTime` 与 `saveProgress()` 需要等待下一次 `timeupdate`。

影响：

- 用户拖动进度后立即返回 `/watch`，可能恢复到旧时间。
- 用户拖动进度后立即关闭，最后位置可能丢失。

建议：

- `seekFromPointer()` 计算出 next time 后立即：
  - 更新本地显示时间
  - `setCurrentTime(next)`
  - `saveProgress(shortId, episode, next)`
- 键盘 seek 同样立即落盘。

### P1-4. Mini 与 full 的播放设置不连续

当前 mini 主要继承：

- `shortId`
- `currentEpisode`
- `activeSourceIndex`
- `currentTime`
- `isPlaying`

未继承或未同步：

- muted
- volume
- playbackRate
- subtitles
- quality
- poster/title

影响：

- 用户在 full 中设置静音/倍速/字幕后，切到 mini 状态丢失。
- 返回 full 后也可能出现设置不一致。

建议：

- 短期把 muted、volume、playbackRate 纳入 `playerStore` 或 session state。
- 字幕/quality 可随 v2.1 video lift 一并统一。

### P1-5. Expanded 几何与拖拽/吸附高度存在不一致风险

MiniPlayer render 时 expanded 高度为 `videoH + 44px`。但 drag/resize 的持久化几何模型只存 `width/height/corner`，其中 `height` 是视频高度。`drag.ts` 在 `commitDrag()` / `commitResize()` / viewport resize 时用 `getGeometry()` 计算 dock position，可能没有纳入 expanded 的额外 44px。

影响：

- Expanded 状态吸附底部角时，底边可能超出 margin。
- viewport resize 后 expanded 高度可能短暂错位。

建议：

- drag attach options 增加 `getEffectiveHeight()` 或 `getIsExpanded()`。
- 所有 dock 计算使用 effective height。
- E2E 增加 expanded + bottom corner 的断言。

### P2-1. 错误状态语义过粗

拉源失败 `.catch()` 当前进入 `no-src`，不是 `error`。视频不存在、接口失败、网络失败、无 active source 目前难以区分。

影响：

- 用户看到“暂无可用播放源”，但真实原因可能是网络/API 错误。
- 运维和排障信号弱。

建议：

- 区分：
  - `no-src`
  - `source-fetch-error`
  - `video-error`
  - `not-found`
- UI 文案分别处理。

### P2-2. Header 文案未达到 UI Contract

Contract 要求标题区显示：

- `标题 · 第N集`
- `标题`
- `正在播放`

当前实现只有：

- `shortId ? '正在播放' : '迷你播放器'`

影响：

- 多个视频之间缺少明确识别。
- 用户悬浮 mini 时看不到正在播放的具体内容。

建议：

- MiniPlayer 拉取视频 detail 或复用已有 store 中的 title。
- 对多集视频展示当前集数。

### P2-3. 控制栏缺 buffered 显示

Contract 要求 progress track 包含 buffered 层。当前控制栏只显示已播 fill。

影响：

- 用户无法判断缓冲范围。
- 与 full player 体验不一致。

建议：

- hook 监听 `progress` 事件，记录 buffered end。
- Controls 增加 buffered layer。

### P2-4. 纯键盘可访问性不完整

Header 按钮在 header 不可见时 `tabIndex=-1`，但键盘用户没有可靠方式让 header visible。容器本身也没有明确 keyboard focus/Space/Enter toggle play 的完整路径。

影响：

- 纯键盘用户可能无法返回、展开、关闭。
- Contract 中的 keyboard order 不能稳定达成。

建议：

- 容器 `tabIndex=0`。
- focus within 时强制 header visible。
- Space/Enter 在 video area/container 上 toggle play。
- 增加 keyboard-only 单测。

### P2-5. E2E 文件含非 MiniPlayer 主题测试，职责混杂

`tests/e2e-next/mini-player.spec.ts` 包含 `?_theme=` query 测试。该测试与 MiniPlayer 行为无关，当前也随 MiniPlayer E2E 一起失败。

影响：

- MiniPlayer 回归信号被主题测试污染。
- 排障时难以判断失败归属。

建议：

- 将 theme query 用例移到独立 `theme-query.spec.ts`。
- MiniPlayer spec 只保留 mini 相关行为。

---

## 4. 文档与实现偏差

### 4.1 UI Contract 的存在时机与实现不一致

Contract 写法：

- 离开 `/watch` 页面，已有播放历史 -> `hostMode = 'mini'`

当前实现：

- 仅当离开前 `isPlaying === true` 时进入 mini。
- 暂停状态离开则关闭。

需要确认这是产品决策变更，还是实现偏差。若接受当前行为，应修订 contract；若 contract 为准，应调整 `RoutePlayerSync`。

### 4.2 README 已过时

`apps/web-next/README.md` 仍写 MiniPlayer 无真实视频画面。当前 HANDOFF-32 已接入真实 `<video>`，README 应更新，否则会误导后续开发。

### 4.3 E2E 注释过时

`tests/e2e-next/mini-player.spec.ts` 顶部仍描述“展开按钮 -> hostMode='full'”，但当前产品语义已改为 mini 内部 expanded/collapsed，返回 full 由返回按钮负责。

---

## 5. 建议后续拆分

### Fix A：MiniPlayer 主路径可用性

优先级：P0

- 给 `player-core` 增加 play/pause 状态回调。
- `PlayerShell` 同步 full 播放状态到 store。
- MiniPlayer 支持 HLS。
- 增加真实 E2E：播放中离开 `/watch` -> mini 可见并继续播放/或 autoplay blocked。

### Fix B：交互一致性

优先级：P1

- 修全局快捷键作用域。
- 修返回 `/watch` 时序。
- seek 后立即写 store/progress。
- expanded 状态 dock 使用 effective height。

### Fix C：体验与可访问性

优先级：P2

- Header 显示标题和集数。
- buffered progress。
- focus-visible / keyboard-only 路径。
- 错误状态细分。

### Fix D：测试与文档清理

优先级：P1

- 修 E2E `page.goto/page.reload` 等待策略，避免依赖 `load`。
- 将 theme query 测试移出 MiniPlayer spec。
- 更新 `apps/web-next/README.md` 和 E2E 注释。
- 为上述 P0/P1 交互补单元和 E2E。

---

## 6. 当前风险判断

| 风险 | 等级 | 判断 |
|------|------|------|
| 播放中离开 `/watch` 无法稳定进入 mini | P0 | 影响 MiniPlayer 核心入口 |
| `.m3u8` 源在 mini 不可播 | P0 | 影响真实播放能力 |
| E2E 浏览器回归不绿 | P1 | 阻断发布信心，但失败点需进一步归因 |
| 返回 `/watch` 双实例时序 | P1 | 可能造成音频/状态跳接 |
| seek 后立即返回丢进度 | P1 | 影响断点体验 |
| 全局快捷键误伤输入/弹窗 | P1 | 影响全站交互 |
| Header/Buffered/A11y 细节 | P2 | 体验与 contract 偏差 |

总体判断：MiniPlayer V1 UI 与基础控制已经成型，但核心交互状态机仍需 P0/P1 专项收口后，才适合宣称“可稳定回归”。
