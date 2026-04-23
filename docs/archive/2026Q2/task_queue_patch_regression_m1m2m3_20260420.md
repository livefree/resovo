# 任务队列补丁 — M1/M2/M3 方案回归（2026-04-20）

> 适用范围：**REGRESSION 阶段 — 补齐方案 M1/M2/M3 未落地能力层**
> 前置补丁：
> - `docs/task_queue_patch_m0_5_close_20260418.md`（Phase 0.5 止损闭幕）
> - `docs/task_queue_patch_rewrite_track_20260418.md`（apps/web-next/ 并行路线 + RW-SETUP）
> - `docs/task_queue_patch_m2_followup_20260419.md`（M2 闭幕，已落地 ✅）
> - `docs/task_queue_patch_m3_20260419.md`（M3 详情页 + 播放器接管，已落地 ✅）
> 发布者：主循环（claude-opus-4-7）审计三份原方案后起草
> 交付对象：Claude Code 执行会话（14 张卡，分阶段 A/B/C/D；多张强制 opus 子代理）
> 紧迫级别：🛑 **BLOCKER 级** — 在 REGRESSION 序列全部完成前，不得启动任何 exec-M4 及后续任务

---

## 1. 背景与决策摘要

### 1.1 为什么需要回归

主循环在 M3 PHASE COMPLETE 之后，主动对照三份原方案（`docs/design_system_plan_20260418.md`、`docs/frontend_redesign_plan_20260418.md`、`docs/image_pipeline_plan_20260418.md`）做了阶段性复盘，结论：**执行侧的 exec-M1/M2/M3 与方案侧的 M1/M2/M3 语义已严重错位**。

- 方案侧 **M1 = 基础设施**（Token 分层 + 主题切换 + Token 后台 + BrandProvider + middleware 品牌识别）
- 方案侧 **M2 = 品牌上下文 + 全局骨架**（Root layout 四件套 + RouteStack + PageTransition + SharedElement + LazyImage + BlurHash + SafeImage + FallbackCover）
- 方案侧 **M3 = 播放器 root 化**（GlobalPlayerHost + zustand 单例 + mini/full/pip 三态 + FLIP）

而执行侧的 exec-M1（TOKEN-01 至 14）事实上已完成方案 M1 的 apps/web 端版本；exec-M2 做的是"首页搬到 web-next + variety→tvshow URL 改名"；exec-M3 做的是"详情页搬家 + player-core 分包 + PlayerShell 搬到 web-next"。

> 偏差根因：**ADR-035 引入 apps/web → apps/web-next 网关 rewrite 协议后，推进视角默认落到"搬家进度"，而方案的能力层在 apps/web-next 端事实上出现断档**。M1 在 apps/web 建立的 BrandProvider/useBrand/brand-detection 体系没有同步进 apps/web-next；方案 M2/M3 的 primitive 层未建立。

### 1.2 回归目标

**在 exec-M4 启动前**，把方案 M1/M2/M3 对应的能力层与页面结构在 apps/web-next 端**切实落地达成**。补齐完成后再推进方案 M4（图片治理）与 M5（页面重制）。

**不目标**：

1. **不重写**已迁到 apps/web-next 的页面业务逻辑（首页 / 5 详情页 / /watch 的数据调用、文案、布局 DOM 结构保留）
2. **不动** apps/web 侧已完成的 TOKEN-01 至 14 代码（该部分将随 M5+ 页面逐步 git rm）
3. **不实际上线第二个品牌**（多品牌能力仅为 primitive 就绪，只实装 resovo）
4. **不实施** Cloudflare Images CDN（仅契约预留，方案 M6 范围）
5. **不做** poster_status DB migration + 图片健康巡检 Job（方案 M4 范围）

### 1.3 决策列表（本补丁锁定）

**决策 R-A — 双轨主题体系统一**
当前 apps/web-next 同时存在 `stores/themeStore.ts`（zustand）与**应有的** Context 版 useTheme（M1 在 apps/web 建立的 TOKEN-09/10/11 未迁过来）。统一采用 **Context 版**（与方案 §8 Provider 模式一致），themeStore 改造为 Context 的内部实现细节或废弃。ThemeToggle.tsx 改接 useTheme hook。此决策构成 ADR-038（待 REG-M1-01 追加）。必须由 arch-reviewer (claude-opus-4-6) 子代理确认。

**决策 R-B — middleware 分层协议**
apps/web（网关）middleware 只做 rewrite 决策（ADR-035），**不做**品牌识别；apps/web-next middleware **读自己的** brand/theme cookie + 注入 header。两个 app 使用相同的 cookie 名（`resovo-brand` / `resovo-theme`）。`apps/web-next/src/lib/brand-detection.ts` 从 apps/web 复制适配。此决策构成 ADR-039（待 REG-M1-02 追加）。必须由 opus 子代理审 middleware 交互。

**决策 R-C — Root layout 四件套常驻化**
apps/web-next `[locale]/layout.tsx` 成为唯一挂载 `<Nav>` / `<Footer>` / `<GlobalPlayerHost>` 的位置。各 `page.tsx` 去除 Nav/Footer 包裹，仅渲染 MainSlot 内容。此决策构成 ADR-040（待 REG-M2-01 追加）。必须由 opus 子代理设计 layout 契约 + rerender 隔离边界。

**决策 R-D — GlobalPlayerHost 是 /watch 路由的唯一播放器宿主**
`/watch` 页面不再自渲染 PlayerShell，改为发 dispatch 调用 `playerStore.enter({ videoId, mode: 'full' })`，由挂在 root layout 的 `<GlobalPlayerHost>` 接管渲染。路由切换离开 `/watch` → `store.transitionTo('mini')`；再次进入 → `'mini' → 'full'`。此决策构成 ADR-041（待 REG-M3-01 追加）。必须由 opus 子代理（CLAUDE.md 强制升 #4 情形：player core/shell 重构）。

**决策 R-E — URL 语义暂不改**
方案 §13.1 建议 `/video/[id]` + `/video/[id]/play` URL 结构，**但**当前 `/watch/[slug]` 已在 ALLOWLIST 翻转且 E2E 覆盖完成。URL 改名涉及破坏性重定向 + SEO + E2E 全量重写。**本次回归不改 URL**，保留 `/watch/[slug]`；方案 M5 页面重制阶段再单独评估。此决策构成 ADR-042 的一条例外条款（待 REG-M3-04 追加）。

**决策 R-F — Token 后台 MVP 增量补齐 3 项**
TOKEN-14 只做了只读预览（iframe 嵌 `/__playground/tokens`），方案 §5.0 MVP 11 项仅覆盖 1/2/3/10 四项。本次补齐下列 3 项，其余仍归 V2：

- MVP §9 Diff 辅助（保存前 JSON diff + 建议 commit message）
- MVP §5 继承指示（"继承自 base" / "brand-override"）
- MVP §8 保存链路（**生产 403 只读，开发/预览环境可写**）

