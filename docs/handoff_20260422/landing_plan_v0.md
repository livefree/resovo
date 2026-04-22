# Resovo 前端交付包落地计划（v0）

> status: draft · 待评审入队
> owner: @engineering
> created: 2026-04-22
> source: `docs/handoff_20260422/`（HANDOFF.md + Integration Plan.md + Token Audit.md + designs/ + design-canvas.jsx + packages/design-tokens 参考副本）
> 对齐方案：`docs/frontend_redesign_plan_20260418.md`（主）、`docs/design_system_plan_20260418.md`（辅）
> 关联 ADR：ADR-037（REGRESSION 核心能力层签字规则）、ADR-039（middleware 品牌识别）

---

## 0. 基本定位

- **方案归属**：frontend_redesign_plan_20260418.md 的延续扩展。合法，不触发冻结 BLOCKER
- **不得插队**：M5-CLEANUP-11 + CLOSE-03 闭合前，SEQ-20260421-M5-CLEANUP-2 的 BLOCKER 仍激活；本计划在 BLOCKER 解除后作为 M5→M6 衔接序列启动
- **入队方式**：新序列 `SEQ-20260423-HANDOFF-V2`（正式启动时确认序号），追加到 `docs/task-queue.md` 尾部；不改 `docs/tasks.md`（单任务工作台）

---

## 1. 模板 ↔ 项目路径映射表

模板 `Integration Plan.md` 假设 `apps/web` + `packages/ui-web` + `packages/features`；本项目实际为 `apps/web-next` + `packages/{design-tokens,player,player-core,types}`（无 `ui-web` / `features`）。所有 PR 路径需重映射。

| 模板路径（假设） | 本项目实路径 | 处理 |
|---|---|---|
| `packages/design-tokens/` | `packages/design-tokens/` ✅ 一致 | 可直接改（PR-1 目标文件全部存在） |
| `packages/ui-web/AppShell/` | `apps/web-next/src/components/layout/` | 在 layout 下新建 `app-shell/` |
| `packages/ui-web/VideoCard/` | `apps/web-next/src/components/video/` | 在现有卡组件上扩 `<ChipType>` |
| `packages/ui-web/Tag/ChipType.tsx` | `apps/web-next/src/components/primitives/chip-type/` | 新建 primitives 子目录 |
| `packages/features/PlayerShell/` | `apps/web-next/src/components/player/` + `packages/player/` | 编排层仍在 web-next（CLAUDE.md：PlayerShell 编排、core 不写业务） |
| `packages/features/PlayerShell/usePlayerStore.ts` | **已存在** `apps/web-next/src/stores/playerStore.ts` | 扩展不新建；补 `geometry`（width/height/dockX/dockY）、`persist` 切面 |
| `apps/web/lib/transitions/` | `apps/web-next/src/components/primitives/page-transition/` | 已存在；按 PR-3 补 `useSharedElement` / `useSlideTransition` 实装（目前 noop） |
| `apps/web/app/layout.tsx` 挂 `<PlayerShell/>` | `apps/web-next/src/app/[locale]/layout.tsx` + 现有 `#global-player-host-portal` | 已挂；本次重点是 mini 交互补齐 |

---

## 2. 既有基建清点（避免重复造轮）

REGRESSION 阶段（ADR-037）已经完成：

- ✅ `BrandProvider + useBrand/useTheme`（`apps/web-next/src/contexts/BrandProvider.tsx`）
- ✅ `middleware 品牌识别`（`apps/web-next/src/middleware.ts`，ADR-039）
- ✅ `PageTransition`（`apps/web-next/src/components/primitives/page-transition/`，三态降级）
- 🟡 `SharedElement` / `RouteStack`（noop 合约，待 M5 / 本序列实装）
- ✅ `SafeImage + FallbackCover + image-loader`（`apps/web-next/src/components/media/`，四级降级链，颜色零硬编码）
- ✅ `ScrollRestoration + PrefetchOnHover`（`apps/web-next/src/components/primitives/`）
- ✅ `playerStore`（`apps/web-next/src/stores/playerStore.ts`，`hostMode` 状态机 + LEGAL_TRANSITIONS 守卫）
- 🟡 MiniPlayer 的 `<video>` 跨容器移动 / 吸附 / 缩放 / 持久化 尚未实装

---

## 3. PR 拆分（模板 4 个 PR 重映射为本仓 4 张卡 + 1 张收尾）

