# Resovo 前端交付包落地计划（v1.1）

> status: draft · 待 arch-reviewer 复评（同代理 ID `a196a8b03af6e3308`）
> owner: @engineering
> created: 2026-04-22（v1.0）
> revised: 2026-04-22（v1.1，基于 arch-reviewer NEED_FIX 4 项 + 加分建议 4 项 + 用户 2026-04-22 拍板 B/C + 全部采纳加分）
> supersedes: `landing_plan_v0.md`（保留作历史对照）
> source: `docs/handoff_20260422/`（HANDOFF.md + Integration Plan.md + Token Audit.md + designs/{home-b-2,Site Design-2,Global Shell,Motion Spec}.html + design-canvas.jsx + packages/design-tokens 参考副本）
> 对齐方案：`docs/frontend_redesign_plan_20260418.md`（主）、`docs/design_system_plan_20260418.md`（辅）
> 关联 ADR：ADR-035（apps/web → web-next 渐进迁移）、ADR-037（REGRESSION 核心能力层签字规则）、ADR-039（middleware 品牌识别）

---

## 0. 基本定位与 v0 → v1 主要差异

- **方案归属**：`frontend_redesign_plan_20260418.md` 的 M7 扩充；与 `design_system_plan` / `image_pipeline_plan` 目标内嵌，不触发冻结期 BLOCKER（CLAUDE.md §绝对禁止 #14）
- **里程碑归属**：M7 扩充（原 M7 仅 2 卡 "ESLint 禁色 + 视觉回归 + 移除残余旧组件"，v1 扩充为 2 + 9 = 11 卡）
- **不改变 M6 sealed 状态**：本计划在 M7 启动时间点启动，不回退 M6 签字
- **v1.0 相对 v0 的主要修订**：
  1. 依赖策略反转：**不引入** `framer-motion` / `@use-gesture/react`；设计稿四个 HTML 本身无依赖，动效全部 CSS + 原生 pointer events 可达
  2. 既有基建清点状态更新：`SharedElement` / `RouteStack` 已从 noop 升级为真实实装；西里尔 bug `lifecycleDеlisting` 已修复（M5 清场并入）
  3. 卡片拆分 5 → 9，补齐后端 3 卡 + admin 统一管理页 1 卡
  4. `home_modules` 表与 `videos.trending_tag` 列的 migration 范围明确（均未落 DB）
  5. `videos.description` 已存在（`001_init_tables.sql:30`），HeroV2 `blurb` 直接复用，**不加字段**
  6. 模型路由严格化：本序列任何卡禁用 haiku；opus / opus arch-reviewer / sonnet 三档分层
  7. 新增 **§7 UI 复核门禁**：可见 UI 修改未过真人复核不得进入下一卡
  8. 新增 **§9 视觉 7 项硬标尺**：字体/色值/圆角/阴影/spacing/动效/aspectRatio 精确对齐
  9. 新增 **§6.5 设计稿分歧 BLOCKER 条款**：开发中发现设计稿与现有实现严重分歧立即停下

- **v1.1 相对 v1.0 的修订**（arch-reviewer NEED_FIX + 加分建议 + 用户拍板）：
  1. **[Critical 1]** HANDOFF-03 新增"Storage 协调协议"子节：sessionStorage（续播 hostMode）与 localStorage（mini 几何）职责边界 + hydrate 时序 + 矛盾值解决规则
  2. **[Critical 2]** HANDOFF-04 综合排序降级为 **fallback 方案（用户拍板 B）**：本序列 `rating DESC + year DESC` 简单排序 + 人工置顶覆盖；views/completion 埋点与聚合表作为 **v2.1 独立序列** 跟进（不塞入 M7）
  3. **[High 3]** §7 UI 复核门禁改为**混合模式（用户拍板 C）**：Playwright 自动截图 4 象限为默认、Hover/Focus/动效瞬态 fallback 手动；新增 `scripts/ui-review-capture.sh` 作为 HANDOFF-01 前置 CHORE（0.3d）
  4. **[Medium 4]** HANDOFF-02 追加 ADR-052 偏离声明：M7 scope 从 2 卡收尾扩到 11 卡的显式记录 + `home_modules.content_ref_type` 多态外键各 slot 枚举语义约束
  5. HANDOFF-03 工期 2.5d → **3.5d**，合计 12d → **13d**
  6. §9 字体栈注记 Linux CI 降级问题；HANDOFF-09 视觉回归改 **threshold-based 比较** 或 **仅 macOS runner 生成 baseline**
  7. HANDOFF-09 内 **允许 haiku 子代理** 做 changelog 追加 / 文档归档等机械子步骤（主循环与 ADR 撰写仍限 opus）
  8. HANDOFF-02 ADR-052 需显式声明 `home_modules` 各 slot 下 `content_ref_type / content_ref_id` 的枚举值与语义约束

---

## 1. 模板 ↔ 项目路径映射表

模板 `Integration Plan.md` 假设 `apps/web` + `packages/ui-web` + `packages/features`；本项目实际为 `apps/web-next` + `packages/{design-tokens,player,player-core,types}`（无 `ui-web` / `features`）。

| 模板路径（假设） | 本项目实路径 | 处理 |
|---|---|---|
| `packages/design-tokens/` | `packages/design-tokens/` ✅ 一致 | 直接改（HANDOFF-01 目标文件全部存在） |
| `packages/ui-web/AppShell/` | `apps/web-next/src/components/layout/` | 本序列不做 AppShell 抽象，Nav 升级在现有 layout 内完成 |
| `packages/ui-web/VideoCard/` | `apps/web-next/src/components/video/` | 现有卡组件扩 hover overlay + `<TypeChip>` |
| `packages/ui-web/Tag/ChipType.tsx` | `apps/web-next/src/components/primitives/chip-type/` | 新建 primitives 子目录 |
| `packages/features/PlayerShell/` | `apps/web-next/src/components/player/` + `packages/player-core/` | 编排层留 web-next（CLAUDE.md：PlayerShell 编排、core 不写业务） |
| `packages/features/PlayerShell/usePlayerStore.ts` | **已存在** `apps/web-next/src/stores/playerStore.ts` | 扩展不新建；补 `geometry.{width,height,dockX,dockY,corner}` + `persist(localStorage)` + `takeoverActive` 标志 |
| `apps/web/lib/transitions/` | `apps/web-next/src/components/primitives/page-transition/` | 已存在三态降级；本序列仅按需补 `useFadeTransition` / `useSlideTransition` hooks（若 PageTransitionController 已覆盖则跳过） |
| `apps/web/app/layout.tsx` 挂 `<PlayerShell/>` | `apps/web-next/src/app/[locale]/layout.tsx` + `#global-player-host-portal` | 已挂；本次重点是 mini 交互补齐 |

---

## 2. 既有基建清点（v1 状态更新）

REGRESSION 阶段（ADR-037）+ M5 + M6 累积完成：