不补：§4 类型化控件全矩阵（仅 color light/dark + string + dimension 三类）、§6 完整体检组件（复用 TOKEN-12 Playground）、§7 WCAG 校验（简化为 alias 闭环 + schema 校验）、§11 权限（复用 requireRole admin）。此决策构成 ADR-043。

---

## 2. 方案 ↔ 执行 对齐表（回归基线）

| 方案 M# | 方案要求 | apps/web 侧 | apps/web-next 侧 | 回归卡片 |
|---|---|---|---|---|
| M1.1 Token 分层 | base/semantic/component 三子层 + brands/resovo | ✅ TOKEN-01~07 | ⭕ 复用 workspace 包 | — |
| M1.2 主题三态 | ThemeProvider + 三态 Segmented | ✅ TOKEN-09/11 | 🟡 部分（themeStore + ThemeToggle 但无 Context） | REG-M1-01 |
| M1.3 BrandProvider | BrandProvider + useBrand | ✅ TOKEN-09 | ❌ 空 contexts/ 目录 | REG-M1-01 |
| M1.4 middleware 识别 | brand/theme cookie → header | ✅ TOKEN-10 | ❌ 只有 next-intl | REG-M1-02 |
| M1.5 blocking script | 首屏无闪烁 | ✅ TOKEN-11 | ✅ 已复制 theme-init-script | — |
| M1.6 Token 后台 | MVP 11 项（§5.0） | ✅ TOKEN-14（只读 4 项） | — | REG-M1-04（补 3 项） |
| M2.1 Root layout 四件套 | Nav/Footer/Host/MainSlot 常驻 | — | ❌ 各 page 自渲染 | REG-M2-01 |
| M2.2 useBrand 驱动触点 | Header/Footer/Logo/Footer text | — | ❌ 硬编码 "Resovo" | REG-M2-02 |
| M2.3 PageTransition primitive | §9 四类过渡底层 | — | ❌ | REG-M2-03 |
| M2.4 SharedElement primitive | FLIP 基建 | — | ❌ | REG-M2-03 |
| M2.5 RouteStack primitive | 返回手势 | — | ❌ | REG-M2-03 |
| M2.6 LazyImage + BlurHash | §15 + §17 | — | ❌ | REG-M2-04 |
| M2.7 SafeImage + FallbackCover | §17 四级降级链 | — | ❌ | REG-M2-05 |
| M2.8 ScrollRestoration | §15.1 | — | ❌ | REG-M2-06 |
| M2.9 PrefetchOnHover | §15.2 | — | ❌ | REG-M2-06 |
| M3.1 GlobalPlayerHost | 挂 root + zustand 单例 | — | ❌ 页面级 PlayerShell | REG-M3-01 |
| M3.2 mini 态 + FLIP full↔mini | §13.3 Spotify 模式 | — | ❌ | REG-M3-02 |
| M3.3 pip 态 | 浏览器原生 PiP | — | ❌ | REG-M3-03 |
| M3.4 路由切换语义 | 离开 /watch 转 mini | — | ❌ 离开即卸载 | REG-M3-04 |

---

## 3. BLOCKER 通知（追加到 `docs/task-queue.md` 尾部，REG-M1-01 之前必须落盘）

```markdown
## 🛑 BLOCKER — REGRESSION 阶段启动（exec-M4 及后续任务冻结）

- **触发时间**：2026-04-20 00:00
- **触发原因**：三份原方案对齐复盘结论 — 方案 M1/M2/M3 能力层在 apps/web-next 端存在结构性断档
- **封锁范围**：
  - 🚫 禁止启动任何 exec-M4 及后续里程碑任务
  - 🚫 禁止对 apps/web-next 新增业务页面（auth / search / admin 任一模块的搬家均暂停）
  - 🚫 禁止修改 ALLOWLIST（除 REGRESSION 序列内允许的 kill-switch 操作外）
  - ✅ 允许：REGRESSION 序列（REG-M1-01 至 REG-CLOSE-01）
  - ✅ 允许：hotfix（破坏性 bug 必须报 BLOCKER 后另开序列）
- **解除条件**：
  1. REG-CLOSE-01 ✅ 已完成
  2. Opus arch-reviewer 独立审计 PASS
  3. 方案 M1/M2/M3 的 19 项条目全部打勾（第 2 节对齐表）
- **关联文档**：`docs/task_queue_patch_regression_m1m2m3_20260420.md`
```

---

## 4. REGRESSION 序列总览

```
阶段 A · M1 残片回迁（apps/web-next 补齐）
├─ REG-M1-01  BrandProvider 体系迁 + 双轨主题统一   [opus+sonnet]  规模 M
├─ REG-M1-02  middleware brand/theme 识别迁         [opus+sonnet]  规模 M
├─ REG-M1-03  layout.tsx 挂 BrandProvider           [sonnet]        规模 S
└─ REG-M1-04  Token 后台 MVP 补齐 3 项               [opus+sonnet]  规模 L

阶段 B · 方案 M2 全量落地（全局骨架 + primitives）
├─ REG-M2-01  Root layout 四件套常驻化               [opus+sonnet]  规模 M
├─ REG-M2-02  useBrand 驱动触点（Header/Footer/文案）[haiku]         规模 S
├─ REG-M2-03  PageTransition + SharedElement + RouteStack primitives  [opus+sonnet]  规模 L
├─ REG-M2-04  LazyImage + BlurHash primitive         [sonnet]        规模 M
├─ REG-M2-05  SafeImage + FallbackCover + Loader 契约 [opus+sonnet]  规模 L
└─ REG-M2-06  ScrollRestoration + PrefetchOnHover    [sonnet]        规模 S

阶段 C · 方案 M3 全量落地（播放器 root 化）
├─ REG-M3-01  GlobalPlayerHost + zustand 扩展 + ADR-041 [opus+sonnet]  规模 L
├─ REG-M3-02  mini 态 UI + FLIP full↔mini 过渡        [sonnet]        规模 M
├─ REG-M3-03  pip 态（Picture-in-Picture）            [sonnet]        规模 S
└─ REG-M3-04  路由切换语义 + /watch 接入 Host         [opus+sonnet]  规模 M

阶段 D · 回归收尾
└─ REG-CLOSE-01  REGRESSION PHASE COMPLETE + Opus 独立审计 + ADR-037  [opus]  规模 S
```

**依赖关系**：阶段 A → 阶段 B → 阶段 C → 阶段 D。阶段内部卡片除 REG-M1-03 依赖 REG-M1-01/02 外其余可并行（建议串行执行以便 PR 粒度清晰）。

---

## 5. 任务卡详细定义

### 5.1 REG-M1-01 — BrandProvider 体系迁到 apps/web-next + 双轨主题统一

