# M5 真·PHASE COMPLETE 方案 ↔ 执行对齐表（最终版）

- **创建日期**：2026-04-21
- **关联里程碑**：M5 — 页面重制（含 CLEANUP 收尾序列）
- **前置对齐表**：`docs/milestone_alignment_m5_20260420.md`（M5-CLOSE-01 主序列 30 项对齐）
- **关联 ADR**：ADR-037（REGRESSION 对齐闭环 + 真·PHASE COMPLETE 门禁）、ADR-048（M5 卡片协议 v1.1）、ADR-049（@dnd-kit admin 选型）
- **关联补丁**：`docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md`、`docs/task_queue_patch_m5_cleanup_20260421.md`
- **关联方案**：`docs/frontend_redesign_plan_20260418.md`、`docs/design_system_plan_20260418.md`、`docs/image_pipeline_plan_20260418.md`
- **审计签字**：Opus arch-reviewer (claude-opus-4-6) 独立审计 — **PASS**
- **签字日期**：2026-04-21
- **审计结论**：10 项必查全部 PASS（2 项非阻断 WARN）；解除 `🛑 BLOCKER — M5-CLEANUP 启动`；M5 里程碑真·PHASE COMPLETE，允许启动 M6

---

## 0. 前后关系

本文档是 `milestone_alignment_m5_20260420.md`（主序列签字挂起版）的**真·闭环继任**。阅读顺序：

1. 主序列 30 项对齐 + 15 项红旗 → 见 `milestone_alignment_m5_20260420.md`（M5-CLOSE-01 起草，arch-reviewer 以 CONDITIONAL → PASS 验收，三类结构性偏差转入 CLEANUP）
2. CLEANUP 补充 5 项对齐 + 3 项红旗 → 本文档 §1 / §2
3. 真·PHASE COMPLETE 审计 10 项必查 → 本文档 §3

合计：**35 项对齐（30 主 + 5 CLEANUP）+ 18 项红旗（15 主 + 3 CLEANUP）+ 10 项必查**，全部 PASS。

---

## 1. CLEANUP 补充对齐明细（5 项，续 #30）

> 说明：#1-#30 承接 `milestone_alignment_m5_20260420.md` §1，本节起编号从 #31 续。

| # | 方案章节 | 方案要求 | 实现位置 | 任务卡 | 状态 |
|---|---------|---------|---------|--------|------|
| **design_system_plan §3 Token 分组** | | | | | |
| 31 | design_system §3 Takeover Token 层 | 3 时长（fast mobile/desktop、standard）+ mask color × 2 + floating play bg/fg | `packages/design-tokens/src/semantic/takeover.ts`（新建 36 行，7 字段）+ `index.ts` L31-32 export + `apps/web-next/src/app/globals.css` 对应 `:root` 声明 | M5-CLEANUP-01 | ✅ |
| 32 | design_system §3 Tabbar Token 层 | height 56px / blur 12px / bg light+dark / underline color + transition duration 180ms | `packages/design-tokens/src/semantic/tabbar.ts`（新建 28 行，5 字段）+ `index.ts` L34-35 export | M5-CLEANUP-01 | ✅ |
| 33 | design_system §3 SharedElement Token 层 | duration 360ms + easing cubic-bezier(0.4,0,0.2,1) + fallback 120ms | `packages/design-tokens/src/semantic/shared-element.ts`（新建 11 行，3 字段）+ `index.ts` L37-38 export | M5-CLEANUP-01 | ✅ |
| 34 | design_system §3 RouteStack Token 层 | edge trigger 20px / threshold 0.3 / velocity 0.5 / duration 240ms | `packages/design-tokens/src/semantic/route-stack.ts`（新建 13 行，4 字段）+ `index.ts` L40-41 export | M5-CLEANUP-01 | ✅ |
| **frontend_redesign §9.5 / §16 组件规格** | | | | | |
| 35 | frontend_redesign §16 StackedPosterFrame 三档叠加 + CinemaMode Token 化 | `stackLevel: 0 \| 1 \| 2` 三档签名 + `getStackLevel` series/anime/variety→2 其余→0；CinemaMode `background: var(--cinema-overlay-bg)` 替换 color-mix 硬编码 | `apps/web-next/src/components/primitives/media/StackedPosterFrame.tsx` L11 + L16-25；`apps/web-next/src/lib/video-stack-level.ts` L4-8；`apps/web-next/src/app/[locale]/_lib/player/CinemaMode.tsx` L37；`globals.css` L615-618 `--cinema-overlay-bg` 声明 | M5-CLEANUP-02 | ✅ |

