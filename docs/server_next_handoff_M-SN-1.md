# server-next M-SN-1 Handoff（工程骨架 + Token 三层 + Provider）

> status: active
> owner: @engineering
> scope: M-SN-1 milestone closure handoff（plan §10.8 SHOULD-4-d 要求）
> source_of_truth: yes
> milestone: M-SN-1（2026-04-28）
> milestone_grade: **B**（arch-reviewer Opus 阶段审计；达成率 90%）
> next_milestone: M-SN-2（packages/admin-ui v1 业务原语）
> last_reviewed: 2026-04-28

---

## 1. milestone 摘要

M-SN-1 在 1.3 工作日内（估算 7.5 天）完成 7+1 张任务卡（CHG-SN-1-01 ~ 08），落地 server-next 工程骨架 + design-tokens 4+1 层（admin-layout 新增 + dual-signal 收编）+ BrandProvider/ThemeProvider 物理副本 + IA v0 19 路由占位 + apiClient + 鉴权 + login + ESLint 边界 + verify-server-next-isolation 兜底脚本 + plan v2.1 修订对账。

**关键产出**：
- `apps/server-next/`：Next.js App Router，单语言 zh-CN，:3003 dev；admin shell 极简骨架；19 IA 路由占位 + login + 错误页；鉴权 middleware 含 /admin 双因素拦截
- `packages/admin-ui/`：空骨架（M-SN-2 起步业务原语下沉）
- `packages/design-tokens/`：新增 `semantic/dual-signal.ts` + `admin-layout/{shell,table,density}.ts`；build pipeline 双轨同步
- `scripts/verify-server-next-isolation.mjs`：TypeScript Compiler API AST 扫描，4 种 import 形态守卫；preflight 集成

**回归基线**：typecheck (7 ws) / lint (4/4) / 1768 unit tests / verify-server-next-isolation 全绿；server-next 0 import apps/web-next 内部代码。

---

## 2. 三个核心决策点（M-SN-1 实施驱动）

### 2.1 ADR-102 patch · token 4+1 层（CHG-SN-1-03，方案 A）

**背景**：CHG-SN-1-03 摸现状阶段触发 BLOCKER —— packages/design-tokens 已是 4 层成熟系统（primitives / semantic / components / brands），ADR-102 起草时假设的"3 层轻量包"与现状不符。

**决策**：用户裁定方案 A —— 保现状 + 新增 admin-layout 层（4+1 层 supersede 3 层）。ADR-102 patch 而非全文重写：
- 原"base 层"映射到 primitives（保现名，避免 web-next 引用面冲击）
- semantic 层新增 dual-signal.ts
- admin-layout 顶级目录新增（本 ADR 原始设计不变）
- 三条硬约束保留，仅"base"在执行时映射"primitives"

**影响**：
- `docs/decisions.md` ADR-102 行 ~2178-2210 新增"修订记录 · 与 design-tokens 现状对齐"段
- `docs/server_next_plan_20260427.md` §4.3 同步重写
- `docs/architecture.md` §17a 新增 4+1 层结构表 + v2.1 → packages 字段映射

**留账**：
- dual-signal 内联 hex（v2.1 设计稿原值），未转 oklch；未来纳入 primitives 颜色层需 ADR 续编（plan §4.3 硬约束 1）
- admin-layout 第三层与 server-next 生命周期绑定

### 2.2 plan v2 → v2.1 修订（CHG-SN-1-08）

**触发**：CHG-SN-1-05 落地 IA v0 时发现 plan §7 视图数字字段（"顶层 21 / 总 27"）与文字清单（13 admin 顶层 + 5 system 子 + 1 编辑子 + 1 login = 20）不一致；CHG-SN-1-08 milestone 验收时统一对账。

**决策**：以文字清单为真源对账，修订为枚举数 21 路由占位（13 admin 顶层 + 1 system landing + 5 system 子 + 1 编辑子 + 1 login）；M-SN-1 实施 19（defer 编辑子 M-SN-4）。

**影响**：
- plan v2.1 修订日志追加，含 4+1 层 supersede + §7 字段对账 + M-SN-1 实际工时 vs 估算（-83%）
- 不触发 BLOCKER（轻量字段对账 + plan §0 SHOULD-4-a 合规：spawn arch-reviewer + 修订日志 + commit trailer 三件齐）

### 2.3 BrandProvider/ThemeProvider 物理副本（CHG-SN-1-04）

**决策**：plan §4.4 明示"BrandProvider/ThemeProvider 不下沉到 packages/admin-ui，直接复用 web-next 的 contexts"，但 plan §4.6 ESLint 边界禁止 server-next 直接 import apps/web-next 内部代码。两者协调路径 = 物理副本（API 同构，物理副本而非共享）。