- **所属 SEQ**：SEQ-20260420-REGRESSION-M1
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理
- **规模估计**：M（~120 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — 双轨主题统一决策 + ADR-038 草稿
- **目标**：把 M1 阶段在 apps/web 建立的 BrandProvider/useBrand/useTheme Context 体系复制到 apps/web-next，并将当前 apps/web-next 的 zustand themeStore 与新 Context 统一为单一数据源。
- **前置**：无
- **文件范围**：
  - 新增 `apps/web-next/src/types/brand.ts`（从 apps/web/src/types/brand.ts 复制）
  - 新增 `apps/web-next/src/contexts/BrandProvider.tsx`（从 apps/web 复制 + 适配 apps/web-next 的 api-client 路径）
  - 新增 `apps/web-next/src/hooks/useBrand.ts`、`apps/web-next/src/hooks/useTheme.ts`（从 apps/web 复制）
  - 修改 `apps/web-next/src/stores/themeStore.ts`:
    - **路径 A（推荐）**：整体删除，ThemeToggle 改接 useTheme hook
    - **路径 B**：保留 zustand store 但改为"Context 的内部 ref"（由 BrandProvider 内部使用）
    - 由 opus 子代理出具方案后选路径
  - 修改 `apps/web-next/src/components/ui/ThemeToggle.tsx`：改用 useTheme hook；同时升级为方案 §7.4 的三态 Segmented Control 形态（☀️浅 | 🌓自动 | 🌙深）
  - 新增 `docs/decisions.md` 追加 ADR-038（双轨主题统一协议）
- **验收**：
  - `grep -rn 'useThemeStore' apps/web-next/src` 零命中（路径 A）或仅 BrandProvider 内部使用（路径 B）
  - ThemeToggle 渲染为三段 Segmented Control，点击任一段立刻切换
  - 刷新页面主题保持（cookie 写回生效）
  - 系统主题切换时 `theme='system'` 态即时响应
  - typecheck ✅ / lint ✅ / unit tests 全绿
- **质量门禁**：六问自检 + [AI-CHECK] 结论块
- **注意事项**：
  - `apps/web` 侧的 BrandProvider 在 M5 页面重制完成后将随 apps/web 整体清退，本次复制不破坏 apps/web 侧代码
  - Context 初始值走 SSR header → layout.tsx → `<BrandProvider initialBrand={} initialTheme={}>`，与 REG-M1-02/03 协同

### 5.2 REG-M1-02 — middleware brand/theme 识别迁到 apps/web-next

- **所属 SEQ**：SEQ-20260420-REGRESSION-M1
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：M（~90 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — middleware 分层协议设计 + ADR-039 草稿
- **目标**：把 TOKEN-10 建立的 brand/theme cookie 识别链迁到 apps/web-next，使 web-next 端 SSR 首屏就拥有正确的 brand/theme 上下文，不依赖 apps/web 的 middleware 转发。
- **前置**：无（REG-M1-01 可同时开工，但 REG-M1-03 必须等两者都完成）
- **文件范围**：
  - 新增 `apps/web-next/src/lib/brand-detection.ts`（从 `apps/web/src/lib/brand-detection.ts` 复制，保留 parseBrandSlug / parseTheme 纯函数）
  - 修改 `apps/web-next/src/middleware.ts`：在 `createIntlMiddleware(routing)` 之前插入 brand/theme cookie 读取 + header 注入（`x-resovo-brand`、`x-resovo-theme`）
  - 修改 `apps/web/src/middleware.ts` 说明文档（**代码不动**，但在 middleware 顶部加注释："品牌识别由 apps/web-next 自行处理（ADR-039），apps/web 仅做 rewrite 与 next-intl"）
  - 新增 `tests/e2e-next/brand-detection.spec.ts`（域名映射 / query / cookie / 默认兜底四条路径，至少 4 个 test）
  - 新增 `tests/unit/web-next/brand-detection.test.ts`（纯函数）
  - 新增 `docs/decisions.md` 追加 ADR-039（middleware 分层协议）
- **验收**：
  - 请求 `/` 路径时，apps/web 先命中 ALLOWLIST 并 rewrite 到 apps/web-next，apps/web-next 的 middleware 读 cookie 后把 `x-resovo-brand` / `x-resovo-theme` 注入下游 request
  - layout.tsx 能通过 `headers()` 读到这两个值
  - E2E 覆盖四条识别路径全部 PASS
  - typecheck ✅ / lint ✅
- **注意事项**：
  - apps/web 网关已在 RW-SETUP-02 设置 ALLOWLIST 透传 cookie（请求透传不修改）——REG-M1-02 假设该行为已成立，若发现 cookie 在 rewrite 过程中丢失，报 BLOCKER
  - middleware 执行在 Edge Runtime，不得使用 Node-only API

### 5.3 REG-M1-03 — apps/web-next layout 挂 BrandProvider