### 记账偏差（非阻断 WARN）

| 项 | 规格原文 | 实际 | 处置 |
|---|---------|------|------|
| admin-banners 单测路径 | `tests/unit/server/admin-banners.test.tsx` | `tests/unit/components/admin/banners/BannerForm.test.tsx`（7 个 it） | arch-reviewer WARN：内容等价通过；路径与 monorepo 其他 unit 测试目录约定一致，规格原文为旧路径习惯。不回滚。 |
| 主序列数量 | "主序列 15 张 + CLEANUP 3 张 + CLOSE-02" | 实际主序列 18 张（PREP 2 + CARD 6 + API/ADMIN 2 + PAGE 7 + CLOSE-01 1）+ CLEANUP 3 + CLOSE-02 1 = 22 张 | arch-reviewer WARN：数字口径修正为 18 / 22，实装更完整。不回滚。 |

---

## 2. CLEANUP 补充红旗检查（3 项，续 RF-15）

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| **§9.5 Token 治理（深化）** | | | |
| RF-16 | design-tokens 包内 takeover / tabbar / shared-element / route-stack 四分组 TS 文件存在且字段齐全 | ✅ | 见本文档 §1 #31-#34 文件路径 + 行号；index.ts L31-41 全 export |
| RF-17 | apps/web-next 组件层无 `var(--foo, non-color-fallback)` 内联 fallback | ✅ | GlobalPlayerFullFrame.tsx L63 / MiniPlayer.tsx L49 / L57-58 均无 fallback；仅残留合法级联（`var(--x, var(--y))` 皆为 color→color）或 CSS 内容占位（`var(--brand-initial, '')` 非颜色非组件内联） |
| **§16 组件契约（补齐）** | | | |
| RF-18 | StackedPosterFrame 类型签名 + buildShadow 支持 0/1/2 三档；CinemaMode 颜色零硬编码 | ✅ | StackedPosterFrame.tsx L11 `stackLevel: 0 \| 1 \| 2`；L16-25 buildShadow 按 level 返回 0/1/2 层 box-shadow；CinemaMode.tsx L37 `var(--cinema-overlay-bg)` 单源 |

---

## 3. M5-CLOSE-02 arch-reviewer 独立审计（10 点必查）

**审计模型**：claude-opus-4-6（arch-reviewer 子代理）
**审计时间**：2026-04-21
**审计方法**：只读静态检查 + 文件读取 + grep 比对
**主循环上下文**：Opus 4.7 主循环（claude-opus-4-7）spawn，审计结果直接决定本里程碑是否可关闭

### 10 点必查项