- ✅ `BrandProvider + useBrand/useTheme`（`apps/web-next/src/contexts/BrandProvider.tsx`）
- ✅ `middleware 品牌识别`（`apps/web-next/src/middleware.ts`，ADR-039）
- ✅ `PageTransition`（`apps/web-next/src/components/primitives/page-transition/`，三态降级）
- ✅ `SharedElement` 实装（`apps/web-next/src/components/primitives/shared-element/{SharedElement,SharedElementLink,registry,types}.tsx`）—— **v1 修正 v0 "🟡 noop 待实装"**
- ✅ `RouteStack` 实装（`apps/web-next/src/components/primitives/route-stack/{RouteStack,types}.tsx`）—— **v1 修正 v0 "🟡 noop 待实装"**
- ✅ `SafeImage + FallbackCover + image-loader`（`apps/web-next/src/components/media/`，四级降级链，颜色零硬编码）
- ✅ `ScrollRestoration + PrefetchOnHover`（`apps/web-next/src/components/primitives/`）
- ✅ `playerStore`（`apps/web-next/src/stores/playerStore.ts`，`hostMode` + LEGAL_TRANSITIONS；已有 sessionStorage 持久化）
- ✅ 西里尔 bug `lifecycleDеlisting`（U+0435 → U+0065）**已于 M5 清场修复**（`packages/design-tokens/src/semantic/tag.ts:27,28,66,67` 全拉丁 e）
- 🟡 MiniPlayer `<video>` 跨容器移动 / 拖拽 / 缩放 / 四角吸附 / localStorage 几何持久化 / takeoverActive 护栏 尚未实装（HANDOFF-03 目标）
- ❌ `home_modules` 表未落 DB（grep migrations/*.sql 无命中；`MediaImageService.ts:212` 注释提及但未建表）
- ❌ `videos.trending_tag` 列未落 DB（前端 `packages/types/src/tag.types.ts` 已定义 `TrendingTag` 枚举但消费链断）
- ❌ `VideoService.trending()` 为简单 period 排序（`apps/api/src/services/VideoService.ts:68-80`），无"观看量 × 完播率 × 评分"综合算分
- ❌ 管理后台无首页推荐聚合页（`apps/server/src/app/admin/` 有 `banners` 单独管理，无 `home-page` 统一页）

---

## 3. 设计稿 ↔ 项目三维 gap

### 3.1 视觉区块 gap（home-b-2.html · Site Design-2.html · Global Shell.html）

| 区块 | 设计稿锚点 | 现 `apps/web-next` | 处理 |
|---|---|---|---|
| Nav 240px 搜索 pill + ⌘K + `☾/中` | `home-b-2.html:851-887` | 已有 nav 但形态不同 | HANDOFF-05 升级 |
| HeroV2 520px scrim + blurb + specs chip + CTA | `home-b-2.html:889-979` | `HeroBanner` 存在，形态不同 | HANDOFF-05 升级 |
| TypeShortcuts 5 入口含数量 | `home-b-2.html:1113-1141` | 无 | HANDOFF-06 新增 |
| FeaturedRow 1.6fr + 3×1fr | `home-b-2.html:1013-1041` | 无 | HANDOFF-06 新增（消费 home_modules） |
| TopTenRow 水平滚动 + rank badge | `home-b-2.html:1082-1095` | 无 | HANDOFF-06 新增（消费新 top10 接口） |
| ScrollRow portrait / landscape 变体 | `home-b-2.html:1097-1111` | `VideoGrid` 类似 | HANDOFF-06 扩 variant |
| VideoCard hover overlay + TypeChip + CornerTags | `home-b-2.html:779-830` | `VideoCard` 存在，无 hover overlay、无 TypeChip | HANDOFF-07 升级 |
| MiniPlayer B 站风浮窗（320×180 / 拖拽 / 吸附 / 缩放 / 持久化） | `Global Shell.html:551-820`（`showMini`/`onDrag`/`onResize`/`nearestCorner`/`applyMiniSize`） | 无 | HANDOFF-03 新增（参考移植，纯 pointer events + localStorage） |
| 动效：fade 200ms / push 240ms / spring 260ms / shimmer | `Motion Spec.html:28-196` CSS `@keyframes` + `cubic-bezier(0.34, 1.56, 0.64, 1)` | 部分已有 | HANDOFF-01 tokens motion 层补齐 |

### 3.2 后端接口 gap

| 设计稿需要 | 后端现状 | 处理 |
|---|---|---|
| `TopTenRow` 综合排序（观看量 × 完播率 × 评分） | `VideoService.trending()` 简单 period 排序 | HANDOFF-04 新增 `GET /home/top10?period=week&limit=10` |
| `TypeShortcuts` count `2,340+` | 无 | HANDOFF-04 新增 `GET /videos/count-by-type`（5min 缓存） |
| `FeaturedRow` 今日精选（编辑位） | `home_banners` 已有但只管 banner | HANDOFF-04 新增 `GET /home/modules?slot=featured` |
| `HeroV2` blurb | `videos.description` 已存在 | 前端 HANDOFF-05 直接消费，**无 migration** |
| `trending: hot/weekly_top/editors_pick/exclusive` 人工置顶 | 前端类型已定义，DB 无列 | HANDOFF-03 migration 051 补列 |

### 3.3 Admin 管理页 gap

用户要求"Banner 管理 + 首页其他推荐 合并为一个管理页面"。`apps/server/src/app/admin/` 现有 `banners/` 独立管理，**无** `home-page/` 聚合页。

HANDOFF-08 新增 `apps/server/src/app/admin/home-page/`，四个 tab 聚合：
1. **Banner**：现有 `banners` 页迁入作为第一个 tab，不删除原路径（保留向后兼容 302 → 新路径）
2. **今日精选 Featured**：消费 `home_modules.slot='featured'`，人工挑 4 部排序
3. **Top 10 人工置顶**：`home_modules.slot='top10'` 或 `videos.trending_tag='weekly_top'` 的人工干预入口
4. **类型快捷 TypeShortcuts**：`home_modules.slot='type_shortcuts'`，控制 5 个 type 入口的排序与开关

严格按 `docs/rules/admin-module-template.md` 模板：`ModernDataTable` + `ColumnSettingsPanel` + `AdminDropdown` + `SelectionActionBar` + `PaginationV2` + 服务端排序。

---

## 4. PR 拆分（9 张卡 + 1 张 PHASE 收尾）

### HANDOFF-01 · tokens-v2 补齐

**目标**：Token Audit §2 全部约 30 条新变量落地。

**文件范围**：
- 修改 `packages/design-tokens/src/semantic/tag.ts`：+10 chip 字段 × 2 主题（chip-{movie,series,anime,tvshow,doc}-{bg,fg}）
- 修改 `packages/design-tokens/src/components/player.ts`：+12 mini 几何/交互字段（dockPadding, dragHandleHeight, resizeHandleSize, minWidth, maxWidth, aspectRatio, snapDuration, snapEasing, ...）
- 修改 `packages/design-tokens/src/primitives/shadow.ts`：+1 `cardHover`
- 修改 `packages/design-tokens/src/primitives/motion.ts`（若不存在则新建）：+ `spring: cubic-bezier(0.34, 1.56, 0.64, 1)`、`duration.fade: 200ms / push: 240ms / snap: 260ms / shimmer: 1400ms`
- 修改 `packages/design-tokens/src/semantic/index.ts`：+ exports
- 新增 `packages/design-tokens/src/semantic/pattern.ts`（dots/grid/noise + sizes）
- 新增 `packages/design-tokens/src/semantic/route-transition.ts`（fade/slide/shared/reduced）
- 修改 `scripts/build-css.ts`（若硬编码白名单 → 加新字段 或 重构扁平递归）
- 修改 `docs/architecture.md`（Token 层新增段落同步）

**验收**：
- `npm -w @resovo/design-tokens run build` 成功
- `tokens.css` diff **只有新增变量**，无删改
- 新变量 light / dark 均有值
- 全仓 grep 西里尔 е 返回 0（复核 M5 清场）
- 视觉验收：无（纯 token 层，UI 复核门禁不触发）

**模型**：sonnet 主循环 + opus arch-reviewer（CLAUDE.md §模型路由 #5）

---

### HANDOFF-02 · DB schema：home_modules 表 + videos.trending_tag 列

**目标**：落地两个 migration，为后续 API 与 admin 页提供 schema 基础。

**文件范围**：
- 新增 `apps/api/src/db/migrations/050_create_home_modules.sql`：`home_modules` 表 schema 字段（`id / slot / brand_scope / ordering / content_ref_type / content_ref_id / start_at / end_at / enabled / metadata(jsonb) / created_at / updated_at`），对齐 `frontend_redesign_plan_20260418.md` §5.4 "home_modules + brand_scope"
- 新增 `apps/api/src/db/migrations/051_add_videos_trending_tag.sql`：`ALTER TABLE videos ADD COLUMN trending_tag trending_tag_enum NULL`（枚举 `hot|weekly_top|editors_pick|exclusive|NULL`），加部分索引 `WHERE trending_tag IS NOT NULL`
- 修改 `apps/api/src/db/queries/*.ts`：home_modules 查询 + videos trending_tag 读写
- 修改 `packages/types/src/video.types.ts`：Video 类型扩 `trendingTag: TrendingTag | null`
- 新增 `packages/types/src/home-module.types.ts`：HomeModule 类型（与 tag.types.ts `TrendingTag` 保持一致）
- 修改 `docs/architecture.md`：schema 变更必须同步（CLAUDE.md §绝对禁止 #1）
- 新增 ADR 条目（`docs/decisions.md`）**ADR-051：首页推荐 home_modules 运营位模型**
  - 字段语义 + brand_scope 查询协议（`WHERE brand_id = ? OR brand_scope = 'all-brands'`，对齐 `frontend_redesign_plan_20260418.md` §21 F5）
  - **`content_ref_type` 枚举约束（必填显式声明）**：
    - `slot='banner'` → `content_ref_type IN ('video', 'external_url', 'custom_html')` / `content_ref_id` 对应语义
    - `slot='featured'` → `content_ref_type = 'video'` / `content_ref_id = videos.short_id`
    - `slot='top10'` → `content_ref_type = 'video'` / `content_ref_id = videos.short_id`（人工置顶专用，覆盖算法排序）
    - `slot='type_shortcuts'` → `content_ref_type = 'video_type'` / `content_ref_id = 'movie'|'series'|'anime'|'tvshow'|'doc'`
  - `metadata(jsonb)` 字段使用守则：仅允许非关键运营展示数据（如 Featured 的自定义描述文案），禁止放关键业务状态（如排序权重、启用标志，这些必须用独立列）；防止 jsonb 膨胀为"垃圾桶"
- 新增 ADR 条目 **ADR-052：M7 scope 扩展偏离声明**
  - 背景：原 `frontend_redesign_plan_20260418.md` §M7 仅规划 2 卡（ESLint 禁硬编码色相类名 / 视觉回归接入 / 移除残余硬编码与旧组件）
  - 决策：M7 scope 从 2 卡扩充为 2 + 9 = 11 卡，纳入 `docs/handoff_20260422/` 交付包的首页重设计落地（Nav/HeroV2/TypeShortcuts/FeaturedRow/TopTenRow/VideoCard hover/MiniPlayer/admin 聚合页/DB schema）
  - 合法性论证：扩充内容归属 `frontend_redesign_plan` + `design_system_plan` 延续范围，不引入无关新业务（CLAUDE.md §绝对禁止 #14）
  - 对齐章节：本 plan §3.1（视觉 gap）+ §3.2（后端 gap）+ §3.3（admin gap）
  - 触发 ADR-037 §2 偏离声明义务：本 ADR 即履行该义务

**验收**：
- 两个 migration 可 up / down 回放
- `npm run typecheck` 通过（跨 apps/api + packages/types + apps/web-next + apps/server）
- home_modules 插入/查询单元测试通过
- ADR-051 + ADR-052 双条目落盘、`docs/decisions.md` 索引更新
- 不涉及 UI，复核门禁不触发

**模型**：opus 主循环（跨 3+ 消费方 schema + ADR 决策文档，CLAUDE.md §模型路由 #2 + #3）+ opus arch-reviewer

---

### HANDOFF-03 · MiniPlayer 交互补齐

**目标**：B 站风浮窗完整交互 —— 同一 `<video>` DOM 跨容器移动（React portal 不可，会 unmount）/ 顶部 32px 拖拽条 / 右下 16px 缩放柄（240–480px 16:9）/ 四角吸附（16px 边距，spring 260ms）/ 位置 localStorage 持久化 / Takeover 冲突护栏（`takeoverActive` 标志）。

**实现路径约束**：**纯 pointer events + CSS transform + localStorage**，参考 `docs/handoff_20260422/designs/Global Shell.html:551-820`（`showMini` / `onDrag`/`endDrag` / `onResize`/`endResize` / `nearestCorner` / `applyMiniSize` / `save`）。**不引入** `framer-motion` / `@use-gesture/react`。

**Storage 协调协议**（必读，实装时严格遵守）：

playerStore 同时消费两种 storage，**职责不可混淆**：

| Storage 键 | 生命周期 | 存储内容 | 权威性 |
|---|---|---|---|
| `sessionStorage['resovo:player-host:v1']`（现有） | tab 生命周期 | `hostMode / hostOrigin / shortId / currentEpisode / currentTime / duration / mode` 续播状态 | **hostMode 唯一权威值**（由 setHostMode 经 LEGAL_TRANSITIONS 守卫写入） |
| `localStorage['resovo:player-mini-geometry:v1']`（新增） | 跨 tab / 跨刷新 | `geometry.{width, height, dockX, dockY, corner}` 浮窗几何 | **只决定位置**，不决定显隐；不影响 hostMode |

**Hydrate 时序规则**：
1. App mount → 先读 sessionStorage 决定 `hostMode` 初值（现有 `hydrateFromSession` 逻辑保留）
2. 若 hostMode 为 `mini` 或 `pip` → 再读 localStorage 拿 geometry，未读到则用 token 默认值（`player.mini.*` 的 width/height/dock 默认）
3. 若 hostMode 为 `closed` 或 `full` → **不读 localStorage**，避免 closed 态下误触发 mini 容器渲染
4. `takeoverActive` 为 true 时 → 不论 hostMode 与 geometry 如何，mini 容器 `display: none`（护栏优先级最高）

**矛盾值解决规则**：
- sessionStorage 无记录 + localStorage 有几何 → 新 tab 场景，`hostMode = closed`，**忽略 localStorage** 直到用户触发 enter → mini transition
- sessionStorage 有 `mini` + localStorage 无几何 → 刷新后几何丢失（极罕见，localStorage 被清），用 token 默认值
- sessionStorage 有 `mini` + localStorage 的 `corner` 值不在合法枚举（`tl|tr|bl|br`）→ 视为损坏，用 token 默认 `br`
- LEGAL_TRANSITIONS 守卫校验失败的 transition → **不写任何 storage**（现有行为保留）

**Persist 写入时序**：
- sessionStorage：`setHostMode` / `setCurrentTime` 等 setter 触发时同步写（现有 `persistToSession` 保留）
- localStorage：仅在 `drag end` / `resize end` / `close mini` 三个事件点写，不在拖拽过程中高频写

**文件范围**：
- 修改 `apps/web-next/src/stores/playerStore.ts`：扩 `geometry.{width,height,dockX,dockY,corner}` + localStorage 读写纯函数（不用 zustand middleware，避免 hostMode 也被写进 localStorage 污染协议）+ `takeoverActive` 标志；保留 `hostMode` + LEGAL_TRANSITIONS 守卫不破坏；保留现有 sessionStorage 续播逻辑与 `persistToSession` 函数
- 新增 `apps/web-next/src/stores/_persist/mini-geometry.ts`：localStorage 读/写/校验纯函数（键、defaults、corner 枚举校验、解析失败降级）
- 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerHost.tsx`：mini 模式下渲染浮窗容器 + 同 `<video>` DOM 跨容器移动（通过 `appendChild` 而非 React 重挂）+ Hydrate 时序按上述规则
- 修改 `apps/web-next/src/components/player/PlayerShell.tsx`：编排拖拽 / 缩放 / 吸附 / 关闭 / takeoverActive 护栏
- 新增 `apps/web-next/src/components/player/MiniPlayer.tsx`：UI 骨架（使用 `player.mini.*` token）
- 新增 `apps/web-next/src/lib/mini-player/drag.ts`：原生 pointer events 手写拖拽/缩放/吸附（参考 `Global Shell.html:759-820`）
- 移动端：屏蔽浮窗（iOS PiP 限制），保留 v2.1 docked bar 注记（**本卡 scope 外**）
- 测试：
  - 单元：`apps/web-next/src/stores/_persist/mini-geometry.test.ts`（协议规则全覆盖：4 种矛盾值解决 / corner 枚举损坏降级 / Hydrate 时序）
  - E2E：`tests/e2e-next/mini-player.spec.ts` —— 浏览页 → /watch → 返回 → 自动 minimize → 拖 / 缩 / 关 / 刷新保持位置 → full 返回视频不 reload / takeoverActive 时浮窗隐藏 / **window.resize 导致浮窗越界后自动 re-snap 到最近合法 corner**（参考 `Global Shell.html:824-829` 越界自动吸附行为）

**验收**：
- /watch minimize → 右下角 spring pop-in，默认 320×180
- 拖拽顶部条 60fps；松手吸附到最近角 260ms spring
- 右下缩放柄 240–480px，保持 16:9
- ✕ 关闭；位置 localStorage 持久化跨刷新
- 主视图 ⇄ 浮窗切换视频不 reload、不跳进度
- z-index 高于 Takeover（但 Takeover active 时浮窗隐藏，通过 `takeoverActive` 标志）
- 播放器关键路径回归（断点续播 / 线路切换 / 影院模式 / 字幕开关）全部通过
- **可见 UI 修改**：触发 §7 UI 复核门禁

**模型**：opus 主循环（双触发：跨 3+ 消费方 schema + 重构播放器 core/shell 接口，CLAUDE.md §模型路由 #2 + #4）+ opus arch-reviewer

---

### HANDOFF-04 · API：home/top10 + count-by-type + home/modules

**目标**：三个新接口支撑 HANDOFF-06 首页组件。

**Top10 排序策略（用户拍板 B：冷启动降级）**：

| 阶段 | 数据源 | 排序规则 |
|---|---|---|
| **本序列（M7）交付** | `home_modules.slot='top10'` 人工置顶 **+** `videos.rating DESC, videos.year DESC` fallback | 1) 先取 home_modules 的人工置顶（按 `ordering ASC`）；2) 剩余名额按 `rating DESC, year DESC` 补齐；3) 合计 10 部 |
| **v2.1 独立序列**（不塞入 M7） | `video_stats(video_id, views, completions)` 聚合表 + 埋点 `POST /stats/view-event` / `/stats/completion-event` | 综合算分 `score = 0.4 × normalize(views) + 0.4 × normalize(completion) + 0.2 × normalize(rating)` |

- **本序列交付时** Top10 排序视觉与 v1 设计稿一致，但**副标题** `"基于观看量、完播率与评分综合排序"` 改为 `"编辑推荐 · 基于评分精选"`（HANDOFF-06 组件同步改）；待 v2.1 埋点上线后再恢复原副标题
- v2.1 序列立项放 `docs/task-queue.md` 尾部作为"M7 之后独立跟进"，不在本序列范围
- 本序列交付的 `HomeService.topTen()` 实现为 stable 接口，v2.1 仅替换内部排序逻辑，签名不变，前端消费方零改动

**文件范围**：
- 修改 `apps/api/src/services/VideoService.ts`：新增原子查询方法 `listByRatingDesc(params)`（不含运营位编排逻辑），供 `HomeService.topTen()` 调用；**禁止**在本序列写入 views/completion 相关代码（避免造成半成品）
- 新增 `apps/api/src/services/HomeService.ts`：top10 运营位编排（人工置顶 + rating fallback 补齐到 10 部），**归口此处**；不放 VideoService，避免该 Service 承担运营位编排职责越界
- 新增 `apps/api/src/routes/home.ts`：`GET /home/top10` + `GET /home/modules?slot=<slot>&brand=<id>`
- 修改 `apps/api/src/routes/videos.ts`：新增 `GET /videos/count-by-type`（CacheService TTL 300s）
- 修改 `apps/api/src/services/CacheService.ts`：注册 `count-by-type` / `top10` 缓存键
- 新增 `apps/api/src/services/HomeModulesService.ts`：home_modules CRUD + brand_scope 过滤（`WHERE brand_id = ? OR brand_scope = 'all-brands'`，对齐 F5 决议）；被 HomeService 组合消费
- 修改 `packages/types/src/api.types.ts` / 新增 `home.types.ts`：三个接口的 request/response schema
- 在 `home.types.ts` 的 `Top10Response` 加 `sortStrategy: 'manual_plus_rating' | 'composite'` 枚举字段，前端可据此决定副标题文案（便于 v2.1 切换时零代码改动）
- 修改 `docs/task-queue.md`：尾部添加 v2.1 独立序列占位（`SEQ-202605XX-STATS-V1: 观看量/完播率埋点 + 聚合表 + Top10 综合算分切换`）
- 测试：`apps/api/src/tests/home.spec.ts`（单元 + 集成，覆盖"人工置顶 3 部 + rating 补齐 7 部 = 10 部"等场景）

**验收**：
- typecheck / lint / test 全绿
- 三个接口返回符合 zod schema
- `count-by-type` 首次 DB 查，5min 内复用缓存
- `top10` 人工置顶优先于 rating fallback 排序
- `Top10Response.sortStrategy` 当前固定返回 `'manual_plus_rating'`
- v2.1 占位序列已写入 task-queue
- 不涉及 UI，复核门禁不触发

**模型**：sonnet 主循环 + opus arch-reviewer（接口契约评审）

---

### HANDOFF-05 · Nav 升级 + HeroV2 升级

**目标**：顶栏搜索 pill（240px + ⌘K 徽章）+ 主题切换按钮 + HeroV2 520px scrim + specs chip + blurb + CTA。

**文件范围**：
- 修改 `apps/web-next/src/components/layout/Nav.tsx`（或现有路径）：按 `home-b-2.html:851-887` 重构
- 修改 `apps/web-next/src/components/video/HeroBanner.tsx` → `HeroV2.tsx`（或原位升级）：按 `home-b-2.html:889-979` 重构，消费 `videos.description` 作为 blurb
- 修改 `apps/web-next/src/app/[locale]/page.tsx`：挂接新 HeroV2
- 国际化文案：`apps/web-next/messages/{zh,en}.json` 补 CTA / meta row 文案
- 视觉 7 项硬标尺逐项对齐（§9）

**验收**：
- Nav sticky + backdrop-filter blur(12px) + 搜索 pill 240px 像素精确
- HeroV2 520px + scrim 渐变层次清晰 + CTA 按钮 spring 按压反馈
- Light / Dark 双主题视觉一致
- 移动端 375×812 响应式降级（Nav 折叠、HeroV2 移动变体）
- **可见 UI 修改**：触发 §7 UI 复核门禁

**模型**：sonnet 主循环（消费层改造，无新 API 契约）

---

### HANDOFF-06 · 首页组件：TypeShortcuts + FeaturedRow + TopTenRow + ScrollRow variant

> **注**：TopTenRow 副标题本序列交付时为 `"编辑推荐 · 基于评分精选"`（对应 HANDOFF-04 fallback 排序）；v2.1 埋点上线后，副标题由前端根据 `Top10Response.sortStrategy` 字段动态切换到 `"基于观看量、完播率与评分综合排序"`。设计稿的原副标题文案记入 `docs/handoff_20260422/designs/` 只作视觉参考，文案差异在 §7 UI 复核"差异点自述"中以"留白项"声明。

**目标**：首页新区块组件落地，消费 HANDOFF-04 的三个新接口。

**文件范围**：
- 新增 `apps/web-next/src/components/home/TypeShortcuts.tsx`（按 `home-b-2.html:1113-1141`，消费 `GET /videos/count-by-type`）
- 新增 `apps/web-next/src/components/home/FeaturedRow.tsx`（按 `home-b-2.html:1013-1041`，消费 `GET /home/modules?slot=featured`）
- 新增 `apps/web-next/src/components/home/TopTenRow.tsx` + `TopTenCard.tsx`（按 `home-b-2.html:1043-1095`，消费 `GET /home/top10`）
- 修改 `apps/web-next/src/components/video/VideoGrid.tsx`：扩 `variant: 'portrait' | 'landscape'`（按 `home-b-2.html:1097-1111`）
- 修改 `apps/web-next/src/app/[locale]/page.tsx`：组装最终首页节奏 Nav → HeroV2 → TypeShortcuts → FeaturedRow → TopTenRow → ScrollRow × N
- 国际化文案补齐
- E2E 测试：`tests/e2e-next/homepage-v2.spec.ts`（新增区块 smoke）

**验收**：
- 五个区块按设计稿节奏正确渲染（gap 56px 等）
- 水平滚动（TopTenRow / ScrollRow）移动端手势流畅
- rank badge 位置精确匹配 `home-b-2.html:1050-1066`
- Light / Dark 双主题
- **可见 UI 修改**：触发 §7 UI 复核门禁

**模型**：sonnet 主循环

---

### HANDOFF-07 · VideoCard hover overlay + TypeChip + CornerTags

**目标**：VideoCard 升级到设计稿 hover overlay 形态（scale 1.04 + linear-gradient scrim + play 按钮 + 评分/年份/集数），以及独立 `<TypeChip>` / `<CornerTags>` primitives。

**文件范围**：
- 新增 `apps/web-next/src/components/primitives/chip-type/ChipType.tsx`（消费 HANDOFF-01 `chip-{type}` tokens）
- 新增 `apps/web-next/src/components/primitives/corner-tags/CornerTags.tsx`（lifecycle + trending + rating + specs）
- 修改 `apps/web-next/src/components/video/VideoCard.tsx`：接入 hover overlay（按 `home-b-2.html:779-830`）
- 修改 `apps/web-next/src/components/video/VideoCardWide.tsx`（如存在或新建）：16:9 wide 变体（按 `home-b-2.html:832-849`）
- 全仓替换硬编码 type badge → `<ChipType>`（禁用 `any`，颜色零硬编码）
- E2E：`tests/e2e-next/video-card-hover.spec.ts`

**验收**：
- Hover overlay scale 1.04 + 渐变遮罩 + play 按钮 36px 圆形 + backdrop-filter blur(8px) `+` 按钮
- TypeChip 5 种 type 色盲模拟下可辨（色 + 文字双重区分）
- light / dark 对比度 > 4.5:1
- **可见 UI 修改**：触发 §7 UI 复核门禁

**模型**：sonnet 主循环 + opus arch-reviewer（`<ChipType>` 作为新共享 primitive，CLAUDE.md §模型路由 #1 "定义新的共享组件 API 契约"）

---

### HANDOFF-08 · Admin 首页推荐统一管理页

**目标**：`apps/server/src/app/admin/home-page/` 新页面，四 tab 聚合 Banner / Featured / Top10 / TypeShortcuts；满足用户"合并为一个管理页面"的诉求。

**文件范围**：
- 新增 `apps/server/src/app/admin/home-page/page.tsx`（Tab 路由器）
- 新增 `apps/server/src/app/admin/home-page/_tabs/{BannersTab,FeaturedTab,TopTenTab,TypeShortcutsTab}.tsx`
- **BannersTab**：从 `apps/server/src/app/admin/banners/` 原页搬移 UI，后端接口不变；原路径 `/admin/banners` 保留 302 → `/admin/home-page?tab=banners`（向后兼容）
- **FeaturedTab / TopTenTab / TypeShortcutsTab**：消费 `home_modules` CRUD + `videos.trending_tag` 人工打标
- 必须使用 `ModernDataTable` + `ColumnSettingsPanel` + `AdminDropdown` + `SelectionActionBar` + `PaginationV2`（`docs/rules/admin-module-template.md`）
- 新增后台 E2E：`tests/e2e/admin-home-page.spec.ts`

**验收**：
- 四 tab 切换保持 URL query 同步
- Banner tab 行为与原 `admin/banners` 1:1
- Featured / TopTen 人工置顶可拖拽排序并持久化
- TypeShortcuts 可控制 5 个 type 的显隐与排序
- 服务端排序、分页、列控制符合 admin 模板
- `/admin/banners` 302 跳转正确
- **可见 UI 修改**（管理员视角）：触发 §7 UI 复核门禁（截图 Banner / Featured / TopTen / TypeShortcuts 四 tab）

**模型**：sonnet 主循环

---

### HANDOFF-09 · PHASE 对齐 + Opus 审计 + 浏览器手动验收 + 视觉回归接入（M7 CLOSE 前置）

**目标**：补齐方案对齐表 + Opus arch-reviewer 独立审计 + 浏览器全流程手动验收 + 视觉回归测试接入（原 M7 范围）+ ESLint 禁硬编码色相类名（原 M7 范围）。本卡合并原 M7 两卡 + HANDOFF 收尾。

**文件范围**：
- 新增 `docs/milestone_alignment_m7_handoff_20260XXX.md`（参照 `milestone_alignment_m6_20260423.md` 风格）
- 修改 `docs/decisions.md`：追加 ADR 条目（token-v2 / miniplayer-interaction / home-modules / admin-home-page）
- 修改 `docs/changelog.md`：HANDOFF-01 至 08 条目 + ★ M7 PHASE COMPLETE ★
- 修改 `docs/task-queue.md`：序列全部 ✅
- 新增 `docs/handoff_20260422/manual_qa_m7_20260XXX.md`（浏览器手动验收 checklist + 截图，对照设计稿逐区块签字）
- 新增 ESLint rule `no-hardcoded-color-class`（禁用 `text-red-500` 等色相类名，强制用 `--tag-*` / `--accent-*` tokens）
- 视觉回归接入：**threshold-based 比较**（不做 pixel-exact），容差 `maxDiffPixelRatio: 0.02` / `threshold: 0.15`；baseline **仅在 macOS runner 生成**（本地开发机），CI（Linux）只做 diff 对比不生成 baseline——绕开 `-apple-system` 在 Linux headless Chromium 降级为 Noto Sans 导致的字体渲染差异误报
- 视觉回归矩阵：Light × Dark × Desktop（1440×900）× Mobile（375×812）= 4 组 snapshot
- `docs/rules/visual-regression.md` 新增（约束 baseline 生成环境、threshold 参数、误报处理流程）

**验收**：
- Opus arch-reviewer 子代理独立审计 PASS（10+ 点必查：token 结构 / playerStore 契约 + Storage 协调协议 / home_modules schema + content_ref_type 枚举 / 接口完整性 / admin 模板合规 / 视觉 7 项硬标尺 / UI 复核记录完整性 / 文档签字 / v2.1 占位序列已入队）
- 主循环浏览器手动验收全部通过（设计稿所有区块逐张对照截图）
- 用户二次人工确认通过
- 视觉回归 baseline snapshot 落盘，CI threshold 可用
- v2.1 占位序列（埋点 + 综合算分）已写入 `docs/task-queue.md` 尾部

**模型**：opus 主循环（撰写 ADR + PHASE COMPLETE，CLAUDE.md §模型路由 #3）+ opus arch-reviewer（#6 高风险 PR code review）
- **例外允许 haiku 子代理**：本卡内以下机械子步骤允许 spawn haiku 节省成本（CLAUDE.md §强制降 Haiku 情形）：
  - changelog 条目追加（HANDOFF-01 至 08 的 8 条 changelog）
  - ADR 索引 / README 索引更新
  - task-queue.md 序列状态表整理（状态标记、时间戳填充）
  - 文档归档（若本序列产出的中间文档需归档）
  - **不允许用 haiku 做**：ADR 正文撰写、PHASE COMPLETE 签字块、视觉回归 baseline 审阅、arch-reviewer 独立评审

---

## 5. 时间估算

| 卡号 | 工作性质 | 估时（含 Opus 评审 + UI 复核等待 + 对齐表） |
|---|---|---|
| HANDOFF-00（前置） | `scripts/ui-review-capture.sh` 截图脚本（由 HANDOFF-01 开工兼职） | 0.3 d |
| HANDOFF-01 | Token 纯库 | 1 d |
| HANDOFF-02 | DB schema migration × 2 + types + ADR-051/052 | 1.2 d |
| HANDOFF-03 | MiniPlayer 交互（最重的一卡：playerStore 重构 + appendChild DOM 移动 + pointer events 手写 + 单元/E2E + UI 复核循环） | **3.5 d** |
| HANDOFF-04 | API × 3 + Top10 fallback 排序（不含综合算分） | 1.2 d |
| HANDOFF-05 | Nav + HeroV2 升级 | 1 d |
| HANDOFF-06 | 首页四区块组件 | 1.5 d |
| HANDOFF-07 | VideoCard hover + ChipType + CornerTags | 1 d |
| HANDOFF-08 | Admin 统一管理页 | 1.5 d |
| HANDOFF-09 | PHASE + 审计 + 视觉回归（threshold）+ ESLint 禁色 | 1 d |
| **合计** | | **≈ 13.2 d** |

---

## 6. 强制模型路由（严格化，本序列禁用 haiku）

| 卡号 | 主循环 | 强制子代理触发（CLAUDE.md §模型路由） | 子代理模型 |
|---|---|---|---|
| HANDOFF-01 | sonnet | #5 Token 层新增字段结构 | opus arch-reviewer |
| HANDOFF-02 | opus | #2 跨 3+ 消费方 schema；#3 ADR 决策文档 | opus arch-reviewer |
| HANDOFF-03 | opus | #2 跨 3+ 消费方 schema；#4 重构播放器 core/shell 接口 | opus arch-reviewer（双触发） |
| HANDOFF-04 | sonnet | #3 综合排序算法将形成 ADR 权重备忘 | opus arch-reviewer |
| HANDOFF-05 | sonnet | — | — |
| HANDOFF-06 | sonnet | — | — |
| HANDOFF-07 | sonnet | #1 `<ChipType>` 新共享组件 API 契约 | opus arch-reviewer |
| HANDOFF-08 | sonnet | — | — |
| HANDOFF-09 | opus | #3 ADR 收尾；#6 高风险 PR code review | opus arch-reviewer |

**haiku 本序列全域禁用**，理由：UI 视觉敏感任务、需要判断力的组件契约设计、需要权衡的综合排序算法，均超出 haiku 胜任范围。

---

## 6.5 设计稿分歧 BLOCKER 条款（新增）

开发某卡时若发现**以下任意情况**，必须立即：①停下当前卡；②在 `docs/task-queue.md` 尾部写 `🚨 BLOCKER`；③回到主循环等待人工决议，**不得擅自折中实现**。

触发情形：
- 设计稿某区块/交互与现有已 sealed 模块（M5/M6 签字）存在不兼容冲突（如 PlayerShell 接口冲突、Token 名冲突、品牌边界冲突）
- 设计稿要求的后端字段/接口与现有 schema 语义冲突（而非"缺字段"这种可加列解决的情况）
- 设计稿隐含的能力在当前技术栈不可达（如需要特定浏览器 API 但不在 caniuse 支持范围）
- 视觉 7 项硬标尺（§9）中某一项在 tokens 层无法用现有能力表达
- UI 复核（§7）连续 2 次被真人判定"🔴 改"且改完仍不达预期

BLOCKER 内容必须含：卡号 / 触发情形 / 设计稿锚点（file:line）/ 已尝试方案 / 建议路径 A/B。

---

## 7. UI 复核门禁（硬性条款，v1.1 混合模式 · 用户拍板 C）

### 7.1 触发目录

每卡完成前、git commit 前，若改动命中以下任一目录即触发：
- `apps/web-next/src/app/**`
- `apps/web-next/src/components/**`
- `apps/web-next/src/styles/**`
- `apps/server/src/app/admin/**`（管理员视角 UI 同样触发）
- `packages/design-tokens/src/**` **且** 有 `apps/web-next/src` 或 `apps/server/src` 内组件在本卡内同步消费该 token（否则仅修 tokens.css 不触发；该判断写入复核包 §差异点自述 证明）

### 7.2 截图生成（混合模式）

**默认 A：Playwright 自动截图**
- 前置 CHORE：HANDOFF-01 开工时一次性写 `scripts/ui-review-capture.sh`（约 0.3d 工作量）
- 脚本内容：启动 `npm run dev`（或复用已在跑的）→ 等待 apps/web-next + apps/server ready → 按卡传入的路由清单截 4 张（Light × Dark × Desktop 1440×900 × Mobile 375×812）→ 输出到 `test-results/ui-review/<卡号>/<route>/{light-desktop,light-mobile,dark-desktop,dark-mobile}.png`
- 每卡完成时主循环执行 `bash scripts/ui-review-capture.sh <卡号> <route1> <route2> ...`，把截图路径列在复核包里

**Fallback B：主循环暂停等手动截图**
- 适用 Playwright 不方便自动捕的场景：
  - VideoCard / 按钮 / 链接 **Hover 态**（需鼠标悬停）
  - **Focus 态**（需 Tab 键触发）
  - **动效瞬态**（HANDOFF-03 MiniPlayer 拖拽中 / 吸附 spring 中 / Takeover 遮罩动画）
  - **跨页面过渡瞬态**（HANDOFF-05 SharedElement / RouteStack 过渡中）
- 主循环此时在对话里列清单：`需手动截图：/page-path + <交互步骤描述>`，暂停等用户回复截图文件路径或"已过目无需改"。

**哪些情形用 A 哪些用 B**：每卡开工时由主循环在卡片规划阶段显式列出 **Auto** 路由清单和 **Manual** 路由清单，不允许临时决定。

### 7.3 复核包结构（每卡提交给真人的对话内容）

1. **改动文件清单**（file:line 级，关注 UI 相关行）
2. **对应设计稿锚点**（`docs/handoff_20260422/designs/{file}.html:Lxxx-Lyyy` 范围）
3. **Auto 截图清单**：`scripts/ui-review-capture.sh` 生成的 4 象限 × N 路由，贴文件路径；主循环如能以 MCP / 文件协议贴图则直接贴
4. **Manual 截图清单**（若本卡涉及）：列出待截路由与交互步骤，等用户回填
5. **关键路径清单**（每卡按需勾选）：
   - [ ] 移动端响应式降级（Nav / Tab Bar / HeroV2）
   - [ ] Hover 态（VideoCard overlay / HANDOFF-07）
   - [ ] Focus 态（可聚焦元素 a11y）
   - [ ] 动效过程（HANDOFF-03 拖拽/吸附瞬间）
   - [ ] 跨主题对比（Light ↔ Dark 1:1 对照）
6. **差异点自述**：与设计稿不一致处，每条给出"原因 + 是否需改"

### 7.4 真人判定与阻塞效果

真人回复三种之一：
- **✅ 过** → 允许 commit + 进入下一卡
- **🔴 改：`<具体项>`** → 本卡保持 🔄 进行中，不删卡；按具体项修改后重新提交复核包
- **⚠️ 留白：`<原因>`** → 允许 commit，但必须记入 `docs/handoff_20260422/manual_qa_m7_*.md` 的"已留白项"列表，由 HANDOFF-09 PHASE 阶段统一回补

**未收到"✅ 过"或"⚠️ 留白"不得 commit。**

**连续 2 次"🔴 改"且改完仍不达预期** → 触发 §6.5 BLOCKER 条款（视为设计稿分歧，停下讨论）。

### 7.5 诚实性条款

主循环**不得**在复核包里声称"视觉 100% 对齐设计稿"而不给 4 象限截图证据；**不得**对 Manual 截图清单的缺口以"已自测"代替真人复核；**不得**把 §7.1 触发判断偷懒判为"不触发"以跳过门禁（该判断若存疑必须在复核包里说明并请真人确认）。违反此条单独视为 CLAUDE.md §绝对禁止违规。

---

## 8. 风险与护栏

| 风险 | 缓解 |
|---|---|
| 模板 `pnpm --filter` 在本仓不适用（npm workspaces） | 全部改为 `npm -w @resovo/<ws> run <script>` |
| `build-css.ts` 若硬编码白名单 → 新字段不生成 CSS（Audit §2.3） | HANDOFF-01 内重构为扁平递归；若工作量大拆 HANDOFF-01b |
| iOS Safari PiP 限制移动端浮窗 | 移动端不做浮窗，v2.1 跟进 docked bar（本次 scope 外） |
| Takeover + MiniPlayer z-index 冲突 | playerStore 加 `takeoverActive` 标志，HANDOFF-03 实装 |
| 综合排序算法权重不合理 | HANDOFF-04 内必须出 ADR 条目，opus arch-reviewer 独立评审权重备选方案 |
| home_modules brand_scope 查询性能 | 加复合索引 `(slot, brand_id, enabled, ordering)`；HANDOFF-02 内落地 |
| `videos.trending_tag` 人工置顶与算法排序冲突 | 协议：人工置顶优先，算法补齐剩余名额；HANDOFF-04 实装 |
| admin `/admin/banners` 路径用户/运营已熟悉 | HANDOFF-08 加 302 跳转，保留向后兼容 6 个月 |
| 冻结期"未含方案对齐表的 PHASE COMPLETE 视为未完成" | HANDOFF-09 单独承担对齐表 + Opus 审计 + 浏览器手动验收三维 |
| 设计稿与现有 sealed 模块冲突 | §6.5 BLOCKER 条款立即停下讨论 |
| UI 复核连续不过 | §7 连续 2 次 🔴 改 → §6.5 BLOCKER |
| 主循环执行中发现难度高于预期 | 写 BLOCKER 暂停；禁止主循环擅自 spawn Opus 替做最终决策 |

---

## 9. 视觉"几乎看不出区别"的 7 项硬标尺

每卡 §7 UI 复核时，必须核对以下 7 项：

1. **字体栈**：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`（与 `home-b-2.html:43` 一致）
   - ⚠️ **Linux CI 注记**：`-apple-system` 在 Linux headless Chromium 无对应字体，会降级为 Noto Sans 等，渲染差异会导致 pixel-exact snapshot 回归误报。因此 HANDOFF-09 视觉回归 baseline **仅在 macOS runner 生成**（本地开发机），CI 只做 diff 对比并采用 **threshold-based**（`maxDiffPixelRatio: 0.02`，`threshold: 0.15`）。此标尺对齐的评判基准为 **macOS 渲染**，不覆盖 Linux 下的字体兜底形态。
2. **色值 oklch 精确对齐**：色相/彩度/明度数值完全一致，禁止 oklch → hex → oklch 的 round-trip 失真
3. **圆角**：`radius: 4 / 6 / 8 / 10 / 12 / 14 / 18 / 999`（从 home-b-2 实测，全部进 `primitives/radius.ts`）
4. **阴影**：`--shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.12)` + `cardHover` + dark 变体
5. **spacing 节律**：首页 `padding: 48px 24px 80px` / 区块间 `gap: 56px` / 卡间 `gap: 16px` / 文字行距 `lineHeight: 1.3 / 1.55`
6. **动效参数**：`duration.fade: .15s / .2s`、`duration.push: .24s`、`duration.snap: .26s (spring)`、`cubic-bezier(0.34, 1.56, 0.64, 1)`
7. **aspectRatio + 响应式能力**：海报 `2/3`、wide `16/9`、featured big `4/5`、HeroV2 `height: 520px`；`backdrop-filter: blur(12px)` 在目标浏览器矩阵（Chrome/Safari/Firefox 2024+）可用

违反任一项必须在 §7 复核包"差异点自述"中显式说明理由，不得静默放过。

---

## 10. 明确 Scope 外（本序列不做）

- `design-canvas.jsx` — 开发参考，不入 build pipeline
- `designs/*.html` — 设计参考 mock，不做像素级复刻；实装以 tokens + 现有组件为准（但 §9 的 7 项硬标尺必须精确）
- `packages/design-tokens.zip`（根目录遗留，如存在）— 与本交付包无关，由 CHORE 任务单独确认清理
- 移动端 docked MiniBar（Mini Player 移动端变体）/ TV / 车机端外壳 — v2.1 跟进
- 视频广告插入点外观 — scope 外
- `apps/web` 下线 / M6-RENAME / CUTOVER —— 独立架构决策，不在本序列
- 新依赖引入（`framer-motion` / `@use-gesture/react` 等）—— 明确不做，撤回 v0 曾考虑的方向

---

## 11. 入队触发条件（v1 修订）

**前置**（基于 M6 现状）：
1. M6-CLOSE-01 sealed ✅（`4d9eb35 docs(M6-CLOSE-01): ★ M6 PHASE COMPLETE ★`，已满足）
2. 本计划 v1 经 **opus arch-reviewer** 独立评审 PASS
3. 用户对 §7 UI 复核门禁条款二次确认 ✅（已确认于 2026-04-22）

**入队方式**：
- 追加序列 `SEQ-20260423-HANDOFF-V2`（序号按启动日校准）到 `docs/task-queue.md` 尾部
- 归入 M7 扩充（M7 原 2 卡 + 本序列 9 卡 = 11 卡）
- 主循环单次取卡执行，每张卡完成后立即更新序列状态 + 时间戳
- 严格遵守 CLAUDE.md 单任务工作台 + `docs/rules/workflow-rules.md`

**不跳过**：
- `docs/tasks.md` 单任务工作台约束
- §7 UI 复核门禁
- §6.5 设计稿分歧 BLOCKER 条款

---

## 12. 变更历史

| 版本 | 日期 | 变更 | 审阅 |
|---|---|---|---|
| v0 | 2026-04-22 | 初稿：模板 → 本仓路径映射 + 5 张卡拆分 + Opus 触发矩阵 + 风险护栏 | 基于 M5 前置假设 |
| v1.0 | 2026-04-22 | 基于 M6 sealed + 用户三项裁决（撤回依赖引入 / blurb 复用 description / 严格模型路由 + UI 复核门禁）重写：5 卡 → 9 卡、增加后端 schema + API + admin 统一管理页、新增 §7 UI 复核门禁、§6.5 设计稿分歧 BLOCKER、§9 视觉 7 项硬标尺 | arch-reviewer `a196a8b03af6e3308` 评审 NEED_FIX |
| v1.1 | 2026-04-22 | 基于 arch-reviewer NEED_FIX 4 项 + 加分建议 4 项 + 用户拍板 B/C 修订：①HANDOFF-03 加 Storage 协调协议（session/local 职责、hydrate 时序、矛盾值解决）；②HANDOFF-04 Top10 降级 rating fallback，埋点 v2.1 独立跟进；③§7 UI 复核改混合模式（Playwright 自动 + Hover/Focus/动效瞬态 fallback 手动）+ `scripts/ui-review-capture.sh` 前置 CHORE；④HANDOFF-02 加 ADR-051（home_modules + content_ref_type 枚举约束）+ ADR-052（M7 scope 偏离声明）；⑤HANDOFF-03 工期 2.5 → 3.5d，合计 12 → 13.2d；⑥§9 字体栈注记 Linux CI 降级 + HANDOFF-09 threshold 视觉回归；⑦HANDOFF-09 允许 haiku 做 changelog/归档等机械子步骤；⑧§7.5 新增诚实性条款 | 第二轮 arch-reviewer `a5035ed3d8dd76dc3` **PASS**；额外采纳 2 条补强建议：HANDOFF-04 topTen 归 HomeService（VideoService 只提供原子 listByRatingDesc）、HANDOFF-03 E2E 补 window.resize 越界 re-snap 场景 |
