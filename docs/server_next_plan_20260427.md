# Resovo server-next 工程实施 Plan v1

> status: approved-for-execution（M-SN-0 清理工作台前的最终版）
> version: v2.4（v0 → v1 → v2 → v2.1 → v2.2 → v2.3 → v2.4 修订记录见末尾"修订日志"；v2.4 = CHG-SN-2-01.5 §4.7 依赖白名单扩列 lucide-react + ADR-103b）
> owner: @engineering
> scope: apps/server-next 工程 + packages/admin-ui 下沉 + packages/design-tokens 三层 + nginx 反代切流 + apps/server 退场
> source_of_truth: yes（工程视角的"宪法"，所有 server-next 任务卡须引用本 plan §节号）
> companion:
>   - [admin_audit_20260426.md](./admin_audit_20260426.md)（现状 / 9 痛点）
>   - [admin_design_brief_20260426.md](./admin_design_brief_20260426.md)（design 视角 brief）
>   - [server_next_kickoff_20260427.md](./server_next_kickoff_20260427.md)（R1–R5 决策实录 + 评审报告）
>   - [docs/designs/backend_design_v2.1/](./designs/backend_design_v2.1/)（设计稿，仍在补完）
> generated_at: 2026-04-27（v0）/ revised: 2026-04-27（v1）/ 2026-04-28（v2 / v2.1 / v2.2 / v2.3 / v2.4）
> 主循环模型：claude-opus-4-7
> 评审：v1 完成后 spawn arch-reviewer (Opus) 二轮评审 PASS 才进入 M-SN-0

---

## 0. 性质声明

本 plan 是 **工程实施版**，与 admin_design_brief 的 **设计视角** 区分。

**前置事实**：
- M0–M6 已完成（前端重写主轨结束）；`freeze_notice_20260418.md` 即将退役
- 旧前台 `apps/web/` 仅余构建产物，将随 M-SN-0 清理删除
- server-next 立项 **不受重写冻结期约束**，但仍遵守 CLAUDE.md 价值排序与质量门禁

**Plan 版本协议（SHOULD-4-a）**：本 plan 在 M-SN-1～M-SN-6 期间任何修订必须：(1) 主循环 spawn arch-reviewer 评审；(2) 修订项写入末尾"修订日志"；(3) commit trailer 含 `Plan-Revision: vN → vN+1`；(4) 重大修订（含范围 / milestone / Non-Goals）须人工 sign-off。

---

## 1. 项目目标

| # | 目标 | 度量 |
|---|---|---|
| G1 | 取代 `apps/server`，成为 admin 控制台唯一壳 | M-SN-7 cutover 完成且 24h 平稳 |
| G2 | 解决 admin_audit 9 大痛点 | P0×3 在 M-SN-4 验收；P1×6 在 M-SN-5/6 验收（含 admin API 补齐前置，详见 §4.5 / §6 M-SN-5）|
| G3 | 落地 admin_design_brief 5 项推荐 | 推荐 4 在 M-SN-2；推荐 1 在 M-SN-4；推荐 2/3/5 在 M-SN-5（推荐 3/5 含 API 补齐子任务）|
| G4 | 落地 backend_design_v2.1 设计稿 | IA / 视觉 token / 交互模式 100% 对齐（设计稿仍在补完，IA 非最终版）|
| G5 | 工程边界清晰，最大化复用减少一次性设计 | 复用矩阵（§8）每个视图标 ≥80% 共享原语来源 |

---

## 2. 范围与 Non-Goals

### 2.1 In-Scope
- 新建 `apps/server-next/`（Next.js App Router，端口 3003）
- 新建 `packages/admin-ui/`（DataTable v2 + useTableQuery + Toolbar/Filter/Drawer/Modal/Toast 等共享原语）
- 改造 `packages/design-tokens/` 为三层结构（base / semantic / admin-layout）
- **新增 admin API 端点（仅用于解锁缺位视图）**：home_modules CRUD（推荐 3）/ split-unmerge / candidate-preview（推荐 5）— 每个新增端点须独立 ADR + Opus arch-reviewer 评审
- 编写 nginx 反代切流配置（cutover 当日生效）
- M-SN-7 删除 `apps/server/`

### 2.2 Non-Goals（命中即触发 BLOCKER）

> **MUST-4 修订**：第 4 条由"不修改 API 契约"放宽为以下精确措辞。

1. ❌ 修改 `apps/api/` 中已有 Service / DB queries / 业务逻辑（路由层下方所有改动）
2. ❌ 修改 `apps/web-next/` 业务代码（仅 packages/design-tokens 重构会触及其引用）
3. ❌ DB schema 变更（含新 migration）
4. ❌ **修改现有 admin API 端点的 path / 入参 schema / 返回结构 / 鉴权策略**（新增端点用以解锁缺位视图允许，但须独立 ADR + Opus 评审；详见 §4.5）
5. ❌ 引入 §4.7 依赖白名单之外的 npm 包
6. ❌ admin 多语言 / i18n（**单语言中文**确认）
7. ❌ admin 移动端适配（桌面优先 ≥1280px）
8. ❌ admin 权限模型扩张（auth / adminOnly / moderator+ 三层不增不减）
9. ❌ 复用 `apps/server/src/components/admin/shared/` 的现有实现（用户裁定：体验不达标，重新设计）
10. ❌ apps/server-next 直接 import apps/server 任何文件（CI 脚本扫描，命中即 fail）

---

## 3. 决策汇总（R1–R3 + R5）

| 决策 | 结论 | 来源 | ADR 落地 |
|---|---|---|---|
| 启动时机 | 方案制定好即启动；不受冻结期约束 | R2.1 Q1 | ADR-100 |
| 命名 | `apps/server-next`；cutover 同 commit 内改名为 `apps/admin` | R2.1 Q2 + R5 DISCUSS-4 | ADR-100 |
| 切流策略 | 方案 E：独立壳 + 端口隔离 + 一次性切换；nginx 反代 | R2.2 + R3.1 S1 | ADR-101 |
| Token 体系 | 三层架构（base / semantic / admin-layout），不独立 | R2.3 | ADR-102 |
| 共享组件下沉 | 不复用旧实现；新建 `packages/admin-ui/`；M-SN-1 第一个任务卡即创建空骨架 | R2.1 Q5 + R5 MUST-3 | ADR-100 |
| 骨架优先 | 先地基（packages + DataTable v2 + useTableQuery）后填充 | R2.1 Q6 | M-SN-1/2 划分 |
| IA 命名 | v2.1 草案为开发期 IA；URL slug 优先英文；中文菜单 cutover 前可调 | R2.1 Q7 + R5 SHOULD-6 | 不立 ADR |
| IA "待发布" | 移除；并入审核台"已审"Tab | R3.2 | ADR-100 |
| 采集后未审 | 方案 α：审核台"待审"Tab 覆盖 | R3.4 | ADR-100 |
| 多语言 | 单语言中文；不装 next-intl | R3.1 S2 | ADR-100 |
| M-SN-0 清理节奏 | 三批（docs / code / ADR），每批 arch-reviewer 复核 | R3.1 S3 | 本 plan §11 |
| 自动化 review | 每任务 spawn arch-reviewer，PASS / CONDITIONAL ≤3 轮 / REJECT | R2.4 规约 A | §5.1 |
| 计划外决策停机 | BLOCKER 清单 10 条命中即停 | R2.4 规约 B | §5.2 |
| Milestone 审计 | 每 milestone spawn arch-reviewer 出偏差 + 评级 + 人工 checklist；A/B/C 客观判据 | R2.4 规约 C + R5 MUST-6 | §5.3（详见判据表）|
| **API 契约缺口** | **方案 B3**：放宽 Non-Goals 第 4 条；新增端点（home_modules / split-unmerge / candidate-preview）允许，但须独立 ADR + Opus 评审；M-SN-5 内顺手补 | R5 Q-MUST-4 | ADR-100 + 子 ADR |
| **M-SN-2 范围** | **方案 A2**：保留单 milestone；游标+虚拟滚动延迟到 M-SN-6 首次 >50k 数据时按需即建 | R5 Q-MUST-1 | §6 M-SN-2 |
| **依赖白名单** | 预批：`@dnd-kit/core` `@dnd-kit/sortable`；候选 `recharts` `reactflow` `react-window` 首次落地前 spawn arch-reviewer 二选一 | R5 Q-MUST-5 | §4.7 + ADR-100 |
| **工时估算** | M-SN-0～7 合计 16 周（~4 个月）；单 milestone 超 +30% 触发 BLOCKER | R5 SHOULD-1 | §6 |
| **性能 / a11y 验收门** | 新增 M-SN-6.5（cutover 前置） | R5 SHOULD-2 | §6 |
| **apps/server 冻结边界** | 开发期仅 P0 hotfix；hotfix 不反向同步 server-next（避免漂移），但记入 task-queue 方便 cutover 前对账 | R5 DISCUSS-1 | ADR-101 |
| **cookie + nginx e2e 演练** | M-SN-3 标杆页完成时进行 staging 环境演练 | R5 DISCUSS-3 | ADR-101 |
| **cutover 后回滚 RTO** | apps/server 物理目录保留 7 天与 git tag 一致；超 7 天回滚走完整 commit revert（RTO ≤ 4h）| R5 DISCUSS-5 | ADR-101 |
| **M-SN-6 工时上调** | 2.5w → 4w；总周期 16w → 17.5w（吸收大数据原语 + 三组依赖选型 + 9 路由）| R7 MUST-7 (c) | §6 |
| **ADR-端点先后协议** | ADR-104/051 须在对应端点首个任务卡前完成 Opus PASS；端点逐个落地复用同一 ADR；不允许端点 PR 与 ADR 同卡 | R7 MUST-8 | §4.5 + §6 M-SN-5 |
| **M-SN-6.5 软上限** | 0.5w 为基线；任一类验收发现 critical >2 项即升至 1w | R7 SHOULD-8 | §6 M-SN-6.5 |
| **token 重构截图标准** | web-next 视觉回归对照清单：home / search / video detail / player 4 页 × 明暗双模 = 8 张 | R7 DISCUSS-7 | §10.4 |
| **M-SN-2 范围扩列 Shell**（v2.3 新增）| 方案 B：A2 + Shell 扩列；M-SN-2 工时 2.5w → 3w（+20%，未触发 BLOCKER 11）；总周期 17.5w → 18.0w；新增 ADR-103a（Shell 公开 API 契约） | CHG-SN-1-12 Opus 评审 | §6 M-SN-2 + §8 复用矩阵 + ADR-103a |
| **server-next 图标库选型**（v2.4 新增）| **lucide-react `^1.12.0`**；6 维评估 30/30；与设计稿 shell.jsx 12 NAV icon 同名命中；安装位置仅 apps/server-next（packages/admin-ui 零图标库依赖约束 ADR-103a §4.4-4 不变）；仅允许 named import；Next.js optimizePackageImports + ESLint + ts-morph 三层兜底 | CHG-SN-2-01.5 Opus 评审 + 用户 sign-off | §4.7 + ADR-103b |