| # | 必查项 | 结论 | 关键证据 |
|---|--------|------|---------|
| 1 | Token 新增 4 组（takeover / tabbar / shared-element / route-stack）在 design-tokens 构建产物中可 grep | **PASS** | `packages/design-tokens/src/semantic/takeover.ts` L3-36 / `tabbar.ts` L3-28 / `shared-element.ts` L1-11 / `route-stack.ts` L1-13；`index.ts` L31-41 全部 export |
| 2 | 组件层无 `var(--foo, non-color-fallback)` 内联 fallback | **PASS** | GlobalPlayerFullFrame.tsx L63 `zIndex: 'var(--z-full-player)'` 无 fallback；MiniPlayer.tsx L49 / L57-58 `--z-mini-player` / `--transition-shared` / `--ease-page` 无 fallback；globals.css L445 `var(--brand-initial, '')` 为 CSS 字符串占位，非颜色非组件内联 |
| 3 | StackedPosterFrame `stackLevel: 0 \| 1 \| 2` 类型签名 | **PASS** | StackedPosterFrame.tsx L11；L16-25 buildShadow 对 1/2 正确返回单/双层 box-shadow；lib/video-stack-level.ts L4-8 series/anime/variety → 2，其余 → 0（1 预留给显式传入） |
| 4 | CinemaMode 无硬编码颜色 | **PASS** | CinemaMode.tsx L37 `background: 'var(--cinema-overlay-bg)'` 单源 |
| 5 | `--cinema-overlay-bg` Token 已声明 | **PASS** | globals.css L615-618 `:root` 单一定义 `color-mix(in srgb, black 55%, transparent)`；黑色 × 55% 透明度对明暗态均适用，单一定义合理 |
| 6 | ADR-049 已落盘且 admin-module-template 已引用 | **PASS** | `docs/decisions.md` L1550-1573 ADR-049 已接受；`docs/rules/admin-module-template.md` L93-112 含有序列表章节 + SortableList Props 契约；`apps/server/src/components/admin/shared/SortableList.tsx` 实装齐全 |
| 7 | admin-banners 单测 ≥ 6 it | **PASS（路径 WARN）** | `tests/unit/components/admin/banners/BannerForm.test.tsx` 含 7 个 `it(...)`（L121 / L126 / L136 / L152 / L160 / L172 / L191）；路径偏离规格但内容等价 |
| 8 | milestone_alignment_m5_20260420.md 签字行已更新 | **PASS** | L8-10 已填 "Opus arch-reviewer (claude-opus-4-6) 独立审计"、日期 2026-04-21、明确结论，不再为待办占位 |
| 9 | 主序列 + CLEANUP 3 张 + CLOSE-02 全部 ✅ | **PASS（口径 WARN）** | task-queue.md 主序列 18 张全 ✅（ADMIN-BANNER ⚠️ 延期已在 M5-CLOSE-01 接受）；CLEANUP-01/02/03 L8972 / L8998 / L9021 均 ✅；CLOSE-02 本卡完成后标 ✅ |
| 10 | 关键路径（断点续播 / 影院模式 / mini↔full↔pip / Fast Takeover）未回退 | **PASS（静态）** | `stores/playerStore.ts` LEGAL_TRANSITIONS 完整；CLEANUP 变更仅 Token 引用 + stackLevel 枚举扩展，不触碰 shell/core 编排。主循环补跑 `npm run test:e2e` 确认 runtime 回归 |

### 审计最终结论

> **AUDIT RESULT: PASS**
>
> 10 项全部 PASS（其中第 7 / 9 项各带一个非阻断 WARN：测试文件路径偏离规格、主序列口径从 15 修正为 18，均属记账偏差而非功能缺失）。ADMIN-BANNER 两项延期（图片上传 + E2E）已在 M5-CLOSE-01 接受记录在案，不影响本次签字。CLEANUP 三卡修复内容精确命中 BLOCKER 触发原因（Token 层 / 组件规格 / 文档签字），无越界改动。
>
> **arch-reviewer (claude-opus-4-6) — PASS — 2026-04-21**

---

## 4. 真·PHASE COMPLETE 判定

依据 ADR-037（迭代：M5 真·PHASE COMPLETE 门禁）：

| 判定项 | 要求 | 实际 | 结论 |
|-------|------|------|------|
| 方案对齐表 | ≥ 25 项 | 35 项（30 主 + 5 CLEANUP） | ✅ |
| 红旗检查 | ≥ 15 项 | 18 项（15 主 + 3 CLEANUP） | ✅ |
| Opus arch-reviewer 必查项 | ≥ 5 点（ADR-048 / 卡范围 / Token / E2E / 方案漂移） | 10 点（CLOSE-02 深化审计） | ✅ |
| 审计结论 | PASS | PASS（2 WARN 非阻断） | ✅ |
| 质量门禁 | typecheck ✅ / lint ✅ / unit ✅ / e2e ✅ | 主循环运行记录见 changelog | ✅ |

**M5 里程碑真·PHASE COMPLETE 成立** → 解除 `🛑 BLOCKER — M5-CLEANUP 启动`，允许启动 M6。

---

## 5. 遗留项（不阻断 M6 启动）

| 项 | 处置 | 跟踪位置 |
|---|------|---------|
| M5-ADMIN-BANNER-01 图片上传（无基础设施）+ Banner E2E | 已在 M5-CLOSE-01 接受为延期；待图片基础设施就绪后补卡 | task-queue.md L9038 前已登记 ⚠️ |
| admin-banners 单测路径偏离 | 本次 WARN，不回滚；后续若再写 server 层纯 unit 可合并为一个统一入口 | 本文档 §1 记账偏差 |
| 主序列数量口径 | 本次 WARN，实际 18 张更完整；补丁模板下次引用时修正 | 本文档 §1 记账偏差 |

---

*主循环模型：claude-opus-4-7；子代理：arch-reviewer (claude-opus-4-6)。起草 + 审计 + 签字于 2026-04-21 完成。*
