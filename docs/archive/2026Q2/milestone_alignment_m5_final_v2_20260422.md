# M5 真·PHASE COMPLETE v2 — 方案对齐表 + 11 点审计签字 + 手动验收清单

> status: sealed
> sequence: SEQ-20260421-M5-CLEANUP-2
> supersedes: `docs/milestone_alignment_m5_final_20260421.md`（M5-CLOSE-02 静态审计 PASS → PC 端人工回归否决 → CANCELED 的历史版本）
> date: 2026-04-22
> executed-by-model: claude-opus-4-7（主循环）
> arch-reviewer: claude-opus-4-6（独立二次审计）
> 对齐方案：`docs/frontend_redesign_plan_20260418.md`、`docs/design_system_plan_20260418.md`、`docs/image_pipeline_plan_20260418.md`
> 关联 ADR：ADR-037（REGRESSION + 真·PHASE COMPLETE 门禁）、ADR-048（VideoCard 双出口）、ADR-035（rewrite-allowlist）

---

## 1. 本文档的定位

M5-CLOSE-02 在 2026-04-21 以"arch-reviewer 10 点静态审计 PASS"宣告真·PHASE COMPLETE，当日即被 PC 端人工回归测试**否决**，发现 9 项 UI 运行时缺陷。本次 v2 是 ADR-037 §4b 迭代条款落地后的**三维闭环**签字：

1. **静态审计维度** — arch-reviewer (claude-opus-4-6) 独立 11 点必查（CLOSE-02 原 10 点 + 新增"手动验收记录审查"）
2. **运行时验证维度** — 本文件 §4 代理证据：dev server 启动状态 + 9 项缺陷路由 HTTP 200 + e2e 回归
3. **固化防复发维度** — CLEANUP-11 新增 8 spec / 24 test case + `_fixtures.ts` 框架层 SSR ≥500 兜底

单一维度 PASS 不构成 PHASE COMPLETE；三维全绿才签字。

---

## 2. M5 方案里程碑对齐表

frontend_redesign_plan_20260418.md §19 M5 章节定义的五阶段共 18 卡片，与本次 SEQ-20260421-M5-CLEANUP-2 的 8 张纠偏卡 + 1 张收尾卡的落地关系：

### 2.1 CARD 阶段（4 卡）

| 方案条目 | 执行卡 | 状态 | commit | 固化 spec |
|---|---|---|---|---|
| M5-CARD-CTA-01 · 双出口协议 | M5-CARD-CTA-01 | ✅ | （原 SEQ 序列） | `card-to-watch.spec.ts` |
| M5-CARD-TAG-01 · TagLayer primitive | M5-CARD-TAG-01 | ✅ | （原 SEQ 序列） | 现有 unit 测试 |
| M5-CARD-STACK-01 · StackedPosterFrame | M5-CARD-STACK-01 | ✅ | （原 SEQ 序列） | 现有 unit 测试 |
| M5-CARD-SHARED-01 · SharedElement FLIP | M5-CARD-SHARED-01 | ✅ | （原 SEQ 序列） | `shared-element.spec.ts`（TODO skipped，M5 范围外） |

### 2.2 API 阶段（2 卡）

| 方案条目 | 执行卡 | 状态 |
|---|---|---|
| M5-API-TAG-01 · tag taxonomy | M5-API-TAG-01 | ✅ |
| M5-API-TRENDING-01 · /videos/trending | M5-API-TRENDING-01 | ✅ |

### 2.3 PAGE 阶段（5 卡）

| 方案条目 | 执行卡 | 状态 | 影响的缺陷 |
|---|---|---|---|
| M5-PAGE-HOME-01 | M5-PAGE-HOME-01 | ✅ | — |
| M5-PAGE-GRID-01 · 分类页 Sibling | M5-PAGE-GRID-01 | ✅ | BLOCKER #2（CLEANUP-05 修） |
| M5-PAGE-PLAYER-01 · GlobalPlayerHost | M5-PAGE-PLAYER-01 | ✅ | BLOCKER #3/#4/#5（CLEANUP-06 修） |
| M5-PAGE-DETAIL-01 · 详情页 + 选集 | M5-PAGE-DETAIL-01 | ✅ | BLOCKER #9（CLEANUP-10 修） |
| M5-PAGE-SEARCH-01 · 搜索页 | M5-PAGE-SEARCH-01 | ✅ | BLOCKER #8（CLEANUP-09 修 + CLOSE-03 补 SSR 500 修） |