### HANDOFF-01 · tokens-v2 补齐 + 西里尔 bugfix（对应模板 PR-1）

**目标**：Token Audit §2 全部 ≈30 条新变量落地，`lifecycleDеlistingBg/Fg`（U+0435 西里尔 е）→ `lifecycleDelistingBg/Fg`（拉丁 e）全仓修复。

**文件范围**：
- 修改：`packages/design-tokens/src/semantic/tag.ts`（+10 chip 字段 × 2 主题 + 西里尔修复 4 处）
- 修改：`packages/design-tokens/src/components/player.ts`（+12 mini 几何/交互字段）
- 修改：`packages/design-tokens/src/primitives/shadow.ts`（+1 cardHover）
- 修改：`packages/design-tokens/src/semantic/index.ts`（+2 export）
- 新增：`packages/design-tokens/src/semantic/pattern.ts`（dots/grid/noise + sizes）
- 新增：`packages/design-tokens/src/semantic/route-transition.ts`（fade/slide/shared/reduced）
- 修改：`scripts/build-css.ts`（若是硬编码白名单 → 加入新字段 或 重构为扁平递归，Audit §7 风险 3）
- 修改：`docs/architecture.md`（Token 层新增段落同步）
- grep 全仓 `lifecycleDеlisting`（西里尔 е）→ 应返回空

**验收**：
- `npm -w @resovo/design-tokens run build` 成功
- `tokens.css` diff **只有新增变量**，无删改
- 新变量 light / dark 均有值
- `scripts/validate-tokens.ts`（若存在）通过
- 西里尔字母全仓 grep 清零

**强制 Opus 子代理**：`shadow.ts` 新增 `cardHover` 属"Token 层新增字段的结构与引用规则"（CLAUDE.md §模型路由 #5）→ spawn arch-reviewer 评审 token 新增影响面。

**建议模型**：sonnet 主循环 + opus arch-reviewer 子代理

---

### HANDOFF-02 · MiniPlayer 交互补齐（对应模板 PR-2）

**目标**：B 站风浮窗的完整交互 —— 同一 `<video>` DOM 跨容器移动（React portal 不可用，会 unmount）/ 顶部 32px 拖拽条 / 右下 16px 缩放柄（240–480px，16:9）/ 四角吸附（16px 边距，spring 260ms）/ 位置 localStorage 持久化 / Takeover 冲突护栏（`takeoverActive` 标志）。

**文件范围**：
- 修改：`apps/web-next/src/stores/playerStore.ts`（扩展 `geometry.{width,height,dockX,dockY,corner}` + `persist` middleware + `takeoverActive` 标志；保留 `hostMode` + LEGAL_TRANSITIONS 守卫不破坏）
- 修改：`apps/web-next/src/components/player/`（GlobalPlayerHost 补 mini 容器 DOM；PlayerShell 编排拖拽 / 缩放 / 吸附 / 关闭）
- 新增：`apps/web-next/src/components/player/MiniPlayer.tsx` + `.module.css`（或与 token 对齐的 CSS 变量）
- 移动端：屏蔽浮窗（iOS PiP 限制），保留 scope 外注记 v2.1 docked bar
- 测试：`apps/web-next/` Playwright e2e — 浏览页 → /watch → 返回 → 自动 minimize → 拖 / 缩 / 关 / 刷新保持位置 → full 返回视频不 reload

**验收**（模板 §5）：
- /watch minimize → 右下角 spring pop-in，默认 320×180
- 拖拽顶部条 60fps；松手吸附到最近角 260ms spring
- 右下缩放柄 240–480px，保持 16:9
- ✕ 关闭；位置 localStorage 持久化
- 主视图 ⇄ 浮窗切换视频不 reload、不跳进度
- z-index 高于 Takeover（但 Takeover active 时浮窗隐藏）
- 播放器关键路径回归（断点续播 / 线路切换 / 影院模式 / 字幕开关）全部通过

**强制 Opus 子代理**（双触发）：
- playerStore 扩展属"跨 3+ 消费方 schema 设计"（CLAUDE.md §模型路由 #2）
- GlobalPlayerHost / PlayerShell 接口调整属"重构播放器 core / shell 层的接口"（#4）

**建议模型**：opus 主循环 + opus arch-reviewer

---

### HANDOFF-03 · 路由过渡实装（对应模板 PR-3）