---

## 4. 工程架构

### 4.1 仓库结构（cutover 前）

```
resovo/
├── apps/
│   ├── api/                 ← 不动业务（M-SN-5 仅追加新端点：home_modules / split-unmerge / candidate-preview）
│   ├── web-next/            ← 不动（Next.js，3000）
│   ├── server/              ← 冻结，仅 P0 hotfix；M-SN-7 cutover commit 内删除并改名 server-next → admin
│   └── server-next/         ← 新建（Next.js App Router，3003）
│       ├── src/
│       │   ├── app/         ← App Router（admin 路由树，IA v0 详见 §7）
│       │   ├── components/  ← server-next 业务组件（成熟原语下沉到 packages/admin-ui）
│       │   ├── lib/         ← apiClient / 鉴权 / utils
│       │   ├── stores/      ← zustand（如需）
│       │   ├── contexts/    ← BrandProvider / ThemeProvider（沿用 ADR-038/039 协议）
│       │   └── middleware.ts
│       ├── tests/e2e/       ← 每视图 ≥1 条黄金路径
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── packages/
│   ├── types/               ← 不动（共享类型）
│   ├── player-core/         ← 不动
│   ├── logger/              ← 不动
│   ├── design-tokens/       ← 改造为三层（§4.3）
│   └── admin-ui/            ← 新建（§4.4，**M-SN-1 第一个任务卡即创建空骨架并加入 workspaces**）
└── ...
```

### 4.2 端口与切流

| 阶段 | apps/server :3001 | apps/server-next :3003 | nginx `/admin/*` 指向 |
|---|---|---|---|
| 开发期 M-SN-1 ~ M-SN-6.5 | 生产可用，仅 P0 hotfix | 开发中 | :3001 |
| Cutover 当日 M-SN-7 | 流量已切走 | 接管全部 `/admin/*` | :3003 |
| Cutover + 24h | 物理目录保留 | 唯一生产壳 | :3003 |
| Cutover + 7 天 | 物理删除 + git tag `pre-server-next-cutover` 保留 | — | :3003 |

**Cookie / 鉴权**：server-next 与 apps/server 使用相同的 fastify-jwt cookie 名（由 apps/api 签发），cutover 当日运营无需重新登录（cookie 在浏览器侧保持）。**M-SN-3 完成时在 staging 环境做一次 cookie + nginx e2e 端到端演练**（DISCUSS-3）。

### 4.3 Token 4+1 层（详见 ADR-102 含修订记录）

> **现状对齐修订（2026-04-28）**：CHG-SN-1-03 摸现状发现 packages/design-tokens 已是 4 层成熟系统（primitives / semantic / components / brands）。ADR-102 原"3 层"措辞贴合现状改为"在 4 层基础上新增 admin-layout 层（4+1 层结构）"。详见 ADR-102 修订记录段。

```
packages/design-tokens/src/
├── primitives/         ← 原子 token，前后台共用，不可 fork（ADR-022/023/032）
│   color.ts / typography.ts / space.ts / radius.ts / shadow.ts / motion.ts / z-index.ts / size.ts
├── semantic/           ← 语义 token，前后台共用，按场景命名（ADR-022）
│   state.ts / tag.ts / surface.ts（含 bg0..bg4）/ border.ts / route-stack.ts / stack.ts
│   dual-signal.ts（本卡新增，probe/render，admin 主用，前台预留）
├── admin-layout/       ← 本卡新增，admin 专属（ADR-102）
│   shell.ts（sidebar-w / topbar-h / sidebar-collapsed-w）
│   table.ts（row-h / row-h-compact / col-min-w）
│   density.ts
├── components/         ← 组件级 token（ADR-022 隐式容纳）
│   table / modal / input / player / button / card / tooltip / tabs
└── brands/             ← 多品牌 token（ADR-038/039）
    default + _validate / _patch / _resolve / index
```