- **所属 SEQ**：SEQ-20260420-REGRESSION-M1
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：claude-sonnet-4-6
- **规模估计**：S（~45 分钟）
- **子代理调用**：无
- **目标**：把 REG-M1-01/02 的成果在 layout 组装：SSR 读 header → 传 initialBrand/initialTheme 给 BrandProvider → children 可用 useBrand/useTheme。
- **前置**：REG-M1-01 ✅ + REG-M1-02 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx`：
    - `import { headers } from 'next/headers'` + 读 `x-resovo-brand` / `x-resovo-theme`
    - 在 NextIntlClientProvider 内包裹 `<BrandProvider initialBrand={} initialTheme={}>`
    - 保留 theme-init-script 在 `<head>` 的位置（REG-M1-01 的 Context 在 hydration 前依赖该脚本设置 dataset）
  - 修改 `apps/web-next/src/app/layout.tsx`（如存在 root layout 文件）
- **验收**：
  - 首页 / 详情页 / 播放页 Server Component 渲染时 `useBrand().id === 'resovo'`、`useTheme().resolvedTheme` 与 cookie 一致
  - 无 hydration mismatch 警告
  - typecheck ✅ / lint ✅
- **注意事项**：BrandProvider 必须是 Client Component，children 传入（React Server Component 规则）

### 5.4 REG-M1-04 — Token 后台 MVP 增量补齐 3 项

- **所属 SEQ**：SEQ-20260420-REGRESSION-M1
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：L（~240 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — ADR-043 草稿（Token 写回 API 契约 + 生产只读边界 + 继承指示算法）
- **目标**：在 TOKEN-14 只读预览基础上，补齐方案 §5.0 MVP 的 3 项关键能力（Diff 辅助 / 继承指示 / 保存链路），使运营能在开发/预览环境实际调整 Token 值。
- **前置**：REG-M1-01 / 02 / 03 ✅
- **文件范围**：
  - **API 侧**：
    - 修改 `apps/api/src/routes/admin/design-tokens.ts`：新增 `PUT /v1/admin/design-tokens/:brandId`（requireRole admin），payload 为部分 Token 对象，校验：① alias 闭环 ② schema 合法 ③ 禁改 Primitive 数值（只能改 Semantic/Component/Brand 层白名单字段）
    - 生产环境（NODE_ENV === 'production' || `DESIGN_TOKENS_WRITE_DISABLED` env 非空）直接返回 403
    - 调用 `packages/design-tokens/scripts/validate-tokens.ts` + `build-css.ts`
  - **写回落盘**：
    - 方案 §6.2 "后台保存 → 立即触发增量构建"
    - 开发/预览环境写回 `packages/design-tokens/src/brands/<brandId>.ts`（或对应源文件），触发 workspace 重新 build
    - 版本历史简化：仅保存最近 3 版到 `packages/design-tokens/.history/<brandId>-<timestamp>.json`（非 DB）
  - **UI 侧**：
    - 修改 `apps/server/src/components/admin/design-tokens/DesignTokensView.tsx`：
      - 右栏 iframe 旁新增"编辑面板"（分组 Tab：semantic/component/brand，每组列出可编辑字段）
      - 每个字段显示"继承自 base" / "brand-override"标签；允许"解除继承"（新增 brand 覆写）和"重置继承"（移除 brand 覆写）
      - 颜色字段显示 light/dark 两列输入 + 迷你色块
    - 新增 `apps/server/src/components/admin/design-tokens/DiffPanel.tsx`：保存前显示 JSON diff + 建议 commit message
    - 新增 `apps/server/src/components/admin/design-tokens/InheritanceBadge.tsx`
  - **测试**：
    - 新增 `tests/e2e/admin-design-tokens.spec.ts`（编辑 → 预览 → 保存 → 重新加载值保持）
    - 新增 `tests/unit/api/admin-design-tokens-write.test.ts`（校验 alias / schema / primitive 禁改）
  - **文档**：
    - `docs/decisions.md` 追加 ADR-043（Token 后台 MVP 增量补齐范围 + V2 推迟项）
- **验收**：
  - 开发环境：编辑 semantic.color.bg.canvas 的 light 值 → 保存 → iframe preview 立即反映 → 刷新后值保持 → 源文件已变更
  - 生产环境：保存按钮 disabled + 提示"生产环境只读" + API 返回 403
  - 继承指示：点击"解除继承"→ 字段从 base 值变为可独立编辑；"重置继承"→ 字段回到 base 值
  - Diff 面板：修改前后显示两列 JSON，可复制建议 commit message
  - Primitive 层字段不允许编辑（UI 灰态）
  - typecheck ✅ / lint ✅ / unit tests + E2E 全绿
- **注意事项**：
  - **不做**：新增 Token / 重命名 Token / WCAG 自动校验 / 多人协作冲突检测 / 视觉回归 — 这些归 V2
  - 写回采用 Node fs + @prettier/core 格式化，避免手动拼字符串
  - `.history/` 目录纳入 .gitignore（本地缓存不入版本）

### 5.5 REG-M2-01 — Root layout 四件套常驻化

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：M（~120 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — Root layout 契约设计 + rerender 隔离 + ADR-040
- **目标**：方案 §6 "持久化三件套 + 一个容器"。把 Nav/Footer/GlobalPlayerHost 占位/MainSlot 搬到 `apps/web-next/src/app/[locale]/layout.tsx`，各 page.tsx 去除 Nav/Footer 包裹。
- **前置**：REG-M1-03 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx`：
    - 在 BrandProvider 内渲染：`<Nav /> <main className="main-slot">{children}</main> <GlobalPlayerHostPlaceholder /> <Footer />`
    - `<GlobalPlayerHostPlaceholder />` 本轮仅是 `<div id="global-player-host-portal" />`，REG-M3-01 填充实际 Host
  - 修改 `apps/web-next/src/app/[locale]/page.tsx`（首页）：删除 `<Nav />` + `<Footer />` 包裹，只保留 HeroBanner + main 内容
  - 修改 `apps/web-next/src/app/[locale]/_lib/detail-page-factory.tsx`（5 详情页共用）：删除 Nav/Footer 包裹
  - 修改 `apps/web-next/src/app/[locale]/watch/[slug]/page.tsx`：删除 Nav/Footer 包裹
  - 修改 `apps/web-next/src/app/[locale]/next-placeholder/page.tsx`：同上
  - 验证 `tests/e2e-next/homepage.spec.ts`、`detail.spec.ts`、`player.spec.ts` 不依赖 Nav/Footer 的绝对位置选择器（如依赖则调整）
  - 新增 `docs/decisions.md` 追加 ADR-040（Root layout 常驻契约 + rerender 隔离边界）
- **验收**：
  - 首页 → 详情页 → /watch 跨页切换时，Nav 与 Footer 的 DOM 节点 **不重新挂载**（可用 `React DevTools Profiler` 或 E2E 断言 data-testid 元素引用相等）
  - 视觉上 Nav/Footer 在过渡期间不闪烁
  - typecheck ✅ / lint ✅ / E2E 全绿
- **注意事项**：
  - Nav 内部若有订阅 pathname 的逻辑（如高亮当前分类），通过 Client Component + `usePathname()` 订阅，不触发 layout 重渲
  - GlobalPlayerHostPlaceholder 必须在 Footer **之前**插入（z-index 层级准备：Host > Footer）
  - `main` 元素加 `min-h-screen` + safe-area-padding-bottom（为未来 mini player 预留）