**简化偏离**（reviewer 判定合理）：
- DEFAULT_THEME 改 'dark'（plan §4.3 / ADR-102 dark-first）
- setBrand 不 fetch /api/brands（admin 单品牌内部工具）
- 去 logger.client 依赖（CHG-SN-1-06 接入时无缝补回 —— 已落地，apiClient 接入；setBrand 无 error 路径，无需补回）
- resolveTheme SSR fallback 改 'dark'

**长期成本**：BrandProvider 是 ADR 级原语。若 web-next 后续修改 Context 协议，server-next 不会自动同步。建议 M-SN-7 cutover 后启动"同源化"任务卡（提取到 packages/web-shared 或固化协议测试）。

---

## 3. M-SN-2 启动前置任务清单

reviewer Opus 阶段审计建议 3 项，已登记：

### 3.1 CHG-SN-1-09 · verify-server-next-isolation 扩展 string 级（task-queue 新增）

**目的**：补齐 ADR-102 跨域消费禁令的完整守卫。当前 ESLint + verify 守卫是 import path 级；ADR-102 本质是 token name string 级（apps/web-next 任何路由 0 消费 `--probe` / `--render` / `--sidebar-w` 等）。

**前置依赖**：ADR-103 DataTable v2 公开 API 契约 Opus 评审的硬前置。

**工时估算**：0.3 天。详见 task-queue SEQ-20260428-01 第 9 卡。

### 3.2 视觉回归豁免备忘

**理由**：M-SN-1 期间 dual-signal + admin-layout 是 packages/design-tokens 的 **net-new 字段**，0 现有引用面被触及。plan §10.4 8 张截图（home/search/video detail/player × light/dark）的"缺一即不可 merge"硬约束在本 milestone 不适用（无可比对基线变更）。

**兜底**：M-SN-7 cutover 前置检查清单补做"web-next 视觉确认"。

### 3.3 handoff 文档

**本文档**即 handoff 输出（plan §10.8 SHOULD-4-d）。

---

## 4. M-SN-1 留账（不阻塞 cutover；后续卡处理）

| 留账 | 处理时点 | 备注 |
|---|---|---|
| video/[id]/edit 编辑子 | M-SN-4 | plan §7 v2.1 已声明 |
| light theme | 视需求接入 | dark-first 已默认；token 4+1 层 light 字段已就位 |
| 真 e2e 登录测试（apps/api 在跑） | M-SN-3 业务卡 e2e | 本卡 path smoke 已覆盖 |
| admin-only 子路径细分（admin / users / crawler / analytics 仅 admin）| M-SN-2+ 视图卡按需 | 整段拦截已生效 |
| zustand authStore | M-SN-3 业务卡决定 | accessToken 当前由 cookie 自动管理 |
| dual-signal hex → oklch 迁移 | 视需求 | ADR 续编（plan §4.3 硬约束 1）|
| BrandProvider 物理副本同源化 | M-SN-7 cutover 后 | "同源化"独立任务卡 |
| apps/web-next 视觉回归 8 张截图 | M-SN-7 cutover 前置 | 本 milestone 豁免（net-new 字段）|

---

## 5. 关键任务卡指针（CHG-SN-1-* commit + 主要文件）

| 卡 | commit | 主要文件 |
|---|---|---|
| CHG-SN-1-01 | `51d39b1` | `packages/admin-ui/{package,tsconfig}.json` + `src/index.ts` |
| CHG-SN-1-02 | `456c656` | `apps/server-next/{package,next.config,tsconfig}.json` + `src/app/{layout,page,admin/page}.tsx` + `scripts/dev.mjs` |
| 中途 P2 修复 | `9ba869e` | root typecheck 串入 admin-ui + design-tokens；`build-css.ts` pattern 类型 cast |
| CHG-SN-1-03 | `965eb1e` | `packages/design-tokens/src/{admin-layout/*, semantic/dual-signal.ts}` + `build.ts` + `scripts/build-css.ts` + `tests/unit/design-tokens/admin-layout.test.ts` + `docs/architecture.md` §17a |
| CHG-SN-1-04 | `ee89fd2` | `apps/server-next/src/{contexts/BrandProvider.tsx, lib/brand-detection.ts, types/brand.ts, middleware.ts, app/{layout,globals.css}}` |
| CHG-SN-1-05 | `be5cdc8` | `apps/server-next/src/{lib/admin-nav.ts, components/PlaceholderPage.tsx, app/admin/layout.tsx}` + 22 page.tsx + not-found.tsx |
| CHG-SN-1-06 | `2d7a42d` | `apps/server-next/src/{lib/api-client.ts, lib/auth/index.ts, app/login/{page,LoginForm}.tsx}` + `middleware.ts`（鉴权追加）|
| CHG-SN-1-07 | `56efb05` | `apps/server-next/.eslintrc.cjs` + `scripts/verify-server-next-isolation.mjs` + `scripts/preflight.sh`（追加）|
| CHG-SN-1-08 | TBD | `docs/server_next_plan_20260427.md`（v2.1 修订日志）+ 本文件 + task-queue M-SN-2 前置卡登记 |

