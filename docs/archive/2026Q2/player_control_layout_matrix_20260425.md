# 播放器按钮响应式布局矩阵（现状）

创建时间：2026-04-25

本文只记录现有实现，不包含修复方案。前台播放页实际使用 `@resovo/player-core`，入口是 `apps/web-next/src/components/player/VideoPlayer.tsx` 动态加载 `packages/player-core/src/Player.tsx`。`packages/player/src/core` 中有旧副本，当前布局决策与 `player-core` 一致。

## 1. 判定口径

布局以播放器根节点 `getBoundingClientRect()` 的宽高为准，不是直接以浏览器 viewport 为准。代码位置：`packages/player-core/src/hooks/useLayoutDecision.ts:315-318`。

宽度断点：

| band | 条件 |
| --- | --- |
| `wide` | `width > 960` 或未测量到宽度 |
| `medium` | `761 <= width <= 960` |
| `compact` | `561 <= width <= 760` |
| `narrow` | `width <= 560` |
| `phone-portrait` | `pointer: coarse` 且窗口竖屏且 `width <= 560` |

高度断点：

| band | 条件 |
| --- | --- |
| `tall` | `height > 460` 或未测量到高度 |
| `short` | `height <= 460` |

输入策略：

| policy | 条件 |
| --- | --- |
| `desktop-pointer` | 非 `pointer: coarse` |
| `tablet-touch` | `pointer: coarse`，但不是 `phone-touch` |
| `phone-touch` | `pointer: coarse` 且窗口竖屏且 `width <= 560` |

## 2. 按钮代号

| 代号 | 功能 | 渲染前置条件 |
| --- | --- | --- |
| `title` | 顶部标题 | 有 `title` 或 `author` 才显示内容 |
| `play` | 播放/暂停 | 总是存在 |
| `next` | 下一集 | `onNext` 存在 |
| `episodes` | 选集 | `episodes.length > 0` |
| `volume` | 静音/音量滑杆 | slot 存在时渲染；触屏 CSS 还会隐藏 `.ytpVolumeArea` |
| `time` | 时间显示 | slot 存在时渲染；容器 `<=320px` 时 CSS 隐藏 |
| `chapter` | 章节 | slot 存在且有当前章节 |
| `subtitles` | 字幕快捷切换 | `subtitles.length > 0` |
| `speed` | 倍速 | 总是存在 |
| `settings` | 设置 | 总是存在，但无清晰度/字幕/可解析分辨率时禁用 |
| `theater` | 影院模式 | slot 存在时渲染；触屏 CSS 还会隐藏 |
| `airplay` | AirPlay | slot 存在且系统可用 |
| `pip` | 画中画 | slot 存在且浏览器支持 `pictureInPictureEnabled` |
| `fullscreen` | 全屏 | 总是存在 |

下方矩阵默认假设 `hasEpisodes=true`、`hasNext=true`，且字幕、AirPlay、PiP、章节都满足渲染条件。实际页面中不满足前置条件时，对应按钮会从 DOM 或视觉上消失。

## 3. 非全屏桌面矩阵（pointer fine）

| 尺寸/状态 | mode | profile | top-left | top-right | bottom-left | bottom-right | 被布局隐藏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `wide + tall`，`width > 960`、`height > 460` | `desktop-default` | `default` | `title` | 空 | `play`, `next`, `episodes`, `volume`, `time`, `chapter` | `subtitles`, `speed`, `settings`, `theater`, `airplay`, `pip`, `fullscreen` | 无 |
| `wide + short`，`width > 960`、`height <= 460` | `desktop-default` | `short-height` | `title` | `speed`, `settings`, `episodes` | `play`, `next`, `volume`, `time` | `subtitles`, `airplay`, `pip`, `fullscreen` | `chapter`, `theater` |
| `medium + tall`，`761 <= width <= 960`、`height > 460` | `desktop-default` | `medium-width` | `title` | `speed`, `settings`, `episodes` | `play`, `next`, `time` | `subtitles`, `theater`, `airplay`, `pip`, `fullscreen` | `volume`, `chapter` |
| `medium + short`，`761 <= width <= 960`、`height <= 460` | `desktop-default` | `short-height` | `title` | `speed`, `settings`, `episodes` | `play`, `next`, `volume`, `time` | `subtitles`, `airplay`, `pip`, `fullscreen` | `chapter`, `theater` |
| `compact`，`561 <= width <= 760` | `desktop-compact` | `compact-width` | `title` | `speed`, `settings`, `episodes` | `play`, `next`, `time` | `subtitles`, `theater`, `airplay`, `pip`, `fullscreen` | `volume`, `chapter` |
| `narrow`，`width <= 560` | `desktop-compact` | `narrow-width` | `title` | `speed`, `settings`, `episodes` | `play`, `next`, `time` | `subtitles`, `fullscreen` | `volume`, `chapter`, `theater`, `airplay`, `pip` |

现状注意点：

- `medium-width` 虽然 density 仍是 `comfortable`，但会移除 `volume` 和 `chapter`。这是音量键在较宽但不超过 960px 容器中消失的直接规则来源。
- `short-height` 不移除 `volume`，只移除 `chapter` 和 `theater`。
- `episodes` 在 `default` 桌面布局位于 bottom-left；如果同时有 `next` 且面板未打开，会进入 hover reveal 状态，默认宽度 0、透明，只有 hover `next-episodes-group` 才出现。

## 4. 非全屏触屏矩阵（pointer coarse）