**目标**：把 `SharedElement` / `RouteStack` 从 noop 合约升级为真实实装；新增 `useFadeTransition` / `useSlideTransition` / `useSharedElement` 三个 hooks；reduced-motion 降级读 `routeTransition.reducedDuration`（80ms）；View Transitions API fallback 用 FLIP。

**文件范围**：
- 修改：`apps/web-next/src/components/primitives/page-transition/`（SharedElement / RouteStack 升级为真实实装）
- 新增：`apps/web-next/src/lib/transitions/` 下 3 个 hooks（或并入 page-transition 子目录，依 HANDOFF-03 开工前 Opus 评审结论）
- 移动端：基于现有 `framer-motion`（如已在依赖中）+ `@use-gesture/react`，否则走 CSS 降级（**不引入新依赖**，否则触发 BLOCKER，CLAUDE.md §绝对禁止）
- 测试：Playwright 跨浏览器矩阵（Chrome / Safari / Firefox）— Firefox 必测 FLIP fallback

**验收**：
- PC 同层切换 fade 200ms
- PC 海报 → 详情 shared element 360ms
- Mobile push 240ms，左滑 20px 触发返回
- `prefers-reduced-motion: reduce` 全退化 80ms

**强制 Opus 子代理**：SharedElement / RouteStack 接口升级属"定义新的共享组件 API 契约"（#1）→ spawn arch-reviewer。

**建议模型**：sonnet + opus arch-reviewer

**前置依赖确认**：开工前 grep 依赖 `framer-motion` / `@use-gesture/react`，若缺失 → 写 BLOCKER 暂停（不擅自引入新依赖）。

---

### HANDOFF-04 · Pattern + ChipType（对应模板 PR-4）

**目标**：消费 HANDOFF-01 新 tokens 的两处前端落地。

**文件范围**：
- 新增：`apps/web-next/src/components/layout/app-shell/`（AppShell 组件，接 `pattern` prop: `"dots" | "grid" | "noise" | "none"`，默认 `"none"`）
- 新增：`apps/web-next/src/components/primitives/chip-type/`（`<ChipType>` 组件，接 `type: "movie" | "series" | "anime" | "tvshow" | "doc"`）
- 修改：`apps/web-next/src/components/video/` 下 VideoCard 相关 — 替换硬编码 type badge 为 `<ChipType>`（禁用 `any`，颜色零硬编码）
- 修改：`apps/web-next/src/app/[locale]/layout.tsx`（若需挂 AppShell pattern）

**验收**：
- AppShell `pattern` 值切换正确生效
- dark 主题下 pattern 对比度合理
- 5 种 type chip 色盲模拟下可辨（不仅靠色，还靠文字）
- light / dark 对比度 > 4.5:1

**建议模型**：sonnet

---

### HANDOFF-05 · PHASE 对齐 + Opus 审计 + 浏览器手动验收（M6 起点 / M5→M6 衔接）

**目标**：补齐方案对齐表 + Opus arch-reviewer 独立审计 + 浏览器手动验收 + changelog ★ 标记，满足 ADR-037 §4b 三维闭环。

**文件范围**：
- 新增：`docs/milestone_alignment_20260423_handoff.md`（参照 `milestone_alignment_20260420.md` 风格）
- 修改：`docs/decisions.md`（追加 ADR 条目 · token-v2 / miniplayer / route-transition 决策）
- 修改：`docs/changelog.md`（HANDOFF-01 至 04 条目 + ★ M6 起点确认 ★）
- 修改：`docs/task-queue.md`（序列全部 ✅ + BLOCKER 解除说明）
- 新增：`docs/handoff_20260422/manual_qa_20260423.md`（浏览器手动验收 checklist + 截图，对照模板 §5 验收清单逐条签字）

**验收**：
- Opus arch-reviewer 子代理独立审计 PASS（10+ 点必查：token 结构 / playerStore 契约 / page-transition 接口 / 引用完整性 / 文档签字）
- 主循环浏览器手动验收全部通过
- 用户二次人工确认通过

**强制 Opus 子代理**：整个 HANDOFF-05 本身走 opus 主循环 + arch-reviewer。

**建议模型**：opus + opus arch-reviewer

---

## 4. 时间估算