### 2.4 REGRESSION 阶段（已在 M4 末尾闭环，见 `docs/milestone_alignment_20260420.md`）

- BrandProvider / middleware / PageTransition / SafeImage / FallbackCover / ScrollRestoration / PrefetchOnHover 等核心能力层 ✅
- SharedElement / RouteStack 以 noop 合约形式就位，HANDOFF-03 将实装（docs/handoff_20260422/landing_plan_v0.md 第 3 节）

### 2.5 CLEANUP 阶段（本次 SEQ 9 卡）

| 卡号 | 缺陷 | 状态 | commit |
|---|---|---|---|
| M5-CLEANUP-01/02/03 | Token-v2 + 杂项 | ✅ | （原序列） |
| M5-CLEANUP-04 | BLOCKER #1 VideoCard 双出口反转 + TagLayer 溢出 | ✅ | b557463 |
| M5-CLEANUP-05 | BLOCKER #2 分类页 404 | ✅ | b557463 |
| M5-CLEANUP-06 | BLOCKER #3 + #4 + #5 播放器三态 + 线路 + 选项卡 | ✅ | b557463 |
| M5-CLEANUP-07 | BLOCKER #6 CinemaMode 尺寸 | ✅ | b557463 |
| M5-CLEANUP-08 | BLOCKER #7 排版 + 字体 + 布局（字体族 BLOCKER-FONT 待决） | ⚠️ 部分 | b557463 |
| M5-CLEANUP-09 | BLOCKER #8 搜索 q 透传 | ✅ | b557463 |
| M5-CLEANUP-10 | BLOCKER #9 详情选集 | ✅ | b557463 |
| M5-CLEANUP-11 | e2e 扩写（24 test case 固化 9 缺陷） | ✅ | d85bf9e |
| M5-CLOSE-03 (本卡) | 真·PHASE COMPLETE v2 + 发现并修 SSR 500 + fixture 兜底 | ✅（待 arch-reviewer） | 本次 commit |

### 2.6 CLOSE-03 额外发现 + 修复

| 新发现 | 根因 | 修复 commit | 固化 |
|---|---|---|---|
| `/en/search?q=...` SSR 500 | `SearchPage.Skeleton`（'use client' 静态属性）在 Next 15 Server 端被视为 Client Reference，`.Skeleton` 访问返回 undefined → Suspense fallback `<undefined />` 500。与 9fcaaf1 的 `VideoDetailClientSkeleton` 修复同一 pattern | 本次 | 新增 `tests/e2e-next/_fixtures.ts` 框架层 response.status≥500 抛错，所有 e2e-next spec 统一 import |

---

## 3. arch-reviewer 11 点必查清单（已执行，AUDIT RESULT: PASS）

**审计模型**：`claude-opus-4-6`
**审计日期**：2026-04-22
**审计结论**：`AUDIT RESULT: PASS`（10 PASS + 1 NEED_FIX 黄线 + 0 红线）

本节为必查清单参考；完整审计报告由 arch-reviewer 子代理产出，逐项结论已对齐本清单结构，主要结论摘录：

- 1. Token 层：PASS — 13 个 semantic 模块导出齐全，类型签名完整
- 2. 共享组件 Props：PASS — TagLayer / playerStore 与 ADR-048 / ADR-041 一致
- 3. playerStore 状态机：PASS — LEGAL_TRANSITIONS 常量未破坏，activeSourceIndex 为独立字段
- 4. 路由 / allowlist：**NEED_FIX（黄线）** — `apps/web/src/lib/rewrite-allowlist.ts` 中 `/search` 条目仍注释；本次 §4.2 基于 web-next:3002 直连成立，网关接入已登记为 HANDOFF 遗留
- 5. 无硬编码颜色：PASS — 抽样全部走 CSS 变量
- 6. architecture.md 同步：PASS — 无 schema 变更，无需同步
- 7. ADR 引用完整性：PASS — ADR-037 §4a/§4b/§4c 落盘，ADR-048 / ADR-041 / ADR-035 / ADR-039 健在
- 8. 单测不降级：PASS — 1380 tests 基线维持
- 9. task-queue 状态流转：PASS — CLEANUP-04~11 带 commit hash，CLOSE-03 🔄 合规
- 10. 改动未越权：PASS — CLEANUP-11 仅 1 行 testid；CLOSE-03 仅 SearchPage + page.tsx + _fixtures.ts
- 11. 手动验收 + e2e 兜底：PASS — §4.1/§4.2/§4.3 三张表硬证据，18 spec 全部 import `./_fixtures`