| 尺寸/状态 | mode | policy | top-left | top-right | bottom-left | bottom-right | 被布局隐藏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 竖屏且 `width <= 560` | `mobile-portrait` | `phone-touch` | `title` | `settings`, `speed`, `airplay`, `pip` | `play`, `next`, `time` | `episodes`, `fullscreen` | `volume`, `chapter`, `subtitles`, `theater` |
| 横屏，或竖屏但 `width > 560` | `mobile-landscape` 或 `mobile-portrait` | `tablet-touch` | `title` | `episodes`, `speed`, `settings`, `subtitles` | `play`, `next`, `time` | `fullscreen` | `volume`, `chapter`, `theater`, `airplay`, `pip` |

现状注意点：

- `phone-touch` 完全没有 `subtitles` slot，字幕按钮会消失，即使有字幕数据。
- 非全屏触屏布局没有 `volume` slot；同时 CSS 在 `pointer: coarse` 下也把 `.ytpVolumeArea` 设为 `display:none`。
- `tablet-touch` 有 `episodes`，位置在 top-right；`phone-touch` 有 `episodes`，位置在 bottom-right。

## 5. 全屏矩阵

| 尺寸/状态 | mode | policy | top-left | top-right | bottom-left | bottom-right | 被布局隐藏 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 全屏 + pointer fine | `fullscreen-immersive` | `desktop-pointer` | `title` | `airplay`, `pip` | `play`, `next`, `episodes`, `volume`, `time`, `chapter` | `subtitles`, `speed`, `settings`, `fullscreen` | `theater` |
| 全屏 + pointer coarse | `fullscreen-immersive` | `phone-touch` 或 `tablet-touch` | `title` | `settings`, `speed`, `airplay`, `pip` | `play`, `next`, `time`, `episodes` | `fullscreen` | `volume`, `chapter`, `subtitles`, `theater` |

现状注意点：

- 全屏触屏布局把 `episodes` 放在 bottom-left。
- `renderControl("episodes")` 只要发现 `episodes` 在 bottom-left，就给外层加 `.ytpEpisodesSlide`。
- CSS 在 `@media (pointer: coarse)` 下将 `.ytpEpisodesSlide` 设置为 `display:none`。
- 因此全屏触屏下，布局矩阵声明有 `episodes`，但实际视觉会隐藏。这是“选集功能消失”的高优先级线索。

## 6. 面板布局矩阵

| band | 选集面板列数 | 选集面板最大高度 | 面板 sizing |
| --- | --- | --- | --- |
| `wide` 且集数 `<=12` | 4 | `260px` | `stable` |
| `wide` 且集数 `>12` | 6 | `260px` | `stable` |
| `medium` | 5 | `260px` | `stable` |
| `compact` | 4 | `220px` | `compact` |
| `narrow` | 3 | `196px` | `compact` |
| `phone-portrait` | 3 | `196px` | `compact` |

面板位置：

| 条件 | episodesPanel | speedPanel | settingsPanel |
| --- | --- | --- | --- |
| `episodes` 在 top-right | `top-right` | `top-right` | `top-right` |
| `episodes` 在 bottom-right | `bottom-right` | 取决于 `speed` 是否在 top-right | 取决于 `settings` 是否在 top-right |
| 其他 | `bottom-left` | `bottom-right` | `bottom-right` |

## 7. 已解释的问题线索

1. 音量键消失：
   - 桌面非全屏 `medium-width`、`compact-width`、`narrow-width` 都会从 slot 中移除 `volume`。
   - 触屏非全屏/全屏都没有 `volume` slot。
   - 即使未来触屏 slot 加回 `volume`，现有 CSS 仍会在 `pointer: coarse` 下隐藏 `.ytpVolumeArea`。

2. 选集按钮消失：
   - 桌面 `wide + tall` 且有 `next` 时，`episodes` 默认是 hover reveal，未 hover 时看起来消失。
   - 全屏触屏时，slot 中有 `episodes`，但 CSS 因 `.ytpEpisodesSlide` 隐藏了它。
   - `episodes` 完全依赖 `episodes.length > 0`，如果上层没有传入 episodes，即使视频是多集也不会出现播放器内选集。

3. 其他随尺寸消失的功能：
   - `phone-touch` 没有字幕按钮。
   - `narrow-width` 桌面移除 `theater`、`airplay`、`pip`。
   - 全屏模式移除 `theater`。
   - 触屏 CSS 隐藏 `theater`，即便未来 slot 加回也不可见。

## 8. 代码锚点

- 断点常量：`packages/player-core/src/hooks/useLayoutDecision.ts:116-119`
- 桌面默认 slot：`packages/player-core/src/hooks/useLayoutDecision.ts:121-136`
- 触屏 slot：`packages/player-core/src/hooks/useLayoutDecision.ts:138-167`
- 全屏 slot：`packages/player-core/src/hooks/useLayoutDecision.ts:170-202`
- 桌面折叠策略：`packages/player-core/src/hooks/useLayoutDecision.ts:231-268`
- mode/profile 判定：`packages/player-core/src/hooks/useLayoutDecision.ts:344-415`
- 隐藏按钮计算：`packages/player-core/src/hooks/useLayoutDecision.ts:421-442`
- 面板 sizing/placement：`packages/player-core/src/hooks/useLayoutDecision.ts:455-514`
- 按钮前置渲染条件：`packages/player-core/src/controls/ControlRenderer.tsx:132-380`
- `hasSettingsContent` 判定：`packages/player-core/src/Player.tsx:191-199`
- 触屏 CSS 二次隐藏：`packages/player-core/src/Player.module.css:1994-2028`