| 卡号 | 对应模板 | 模板估时 | 本仓估时（含路径映射 + Opus 评审 + 对齐表） |
|---|---|---|---|
| HANDOFF-01 | PR-1 + bugfix | 1 d | 1.5 d |
| HANDOFF-02 | PR-2 | 2 d | 2.5 d |
| HANDOFF-03 | PR-3 | 1 d | 1.5 d |
| HANDOFF-04 | PR-4 | 0.5 d | 0.5 d |
| HANDOFF-05 | — | — | 1 d |
| **合计** | | **4.5 d + QA 0.5 d** | **≈ 7 d** |

---

## 5. 强制决策点清单（Opus 子代理触发矩阵）

| 卡号 | 触发条款（CLAUDE.md §模型路由） | 子代理类型 |
|---|---|---|
| HANDOFF-01 | #5 Token 层新增字段的结构与引用规则 | arch-reviewer |
| HANDOFF-02 | #2 跨 3+ 消费方 schema；#4 重构播放器 core / shell 接口 | arch-reviewer（双触发） |
| HANDOFF-03 | #1 定义新的共享组件 API 契约（SharedElement / RouteStack 升级） | arch-reviewer |
| HANDOFF-04 | 无强制触发（消费层改造） | — |
| HANDOFF-05 | #3 撰写即将成为 ADR 的决策文档；#6 高风险 PR code review | arch-reviewer |

---

## 6. 风险与护栏

| 风险 | 缓解 |
|---|---|
| 模板 `pnpm --filter` 在本仓不适用（npm workspaces） | 改为 `npm -w @resovo/design-tokens run build` 或实际 script 名 |
| `build-css.ts` 若硬编码白名单 → 新字段不生成 CSS（Audit §2.3） | HANDOFF-01 内重构为扁平递归；若工作量大拆 HANDOFF-01b |
| iOS Safari PiP 限制移动端浮窗 | 移动端不做浮窗，tabbar 上方 docked bar **本次 scope 外**，v2.1 跟进 |
| Takeover + MiniPlayer z-index 冲突 | playerStore 加 `takeoverActive` 标志，HANDOFF-02 实装 |
| View Transitions Firefox 无 stable 支持（2026-04） | HANDOFF-03 FLIP fallback 必测；Playwright 加 Firefox 矩阵 |
| 冻结期"未含方案对齐表的 PHASE COMPLETE 视为未完成" | HANDOFF-05 单独承担对齐表 + Opus 审计 + 浏览器手动验收三维 |
| 新增依赖触发 BLOCKER（CLAUDE.md §绝对禁止） | HANDOFF-03 开工前 grep 依赖链；缺失 → 写 BLOCKER，不擅自引入 |
| 主循环执行中发现难度高于预期 | 写 BLOCKER 暂停；禁止主循环擅自 spawn Opus 替做最终决策 |

---

## 7. 明确 Scope 外（不做）

- `design-canvas.jsx` — 开发参考，不入 build pipeline
- `designs/*.html` — 设计参考 mock，不做 1:1 像素级复刻；实装以 tokens + 现有组件为准
- `packages/design-tokens.zip`（根目录遗留）— 与本交付包无关，由 CHORE 任务单独确认清理
- 移动端 docked MiniBar / TV / 车机端外壳 — v2.1 跟进
- 视频广告插入点外观 — scope 外

---

## 8. 入队触发条件

**前置**：以下 4 项全部 ✅ 后，本序列方可进入 task-queue：
1. M5-CLEANUP-11（e2e 扩写 9 场景）✅
2. M5-CLOSE-03（真·PHASE COMPLETE v2）✅ —— 含 arch-reviewer 11 点 PASS + 主循环浏览器手动验收 + 用户二次确认
3. SEQ-20260421-M5-CLEANUP-2 BLOCKER 解除（task-queue 尾部通知块更新）
4. 本计划 v0 人工评审通过（如需调整 → 出 v0.1）

**入队方式**：
- 追加 `SEQ-20260423-HANDOFF-V2`（序号按启动日校准）到 `docs/task-queue.md` 尾部
- 主循环单次取卡执行，每张卡完成后立即更新序列状态 + 时间戳
- 不跳过 `docs/tasks.md` 单任务工作台约束

---

## 9. 变更历史

| 版本 | 日期 | 变更 | 审阅 |
|---|---|---|---|
| v0 | 2026-04-22 | 初稿：模板 → 本仓路径映射 + 5 张卡拆分 + Opus 触发矩阵 + 风险护栏 | 待评审 |