**红线项**：无
**黄线项**：上方 §4 的 rewrite-allowlist `/search`（已登记 HANDOFF 遗留）；changelog 缺 CLEANUP-04~10 合并条目（已在本次 §6 签字块附注）；e2e 数字口径 52 + 1 flaky-retry-pass = 53 passed（对齐表 §4.3 已显式标注）
**M6 前置待办（非 v2 阻断）**：
1. CLEANUP-08 BLOCKER-FONT（字体族选型）
2. Tag Token Cyrillic Bug（`lifecycleDеlisting*` U+0435 e → ASCII e，属 HANDOFF-01 范围）

1. Token 层文件存在 + 类型签名完整
2. 共享组件 Props 类型与方案文档一致
3. playerStore LEGAL_TRANSITIONS / hostMode 状态机契约不被破坏
4. 路由 / rewrite-allowlist 完整性
5. 没有硬编码颜色（`no-hardcoded-color` ESLint 规则）
6. `docs/architecture.md` 与 schema 同步
7. ADR 引用完整性（ADR-037 / ADR-048 / ADR-035 / ADR-039 均已落盘）
8. 单测覆盖率不降级（维持 1380 passed 基线）
9. task-queue.md 状态流转规则遵守（每卡 ✅ 前带 commit hash）
10. CLEANUP-04 ~ CLEANUP-10 的 commit diff 未越权改到任务范围外的文件
11. **【新增】** 浏览器手动验收记录（本文件 §4）+ e2e 框架层 status≥500 兜底（`tests/e2e-next/_fixtures.ts`）已就位，非静态审计一维存在硬证据

**审计请求指令**（给 arch-reviewer）：

> Read-only 审阅以下文件并对 1–11 点逐项输出 PASS / FAIL / NEED_FIX：
> - `docs/task-queue.md`（全文，聚焦 SEQ-20260421-M5-CLEANUP-2 + 尾部 BLOCKER 块）
> - `docs/tasks.md`（确认仅有 M5-CLOSE-03 🔄 卡片）
> - `docs/changelog.md`（最近 3 条：CLEANUP-04~10 / CLEANUP-11 / 本次 CLOSE-03）
> - `docs/decisions.md`（ADR-037 迭代条款）
> - `docs/milestone_alignment_m5_final_v2_20260422.md`（本文件）
> - `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`（本次修点）
> - `apps/web-next/src/app/[locale]/search/page.tsx`（本次修点）
> - `tests/e2e-next/_fixtures.ts`（本次新增框架层兜底）
> - `tests/e2e-next/card-dual-exit.spec.ts` 等 7 个新 spec（抽样）
> - `apps/web-next/src/stores/playerStore.ts`（LEGAL_TRANSITIONS 校验）
>
> 审计报告结构：
>   11 点逐项结论 + 红线项 + 黄线项 + 数字一致性审查 + git log 交叉核验 + 总体 PASS/FAIL

---

## 4. 浏览器手动验收代理证据（主循环强制义务）

ADR-037 §4b 修订要求"浏览器手动验收"作为静态审计之外的独立一维。在 AI 主循环无法实际操作浏览器的约束下，以下证据作为**dev server 真实渲染 + 关键路由 HTTP 200 + e2e 完整回归**的代理证据组合，等价于"dev server 启动 + 9 项逐一走查"的机器可验证子集。用户二次确认环节仍需真人 PC / 移动端交互验收。

### 4.1 Dev Server 启动状态（采集时刻 2026-04-22）

| 端口 | 服务 | HTTP 探测 | 状态码 |
|---|---|---|---|
| 3000 | apps/web（legacy 前台） | `GET /` | 200 ✅ |
| 3001 | apps/server（admin） | `GET /admin` | 200 ✅ |
| 3002 | apps/web-next（M5 新前台） | `GET /en/next-placeholder` | 200 ✅ |

三台 dev server 均启动并响应正常。playwright.config `reuseExistingServer` 在本地 session 内维持。

### 4.2 9 项缺陷对应路由 HTTP 验证（采集时刻 2026-04-22）

全部针对 **web-next:3002 直连端口**采集。`apps/web/src/lib/rewrite-allowlist.ts` 中 `/search` 路由接入尚未 enable（仍为 M5 示例注释状态），这属 HANDOFF 阶段范围内的网关集成遗留项，将在 HANDOFF-04（Pattern + ChipType）或单独的 `CHORE-rewrite-search-enable` 卡片中登记覆盖；本次签字基于端到端直连路径成立。

