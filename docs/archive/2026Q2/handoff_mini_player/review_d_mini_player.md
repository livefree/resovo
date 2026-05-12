# REVIEW-D — MiniPlayer 整治专项审核报告

- **审核时间**：2026-04-25
- **审核模型**：arch-reviewer（`claude-sonnet-4-6`）
- **覆盖序列**：HANDOFF-31 + HANDOFF-32 + HANDOFF-33 + HANDOFF-35 + HANDOFF-36
- **结论**：**CONDITIONAL PASS**（P1-INFO 修复已在本报告写入前同步落地）

---

## 审核项结论（11 项）

| # | 审核要点 | 结论 | 说明 |
|---|---------|------|------|
| 1 | mini `<video>` src 初始化路径 | PASS | `activeSourceIndex` 越界时 fallback `sources[0]`；`undefined` 裸赋值守卫存在 |
| 2 | `setCurrentTime` 写入节流 | PASS | 250ms 节流实现，`onTimeUpdate` 同时调用 `saveProgress` |
| 3 | 关闭路径顺序 | PASS | `video.pause()` → `removeAttribute('src')` + `video.load()` → `releaseMiniPlayer()`；顺序正确 |
| 4 | 事件隔离 | PASS | header 按钮 `stopPropagation` 覆盖；拖拽区分 5px/300ms 逻辑在视频区实现 |
| 5 | dock recompute | PASS | viewport resize 时 corner 重新计算；展开/折叠后 top 值重新计算防止超出 |
| 6 | PiP 零污染 | PASS | `MiniPlayer.tsx` 无 `pip`、`PiP`、`requestPictureInPicture` 字样 |
| 7 | 颜色 token | PASS | 新增控制栏、overlay 颜色走 `var(--player-mini-*)` 或通用 token，零 hex/rgb |
| 8 | 折叠/展开无布局抖动 | PASS | fixed 定位，展开态高度变化不影响容器位置 |
| 9 | 移动端关闭路径 | PASS | MQ 匹配时 `releaseMiniPlayer()` 被调用，video.src 被清空 |
| 10 | HLS 路径 | PASS | `.m3u8` 走 hls.js，effect cleanup 调 `hls.destroy()`；MP4 走原生路径 |
| 11 | isPlaying 同步 | PASS | `PlayerShell` 传入 `onPlay/onPause`；`watchPlayingRef` 正确冻结离开瞬间的播放状态 |

---

## 问题清单

### [P1-INFO] releaseMiniPlayer 未清零 miniAutoplay / miniResumeTime

- **位置**：`playerStore.ts` `releaseMiniPlayer`
- **风险**：`LEGAL_TRANSITIONS` 阻止 `closed→mini` 直接跳转，当前无触发路径，但防御性清零是最佳实践
- **修复**：已在本报告写入前同步落地（commit 同批次）
  ```ts
  // Before
  set({ shortId: null, currentTime: 0, duration: 0, isPlaying: false, activeSourceIndex: 0 })
  // After
  set({ shortId: null, currentTime: 0, duration: 0, isPlaying: false, activeSourceIndex: 0, miniAutoplay: false, miniResumeTime: 0 })
  ```

### [P2] MiniPlayer.tsx 内联函数未 useCallback

- **位置**：`MiniPlayer.tsx` 约 207–287 行
- **影响**：`handleContainerMouseEnter/Leave`、`handleVideoAreaPointerDown/Up`、`seekFromPointer`、`handleProgress*` 等内联函数每次渲染重建，轻度性能损失
- **处理**：计划在 HANDOFF-34 一并清理

### [P2] MiniPlayer.tsx 接近 500 行上限

- **当前行数**：约 495 行
- **处理**：HANDOFF-34 中提取 `MiniControlBar` 子组件后可降至 380 行以下

### [P2] PlayerShell.tsx renderSelectionPanel 内联函数

- **位置**：`PlayerShell.tsx` `renderSelectionPanel`
- **处理**：可提取为独立子组件，HANDOFF-34 范围内

---

## 主要风险收敛情况

| 风险 | 修复任务 | 状态 |
|------|---------|------|
| `onPause` 竞态导致 mini 无法唤出 | HANDOFF-33 P0-1 + watchPlayingRef 方案 | ✅ 已修复 |
| HLS seek 时序问题（activeSrc 后立即 seek 失效）| HANDOFF-33 P0-2 startPosition | ✅ 已修复 |
| mini 唤出进度/集数重置 | HANDOFF-35 snap before initPlayer | ✅ 已修复 |
| mini 唤出/返回无自动播放 | HANDOFF-35 miniAutoplay transient flag | ✅ 已修复 |
| initPlayer 清零 mini 状态 | HANDOFF-35 capture before call | ✅ 已修复 |

---

## 结论

HANDOFF-31/32/33/35/36 序列通过专项审核。所有 P0/P1 问题均已修复，主播放路径（唤出、续播、返回、自动播放、关闭）行为正确。P2 技术债已录入 HANDOFF-34 范围。
