# M5 依赖核查清单（2026-04-21）

> 产出卡片：M5-PREP-02
> 核查时间：2026-04-21
> 核查范围：`apps/**/package.json`、`packages/**/package.json`（排除 node_modules）
> 核查命令：`grep -r "embla|framer|react-spring|dnd|gesture|sortable" apps/*/package.json packages/*/package.json`

---

## 核查结果

| 库 | 用途 | 核查结果 | 影响卡片 | 处理方式 |
|---|---|---|---|---|
| `embla-carousel-react` | Banner 移动端轮播 swipe | ❌ 不存在 | M5-PAGE-BANNER-FE-01 | ⚠️ 见下方 BLOCKER 通知 |
| `react-dnd` / `@dnd-kit/core` | Banner 后台拖拽排序 | ❌ 不存在 | M5-ADMIN-BANNER-01 | ⚠️ 见下方 BLOCKER 通知 |
| `framer-motion` | 动效库（额外） | ❌ 不存在 | 无（M5 CARD/PAGE 使用 CSS + rAF） | 不需要，不影响 |
| `react-spring` | 动效库（额外） | ❌ 不存在 | 无 | 不需要，不影响 |
| `@use-gesture/react` | 手势库 | ❌ 不存在 | M5-CARD-ROUTESTACK-01 | RouteStack 用原生 touch events，不需要此库 |

---

## BLOCKER 通知

### BLOCKER-M5-DEP-01 — embla-carousel-react 未安装

- **影响范围**：仅 `M5-PAGE-BANNER-FE-01`（HeroBanner 移动端轮播）
- **封锁**：M5-PAGE-BANNER-FE-01 **禁止启动**，直到人工批准安装 embla-carousel-react
- **不封锁**：M5-CARD-* / M5-API-* / M5-ADMIN-* / 其他 M5-PAGE-* 任务均不依赖此库，可正常推进
- **处理路径**：
  1. 人工确认是否批准安装 `embla-carousel-react`（符合 CLAUDE.md 绝对禁止第 2 条审批要求）
  2. 确认后在 `apps/web-next/package.json` 安装，并在 M5-PAGE-BANNER-FE-01 验收中记录版本
  3. 或选择替代方案：用 CSS scroll-snap + touch event 实现轮播（无新依赖），需在 M5-PAGE-BANNER-FE-01 卡片中更新实现方案

### BLOCKER-M5-DEP-02 — 拖拽排序库未安装

- **影响范围**：仅 `M5-ADMIN-BANNER-01`（Banner 后台拖拽排序）
- **封锁**：M5-ADMIN-BANNER-01 **禁止自行安装**任何拖拽库，启动前须人工决策
- **不封锁**：M5-API-BANNER-01 不涉及拖拽，可正常推进
- **处理路径**：
  1. 确认现有 admin codebase 中列设置面板（`TableSettingsPanel`）的列拖拽是否为 CSS 实现，若是则评估复用
  2. 或选择 `@dnd-kit/core`（推荐，轻量 tree-shakeable）— 需人工批准安装
  3. 或仅用 `sort_order` 字段 + 上移/下移按钮替代拖拽（降级方案，无新依赖）

---

## 不受影响的 M5 任务

以下任务不依赖任何未安装库，依赖核查对其无影响：

- M5-CARD-CTA-01：使用 CSS animation + playerStore，无外部动效库
- M5-CARD-TAG-01：纯 CSS + Token
- M5-CARD-STACK-01：CSS box-shadow，无外部库
- M5-CARD-SHARED-01：原生 requestAnimationFrame FLIP，无外部库
- M5-CARD-ROUTESTACK-01：原生 TouchEvent，无外部库
- M5-CARD-SKELETON-01：CSS animation shimmer，无外部库
- M5-API-BANNER-01：纯后端 migration + API，无前端依赖
- M5-PAGE-HEADER-01：CSS + useBrand，无外部库
- M5-PAGE-TABBAR-01：CSS + 路由，无外部库
- M5-PAGE-GRID-01：消费 CARD primitive，无新依赖
- M5-PAGE-SEARCH-01：CSS clip-path，无外部库
- M5-PAGE-DETAIL-01：消费 SharedElement，无新依赖
- M5-PAGE-PLAYER-01：现有 player-core，无新依赖

---

## 变更记录

| 日期 | 版本 | 作者 |
|------|------|------|
| 2026-04-21 | v1.0 | M5-PREP-02（claude-sonnet-4-6 主循环） |