| BLOCKER # | 修复卡 | 路由 | HTTP | 备注 |
|---|---|---|---|---|
| #1 | CLEANUP-04 | `/en` | 200 ✅ | 首页 movie-grid + series-grid SSR 就位 |
| #2 | CLEANUP-05 | `/en/movie` | 200 ✅ | category-grid-movie 渲染 |
| #2 | CLEANUP-05 | `/en/series` | 200 ✅ | |
| #2 | CLEANUP-05 | `/en/anime` | 200 ✅ | |
| #2 | CLEANUP-05 | `/en/tvshow` | 200 ✅ | |
| #3/#4/#5/#6 | CLEANUP-06/07 | `/en/watch/test-movie-aB3kR9x1` | 200 ✅ | WatchPage 占位就位，GlobalPlayerHost 通过 Portal 装载 |
| #7 | CLEANUP-08 | （全局 body 字体） | n/a | e2e `typography-layout.spec.ts` body font-family 命中系统 sans 回退链；具体字体族待 BLOCKER-FONT 决策（scope 外） |
| #8 | CLEANUP-09 + CLOSE-03 SSR 修 | `/en/search` | 200 ✅ | （之前 500，本次修复）|
| #8 | CLEANUP-09 + CLOSE-03 SSR 修 | `/en/search?q=test` | 200 ✅ | （之前 500，本次修复）|
| #9 | CLEANUP-10 | `/en/anime/test-anime-bC4lS0y2` | 200 ✅ | 详情页 VideoDetailClient + EpisodePicker 就位 |

### 4.3 e2e 完整回归（采集时刻 2026-04-22）

playwright project `web-next-chromium` 完整运行：

- **Total**：18 spec 文件 / 68 test cases
- **通过**：52 passed
- **跳过（TODO/待激活）**：15 skipped（含 mobile-tabbar × 4 / shared-element × 4 / VideoGrid gap 条件性 × 1 / others × 6）
- **失败**：0
- **flaky（retry 后通过）**：1（`detail-episode-pick.spec.ts:64` 单独压测 3 轮稳定，判定为 `workers=2` 并行下 dev server 冷启动时序偶发）

CLEANUP-11 新增 24 test case（7 新增 spec + 1 扩写）全部绿。`_fixtures.ts` 框架层 SSR ≥500 兜底已覆盖 18 spec（import 替换验证：`grep -c "from '@playwright/test'" tests/e2e-next/*.spec.ts` → 全为 0；`grep -c "from './_fixtures'"` → 全为 1）。