### 5.6 REG-M2-02 — useBrand 驱动触点（Header/Footer/Logo/文案全清理）

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**haiku**（机械扫描替换）
- **规模估计**：S（~60 分钟）
- **子代理调用**：无（纯文本扫描）
- **目标**：方案 §7 + §5.5 "Header/Footer/Banner/Metadata 全部走品牌上下文"。扫描 apps/web-next 所有硬编码 "Resovo" / "流光" 字符串，替换为 `useBrand()` 读取。
- **前置**：REG-M2-01 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/layout/Nav.tsx`：Logo 文字从 useBrand().name 读取（SSR 与 CSR 一致）
  - 修改 `apps/web-next/src/components/layout/Footer.tsx`：版权文本 / ICP / 客服邮箱 / 社交链接全部 useBrand() 读取
  - 修改所有 `messages/*.json` 中的"Resovo"固化词条改为通用词条（如有）
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx` 的 metadata：title / description 从 useBrand() 读取
  - 扫描 `apps/web-next/src` 下所有 .tsx 文件，确保 `grep -n '"Resovo"\|'流光'' apps/web-next/src -r` 零命中（不含 i18n message 文件的 locale-specific fallback）
- **验收**：
  - 首页 / 详情页 / 播放页的 Nav Logo 显示正确
  - Footer 底部所有字段与 `brands/resovo.tokens.ts` 的 brand/identity + brand/footer 条目一致
  - 改 brands/resovo 的 `brand/identity/name` 为 "TestBrand" 后刷新，所有触点更新（仅开发环境测试，之后回滚）
  - typecheck ✅ / lint ✅
- **注意事项**：
  - 不动 "resovo" 这种 slug 字符串（它是 brand id，不是品牌名）
  - metadata 的 generateMetadata 中使用 useBrand 不可行（Server Component 限制），改为从 header 读 brand slug + 查 brands 表

### 5.7 REG-M2-03 — PageTransition + SharedElement + RouteStack primitives

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：L（~240 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — primitive API 契约（PageTransition / SharedElement / RouteStack）+ ADR-044
- **目标**：方案 §9 四类过渡（Sibling / Push+Shared / Takeover / Overlay）的**底层 primitive**。不接入任何现有页面——仅建立可被 M5 页面重制消费的基建。
- **前置**：REG-M2-01 ✅
- **文件范围**：
  - 新增 `apps/web-next/src/components/shared/primitives/PageTransition.tsx`：
    - API：`<PageTransition type="sibling|push|takeover|overlay" match={routeKey}>{children}</PageTransition>`
    - 底层实现：View Transitions API（支持时）+ CSS fallback（不支持时）
    - 接入 `prefers-reduced-motion` 降级（方案 §15.5）
  - 新增 `apps/web-next/src/components/shared/primitives/SharedElement.tsx`：
    - API：`<SharedElement id="poster-<videoId>">{children}</SharedElement>`
    - 两端带相同 id 的元素在路由切换时做 FLIP
    - 基础数学：`getBoundingClientRect()` 前后差值 → CSS transform 反向平移 → 动画还原到 0
  - 新增 `apps/web-next/src/components/shared/primitives/RouteStack.tsx`：
    - 方案 §14.4 返回手势的原语（移动端 touchstart 边缘 20px 内）
    - 桌面端降级为 `history.back()` 键盘绑定
  - 新增 `apps/web-next/src/lib/motion-tokens.ts`：从 `packages/design-tokens` 读 duration/easing 值暴露给 primitive
  - 新增单元测试 `tests/unit/web-next/primitives/`：FLIP 数学正确性 + reduced-motion 降级
  - 新增 `docs/decisions.md` 追加 ADR-044（四类过渡 primitive API 契约）
- **验收**：
  - primitive 可独立 import，不依赖任何具体页面
  - `tests/e2e-next/primitives.spec.ts` 建立一个临时 `/__dev/primitives` 页面（开发环境限定）展示四类过渡，E2E 断言动画时长 / 降级行为
  - `prefers-reduced-motion: reduce` 时所有过渡改为瞬时 opacity 切换
  - typecheck ✅ / lint ✅
- **注意事项**：
  - View Transitions API 在 Safari < 18 / Firefox 当前不支持 —— 必须有 fallback
  - SharedElement 对同图源 URL 强依赖（方案 §9.2 关键要求），primitive 层只做 DOM 动画，图源策略由消费方保证

### 5.8 REG-M2-04 — LazyImage + BlurHash primitive

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~90 分钟）
- **子代理调用**：无
- **目标**：方案 §15.2 + §17 的图片 primitive 层（含 BlurHash 占位），为 REG-M2-05 的 SafeImage 提供底层能力。
- **前置**：无（可与 REG-M2-03 并行）
- **文件范围**：
  - 新增 `apps/web-next/src/components/shared/primitives/LazyImage.tsx`：
    - API：`<LazyImage src="" blurHash="" aspectRatio={2/3} alt="" />`
    - 底层：Intersection Observer 触发加载；加载完成前显示 BlurHash canvas；接入 `next/image`
    - 支持 `priority` prop（首屏大图跳过 lazy）
  - 新增依赖：`blurhash@2.x`（解码器，~3kb gzipped）
  - 新增 `apps/web-next/src/lib/blurhash.ts`：decode + canvas 渲染封装
  - 新增单元测试 `tests/unit/web-next/LazyImage.test.tsx`
- **验收**：
  - LazyImage 在视口外不发起图片请求；进入视口后触发加载
  - BlurHash 字符串解码后显示在 canvas 上，加载完成后平滑切换为真实图
  - priority=true 时立即加载（SSR 不 lazy）
  - typecheck ✅ / lint ✅ / unit tests 全绿
- **注意事项**：
  - blurhash 包加入 package.json workspace 时需确认 CLAUDE.md 禁令 "不引入技术栈以外的新依赖" — BlurHash 在方案 §17 已明确采用，视为架构决策不触发 BLOCKER，但需在 changelog 注明"方案 §17 决策项"
  - 如 `next/image` 与 LazyImage 功能重叠严重，可改为 LazyImage 仅作 BlurHash 占位层 + next/image 做加载

### 5.9 REG-M2-05 — SafeImage + FallbackCover + Cloudflare Images Loader 契约

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：L（~240 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — loader 接口 + 四级降级链契约 + ADR-045
- **目标**：方案 §17 的 SafeImage primitive（含四级降级链）+ FallbackCover 样板图 + next/image 自定义 loader 契约预留（方案 F3 决议 Cloudflare Images + R2，本轮不实施但签约）。
- **前置**：REG-M2-04 ✅
- **文件范围**：
  - 新增 `apps/web-next/src/components/shared/primitives/SafeImage.tsx`：
    - API：`<SafeImage src blurHash fallbackKind="poster|backdrop|square" aspectRatio alt />`
    - 四级降级链：真实图 → BlurHash 占位 → `<FallbackCover>` 样板图 → CSS 渐变兜底
    - onError 事件上报 + 切换降级级别
  - 新增 `apps/web-next/src/components/shared/primitives/FallbackCover.tsx`：
    - API：`<FallbackCover kind="poster|backdrop|square|card|ultrawide" seed="" brandSeeds={[]} title="" />`
    - 运行时生成 SVG：品牌 token 驱动（从 useBrand().palette.fallbackSeeds 读）
    - 样板图四种 aspect（方案 §17 + primitive/aspect 子层）
  - 新增 `apps/web-next/src/lib/image-loader.ts`：
    - 默认 loader：passthrough（直接返回 src）
    - 预留 Cloudflare Images 模板（方案 §21 F3）：注释状态，实施开关由 env `NEXT_PUBLIC_IMAGE_LOADER=cloudflare` 控制（本轮不开启）
    - 契约：`(src, { width, quality, format }) => string`
  - 修改 `apps/web-next/next.config.ts`：images.loader 设为 'custom' + loaderFile 指向 image-loader.ts
  - 新增单元测试 `tests/unit/web-next/SafeImage.test.tsx`（四级降级链）、`tests/unit/web-next/FallbackCover.test.tsx`（不同 kind 产出不同 SVG）
  - 新增 `docs/decisions.md` 追加 ADR-045（图片 primitive 契约 + loader 预留）
- **验收**：
  - SafeImage 在 src 返回 404 时自动降级到 FallbackCover
  - FallbackCover 生成的 SVG 含品牌色块（不硬编码颜色）
  - image-loader.ts 契约与 Cloudflare Images URL 模板结构一致（未来切换零代码改动）
  - typecheck ✅ / lint ✅ / unit tests 全绿
- **注意事项**：
  - **不替换** apps/web-next 现有 `<img>` / `<Image>` 使用——本轮只建 primitive，方案 M4 再全站替换
  - FallbackCover 在 RSC/CSR 双端必须产出一致 SVG（避免 hydration mismatch）

### 5.10 REG-M2-06 — ScrollRestoration + PrefetchOnHover primitives

- **所属 SEQ**：SEQ-20260420-REGRESSION-M2
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：claude-sonnet-4-6
- **规模估计**：S（~60 分钟）
- **子代理调用**：无
- **目标**：方案 §15.1 / §15.2 的两个辅助 primitive。
- **前置**：REG-M2-03 ✅（二者共享 motion-tokens）
- **文件范围**：
  - 新增 `apps/web-next/src/components/shared/primitives/ScrollRestoration.tsx`：
    - 同层切换：每路由记忆 `scrollY`（sessionStorage）
    - 下钻 → 返回：保存 `{scrollY, lastVisibleCardId}`，返回时 jump + IntersectionObserver 校准
  - 新增 `apps/web-next/src/components/shared/primitives/PrefetchOnHover.tsx`：
    - API：`<PrefetchOnHover href="/video/xxx" delay={150}>{children}</PrefetchOnHover>`
    - PC hover 150ms 后触发 `router.prefetch(href)`
    - 移动端 noop（通过 matchMedia 探测）
  - 单元测试覆盖核心逻辑
- **验收**：
  - 同层路由切换回前页时 scrollY 恢复（E2E 断言）
  - PC 端 hover 卡片 150ms 后 Network 面板可见 prefetch 请求
  - typecheck ✅ / lint ✅
- **注意事项**：本轮不接入页面，M5 页面重制时消费

### 5.11 REG-M3-01 — GlobalPlayerHost + zustand 扩展 + ADR-041

- **所属 SEQ**：SEQ-20260420-REGRESSION-M3
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理（CLAUDE.md 强制升 Opus 情形 #4）
- **规模估计**：L（~240 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — GlobalPlayerHost API 契约 + playerStore 扩展 schema + /watch 路由消费模式 + ADR-041
- **目标**：方案 §13.2 "全局播放器宿主"。挂 root layout + zustand 单例 store + Portal 挂载 + full 态就绪（mini/pip 留给 REG-M3-02/03）。
- **前置**：REG-M2-01 ✅（Root layout 四件套必须先常驻化）
- **文件范围**：
  - 修改 `apps/web-next/src/stores/playerStore.ts`：
    - 扩展 state：`mode: 'closed' | 'full' | 'mini' | 'pip'`、`currentVideo`、`currentEpisode`、`playbackTime`、`isPlaying`、`queue`、`pendingMode?`
    - 扩展 actions：`enter({videoId, episodeId, mode='full'})`、`transitionTo(mode)`、`close()`、`updateProgress(time)`、`setEpisode(episodeId)`
    - 持久化：playbackTime + currentVideo 写 sessionStorage（刷新页面播放状态不中断）
  - 新增 `apps/web-next/src/components/player/GlobalPlayerHost.tsx`：
    - `'use client'` + `dynamic(..., { ssr: false })`（方案 §13.4）
    - 订阅 playerStore → 根据 mode 渲染不同容器（full: position fixed inset-0；mini: 后续 REG-M3-02 接入；pip: REG-M3-03）
    - 内部消费 `@resovo/player-core` 的 `<Player>` + PlayerShell 的字幕 / 线路 / 断点续播编排
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx`：把 REG-M2-01 占位的 `<GlobalPlayerHostPlaceholder />` 替换为 `<GlobalPlayerHost />`
  - 修改 `apps/web-next/src/components/player/PlayerShell.tsx`：从"页面级"改造为"模式级"——接受 `mode` prop + 根据 mode 调整布局（本轮 full 态逻辑与原来一致）
  - 新增单元测试 `tests/unit/web-next/playerStore.test.ts`（mode 状态机 + 持久化）
  - 新增 `docs/decisions.md` 追加 ADR-041（GlobalPlayerHost 契约）
- **验收**：
  - `<GlobalPlayerHost mode='full'>` 在 root layout 常驻，首屏 SSR 不渲染（dynamic ssr: false）
  - playerStore state 机合法（enter/transitionTo/close 路径覆盖）
  - typecheck ✅ / lint ✅ / unit tests 全绿
- **注意事项**：
  - 本卡**不改** /watch 页面对 Host 的消费模式 — 留给 REG-M3-04
  - 本卡**不做** mini 态 UI / pip 态 / FLIP 过渡
  - z-index：GlobalPlayerHost 的 full 态 = `z-overlay`，mini 态 = `z-pip-player = 80`（方案 §13.5）

### 5.12 REG-M3-02 — mini 态 UI + FLIP full↔mini 过渡

- **所属 SEQ**：SEQ-20260420-REGRESSION-M3
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无
- **目标**：方案 §13.3 "Spotify 模式"。mini 态 UI + full ↔ mini FLIP 过渡（220–360ms）。
- **前置**：REG-M3-01 ✅ + REG-M2-03 ✅（需要 SharedElement primitive）
- **文件范围**：
  - 新增 `apps/web-next/src/components/player/MiniPlayer.tsx`：
    - 移动端：浮于 Tab Bar 上方 56px（左封面 40×40 / 右播放暂停 + 关闭；下滑收起为一行"正在播放"胶囊）
    - 桌面端：右下 320×180
    - CSS 变量驱动（`var(--z-pip-player)` = 80）
  - 修改 `apps/web-next/src/components/player/GlobalPlayerHost.tsx`：mode='mini' 时渲染 MiniPlayer；full ↔ mini 切换时使用 SharedElement primitive 做 FLIP
  - 新增 `apps/web-next/src/components/player/playerTransitions.ts`：FLIP 具体数学（full rect → mini rect 的 transform）
  - 新增单元测试 + E2E 用例（mini 态显示 / full→mini 切换）
- **验收**：
  - full → mini：播放器缩到 mini 位置，动画 220–360ms
  - mini → full：反向动画 + 回到原占位
  - mini 态点击 → mini → full（状态机 transitionTo('full')）
  - 移动端 mini 下滑：mode 变为 'closed'（胶囊态），音视频不卸载（延后做）
  - **关键路径人工回归**：断点续播 / 线路切换 / 剧场模式 / 字幕 / **mini 态进出**
  - typecheck ✅ / lint ✅ / E2E 全绿
- **注意事项**：
  - mini 态由 GlobalPlayerHost 唯一渲染，不是 MiniPlayer 自己定位
  - Tab Bar 尚未在 apps/web-next 实装（方案 §14.1 属于 M5），本轮 mini 态先按"移动端浮于底部 + safe-area-inset-bottom"布局，M5 Tab Bar 上线后再调整 bottom 偏移

### 5.13 REG-M3-03 — pip 态（Picture-in-Picture）

- **所属 SEQ**：SEQ-20260420-REGRESSION-M3
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：claude-sonnet-4-6
- **规模估计**：S（~60 分钟）
- **子代理调用**：无
- **目标**：方案 §13.2 第三态 pip（浏览器原生 Picture-in-Picture）。
- **前置**：REG-M3-01 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/player/GlobalPlayerHost.tsx`：mode='pip' 时调用 HTMLMediaElement.requestPictureInPicture()
  - 修改 `apps/web-next/src/components/player/PlayerShell.tsx`（或 core 的控制条）：控制条加 pip 按钮，点击触发 `store.transitionTo('pip')`
  - 监听 `leavepictureinpicture` 事件：自动回 full 或 mini（取决于当前路由）
  - 新增 E2E（若环境支持；不支持则标记 skip 并记录 quarantine）
- **验收**：
  - Chrome / Edge 上点击 pip 按钮，视频进入浏览器原生 PiP 浮窗
  - 关闭 PiP 后自动回到 full（/watch 页）或 mini（其他页）
  - 不支持 pip 的浏览器（Safari iOS、某些 Firefox）pip 按钮不显示或 disabled
  - typecheck ✅ / lint ✅
- **注意事项**：
  - pip 是浏览器原生能力，不是 DOM 内自定义浮窗
  - PiP 不支持字幕自定义渲染（浏览器限制），需把字幕烧进 track element

### 5.14 REG-M3-04 — 路由切换语义 + /watch 接入 GlobalPlayerHost

- **所属 SEQ**：SEQ-20260420-REGRESSION-M3
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环）+ opus 子代理
- **规模估计**：M（~120 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — /watch 接入模式 + ADR-042（URL 保留决策）
- **目标**：方案 §13.3 路由切换语义落地。/watch 页不再自渲染 PlayerShell，改为 dispatch `store.enter({videoId, mode:'full'})`；离开 /watch → `store.transitionTo('mini')`；再进 /watch 同一视频 → `mini → full`。
- **前置**：REG-M3-01 ✅ + REG-M3-02 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/watch/[slug]/page.tsx`：
    - 页面不再渲染 `<PlayerShell>` 或 `<VideoPlayer>`
    - 改为 Client Component 在 useEffect 中 `store.enter({ videoId, mode: 'full' })`
    - 页面 DOM 只渲染"播放器占位"（空 div 占视口），实际播放器由 GlobalPlayerHost 用 portal 渲染到占位位置
  - 新增 `apps/web-next/src/hooks/usePlayerRouteSync.ts`：订阅 pathname，离开 /watch 转 mini；进入 /watch 且 currentVideo 匹配则 mini→full，不匹配则 enter 新视频（可选 ConfirmDialog 提示"替换当前播放？"）
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx`：挂 usePlayerRouteSync
  - 更新 `tests/e2e-next/player.spec.ts`：新增"跨路由 mini 持续"测试（进 /watch → 返回首页 → mini 态可见 → 点击 mini 返回 /watch → full 态）
  - 新增 `docs/decisions.md` 追加 ADR-042（/watch URL 保留决策 + 方案 §13.1 偏离说明）
- **验收**：
  - /watch 页播放中点击返回首页：播放器缩到 mini 态 + 继续播放 + 首页其他内容正常
  - 首页再次点击 /watch 同一视频：mini → full 平滑过渡（FLIP）
  - 点击 mini 区域任意位置：回到 /watch 页 full 态
  - 不同视频替换：弹 ConfirmDialog（可先简化为 confirm() 浏览器原生对话框，V2 升级组件）
  - **关键路径人工回归**：断点续播 / 线路切换 / 剧场模式 / 字幕 / mini 跨路由 / 替换视频提示
  - typecheck ✅ / lint ✅ / E2E 全绿
- **注意事项**：
  - URL 语义**保留** `/watch/[slug]`（决策 R-E），方案 §13.1 的 `/video/[id]/play` 推迟
  - 单视频 replay：不触发 ConfirmDialog
  - 播放器 Portal 目标：`#global-player-host-portal`（REG-M2-01 的占位）

### 5.15 REG-CLOSE-01 — REGRESSION PHASE COMPLETE + Opus 独立审计 + ADR-037

- **所属 SEQ**：SEQ-20260420-REGRESSION-CLOSE
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20 00:00
- **建议模型**：**opus**（主循环 + 审计 opus 子代理）
- **规模估计**：S（~90 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — REGRESSION 阶段独立审计（对照第 2 节对齐表 19 条逐条验收）
- **目标**：正式宣告 REGRESSION 阶段完成，解除 BLOCKER，为 exec-M4 启动清场。
- **前置**：REG-M1-01 至 REG-M3-04 全部 ✅
- **文件范围**：
  - 新增 `docs/milestone_alignment_20260420.md`：固化"方案 M# ↔ 执行里程碑"映射表 + 未来新里程碑命名协议（提议：执行里程碑从 exec-M4 起恢复使用方案编号对齐，即 exec-M4 = 方案 M4）
  - 新增 `docs/decisions.md` 追加 ADR-037（执行里程碑与方案里程碑对齐协议 — 历史偏差追认 + 未来对齐要求 + 每个 PHASE COMPLETE 必须含方案对齐表）
  - 更新 `docs/task-queue.md`：
    - 将 BLOCKER 通知块状态改为"已解除"
    - 追加 🚀 REGRESSION PHASE COMPLETE 通知块（含 14 张卡完成清单 + Opus 审计签字 + 解除条件确认）
  - 更新 `docs/changelog.md`：追加 REG-CLOSE-01 条目 + REGRESSION 阶段汇总
  - 更新 CLAUDE.md："绝对禁止"章节追加一条："未通过 PHASE COMPLETE Opus 审计的里程碑不得对外宣告完成（每个 PHASE COMPLETE 必须含方案对齐表）"
  - 更新 `docs/architecture.md`：追加 GlobalPlayerHost 章节 + 品牌 middleware 章节 + root layout 四件套章节
- **验收**：
  - 第 2 节对齐表 19 条全部打勾
  - 人工端到端回归：首页 → 详情页（push + FLIP） → /watch（takeover + FLIP）→ 返回首页（mini 态保持）→ 点击 mini（mini→full）→ pip 按钮（pip 态）→ 关闭 pip（回 full / mini）
  - Opus 独立审计 AUDIT RESULT: PASS
  - typecheck ✅ / lint ✅ / unit tests 全绿 / E2E 全绿
  - `grep -n 'REGRESSION' docs/task-queue.md` 命中 BLOCKER 解除块 + PHASE COMPLETE 块
- **注意事项**：
  - 审计员若发现 19 条中任一未达成 → 写 BLOCKER 补救卡，REGRESSION 未真正完成不得宣告
  - 此卡结束后 **才能** 开始 exec-M4（方案 M4 图片治理，或人工指定的其他序列）

---

## 6. 关键路径回归清单（M3 完成后必做）

REG-M3-02 + REG-M3-04 完成后，人工端到端回归必须覆盖：

1. **断点续播**：/watch 播放到 5:00 → 关闭 tab → 重开 → 恢复到 5:00 附近（sessionStorage 持久化）
2. **线路切换**：同一视频 5 个线路之间切换，播放进度保持
3. **剧场模式（影院模式）**：开启 / 关闭，控制条面板位置正确
4. **字幕开关**：多字幕轨道切换 + 无字幕源跳过
5. **mini 态进出**：/watch → 首页 → mini 可见 → 点击 → 回 /watch full 态
6. **替换视频**：当前有播放 → 进另一视频 /watch → ConfirmDialog 正确触发
7. **pip 态**：/watch full → 点击 pip 按钮 → 浏览器原生 PiP → 关闭 → 回 full
8. **跨路由 mini 连续播放**：首页 mini 播放中 → 进详情页 → mini 保持播放 → 进 /watch 不同视频 → ConfirmDialog

回归结果写入 REG-CLOSE-01 的 `changelog.md` 条目。

---

## 7. 下发协议与执行顺序

### 7.1 会话启动前

1. 人工把本补丁内容追加到 `docs/task-queue.md` 尾部（或以"前置阅读"形式 link 过去）
2. 第 3 节的 BLOCKER 通知块**必须先写入 task-queue.md**，确保下次会话启动时 workflow-rules 检查机制能识别 BLOCKER
3. tasks.md 必须为空（若有遗留卡片则人工决定移走或合并）

### 7.2 每次会话的启动流程

按照 `docs/rules/workflow-rules.md`：
1. 读 task-queue.md → 发现 BLOCKER（REGRESSION 阶段未完成）+ 下一张未完成 REG 卡片
2. 若 REG 序列全部完成 → 读到 PHASE COMPLETE 通知 → 可开始 exec-M4
3. 若 REG 序列未完成 → 只能执行下一张 REG 卡片，禁止自选其他任务

### 7.3 模型启动建议（人工传 --model 参数）

| 卡片 | 建议模型 |
|---|---|
| REG-M1-01 | `claude-opus-4-6`（主循环即为 opus，子代理同） |
| REG-M1-02 | `claude-opus-4-6` |
| REG-M1-03 | `claude-sonnet-4-6` |
| REG-M1-04 | `claude-opus-4-6` |
| REG-M2-01 | `claude-opus-4-6` |
| REG-M2-02 | `claude-haiku-4-5-20251001` |
| REG-M2-03 | `claude-opus-4-6` |
| REG-M2-04 | `claude-sonnet-4-6` |
| REG-M2-05 | `claude-opus-4-6` |
| REG-M2-06 | `claude-sonnet-4-6` |
| REG-M3-01 | `claude-opus-4-6` |
| REG-M3-02 | `claude-sonnet-4-6` |
| REG-M3-03 | `claude-sonnet-4-6` |
| REG-M3-04 | `claude-opus-4-6` |
| REG-CLOSE-01 | `claude-opus-4-6` |

### 7.4 规模汇总

- **总卡片数**：15 张（阶段 A 4 张 + 阶段 B 6 张 + 阶段 C 4 张 + 阶段 D 1 张）
- **规模估计**：
  - S（~60 min）：4 张（REG-M1-03 / REG-M2-02 / REG-M2-06 / REG-M3-03）
  - M（~120 min）：6 张（REG-M1-01 / REG-M1-02 / REG-M2-01 / REG-M2-04 / REG-M3-02 / REG-M3-04）
  - L（~240 min）：5 张（REG-M1-04 / REG-M2-03 / REG-M2-05 / REG-M3-01 / REG-CLOSE-01 暂记 S 但审计阶段可能延长）
  - 不含 REG-CLOSE-01：**约 26 小时纯执行时间**（不含代码审查 / 迭代 / 回归人工测试）
  - 按每会话 3-4 小时节奏，大约 **8–10 个会话** 完成

### 7.5 风险与缓解

| 风险 | 缓解 |
|---|---|
| 双轨主题统一（决策 R-A）可能破坏 ThemeToggle 现有 E2E | REG-M1-01 执行前先 export 当前 ThemeToggle E2E snapshot，opus 子代理设计需包含向后兼容的测试迁移方案 |
| GlobalPlayerHost 引入的 portal 跨 tree 渲染可能触发 Next.js 14 App Router hydration mismatch | REG-M3-01 强制 `dynamic(..., { ssr: false })` + 关键路径人工回归 |
| Token 后台写回落盘（REG-M1-04）可能与 CI 构建产物冲突 | 生产 env `DESIGN_TOKENS_WRITE_DISABLED=1` 强制只读；写回文件通过 prettier 格式化减少 diff 噪声 |
| View Transitions API 在 Safari < 18 降级 | REG-M2-03 必须实测 Safari 降级路径，primitive 层单元测试覆盖 fallback |
| SharedElement FLIP 在列表卡片 → 详情页间依赖同图源 URL | 本轮 primitive 不接入页面，M5 页面重制时再验证；PR 审查要求接入方在 PR 说明中断言图源 URL 一致 |
| REG-M3-04 /watch URL 保留不改（决策 R-E）导致方案 §13.1 长期偏离 | ADR-042 明确记录偏离 + M5 页面重制时重审 |
| Token 后台生产只读的 env 判定若漏写会造成生产可写事故 | 单元测试覆盖 NODE_ENV=production 返回 403；API 侧双重校验（路由级 middleware + service 层二次检查） |

---

## 8. 文档更新清单（REG-CLOSE-01 一并落地）

| 文件 | 操作 |
|---|---|
| `docs/decisions.md` | 追加 ADR-037（里程碑对齐协议）、ADR-038（双轨主题统一）、ADR-039（middleware 分层）、ADR-040（Root layout 契约）、ADR-041（GlobalPlayerHost）、ADR-042（/watch URL 保留）、ADR-043（Token 后台 MVP 增量）、ADR-044（过渡 primitive 契约）、ADR-045（图片 primitive 契约） |
| `docs/architecture.md` | §1 新增 GlobalPlayerHost / BrandProvider（apps/web-next）小节；§2 追加 apps/web-next 品牌 middleware 分层说明 |
| `docs/milestone_alignment_20260420.md` | 新建 — 方案 M# ↔ 执行里程碑映射表 + 未来对齐协议 |
| `docs/changelog.md` | REG-M1-01 至 REG-CLOSE-01 共 15 条目 + REGRESSION 阶段汇总 |
| `docs/task-queue.md` | BLOCKER 通知 → 解除块 → REGRESSION PHASE COMPLETE 块 |
| `CLAUDE.md` | "绝对禁止"追加一条（PHASE COMPLETE 必须含方案对齐表） |
| `docs/rules/workflow-rules.md` | "重写期测试基线例外" 小节追加"回归补齐"子条款 |
| `docs/known_failing_tests_phase0.md` | REG-M3-04 完成后必要时更新（DanmakuBar 条目在本补丁范围内不动） |

---

## 9. 本补丁的生效方式

1. 人工把本补丁**完整追加**到 `docs/task-queue.md` 的"任务序列池"章节尾部（或作为独立序列 SEQ-20260420-REGRESSION-M1/M2/M3 + SEQ-20260420-REGRESSION-CLOSE）
2. 把第 3 节的 BLOCKER 通知块**显著放在 task-queue.md 顶部或 BLOCKER 专用章节**，确保 workflow-rules 首检命中
3. 把第 7.3 节模型建议传达给每次启动 Claude Code 会话的操作人
4. REG-CLOSE-01 完成后删除 BLOCKER 通知，开始 exec-M4

---

**本补丁签字**：主循环 claude-opus-4-7（主审计 + 起草），对照三份原方案（design_system_plan / frontend_redesign_plan / image_pipeline_plan）逐条核对。

**关联工单**：无（REGRESSION 阶段是对既有 M1/M2/M3 的补齐，不新增业务需求）