ADR：`docs/decisions.md` ADR-100/101/102（含 ADR-102 修订记录段）

---

## 6. 复盘结论（plan §10.8 SHOULD-4-d 必填）

### 顺利点
1. **决策成本归零**：M-SN-0 三批 ADR + plan v2 已固化大量决策，M-SN-1 是工程落地，主循环可直接执行
2. **arch-reviewer 闭环效率**：5 卡首轮 PASS，1 卡 CONDITIONAL 1 轮内修复（CHG-SN-1-06 UserRole + query string）；milestone 审计 B 级 PASS
3. **物理副本 + 简化偏离策略**：BrandProvider / api-client 物理副本避开 ESLint 边界；admin 单品牌简化降低复杂度
4. **现状摸清优先**：CHG-SN-1-03 摸现状即触发 BLOCKER，A 方案让 ADR 让步现状而非反向，避免对 ADR-022/023/032/038/039 的级联 supersede

### 风险点
1. **ESLint string 级守卫缺位**：当前 import 级守卫不覆盖 ADR-102 string 级跨域禁令；CHG-SN-1-09 补齐
2. **Provider 物理副本漂移风险**：M-SN-7 cutover 后须启同源化任务
3. **plan §7 字段错误未在起草时被发现**：plan v2 起草时未严格枚举核对，CHG-SN-1-05/08 触发对账。M-SN-2 起草时建议主循环增加"路由数字字段 vs 文字清单"自检

### 节奏校准建议
M-SN-1 实际 1.3d / 估算 7.5d 极致缩短的核心因素是"决策已熟"+"物理副本/简化偏离"+"build pipeline 已成熟"。M-SN-2 是新代码量大 + 单元测试 ≥70% + 业务原语首次落地，估算系数不宜直接套用。M-SN-2 启动按 plan §6 原 2.5w 估算执行；CHG-SN-2-08 milestone 审计再回看校准。

---

## 7. 与 ADR-100/101/102 的对账

| ADR 决策点 | M-SN-1 落地状态 |
|---|---|
| ADR-100 IA v0 27 路由 | ⚠️ 实际 plan v2.1 修订为 21 路由占位；M-SN-1 落地 19（defer 编辑子）|
| ADR-100 单语言 zh-CN | ✅ apps/server-next 无 next-intl |
| ADR-100 依赖白名单 | ✅ 仅 next/react/react-dom + workspace 内部包；无 dnd-kit / 候选三组 / 严禁清单引入 |
| ADR-100 ts-morph CI 兜底 | ⚠️ 用 typescript Compiler API 替代（已有 dep，无 ts-morph 新依赖）；string 级守卫待 CHG-SN-1-09 |
| ADR-101 cutover 协议 | — | M-SN-7 落地，本 milestone 不涉及 |
| ADR-102 token 4+1 层 | ✅ patch 修订记录段已落 + 4+1 层结构落地 |
| ADR-102 dual-signal + admin-layout | ✅ semantic/dual-signal.ts + admin-layout/* 全字段 |
| ADR-102 跨域消费禁令 | ⚠️ import path 级守卫已生效（ESLint + verify）；string 级守卫待 CHG-SN-1-09 |
| ADR-102 三条硬约束 | ✅ 已沉淀到 ADR-102 patch + plan §4.3 |
| ADR-038/039 BrandProvider/middleware | ✅ 物理副本 API 同构 |

---

## 8. M-SN-2 启动 checklist（主循环 ready 前完成）

- [ ] CHG-SN-1-09 string 级 token 跨域守卫扩展完成（M-SN-2 第一卡前置）
- [ ] task-queue 起草 M-SN-2 序列（SEQ-20260428-02 或后续）
- [ ] arch-reviewer Opus 评审 ADR-103 DataTable v2 公开 API 契约（M-SN-2 启动前 PASS）
- [ ] M-SN-2 第一卡（packages/admin-ui v1 起步：DataTable v2 + useTableQuery）写入 tasks.md

---

— END M-SN-1 Handoff —