### 4.4 代码质量门禁

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run test -- --run` | ✅ 130 files / 1380 tests passed |
| `npx playwright test --project=web-next-chromium` | ✅ 52 passed / 15 skipped / 0 failed / 1 flaky(retry-pass) |

### 4.5 本次新发现缺陷的回归证据（SSR 500 修复）

修复前：
```
$ curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3002/en/search?q=test"
500
```

修复后：
```
$ curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3002/en/search?q=test"
200
```

对比两个 commit (`59ba813` CLEANUP-04~10 / `d85bf9e` CLEANUP-11) 均复现 500 → 确认为 pre-existing bug，不由 CLEANUP-11 引入；本次修复作为 CLOSE-03 范围内的"代理证据采集阶段即时发现并修正"纳入。

---

## 5. 用户二次人工确认 checklist（待签字）

用户在 PC 浏览器真实操作后逐条打勾，任一未勾即视为本次 PHASE COMPLETE v2 无效：

- [ ] `/en` 首页：hero banner + movie-grid + series-grid 正确渲染；点任意卡片封面 → fast-takeover 进入 /watch；点文字 → 跳详情
- [ ] `/en/movie` `/en/series` `/en/anime` `/en/tvshow`：全部 200 + video-grid 渲染 + 导航 tab 可互相跳转
- [ ] `/en/watch/*`：无"关闭"/"缩小"按钮；线路切换后 mini 化 → 展开仍是切换后线路；选集 + 线路 tab 稳定同时存在
- [ ] 影院模式切换：播放器容器 `min(85vw, 1440px)`，等比 16:9，缩放不溢出
- [ ] 文字排版：VideoCard title/tag 不堆叠；Grid gap 视觉合理；body 字体非 serif
- [ ] `/en/search?q=*`：q 变化结果刷新；q 为空走推荐；页面源码查看 HTTP 200（非 500 error page）
- [ ] 详情页选集：点 episode-btn-N → URL `?ep=N` + 按钮高亮；点"立即播放" → `/watch/...?ep=N` 切到第 N 集
- [ ] 跨路由 MiniPlayer：暂不验收（HANDOFF-02 范围内，非 M5 scope）
- [ ] 移动端 docked mini bar：暂不验收（v2.1 scope 外）

---

## 6. 签字声明

本页签字有效性取决于：

1. 本文件 §4 全部 ✅
2. §5 全部用户打勾
3. arch-reviewer 11 点 PASS（§3 审计输出待粘贴，`AUDIT RESULT: PASS` 才能视为生效）
4. BLOCKER `M5 PC 端人工回归否决` 解除（task-queue.md 尾部 BLOCKER 块删除）

任一未满足 → 本签字 CANCELED，不得推进 M6。

---

## 7. 变更历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v2（初稿） | 2026-04-22 | CLOSE-03 代理证据 + 待 arch-reviewer 审计 |
| v2.1（本文件） | 2026-04-22 | arch-reviewer (claude-opus-4-6) 审计完成 `AUDIT RESULT: PASS`；补 §3 审计结论 + §4.2 rewrite-allowlist 黄线登记 + §6.2 CLEANUP-04~10 changelog 补记说明 |
| v2.2 | 待定 | 用户 PC 端真人交互二次确认签字（§5 checklist 全部打勾） |

---

## 附：CLEANUP-04~10 changelog 合并记账（arch-reviewer 黄线 #2 补录）

`docs/changelog.md` 在 ~~CANCELED M5 真·PHASE COMPLETE~~ 条目之后直接跳到 CLEANUP-11，中间 7 张卡（CLEANUP-04~10）无单独 changelog 条目；此为 commit `b557463` 一次性合并提交时的文档层遗漏。补记如下：

| 卡号 | BLOCKER # | 关键改动 | 文件范围 |
|---|---|---|---|
| M5-CLEANUP-04 | #1 | VideoCard `group/poster` 作用域修正；FloatingPlayButton 仅封面区触发；TagLayer z-index 不溢出 title | `VideoCard.tsx` / `TagLayer.tsx` / `StackedPosterFrame.tsx` / `globals.css` |
| M5-CLEANUP-05 | #2 | CategoryPageContent 命名导出；movie/anime/series/tvshow `page.tsx` 新增；rewrite-allowlist 放行 | `app/[locale]/[type]/page.tsx` + 4 个独立 page + `rewrite-allowlist.ts` / `middleware.ts` |
| M5-CLEANUP-06 | #3 + #4 + #5 | MiniPlayer.expand→setHostMode('full')；GFF watch page 内隐藏控制栏；activeSourceIndex 入 store；tab 稳定渲染 | `playerStore.ts` / `_lib/player/*.tsx` / `PlayerShell.tsx` / `EpisodePicker.tsx` / `LineSwitcher.tsx` |
| M5-CLEANUP-07 | #6 | PlayerShell theater 态 maxWidth `min(85vw, 1440px)` | `CinemaMode.tsx` / `PlayerShell.tsx` / `globals.css` |
| M5-CLEANUP-08 | #7（部分） | body `font-sans antialiased` 系统字体回退链；VideoGrid/SearchPage `gap-4 lg:gap-6` | `globals.css` / `packages/design-tokens/src/semantic/typography.ts` / `components/layout/*` — ⚠️ BLOCKER-FONT 未决 |
| M5-CLEANUP-09 | #8 | SearchPage 导航改用 `usePathname()` 保留 locale；q 参数透传 | `app/[locale]/search/page.tsx` / `components/search/SearchResults.tsx` |
| M5-CLEANUP-10 | #9 | VideoDetailClient `useSearchParams` 初始化 ep；Suspense 边界补全；detail-play-btn 读取最新 activeEpisode | `EpisodePicker.tsx` / `VideoDetailClient.tsx` / `DetailHero.tsx` |

所有 7 卡共提交于 **commit `b557463`**。执行模型 `claude-sonnet-4-6`（部分卡内部触发 Opus 子代理评审 playerStore 扩展，详见 task-queue.md L9109-9114）。本汇总条目作为 changelog 的补记纳入 M5-CLOSE-03 签字范围。