**收编路径**（设计稿 v2.1 `tokens.css` → packages/design-tokens）：
- `:root` 基础调色 → primitives（已有，差缺补齐 motion 等）
- bg0~bg4 surface → semantic/surface.ts（已有；本卡补 v2.1 字段）
- status (ok/warn/danger/info/neutral + soft) → semantic/state.ts（已有；本卡补 v2.1 字段）
- dual-signal (probe/render + soft) → **semantic/dual-signal.ts**（本卡新建文件）
- admin layout 变量（sidebar-w / topbar-h / row-h / row-h-compact）→ **admin-layout/**（本卡新建顶层目录）
- motion duration / easing → primitives/motion.ts（已有；本卡补 v2.1 字段）

**硬约束**：
- **primitives / semantic** 任何字段新增 → spawn arch-reviewer (Opus) 评审 → ADR 续编（原"base / semantic"映射到现名）
- **admin-layout** 新增字段 → 主循环可直接落，但需在 milestone 阶段审计中报备
- **components / brands** 字段新增按各自 ADR 现行规则（ADR-022 / ADR-038 / ADR-039）
- 设计稿与 packages 不一致时，**packages 是真源**

### 4.4 packages/admin-ui 下沉边界（MUST-3 修订）

#### 创建时机
- **M-SN-1 第一个任务卡**即创建 `packages/admin-ui/` 空骨架（仅 `package.json` / `tsconfig.json` / `src/index.ts` 占位）并加入 root `workspaces`
- 之后任何"拟下沉原语"在 server-next 内**首次出现时直接落到 packages/admin-ui**，不再有"先放 server-next 再迁"的过渡态

#### 范围

> **2026-04-30 修订（CHG-DESIGN-11 / SEQ-20260429-02）**：
> 本表中"DataTable v2 / Toolbar / Pagination / SelectionActionBar / ColumnSettings"
> 在 M-SN-2 时代设计为**分离原语 + 消费方编排**。当前真源 `docs/designs/backend_design_v2.1/reference.md`
> §4.4 + §6.0 已裁定 **DataTable 一体化**：toolbar / search / filter chips /
> 表头集成菜单 / saved views / bulk action bar / pagination 全部进入 DataTable
> 内置 props（CHG-DESIGN-02 落地）。**标准列表页必须通过 DataTable 内置 toolbar / body /
> bulk / foot 编排**，外置组合（Toolbar / Pagination / SelectionActionBar 单独使用）
> 仅作为非常规嵌入式场景的兜底，不作首选。原语本身仍可独立 export 但不强求复用。
>
> 同样 2026-04-30 修订：原 "Icon set 复用 web-next 已有图标库" 与 "BrandProvider /
> ThemeProvider 直接复用 web-next 的 contexts" 句子已被 ADR-103a/103b + verify-server-next-isolation
> 守卫推翻 —— admin-ui 必须**零图标库依赖**（消费方注入图标），server-next **禁止 import
> apps/web-next 内部代码**。Brand/Theme **复用接口形态而非 import 实例**，server-next 持有
> 独立 BrandProvider/ThemeProvider 物理副本（CHG-SN-1-04 已落地）。

| 原语 | 必须下沉？ | 出现时机 |
|---|---|---|
| DataTable v2（一体化：含 toolbar / body / bulk / foot 内置编排，CHG-DESIGN-02 起） | ✅ 必须 | M-SN-2（基座）→ SEQ-20260429-02（一体化骨架） |
| Toolbar / Filter / Sort / ColumnSettings | ✅ 必须（独立 export） | M-SN-2；首选用法是 DataTable.toolbar slot |
| Drawer（视频编辑 Drawer 复用） | ✅ 必须 | M-SN-2 |
| Modal / Dialog | ✅ 必须 | M-SN-2 |
| Toast（全局 addToast API） | ✅ 必须 | M-SN-2 |
| AdminDropdown | ✅ 必须 | M-SN-2 |
| SelectionActionBar | ✅ 必须（独立 export） | M-SN-2；首选用法是 DataTable.bulkActions slot（嵌入式 sticky-bottom） |
| Pagination v2（客户端 / 服务端两档） | ✅ 必须（独立 export） | M-SN-2；首选用法是 DataTable 内置 .dt__foot |
| Pagination v2 游标分页 + 虚拟滚动 | ✅ 必须 | **M-SN-6**（首次 >50k 数据时按需即建，A2 方案）|
| Empty / Error / Loading 状态 | ✅ 必须 | M-SN-2 |
| Form 控件（Input / Select / Switch / DateRange） | ⚠️ 评估 | 若 web-next 已有同形态可复用，admin-ui 仅做样式适配壳 |
| Icon set | ⚠️ 零依赖 | admin-ui **零图标库依赖**（ADR-103b）；消费方按需注入；admin 专属（如双信号 icon）补到 packages/admin-ui/icons |
| BrandProvider / ThemeProvider | 🟰 接口复用 | server-next 持有**独立物理副本**（CHG-SN-1-04），不 import apps/web-next 内部代码（ADR-103b + verify-server-next-isolation 守卫） |

#### 自建业务组件下沉规则（SHOULD-5 修订）
**首次跨 2 视图复用即强制下沉**到 packages/admin-ui。包括：状态原子指示器、决策卡、双信号双柱图、证据抽屉、视频分组表、全局别名表、首页运营位编辑器、拖拽排序、合并候选预览、拆分确认、采集 DAG、审计时间线。下沉时机记录于 §8 复用矩阵"下沉里程碑"列。

### 4.5 与 apps/api 的耦合面（MUST-4 修订）

#### 主通道
- 唯一通道：`apiClient`（packages/types 提供 ApiResponse / 端点签名类型）
- 调用 `/v1/admin/*` 共 122 端点（除 staging 路由的"独立 UI 入口"外，全部沿用）
- staging 路由的 10 端点保留但 UI 入口仅在审核台"已审"Tab 暴露

#### 新增端点（B3 方案允许的子集）

| 推荐 | 新增端点 | 责任 milestone | 评审要求 |
|---|---|---|---|
| 推荐 3（首页运营位） | home_modules CRUD（list / create / update / delete / reorder / publish）— 6 端点 | M-SN-5 内 server-next 主循环顺手补；ADR-104 起草 | Opus arch-reviewer PASS |
| 推荐 5（合并/拆分） | candidate-preview / split / unmerge / merge-audit-log — 3-4 端点 | M-SN-5 内补；ADR-105 起草 | Opus arch-reviewer PASS |

#### 硬约束
- 修改**现有**端点的 path / 入参 schema / 返回结构 / 鉴权策略 → BLOCKER §5.2 第 3 条命中
- 新增端点必须：(1) 独立 ADR；(2) Opus arch-reviewer PASS；(3) packages/types 同步类型；(4) 端点鉴权与现有 admin 三层（auth / moderator+ / adminOnly）保持一致（不扩张权限模型）

#### ADR-端点先后协议（R7 MUST-8）
- ADR-104（home_modules）/ ADR-105（merge）必须在**对应端点首个任务卡启动前**完成 Opus arch-reviewer PASS
- 同一 ADR 下的多个端点（如 home_modules CRUD 6 端点）逐个落地时**复用同一 ADR**，不重复评审
- **不允许端点 PR 与 ADR 同卡**——避免端点实现与 ADR 评审来回循环触发 BLOCKER §5.2 第 7 条
- 若端点实现期间发现需修改 ADR，触发 plan §0 版本协议（ADR 续编 + spawn arch-reviewer）
- DISCUSS-6（草稿/发布双态等鉴权粒度）：留待 ADR-104 起草时一并裁定，不在 plan v2 预决

#### apps/api 契约冻结声明（SHOULD-4-b）
开发期内 `apps/api/src/routes/admin/*.ts` 现有端点禁止改 path / schema / 鉴权；如有 P0 hotfix 必须 ping server-next 主循环并写入 task-queue。

### 4.6 编译期边界检查（SHOULD-3 修订）

不再用 grep；改为 ESLint `no-restricted-imports` 规则：

```js
// .eslintrc.cjs（apps/server-next）
rules: {
  'no-restricted-imports': ['error', {
    patterns: [
      { group: ['../../server/**', 'apps/server/**'], message: 'server-next 不得引用 apps/server' },
      { group: ['../../web/**', 'apps/web/**'], message: 'apps/web 已退役' },
      { group: ['../../web-next/src/**', 'apps/web-next/src/**'], message: '共享应走 packages/*' },
    ]
  }]
}
```

加入 `npm run lint` 与 `npm run preflight` 流水线，每个 PR 必跑。补充 `scripts/verify-server-next-isolation.mjs` 走 ts-morph 模块图遍历做 CI 兜底。

### 4.7 依赖白名单（MUST-5 新增；v2.4 扩列图标库）

server-next 可使用的 npm 包，超出本表即触发 BLOCKER §5.2 第 2 条。

#### 预批（直接使用）
- React 18 / Next.js / TypeScript / zod / clsx / tailwind-merge / dayjs / zustand（已在仓库）
- `@dnd-kit/core` `@dnd-kit/sortable`（apps/server 已用，server-next 复用拖拽场景）
- `@resovo/types` `@resovo/player-core` `@resovo/admin-ui` `@resovo/design-tokens`（workspaces 内）
- **`lucide-react@^1.12.0`**（v2.4 扩列；CHG-SN-2-01.5 + ADR-103b）— **安装位置仅 apps/server-next**；packages/admin-ui 严禁引入（ADR-103a §4.4-4 零图标库依赖硬约束 + ADR-103b §4.4 安装位置约束）；仅允许 named import；Next.js `optimizePackageImports` 配置纳入 `lucide-react`

#### 候选（首次落地前 spawn arch-reviewer 二选一）
| 场景 | 候选 1 | 候选 2 | 决策时机 |
|---|---|---|---|
| 图表（analytics） | `recharts` | `visx` | M-SN-6 首次落地前 |
| DAG 渲染（crawler 任务依赖） | `reactflow` v11 | `dagre-d3` | M-SN-6 首次落地前 |
| 虚拟滚动（>50k 数据） | `@tanstack/react-virtual` | `react-window` | M-SN-6 首次落地前 |

#### 严禁
- 任何 UI 框架（antd / mui / chakra / shadcn 重型组件库）— 与"复用 packages/admin-ui"硬冲突
- 任何状态管理替代品（redux / jotai / valtio）— 已用 zustand
- 任何路由库（react-router）— Next.js App Router 已覆盖
- **packages/admin-ui 工作区引入任何图标库**（含 `lucide-react` / `@heroicons/react` / `react-icons`）— 违反 ADR-103a §4.4-4 注入约束（v2.4 新增；ESLint `no-restricted-imports` + `scripts/verify-server-next-isolation.mjs` 模块图校验双兜底）

> v2.4 备注：替代图标库（如 `@heroicons/react` / `react-icons`）暂不进入"严禁"列；若未来在 server-next 内出现引入需求，须新起 ADR-103b 续修订评审（避免双图标库混用）。

---

## 5. 工作流规约

### 5.1 自动化 review 闭环（规约 A）

每个 CHG 卡 / Task 卡完成时：

```
1. 主循环执行任务 → typecheck + lint + test 全绿
2. 主循环 spawn arch-reviewer (Opus) 子代理
   输入：任务卡 + diff + 触及契约 + 关联 ADR
3. 子代理输出 verdict：PASS / CONDITIONAL / REJECT
4. 处理：
   - PASS    → 写 changelog + commit + 关闭任务卡
   - CONDITIONAL → 主循环按 review 项修复 → 再次 spawn arch-reviewer
                   连续 ≤3 轮；>3 轮升 BLOCKER 等人工
   - REJECT  → 任务卡退回设计阶段；BLOCKER 等人工
5. 任务卡字段必填："review 状态：PENDING/PASS/CONDITIONAL(N/3)/REJECT"
   + "审计 commit hash"
```

### 5.2 BLOCKER 触发清单（规约 B）

执行中任意一条命中 → 立即写 BLOCKER 暂停会话：

1. 任务文件范围之外的改动需求
2. 需要新增 §4.7 依赖白名单之外的 npm 包
3. 需要修改**现有** admin API 端点（path / schema / 鉴权）— **新增端点不触发**（走 ADR + Opus 评审通道）
4. 需要修改 DB schema（含新 migration）
5. 需要新增 / 修改 token 层 base / semantic 字段
6. 需要修改 packages/admin-ui 公开 API（Props / 事件 / 生命周期）
7. 同一 review 修复 >3 轮仍未 PASS
8. 计划外的 IA / URL 命名 / 鉴权模型 / 错误降级 / 缓存策略决策
9. apps/server 与 apps/server-next 出现交叉依赖
10. cutover 检查清单出现红项（M-SN-7）
11. 单 milestone 工时超出估算 +30%（SHOULD-1 新增）
12. plan 本身需要修订（走 plan 版本协议 §0）

### 5.3 Milestone 阶段审计协议（规约 C，MUST-6 修订）

每个 Milestone 完成时：

```
主循环 spawn arch-reviewer (Opus)
输入：milestone 范围内全部 commit + 完成标准清单 + 关联 ADR
输出三件：
  ① 偏差报告：偏离计划的决策点（合理 / 需追溯 ADR / 必须回滚 三档）
  ② 质量评级：A / B / C
  ③ 人工审核 checklist：自动审计无法判定的开放项
       + 关键页面交互验收路径
       + 截图建议（设计 vs 实装对照）
M-SN-7 final 审计必须人工 sign-off（PR 描述显式签字）
```

#### A / B / C 评级判据

| 评级 | 客观条件（全部满足） | 处理 |
|:-:|---|---|
| **A** | 完成标准 100% + 偏差报告 0 项"必须回滚" + e2e 黄金路径全绿 + 工时未超 +10% + a11y 无 critical 项 | 直接进入下一 milestone |
| **B** | 完成标准 ≥90% + 偏差报告 ≤2 项"需追溯 ADR" + e2e 全绿 + 工时未超 +30% | 补齐 ADR 后进入下一 milestone |
| **C** | 任一不满足 B：完成标准 <90% / 偏差报告含"必须回滚" / e2e 出红 / 工时超 +30% | 整 milestone 返工；BLOCKER §5.2 第 11 条 |

**两层评级体系**：任务级 §5.1 PASS/CONDITIONAL/REJECT 与 milestone 级 A/B/C 独立。任务级评审检查 diff 局部质量；milestone 级评审检查全 milestone 战略对齐与完成度。

### 5.4 任务卡 / changelog / commit 模板

#### 任务卡（写入 `docs/tasks.md`）必填字段

```markdown
## CHG-SN-<milestone>-<seq> · <短标题>

- 来源 milestone：M-SN-N
- 关联 plan §：§4.x / §6.M-SN-N / §7.<view>
- 关联 ADR：ADR-100 / 047 / 048 / ...
- 关联 brief 推荐：推荐 N（如适用）
- 关联痛点：audit §7 痛点 N（如适用）
- 文件范围：apps/server-next/src/... / packages/admin-ui/...
- 不在范围（明列防扩张）：
- 完成标准：
- 复用矩阵（来源/自建）：
- 测试要求：typecheck + lint + unit + e2e 黄金路径
- 主循环模型：claude-opus-4-7（默认）/ claude-sonnet-4-6
- 子代理调用：arch-reviewer (Opus) 自动化 review
- review 状态：PENDING
- 工时估算：N 天 / 实际：N 天
```

#### commit trailer 必含（SHOULD-7 兼容性声明）

```
Refs: CHG-SN-<id>
Plan: docs/server_next_plan_20260427.md §<节号>
Review: <arch-reviewer commit hash> PASS
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

trailer 与 `docs/rules/git-rules.md` 当前格式兼容（已核：`Refs:` 与 `Co-Authored-By:` 是 git-rules 标准字段；新增 `Plan:` `Review:` 不与现有钩子冲突）。M-SN-0 第三批 ADR 起草时同步在 git-rules.md 中追认 server-next 期间的 trailer 扩展。

---

## 6. Milestone 划分（含工时估算 SHOULD-1）

> 工时阈值：单 milestone 超估算 +30% 触发 BLOCKER §5.2 第 11 条；累计偏差超 +50% 触发 plan 版本修订。

### M-SN-0 · 立项前清理工作台 · **1 周**
- **范围**：见 §11
- **完成标准**：docs / code / ADR 三批清理 PASS；ADR-100/047/048 三份 Opus 评审 PASS
- **阶段审计输入**：清理前后的 git diff + 三份 ADR 文本

### M-SN-1 · 工程骨架 + Token 三层 + Provider · **1.5 周**
- **范围**：
  - apps/server-next 工程骨架（Next.js App Router 空壳）
  - **packages/admin-ui 空骨架（M-SN-1 第一个任务卡）**
  - packages/design-tokens 三层重构 + 现有引用方迁移（packages/design-tokens 内部 + apps/web-next 引用面）
  - BrandProvider / ThemeProvider 移植（沿用 ADR-038/039）
  - 路由骨架（IA v0 §7 全部 21 顶层 + 5 system 子 + login/403/404 占位）
  - apiClient + 鉴权层
- **完成标准**：
  - `npm run dev` 起 :3003，登录 → dashboard 通路打通
  - 所有路由 SSR 不报错（即使内容为占位）
  - typecheck + lint + 现有 test 全绿
  - apps/web-next 在 token 三层下视觉无回归（截图对比）
  - packages/admin-ui 在 root workspaces 注册成功
- **关联 ADR**：ADR-100（立项）/ ADR-102（token 三层）
- **阶段审计重点**：token 收编完整性、Provider 协议合规、零 apps/server 依赖、ESLint no-restricted-imports 规则生效

### M-SN-2 · packages/admin-ui v1（地基 + Shell）· **3 周**（A2 方案 + Shell 扩列，CHG-SN-1-12 修订）
- **范围**：
  - **A. Shell 编排层（10 个组件，CHG-SN-1-12 新增）**：
    - `<AdminShell>` 顶层容器（编排 Sidebar + Topbar + main + ToastViewport + CommandPalette + KeyboardShortcuts）
    - `<Sidebar>`（Brand 区 / 5 组 NAV 渲染 / 折叠开关 / count 徽章 / 折叠态 tooltip / sb__foot 触发）
    - `<Topbar>`（面包屑 + 全局搜索触发 + health + 主题切换 + 任务/通知/设置图标）
    - `<UserMenu>`（用户菜单下拉 6 项动作）
    - `<NotificationDrawer>` + `<TaskDrawer>`（设计稿 §08，右侧滑入双面板）
    - `<CommandPalette>` ⌘K 命令面板（导航 + 快捷操作 + 搜索结果三组，键盘导航）
    - `<ToastViewport>` + `useToast()`（zustand 单例，非 Context；Provider 不下沉约束兼容）
    - `<HealthBadge>`（Topbar 健康三项指标）
    - `<Breadcrumbs>`（接受 items 数组；**消费方调用 `inferBreadcrumbs(activeHref, nav)` helper 后通过 `crumbs` prop 注入 AdminShell**——AdminShell 不在内部推断；2026-04-30 修订 / ADR-103a fix 已裁定）
    - `<KeyboardShortcuts>` + `IS_MAC` / `MOD_KEY_LABEL` / `formatShortcut()` 工具集
  - **B. 数据原语层（沿用 v1 计划）**：
    - DataTable v2（含 useTableQuery URL/sessionStorage 同步）
    - Toolbar / Filter / ColumnSettings
    - Pagination v2 客户端 + 服务端两档（**游标 + 虚拟滚动延迟到 M-SN-6 首次 >50k 数据时按需即建**）
    - Drawer / Modal / AdminDropdown / SelectionActionBar
    - Empty / Error / Loading 状态原语
  - **C. 公开 API 契约前置**：
    - `AdminNavItem` 类型扩展 5 字段（icon / count / badge / shortcut / children）+ `AdminNavCountProvider` 接口；admin-nav.ts 改写在 server-next 侧（M-SN-2 第 1 张卡）
    - Shell 10 组件 Props 公开 API 契约固化（详见 ADR-103a 草案 / Opus 评审 PASS 后定稿）
  - **D. 演示页**：
    - Storybook-style demo 页（在 server-next `/admin/dev/components`），覆盖 Shell 10 组件 + 数据原语全集
- **完成标准**：
  - Shell 10 组件 + 数据原语全部在 demo 页可交互
  - DataTable v2 客户端 / 服务端分页切换正常
  - useTableQuery URL 同步可验证：刷新后筛选/排序/分页保留
  - `<AdminShell>` 在 server-next admin layout 替换现有极简骨架（13 路由可跳转 → 完整壳层），视觉与设计稿 v2.1 shell.jsx 对齐
  - 单元测试覆盖率 ≥70%（含 Shell 组件键盘事件 / Toast 队列 / countProvider 求值）
  - 零硬编码颜色（CI 扫描）/ 零 fetch 副作用（packages/admin-ui 内 grep 校验）
  - SSR 兼容（admin layout 服务端渲染不报错）
- **关联 ADR**：ADR-103（DataTable v2 公开 API 契约）+ **ADR-103a（Shell 公开 API 契约，CHG-SN-2-01 起草）** — 两份 ADR 须先于对应组件首个任务卡完成 Opus PASS（参照 §4.5 ADR-端点先后协议精神）
- **关联 brief**：推荐 4
- **阶段审计重点**：
  - Shell 公开 API 契约稳定性（Props 类型未在 milestone 中期变更）
  - Provider 不下沉约束（packages/admin-ui 内零 BrandProvider/ThemeProvider 声明，仅消费 hooks）
  - SSR / Edge Runtime 兼容（无 window/document 直接访问于模块顶层）
  - a11y 基线（键盘导航全覆盖 ⌘K/⌘1-5/⌘B/⌘,/Esc/↑↓/Enter；焦点环；对比度 ≥4.5:1；aria-* 完整）
  - 复用矩阵 §8 视图行 admin-layout 列扩展为 Shell 列后，所有视图标 ✅
  - 设计稿 shell.jsx 视觉对齐（截图对照：折叠态 + 展开态 × 明暗 = 4 张）

### M-SN-3 · 标杆页：视频库 · **1 周**
- **范围**：
  - `/admin/videos` 列表（DataTable v2 实战）
  - 视频编辑 Drawer（复用，所有入口走 Drawer）—— **独立 `/admin/videos/[id]/edit` 全屏页移出 M-SN-3**：本里程碑只做 Drawer，独立全屏页推迟到 M-SN-4 范围；详见 `docs/task-queue.md` SEQ-20260429-01 关键约束「禁止在 CHG-SN-3-07 之前实装独立全屏页」（2026-04-30 修订 / 与 task-queue 对齐）
  - 状态三元组的"前台可见性原子指示器"（admin_audit 痛点 5 解决件）
  - CRUD + 上下架 + 批量 + 服务端排序/筛选/分页
  - e2e 黄金路径：登录 → 列表 → 编辑 → 保存 → 列表回归
  - **末尾：staging 环境 cookie + nginx 反代 e2e 演练（DISCUSS-3）**
- **完成标准**：
  - 与 apps/server 现 `/admin/videos` 功能 100% 对齐
  - 可作为后续视图的"模板"（任务卡复用其文件结构 — 模板路径写入 `docs/server_next_view_template.md`）
- **关联 brief**：推荐 4 实战、痛点 5
- **阶段审计重点**：是否真正可作为模板（结构清晰度 + 复用矩阵达标）+ e2e 演练通过

### M-SN-4 · P0 痛点视图：审核台 + 视频编辑 Drawer · **2.5 周**
- **范围**：
  - `/admin/moderation` 三栏 + 4 Tab（待审 / 已审 / 已拒绝 / 已发布历史可选）
  - 双信号展示规范（probe/render 双柱图 + 决策卡 + 证据抽屉）
  - 已审 Tab 含发布预检清单 + 单/批量发布动作（替代 staging 页）
  - 状态保留型筛选（URL/sessionStorage 持久化，不再 setListRefreshKey 重挂载）
  - 视频编辑 Drawer 4 Tab（基础 / 线路 / 图片 / 豆瓣）+ 全屏模式 + 全局入口
- **完成标准**：
  - 痛点 1（合并拆分入口）/ 3（双信号）/ 6（筛选保留）解决
  - 筛选保留率：0% → 100%（可观测）
  - e2e 黄金路径：审核 → 通过 → 已审 → 发布
- **关联 brief**：推荐 1
- **关联痛点**：1（部分）/ 3 / 5（前台可见性）/ 6
- **阶段审计重点**：双信号显示是否分双轨、状态保留是否经得起 5 步操作压力测试

### M-SN-5 · P1 视图（含 admin API 补齐）· **4 周**
- **范围**：
  - **admin API 补齐子任务**：home_modules CRUD（推荐 3，6 端点 + ADR-104）/ split-unmerge / candidate-preview（推荐 5，3-4 端点 + ADR-105）— 每个端点 Opus 评审
  - **ADR-端点先后协议**（§4.5）：ADR-104/051 必须先于对应端点首个任务卡完成 Opus PASS；同 ADR 下多端点复用评审；不允许端点 PR 与 ADR 同卡
  - `/admin/sources`（线路矩阵 + 视频维度分组 + 全局别名表，推荐 2）
  - `/admin/home`（首页运营位统一编辑器：banner + featured + top10 + type_shortcuts，推荐 3，需 home_modules API 就位）
  - `/admin/merge`（合并 candidate 预览 + 拆分工作台，推荐 5，需 split-unmerge API 就位）
  - `/admin/submissions`（用户投稿）
  - `/admin/subtitles`（字幕管理）
  - `/admin/users`（用户管理）
- **完成标准**：6 视图全功能对齐 + 新增 9-10 端点 ADR-104/051 PASS + e2e 黄金路径
- **关联 brief**：推荐 2 / 3 / 5
- **关联痛点**：1（完整解决）/ 2 / 4 / 7 / 8
- **阶段审计重点**：复用矩阵达标率、新增端点契约规范、是否引入新原语未下沉

### M-SN-6 · 周边视图 + 设计稿缺口 + 大数据原语 · **4 周**（R7 MUST-7 c 上调）
- **范围**：
  - `/admin/crawler`（站点行展开 + 任务依赖 DAG + MACCMS 配置 + 线路别名分组）— 触发 reactflow vs dagre-d3 选型
  - `/admin/image-health`
  - `/admin/analytics` — 触发 recharts vs visx 选型
  - `/admin/system/*`（settings / cache / monitor / config / migration，5 子视图）
  - `/admin/audit`（审计日志，新增视图）
  - 设计稿后续补完的"设置补全 / 采集展开 / 开发者模式 / 弹层规范"对齐
  - 通知 + 后台任务双面板 + Toast 系统
  - **大数据原语**：游标分页 + 虚拟滚动（首次 >50k 数据集出现时按需即建）— 触发 react-virtual vs react-window 选型
- **完成标准**：13 admin 顶层 + 1 system landing + 5 system 子 + 1 编辑子 + 1 认证 = 21 路由占位全集覆盖 ≥95%；剩余视图（如 design-tokens / sandbox 调整）评估保留或退役
- **阶段审计重点**：覆盖率 + 设计稿对齐度 + 三类候选依赖选型决议

### M-SN-6.5 · 非功能验收门 · **0.5 周（软上限 1 周）**（SHOULD-2 新增 + R7 SHOULD-8）
- **范围**：
  - **a11y 验收**：键盘导航全覆盖 + 焦点环 + 对比度 ≥4.5:1 + aria-* 完整 + screen reader 关键路径验证
  - **性能验收**：首屏 LCP < 2.5s（dashboard / videos）+ 表格渲染 100 行 < 200ms + 5 万行虚拟滚动 ≥30 FPS
  - **跨浏览器**：Chrome / Firefox / Safari 最新两版
  - **断点回归**：1280 / 1440 / 1920 三档
- **完成标准**：四类验收全 PASS；任一项 critical 退回对应 milestone 修复
- **软上限协议（R7 SHOULD-8）**：基线 0.5 周；任一类验收发现 critical >2 项即升至 1 周；超 1 周触发 BLOCKER §5.2 第 11 条
- **阶段审计**：人工抽查（不全自动）

### M-SN-7 · Cutover · **0.5 周**
- **范围**：
  - functional parity 验收清单（apps/server vs apps/server-next 全 21 路由占位逐项 diff）
  - e2e 全绿
  - **同 commit 内**：nginx 反代配置切换（`/admin/*` :3001 → :3003）+ apps/server 删除 + `apps/server-next` → `apps/admin` 改名（DISCUSS-4）
  - 24h 监控期
  - **+ 7 天**：物理目录 + git tag `pre-server-next-cutover` 保留；超 7 天回滚走完整 commit revert（RTO ≤ 4h，DISCUSS-5）
- **完成标准**：cutover + 24h 平稳；运营 0 报障；同 commit 完成全部退场动作进 main
- **关联 ADR**：ADR-101
- **阶段审计**：**人工 final sign-off**（PR 描述签字）

### 总周期：**18.0 周（~4.5 个月）**（v1 16w → v2 17.5w → v2.3 18.0w；v2.3 = CHG-SN-1-12 M-SN-2 范围扩列 Shell +0.5w）

| Milestone | 估算 | 累计 |
|---|:-:|:-:|
| M-SN-0 | 1.0 | 1.0 |
| M-SN-1 | 1.5 | 2.5 |
| **M-SN-2** | **3.0**（v2.2 2.5 + Shell 扩列 +0.5）| 5.5 |
| M-SN-3 | 1.0 | 6.5 |
| M-SN-4 | 2.5 | 9.0 |
| M-SN-5 | 4.0 | 13.0 |
| M-SN-6 | 4.0 | 17.0 |
| M-SN-6.5 | 0.5（软上限 1.0） | 17.5 |
| M-SN-7 | 0.5 | 18.0 |

---

## 7. IA v0 与视图清单（MUST-2 + SHOULD-6 修订）

> **IA 命名声明（SHOULD-6）**：本 IA 为开发期占位；URL slug 优先英文（`/admin/moderation` 等）；中文菜单文案在 cutover 前可调；调整 URL 触发 §5.2 BLOCKER 第 8 条。设计稿 v2.1 仍在补完，cutover 前再做一次 IA 对照。

```
/admin
├─ [运营中心]
│  ├── dashboard            管理台站（⌘1；含原 analytics 卡片库内嵌为 Tab，M-SN-3 实装）
│  └── moderation           内容审核（⌘2；4 Tab：待审 / 已审 / 已拒绝 / 已发布历史）
│                           ★ R3 修正：含原 staging 发布动作；α 方案：待审 Tab 即"采集后未审"集合
│
├─ [内容资产]
│  ├── videos               视频库（⌘3）
│  │   └── [id]/edit        视频编辑 Drawer 全屏模式（M-SN-4 落地）
│  ├── sources              播放线路（含全局别名表）
│  ├── merge                合并拆分（依赖 split-unmerge / candidate-preview API，M-SN-5 内补）
│  ├── subtitles            字幕管理（⌘4）
│  └── image-health         图片健康
│
├─ [首页运营]                ★ v1 修订：从原系统管理组剥离独立成组
│  ├── home                 首页运营位编辑器（依赖 home_modules API，M-SN-5 内补）
│  └── submissions          用户投稿
│
├─ [采集中心]
│  └── crawler              采集控制（⌘5；站点行展开内嵌"线路/别名"分组）
│
├─ [系统管理]
│  ├── users                用户管理
│  ├── system/settings      站点设置（⌘,；M-SN-3 落地为容器，Tab 切换 settings/cache/monitor/config/migration）
│  └── audit                审计日志
│
├─ [hidden · 路由保留不暴露侧栏]   ★ v1 修订：详见 ADR-100 IA 修订段
│  ├── analytics            数据看板（内容并入 dashboard 内 Tab，M-SN-3 迁移）
│  ├── system/cache         缓存管理（作为 settings 容器的 Tab 面板）
│  ├── system/monitor       性能监控（作为 settings 容器的 Tab 面板）
│  ├── system/config        运行时配置（作为 settings 容器的 Tab 面板）
│  └── system/migration     迁移工具（作为 settings 容器的 Tab 面板）
│
└── login                    登录页

★ 已移除：staging（合并到 moderation 已审 Tab，M-SN-1 既定）
★ v1 修订（2026-04-28 · CHG-SN-1-10 / ADR-100 IA 修订段）：
   - dashboard label 由"工作台"→"管理台站"
   - 首页运营独立成组（home + submissions 从系统管理剥离）
   - analytics + system 4 子从侧栏隐藏，路由占位保留（避免 BLOCKER 8 触发）
★ 待评估：design-tokens / sandbox（M-SN-6 决定是否保留为 dev 入口）
```

#### 视图数（v2.1 修订 · 2026-04-28 CHG-SN-1-10 IA v0 → v1 修订）

> v0 写"顶层 21 / 总 27"与文字清单不一致，CHG-SN-1-08 已修订为 21；v1 修订（2026-04-28 · CHG-SN-1-10）维持 21 路由占位总数不变（不删 URL 文件，避免 BLOCKER 第 8 条），但侧栏暴露数从 13 顶层缩减到 9 顶层 + 1 system 子（站点设置）= 10 项链接（analytics 折叠进 dashboard，system 4 子折叠进 settings 容器）。详见 ADR-100 IA 修订段。

实际枚举（M-SN-1 落地基线 + IA v1 暴露策略）：

| 类别 | 路由占位数 | 侧栏暴露数 | 清单 |
|---|:-:|:-:|---|
| **运营中心** | 2 | 2 | dashboard / moderation |
| **内容资产** | 5 | 5 | videos / sources / merge / subtitles / image-health |
| **首页运营** | 2 | 2 | home / submissions |
| **采集中心** | 1 | 1 | crawler |
| **系统管理** | 7 | 3 | users / system(landing) / system/settings ✓暴露; system/cache / system/monitor / system/config / system/migration ✗hidden; audit |
| **hidden 顶层** | 1 | 0 | analytics（内容 M-SN-3 并入 dashboard）|
| **编辑子** | 1 | 0 | videos/[id]/edit（M-SN-4 落地）|
| **认证** | 1 | 0 | /login |
| **总计** | **21** | **10 项侧栏链接** | — |

附加错误页（不计入路由占位但 Next.js 标准）：`/403` + `/not-found`。

cutover 验收按上表 21 路由占位逐项 diff（路由文件物理存在），并按 10 项侧栏链接做 IA 视觉对账（替代 v0 的 13 顶层暴露）。

---

## 8. 复用矩阵（按视图，MUST-2 + SHOULD-5 修订；CHG-SN-1-12 v2.3 修订：admin-layout 列拆为 admin-layout token + Shell 两列）

> 任务卡完成标准要求复用率 ≥80%；自建组件首次跨 2 视图时强制下沉。
> Shell 列含义：视图是否被 `<AdminShell>` 包裹（消费 Sidebar / Topbar / Toast / CmdK / 键盘快捷键）；
> admin-layout token 列含义：视图样式是否消费 packages/design-tokens 第 5 层（admin-layout 命名空间，ADR-102 v2.1 修订）。

| 视图 | DataTable | useTableQuery | Drawer | Toast | 双信号 token | admin-layout token | Shell | 自建组件（下沉里程碑）|
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| dashboard | — | — | — | ✅ | — | ✅ | ✅ | 卡片库 / 三态布局（M-SN-3）|
| moderation | ✅ | ✅ | ✅ | ✅ | ✅（核心）| ✅ | ✅ | 决策卡 / 三栏 / Tab seg / 双信号双柱图（M-SN-4 下沉）|
| videos | ✅ | ✅ | ✅ | ✅ | ✅（线路区）| ✅ | ✅ | 状态原子指示器（M-SN-3 下沉）|
| sources | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 视频分组表 / 全局别名表（M-SN-5 下沉）|
| merge | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | 拆分确认 / 审计时间线 / 合并候选预览（M-SN-5 下沉）|
| subtitles | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| home | — | — | ✅ | ✅ | — | ✅ | ✅ | 首页运营位编辑器 / 拖拽排序（M-SN-5 下沉）|
| submissions | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| crawler | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 站点行展开 / 采集 DAG（M-SN-6 下沉）/ MACCMS 配置面板 |
| image-health | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | 矩阵图（评估降级到表格）|
| analytics | ✅ | — | — | ✅ | — | ✅ | ✅ | 图表（M-SN-6 触发 recharts/visx 选型；IA v1 hidden，内容并入 dashboard）|
| users | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| audit | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | 审计时间线（M-SN-6 下沉，与 merge 共享）|
| system/settings | — | — | ✅ | ✅ | — | ✅ | ✅ | 表单（容器 Tab：cache/monitor/config/migration 4 子内嵌）|
| system/cache | ✅ | ✅ | — | ✅ | — | ✅ | ✅（settings 容器内）| —（IA v1 hidden）|
| system/monitor | ✅ | — | — | ✅ | — | ✅ | ✅（settings 容器内）| 实时图表（共享 analytics；IA v1 hidden）|
| system/config | — | — | ✅ | ✅ | — | ✅ | ✅（settings 容器内）| 表单（IA v1 hidden）|
| system/migration | ✅ | — | — | ✅ | — | ✅ | ✅（settings 容器内）| —（IA v1 hidden）|
| login | — | — | — | ✅ | — | — | **— (不进 Shell)** | 表单 |

**Shell 列说明（CHG-SN-1-12 v2.3 新增）**：
- 全部 `/admin/*` 视图被 `<AdminShell>` 包裹（19 项 ✅）
- `/login` 不进 Shell（独立 layout，仅消费 ToastViewport，因为登录失败需 toast；ToastViewport 可单独引入而不依赖 AdminShell）
- system 4 子（cache/monitor/config/migration）路由保留但 IA v1 已折叠为 settings 容器 Tab；Shell 列标注"（settings 容器内）"，表示间接通过 settings 视图消费 Shell

**自建组件下沉时机汇总**：
- M-SN-3：状态原子指示器、卡片库
- M-SN-4：决策卡、双信号双柱图、证据抽屉、三栏布局
- M-SN-5：视频分组表、全局别名表、首页运营位编辑器、拖拽排序、合并候选预览、拆分确认
- M-SN-6：采集 DAG、审计时间线、图表

---

## 9. ADR 索引

| ADR | 标题 | 范围 | 起草时机 |
|---|---|---|---|
| ADR-100 | server-next 立项与 IA v0 | Q1–Q10 决策 + IA 修正 + 单语言 + 依赖白名单 | M-SN-0 第三批 |
| ADR-101 | server-next 切流与 cutover 协议 | E 方案 4 条硬约束 + nginx 反代 + 7 天保留 + 同 commit 改名 | M-SN-0 第三批 |
| ADR-102 | admin token 三层收编协议 | base / semantic / admin-layout 划分 + 设计稿 v2.1 收编映射 | M-SN-0 第三批 |
| ADR-103 | DataTable v2 公开 API 契约 | useTableQuery hook + Props v2 + 客户端/服务端两档分页协议 | M-SN-2 数据原语首张卡前（Opus PASS 前置） |
| ADR-103a | Shell 公开 API 契约（CHG-SN-1-12 v2.3 新增） | `<AdminShell>` 等 10 组件 Props 类型骨架 + AdminNavItem 5 字段扩展（icon/count/badge/shortcut/children）+ AdminNavCountProvider 接口 + 4 级 z-index 规范（业务 Drawer < Shell 抽屉 < CmdK < Toast）+ Provider 不下沉 + Edge Runtime 兼容 + 零硬编码颜色 | M-SN-2 第一张组件卡前（CHG-SN-2-01；Opus PASS 前置） |
| ADR-104 | home_modules admin API 协议 | 推荐 3 落地所需 6 端点 + 鉴权 + 缓存失效 | M-SN-5 内 |
| ADR-105 | merge candidate / split / unmerge API 协议 | 推荐 5 落地所需 3-4 端点 + 审计日志 schema | M-SN-5 内 |
| ADR-候选 | 大数据原语依赖选型（react-virtual / reactflow / recharts 二选一三组）| Q-MUST-5 候选清单决议 | M-SN-6 首次落地前 |

---

## 10. 风险与回滚（SHOULD-4 修订）

### 10.1 Cutover 回滚（ADR-101 §回滚）
- worktree 备份 + git tag `pre-server-next-cutover`
- nginx 配置 `/admin/* → :3001` 切回（一行 reload）
- apps/server 物理目录保留 7 天 + git tag 与之一致
- 超 7 天回滚走完整 commit revert（RTO ≤ 4h）

### 10.2 设计稿未完工的风险
- 用户已说明 v2.1 仍在补"设置补全 / 采集展开 / 开发者模式 / 弹层规范"
- M-SN-4 不依赖未完工部分；M-SN-6 才会触及
- M-SN-6 启动前需要确认设计稿完工度，否则推迟 M-SN-6（可并行做 M-SN-7 cutover 准备的非业务部分）
- **设计稿大改应急（SHOULD-4-c）**：cutover 前若 IA 大改，回滚到 v2.1 已实现部分 + 任务卡补"未实装入口暂不暴露"声明

### 10.3 工作流规约执行偏差
- 自动化 review 失败连续 3 次 → BLOCKER（清单第 7 条）
- milestone 阶段审计 C 评级 → 整 milestone 返工
- 计划外决策不停机 → 命中 BLOCKER 第 8 条 → review 期检测

### 10.4 packages/design-tokens 重构对 web-next 的影响
- M-SN-1 token 三层重构会触及 apps/web-next 的引用面
- **缓解**：重构 PR 必须包含 web-next 视觉回归截图对照
- **截图标准清单（R7 DISCUSS-7）**：
  - 4 个关键页面：home（`/`）/ search（`/search`）/ video detail（`/video/[slug]`）/ player（播放器全屏态）
  - × 2 个主题模式：明色（data-theme="light"）+ 暗色（data-theme="dark"）
  - = **8 张截图**，重构 PR 描述中按 `<页面>-<模式>.png` 命名顺序粘贴；缺一即 PR 不可 merge
- **回滚**：token 重构 PR 单独切分，不与 server-next 业务代码混在同一 PR

### 10.5 Plan 版本控制风险（SHOULD-4-a）
- plan 修订必须走 §0 版本协议（spawn arch-reviewer + 修订日志 + commit trailer）
- 重大修订（范围 / milestone / Non-Goals）须人工 sign-off
- 任务卡引用的 plan §节号必须与当前 plan 版本一致；plan 升版后旧任务卡需做兼容性核查

### 10.6 apps/api 契约漂移风险（SHOULD-4-b）
- 开发期内 `apps/api/src/routes/admin/*.ts` 现有端点禁止改 path / schema / 鉴权
- 任何 P0 hotfix 必须 ping server-next 主循环并写入 task-queue
- M-SN-5 新增端点不得修改邻近现有端点（隔离原则）

### 10.7 设计稿大改应急
- 见 §10.2
- **IA v0 → v1 修订已完成**（2026-04-28 · CHG-SN-1-10 · ADR-100 IA 修订段）：dashboard label / analytics 折叠 / 首页运营独立组 / system 5 子 Tab 化 4 项裁决落盘；侧栏暴露从 13 顶层缩减到 10 项链接；路由占位总数 21 不变。cutover（M-SN-7）前最终对账义务（拉取设计稿最新版本、三方 diff、写入 `manual_qa_m_sn_7_*.md` 的 IA 章节）详见 ADR-100 "IA 修订段 → 剩余差异"。

### 10.8 Bus factor / 上下文中断（SHOULD-4-d）
- 每个 milestone 末尾输出"上下文移交文档"（在 docs/server_next_handoff_M-SN-N.md）：当前 milestone 决策点 / 未决议题 / 关键任务卡指针 / 复盘结论
- BLOCKER 暂停 >7 天自动触发 milestone 中期审计

---

## 11. M-SN-0 · 立项前清理工作台（任务化）

### 11.1 第一批：docs 归档（spawn doc-janitor）

| # | 操作 | 目标 |
|---|---|---|
| D1 | 移 `docs/freeze_notice_20260418.md` → `docs/archive/freeze_notice_20260418.md`，原位 stub | freeze_notice 退役 |
| D2 | 移 `docs/frontend_redesign_plan_20260418.md` `frontend_phase2_plan_20260424.md` `frontend_design_spec_20260423.md` `image_pipeline_plan_20260418.md` `design_system_plan_20260418.md` → `docs/archive/m0-m6/` | 前端方案归档 |
| D3 | 归档 task-queue 历史：移已完成序列到 `docs/archive/task-queue/task-queue_archive_20260427.md`；保留进行中 + 待启动；顶部加约束声明"新任务序列号不与历史重复" | task-queue 收敛 |
| D4 | 归档 changelog 历史：按里程碑切到 `docs/archive/changelog/changelog_m0-m6.md`；主 changelog 保留 M-SN 之后条目 | changelog 收敛 |
| D5 | 修正 `docs/architecture.md` §1 漂移（apps/web → apps/server / apps/web-next）；预告 server-next | 真源对齐 |

**完成标准**：所有归档文件 git add；原位 stub 含跳转链接；spawn arch-reviewer 复核 PASS。

### 11.2 第二批：code 清理（主循环 + arch-reviewer）

| # | 操作 | 目标 |
|---|---|---|
| C1 | 删除 `apps/web/` 整个目录（含 .next/ .DS_Store） | 旧前台清退 |
| C2 | 根 `package.json` workspaces 由 `apps/*` 改为显式列举 `apps/api`、`apps/server`、`apps/server-next`、`apps/web-next`（+ `packages/admin-ui`、其他 packages、tools/*） | workspace 收敛 |
| C3 | grep 全仓 `apps/web` / `@resovo/web` 引用，确认 0 命中（audit §5.4 已确认） | 防漏 |
| C4 | 跑 `npm install` + `npm run typecheck` + `npm run lint` + `npm run test -- --run` 全绿 | 不回归 |
| C5 | 提交 PR；spawn arch-reviewer 复核 | 闭环 |

### 11.3 第三批：ADR 起草（主循环 + Opus 评审）

| # | 操作 | 目标 |
|---|---|---|
| A1 | 起草 ADR-100（server-next 立项 + IA v0 + 单语言 + 依赖白名单） | 立项决策固化 |
| A2 | 起草 ADR-101（cutover 协议 + nginx 反代 + 7 天保留 + 同 commit 改名 + 回滚预案） | 切流协议固化 |
| A3 | 起草 ADR-102（token 三层收编 + 设计稿 v2.1 映射表） | token 协议固化 |
| A4 | 三份 ADR 同时 spawn arch-reviewer (Opus) 评审 | PASS 才进 M-SN-1 |
| A5 | 评审 PASS 后写入 `docs/decisions.md`；`docs/CLAUDE.md` 索引更新；`docs/rules/git-rules.md` 追认 server-next trailer 扩展 | 真源对齐 |

### 11.4 检查点

M-SN-0 完成 = 三批全部 PASS + 三份 ADR 进入 `docs/decisions.md` + 本 plan §6 列出的 milestone 进入 task-queue。

设计稿后续补完的部分（"设置补全 / 采集展开 / 开发者模式 / 弹层规范"）的 ETA 不影响 M-SN-0–M-SN-5；M-SN-6 启动前需要确认设计稿完工度，否则推迟 M-SN-6。

---

## 12. 自检清单（plan v2 完整性）

- [x] §0 性质声明 + plan 版本协议
- [x] §1 项目目标 + 度量（G2 含 API 补齐前置）
- [x] §2 In-Scope（含新增端点）+ Non-Goals 10 条（第 4 条精确措辞 / 第 5 条接 §4.7 白名单）
- [x] §3 R1–R3 + R5 决策汇总表
- [x] §4 仓库结构 / 端口 / token 三层 / packages/admin-ui 边界 + 创建时机 + 自建下沉规则 / API 耦合 + B3 方案 + **ADR-端点先后协议** / 编译期 ESLint 检查 / **§4.7 依赖白名单**
- [x] §5 工作流规约（自动化 review + BLOCKER 12 条 + milestone 审计 + A/B/C 客观判据 + 任务卡 / commit 模板 + git-rules 兼容声明）
- [x] §6 M-SN-0 ~ M-SN-7 + **M-SN-6.5 非功能验收门（含软上限 1w）** + 工时估算 + 总周期 **17.5 周**
- [x] §7 IA v0 + 视图数 27 路由占位 + IA 命名声明
- [x] §8 复用矩阵（每视图含下沉里程碑列；system/* 拆 5 子）
- [x] §9 ADR 索引（046/047/048 + 049/050/051 + 候选）
- [x] §10 风险与回滚（cutover / 设计稿 / 工作流偏差 / token 影响 **+ 8 张截图标准** / plan 版本 / api 漂移 / 设计稿应急 / bus factor）
- [x] §11 M-SN-0 三批任务化
- [x] §12 自检

---

## 修订日志

### v0 → v1（2026-04-27）

由 R5 arch-reviewer 评审 CONDITIONAL 触发，全部采纳建议。

**MUST 修复（6 项）**：
- MUST-1：M-SN-2 范围采用 A2（保留单 milestone，游标+虚拟滚动延迟到 M-SN-6）
- MUST-2：视图数公式修正（21 顶层 + 5 system + 1 编辑 = 27 路由占位）；§7 / §8 / M-SN-6 / M-SN-7 口径统一
- MUST-3：packages/admin-ui 创建时机明确（M-SN-1 第一个任务卡即建空骨架）
- MUST-4：放宽 Non-Goals 第 4 条（B3 方案）；新增端点允许但须独立 ADR + Opus 评审；M-SN-5 含 ADR-104/051 子任务
- MUST-5：新增 §4.7 依赖白名单
- MUST-6：§5.3 增 A/B/C 客观判据 + 任务级 / milestone 级两层评级体系

**SHOULD 修复（7 项）**：
- SHOULD-1：§6 加工时估算 + §5.2 BLOCKER 第 11 条（超 +30%）
- SHOULD-2：新增 M-SN-6.5 非功能验收门（a11y / 性能 / 跨浏览器 / 断点）
- SHOULD-3：§4.6 改用 ESLint no-restricted-imports + ts-morph CI 兜底
- SHOULD-4：§10 增 4 项（plan 版本 / api 漂移 / 设计稿应急 / bus factor）
- SHOULD-5：§4.4 自建组件首次跨 2 视图强制下沉；§8 加"下沉里程碑"列
- SHOULD-6：§7 加 IA 命名声明（URL slug 优先英文）
- SHOULD-7：§5.4 commit trailer 与 git-rules.md 兼容声明 + M-SN-0 第三批同步追认

**DISCUSS 决议（5 项）**：全部采纳主循环建议（详见 §3 决策汇总表）。

### v1 → v2（2026-04-28）

由 R7 二轮 arch-reviewer 评审 CONDITIONAL 触发，全部采纳建议。

**MUST 修复（2 项）**：
- **MUST-7（M-SN-6 工时失衡）**：采用方案 (c) 直接上调 — `§6 M-SN-6` 工时由 2.5w → 4w；`§6 工时表`累计调整；`§6 总周期声明` 16w → **17.5w**；`§3 决策表`新增"M-SN-6 工时上调"行
- **MUST-8（ADR-端点先后协议）**：`§4.5` 新增子节"ADR-端点先后协议"（ADR 必须先于端点首个任务卡完成 Opus PASS / 同 ADR 多端点复用 / 不允许端点 PR 与 ADR 同卡）；`§6 M-SN-5` 范围加协议引用

**SHOULD 修复（3 项）**：
- **SHOULD-8**：`§6 M-SN-6.5` 加"软上限 1 周"协议（基线 0.5w；任一类 critical >2 项升至 1w；超 1w 触发 BLOCKER §5.2 第 11 条）
- **SHOULD-9**：`§3 决策表` "Milestone 审计"行 ADR 落地列由"§5.3" → "§5.3（详见判据表）"，明确指向判据表
- **SHOULD-10**：本修订日志条目按"v1 → v2 章节定位"组织（如本节所示），便于审计员快速 diff

**DISCUSS 决议（2 项）**：
- **DISCUSS-6**（草稿/发布双态鉴权粒度）：`§4.5 ADR-端点先后协议`末段标注"留待 ADR-104 起草时一并裁定，不在 plan v2 预决"
- **DISCUSS-7**（截图清单标准化）：`§10.4` 加 8 张截图标准（4 页 × 明暗 2 模式），缺一不可 merge；`§3 决策表`新增"token 重构截图标准"行

— END plan v2 —

### v2 → v2.1（2026-04-28）

由 M-SN-1 实施过程的现状对齐 + CHG-SN-1-08 milestone 阶段审计触发的轻量修订（**无新增决策、无 BLOCKER**；修订仅校正已发现的字段错误 + 沉淀执行实证）。

**字段对账（M-SN-1 实施驱动）**：

- **§4.3 token 三层 → 4+1 层**（CHG-SN-1-03 摸现状触发 BLOCKER + 用户裁定 A 方案）
  - packages/design-tokens 现状是 4 层成熟系统（primitives / semantic / components / brands），ADR-102 原"3 层"措辞修订为"在 4 层基础上新增 admin-layout 层"
  - ADR-102 已 patch 修订记录段（`docs/decisions.md` 行 ~2178-2210）
  - plan §4.3 同步：4+1 层目录树 + 收编路径表 + 现状对齐前置说明
- **§7 视图数字字段对账**（CHG-SN-1-05 reviewer 标记 → CHG-SN-1-08 修订）
  - v2 原写"顶层 21 / 总 27"与文字清单（13 admin 顶层 + 5 system 子 + 1 编辑子 + 1 login）不一致
  - v2.1 修订为枚举数 21 路由占位（含 1 编辑子 M-SN-4 落 / system landing 1 / system 子 5 / login 1 / admin 顶层 13）
  - cutover 验收按 21 逐项 diff

**M-SN-1 实际工时 vs 估算**（v2.1 沉淀）：

| 卡 | 估算 | 实际 | 差异 |
|---|---|---|---|
| CHG-SN-1-01 packages/admin-ui 空骨架 | 0.5d | 0.3d | -40% |
| CHG-SN-1-02 server-next Next.js 空壳 | 1.0d | 0.2d | -80% |
| CHG-SN-1-03 design-tokens 4+1 层 | **2.0d** | 0.25d | -88%（A 方案大幅缩范围）|
| CHG-SN-1-04 BrandProvider 移植 + token 接入 | 1.0d | 0.15d | -85% |
| CHG-SN-1-05 IA v0 路由骨架 | 1.0d | 0.1d | -90% |
| CHG-SN-1-06 apiClient + 鉴权 + login | 1.0d | 0.15d | -85% |
| CHG-SN-1-07 ESLint 边界 + 兜底脚本 | 0.5d | 0.15d | -70% |
| CHG-SN-1-08 milestone 验收 + Opus 审计 | 0.5d | TBD | — |
| **M-SN-1 总计** | **7.5d** | **~1.3d**（估）| **-83%** |

实际工时大幅低于估算的核心因素：
1. M-SN-0 第三批 ADR + plan 已固化大量决策，M-SN-1 是工程落地（决策成本几乎归零）
2. 物理副本策略（BrandProvider / api-client）缩短调研时间
3. design-tokens 现状成熟，A 方案让 CHG-SN-1-03 工作量从重构变为增量
4. arch-reviewer 闭环效率高（首轮 PASS 5/7 卡，1 卡 CONDITIONAL 1 轮修复）

**留账（M-SN-1 不阻塞 cutover；后续卡处理）**：
- video/[id]/edit 编辑子（M-SN-4 落地）
- light theme（视需求接入；M-SN-1 dark-first，不阻塞 cutover）
- 真 e2e 登录测试（需 apps/api 在跑；M-SN-3 业务卡 e2e 时一并补）
- admin-only 子路径细分（/admin/users / /admin/crawler / /admin/analytics 仅 admin）— M-SN-2+ 视图卡按需
- apps/web-next 视觉无回归 e2e 截图对比（CHG-SN-1-03 admin-layout 是新增字段 0 现有引用面改动；本卡 milestone 审计判定不阻塞）

**节奏校准建议**：M-SN-2 估算（2.5w）按本 milestone 实测系数粗调约 0.5-1w 实际可完成，但 M-SN-2 是 packages/admin-ui v1 业务原语下沉（DataTable v2 / useTableQuery / Drawer / Modal / Toast 等），新代码量 + 单元测试覆盖率 ≥70% 要求，估算系数不宜直接套用 M-SN-1 比例。M-SN-2 启动时按 plan §6 原估算执行，CHG-SN-2-08 milestone 审计再回看校准。

— END plan v2.1（CHG-SN-1-08 落地）—

### v2.1 → v2.2（2026-04-28）

由 SEQ-20260428-02 任务 1（CHG-SN-1-10）触发的 IA v0 → v1 修订。M-SN-1 闭环（B 级 PASS）后，M-SN-2 启动前的 IA 三层对齐审计发现 `apps/server-next/src/lib/admin-nav.ts`（CHG-SN-1-05 落地）与设计稿 v2.1 真源 `docs/designs/backend_design_v2.1/app/shell.jsx` 在命名 / 分组 / 暴露策略上存在 4 项偏离，且 plan §7 自身亦偏离设计稿。子代理评审 arch-reviewer (claude-opus-4-7) 独立审计后裁决 4 项决策（详见 ADR-100 IA 修订段）。

**修订内容（CHG-SN-1-10 落盘）**：

- **§7 IA tree（行 519-560）**：fenced code block 重写为 5 组结构（运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理 + hidden 隐藏组）+ 显式标注 IA v1 修订点（dashboard label "管理台站" / analytics 折叠 / 首页运营独立 / system 4 子 Tab 化）
- **§7 视图数表（行 563-587）**：保持 21 路由占位总数不变，新增"侧栏暴露数"列；侧栏链接从 13 顶层缩减到 10 项（9 顶层 + 1 system 子）
- **§10.7 设计稿大改应急**：追加 IA v1 修订完成勾项 + cutover 前最终对账义务交叉引用 ADR-100
- **ADR-100**：追加"IA 修订段（v0 → v1，2026-04-28）"完整段落（4 项决策表 / 影响范围 / 不变约束 / 剩余差异 / cutover 对账义务 / 关联卡）

**4 项决策一览**（详见 ADR-100 IA 修订段）：

| 编号 | 偏离点 | v1 决策 |
|---|---|---|
| IA-1 | dashboard label | "工作台" → **"管理台站"** |
| IA-2 | analytics 去留 | 路由保留，**侧栏不暴露**；M-SN-3 起内容并入 dashboard 内部 Tab |
| IA-3 | 首页运营分组 | home/submissions **独立成"首页运营"组**（从系统管理剥离） |
| IA-4 | system 5 子暴露 | 侧栏只暴露 **"站点设置"**；4 子（cache/monitor/config/migration）路由保留作 settings 容器 Tab |

**不变约束**：URL slug 不动（plan §5.2 BLOCKER 第 8 条仍生效）/ 路由占位文件不删 / 不引入 M-SN-1 已闭环资产返工 / Resovo 价值排序顺序不变。

**后续卡链**：
- CHG-SN-1-11（待开）：admin-nav.ts ADMIN_NAV 常量改写 + 5 个 hidden 路由文件 head 注释
- CHG-SN-1-12（待开）：plan §6 M-SN-2 范围补列 admin-ui Shell 组件（防漏）
- CHG-SN-1-09（待开）：token 跨域守卫 string 级（M-SN-1 闭环原欠账，依赖更新为 SEQ-20260428-02 后）
- CHG-SN-1-13（待开）：changelog + handoff 补丁（IA 漏检追溯）

**修订日志元信息**：
- Plan-Revision: v2.1 → v2.2
- 主循环模型：opus
- 子代理：arch-reviewer (claude-opus-4-7) — IA 决策强制 Opus
- 关联 ADR：ADR-100 IA 修订段
- 关联序列：SEQ-20260428-02

— END plan v2.2（CHG-SN-1-10 落地）—

### v2.2 → v2.3（2026-04-28）

由 SEQ-20260428-02 任务 3（CHG-SN-1-12）触发：M-SN-2 启动前发现 plan §6 M-SN-2 范围未列 Shell 编排层组件（Sidebar/Topbar/UserMenu/双 Drawer/CmdK/Toast/HealthBadge/Breadcrumbs/KeyboardShortcuts 共 10 个），与 `apps/server-next/src/app/admin/layout.tsx` 文件头注释（"完整 shell 下沉到 packages/admin-ui Shell 组件"）以及 ADR-100 IA 修订段"剩余差异 → M-SN-2 处理"声明形成口径冲突。子代理评审 arch-reviewer (claude-opus-4-7) 独立审计后裁决 4 项决策。**人工 sign-off：用户 2026-04-28 接受方案 B**。

**修订内容（CHG-SN-1-12 落盘，仅修订 plan 不实施代码）**：

- **§3 决策表**：新增"M-SN-2 范围扩列 Shell"行（结论：A2 + Shell 扩列；来源 CHG-SN-1-12；ADR 落地 §6 M-SN-2 + ADR-103a）
- **§6 M-SN-2 范围（行 404-419）**：重写为 A/B/C/D 四块结构（Shell 编排层 10 组件 + 数据原语层沿用 + 公开 API 契约前置 + 演示页）；工时 **2.5w → 3w**（+20%，未触发 BLOCKER §5.2 第 11 条 +30% 阈值）
- **§6 工时表**：M-SN-2 列 2.5 → 3.0；累计 5.0 → 5.5；后续累计列全部 +0.5；总周期 **17.5w → 18.0w**
- **§6 总周期声明**：17.5 周 → **18.0 周**
- **§8 复用矩阵**：原 `admin-layout` 列拆为 `admin-layout token` + `Shell` 两列；19 admin/* 视图 Shell 列标 ✅；login 标 — ；system 4 子标"（settings 容器内）"
- **§9 ADR 索引**：ADR-103 拆为 ADR-103（DataTable v2 API 契约）+ **ADR-103a（Shell 公开 API 契约，含 AdminNavItem 5 字段扩展协议 + AdminNavCountProvider 接口 + 4 级 z-index 规范）**；两份 ADR 须先于对应组件首个任务卡完成 Opus PASS

**4 项决策一览**：

| 编号 | 议题 | v2.3 决策 |
|---|---|---|
| Shell-1 | Shell 组件清单 | 10 个组件公开导出（AdminShell / Sidebar / Topbar / UserMenu / NotificationDrawer / TaskDrawer / CommandPalette / ToastViewport+useToast / HealthBadge / Breadcrumbs / KeyboardShortcuts）+ Props 类型骨架固化（详见 ADR-103a 草案）|
| Shell-2 | AdminNavItem 扩展 | 5 字段（icon: ReactNode / count: number / badge: 'info'\|'warn'\|'danger' / shortcut: 'mod+x' 规范化 / children）+ AdminNavCountProvider 接口（runtime 计数运行时优先于静态 count）|
| Shell-3 | 工时估算 | 方案 B：2.5w → 3w（+20%，未触发 BLOCKER 11）；保持单 milestone（不拆 M-SN-2.5）；总周期 17.5w → 18.0w |
| Shell-4 | §8 复用矩阵列扩展 | admin-layout 列拆为 admin-layout token + Shell 两列；login 不进 Shell；system 4 子通过 settings 容器间接消费 |

**不变约束**：Provider 不下沉（packages/admin-ui 零 BrandProvider/ThemeProvider 声明）/ Edge Runtime 兼容（无模块顶层 window/document 访问）/ 零硬编码颜色 / URL slug 不动（plan §5.2 BLOCKER 第 8 条仍生效）/ M-SN-1 闭环资产零返工 / Resovo 价值排序顺序不变。

**后续卡链**：
- CHG-SN-2-01（ADR-103a 起草）：Shell 公开 API 契约 ADR + Opus 评审，须先于 M-SN-2 第一张组件卡 PASS
- CHG-SN-2-02（admin-nav.ts 5 字段扩展 + ADMIN_NAV 改写注入 icon / shortcut）：M-SN-2 第一张卡，server-next 侧改动
- CHG-SN-2-03 ~ CHG-SN-2-12：Shell 10 组件分卡实施（按依赖序：ToastViewport → KeyboardShortcuts → Breadcrumbs → HealthBadge → UserMenu → Sidebar → Topbar → 双 Drawer → CommandPalette → AdminShell 装配 + admin layout 替换骨架）
- CHG-SN-2-13 ~ CHG-SN-2-20：数据原语层（DataTable v2 + 5 原语 + Storybook demo）
- CHG-SN-2-21（M-SN-2 milestone 验收）：Opus 阶段审计

**修订日志元信息**：
- Plan-Revision: v2.2 → v2.3
- 主循环模型：claude-opus-4-7
- 子代理：arch-reviewer (claude-opus-4-7) — Shell API 契约决策强制 Opus（CLAUDE.md 模型路由规则第 1/3 项）
- 人工 sign-off：用户 2026-04-28 接受 4 项决策（Q1-Q4 全部确认）
- 关联 ADR：ADR-103a（草案，待 M-SN-2 第一张卡前完成 Opus PASS）
- 关联序列：SEQ-20260428-02 任务 3
- 工时影响：+0.5w（未触发 BLOCKER §5.2 第 11 条）
- 重大修订标记：是（影响 §6 范围 + 总周期 + §8 矩阵列结构）；按 §0 plan 版本协议须人工 sign-off — 已取得

— END plan v2.3（CHG-SN-1-12 落地）—

### v2.3 → v2.4（2026-04-28）

由 SEQ-20260428-03 任务 1.5（CHG-SN-2-01.5）触发：CHG-SN-2-02（admin-nav.ts ADMIN_NAV icon 注入）开工后触发 plan §5.2 BLOCKER 第 2 条 — `lucide-react` 不在 plan §4.7 v2.3 依赖白名单。回溯发现 CHG-SN-2-01（ADR-103a 起草）评审过程虽确立"图标由 server-next 应用层注入"边界，但未驱动 plan §4.7 同步修订（隐性漏洞）。子代理评审 arch-reviewer (claude-opus-4-7) 独立审计 6 维评估 + 3 候选选型后裁决 lucide-react；用户人工 sign-off 后落盘。**人工 sign-off：用户 2026-04-28 接受 4 项决策（Q1-Q4 全部确认）+ 实测 lucide-react 最新稳定版 1.12.0 后版本数字校正为 ^1.12.0**。

**修订内容（CHG-SN-2-01.5 落盘，仅修订 plan 不实施代码）**：

- **§3 决策表**：新增"server-next 图标库选型"行（结论：lucide-react `^1.12.0`；安装位置仅 apps/server-next；packages/admin-ui 零图标库依赖约束沿用；来源 CHG-SN-2-01.5 Opus 评审 + 用户 sign-off；ADR 落地 §4.7 + ADR-103b）
- **§4.7 依赖白名单**：预批清单追加 `lucide-react@^1.12.0` + 安装位置 / 命名 import / Next.js 配置 三项约束；严禁清单追加"packages/admin-ui 工作区引入任何图标库"项（含双兜底机制说明）；末尾备注其他图标库未严禁但混用须新 ADR

**4 项决策一览**：

| 编号 | 议题 | v2.4 决策 |
|---|---|---|
| Icon-1 | 图标库选定 | lucide-react（C1）— 6 维评估 30/30 满分；与设计稿 shell.jsx 12 NAV icon 同名命中；ADR-103a §4.4-4 边界严格兼容 |
| Icon-2 | 安装位置 | 仅 apps/server-next/package.json；packages/admin-ui 严禁引入（ESLint + ts-morph 双兜底） |
| Icon-3 | 版本约束 | `^1.12.0`（实测最新稳定版；caret 范围允许 1.x minor + patch 升级；major 升级须新 ADR） |
| Icon-4 | 替代库严禁策略 | heroicons / react-icons 暂不严禁；未来出现引入需求须 ADR-103b 续修订评审（避免双图标库混用） |

**不变约束**：packages/admin-ui 零图标库依赖（ADR-103a §4.4-4）/ AdminNavItem.icon 类型保持 `React.ReactNode`（ADR-103a §4.1）/ Provider 不下沉（ADR-103a 既定边界）/ Edge Runtime 兼容 / 零硬编码颜色 / URL slug 不动（plan §5.2 BLOCKER 第 8 条仍生效）/ M-SN-1 闭环资产零返工 / Resovo 价值排序顺序不变。

**后续卡链**：
- CHG-SN-2-01.5 完成（本 plan v2.4 + ADR-103b 落盘 + 人工 sign-off）→ 解锁 CHG-SN-2-02 stage 2/2
- CHG-SN-2-02 stage 2/2：apps/server-next 安装 `lucide-react@^1.12.0` + admin-nav.ts ADMIN_NAV 5 字段注入（icon / shortcut；count + badge 按 ADR-103a §4.5 IA v1 业务态势注入）+ Next.js optimizePackageImports + ESLint named import 拦截 + verify-server-next-isolation.mjs 扩展
- CHG-SN-2-03 ~ CHG-SN-2-12：Shell 10 组件分卡时按需消费 lucide-react named import（仅在 server-next 应用层）

**修订日志元信息**：
- Plan-Revision: v2.3 → v2.4
- 主循环模型：claude-opus-4-7
- 子代理：arch-reviewer (claude-opus-4-7) — 依赖白名单修订决策强制 Opus（CLAUDE.md 模型路由规则第 1 / 3 项 + plan §0 SHOULD-4-a 重大修订协议）
- 人工 sign-off：用户 2026-04-28 接受 4 项决策（Icon-1 ~ Icon-4 全部确认）+ 版本号校正 ^1.12.0
- 关联 ADR：ADR-103b（server-next 图标库选型）
- 关联序列：SEQ-20260428-03 任务 1.5
- 工时影响：0（仅依赖白名单扩列；CHG-SN-2-02 stage 2/2 仍按原工时估算）
- 重大修订标记：是（影响 §4.7 白名单 + §3 决策表）；按 §0 plan 版本协议须人工 sign-off — 已取得

— END plan v2.4（CHG-SN-2-01.5 落地）—
