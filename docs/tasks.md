# Resovo（流光） — 任务看板

> last_reviewed: 2026-06-06

---

## 当前任务（单任务工作台：同时仅 1 个 🔄 进行中；完成即删卡，历史见 docs/changelog.md）

### 🔄 SEQ-20260620-01 · IMGH-P3-1A/1B — 图片健康「破损样本区」空白根治

**创建**：2026-06-20 ｜ **建议模型**：opus ｜ **执行模型**：claude-opus-4-8 ｜ **分支**：`fix/imgh-broken-samples-empty-20260620`

**问题理解**：`/admin/image-health` 健康概览 Tab 右侧「破损样本」区恒空（显示「暂无破损样本」），即使 KPI「近 7 日新增破损」非零（实测 834）、TOP 破损域名表有数据——用户视角自相矛盾。

**根因判断**：破损样本区与页面其余部分用了**两套不一致的「破损」口径**，当前数据下完全不重叠：
- KPI/趋势/TOP域名 → `broken_image_events` 事件流（实测 5376 条 unresolved / 近7日 834 / 4488 视频）✅ 有数据
- 破损样本区 → `BrokenSamplesGrid` 客户端硬过滤 `posterStatus === 'broken'`，而 `media_catalog.poster_status` 全库 **0 条 broken**（实测 pending_review 2533 / low_quality 1980 / ok 1070）→ 恒 0 命中。
- 叠加缺陷：① 数据借治理表第一页（`poster_status IN (missing,broken,pending_review)`，已排除 low_quality）+ client 过滤；② 第一页 20 条实测全 pending_review，即便有零星 broken 也未必在第一页。前端上报 `/internal/image-broken` 只写事件表、不回写 poster_status；worker 仅在 URL 非法/连续 3 次失败（内存计数易重置）才写 broken → 状态枚举几乎无 broken。

**方案**：破损样本区改为对齐事件流口径（**ADR-210**）。
- **1A 后端**：新增 `GET /admin/image-health/recent-broken-samples?limit=24`，基于 `broken_image_events`（unresolved + `image_kind='poster'`，`DISTINCT ON (video_id)` 取最近，按 `last_seen_at` desc）JOIN videos+media_catalog；query 落 `imageHealth.scan.ts`（避恶化 imageHealth.ts 639 行已超限）→ ImageHealthService → route；端点单测。
- **1B 前端**：`api.ts` 新增 `BrokenSampleRow` + `getRecentBrokenSamples`；`BrokenSamplesGrid` 改独立数据源（去客户端 broken 过滤，行即破损样本）；`ImageHealthClient` overview 并行加载独立 state；组件测试。

**涉及文件**：
- 后端：`apps/api/src/db/queries/imageHealth.scan.ts`、`imageHealth.ts`（re-export）、`apps/api/src/services/ImageHealthService.ts`、`apps/api/src/routes/admin/image-health.ts`、`docs/decisions.md`（ADR-210）、`tests/unit/api/image-health-*.test.ts`
- 前端：`apps/server-next/src/lib/image-health/api.ts`、`_client/BrokenSamplesGrid.tsx`、`_client/ImageHealthClient.tsx`、对应组件测试

**门禁**：ADR-210 先行（`verify:endpoint-adr` 必过）+ Opus arch-reviewer PASS（新增 admin route）+ Codex 对抗性审核（ADR 非代码产物）+ Subagents trailer + typecheck/lint/test:changed/verify:adr-contracts + test:e2e:admin

**子代理调用**：（commit 前补）

---

### 🔄 SEQ-20260620-01 · IMGH-P3-2 — 健康概览 KPI 卡片信息密度增强

**创建**：2026-06-20 ｜ **建议模型**：sonnet ｜ **执行模型**：claude-opus-4-8 ｜ **分支**：`fix/imgh-broken-samples-empty-20260620`（同 P3-1A/1B）

**⚠️ 补登记说明**：用户在 P3-1A/1B 代码完成（待 commit/gate）后于会话内**直接指令**「按上次草案落地图片健康 KPI 卡片」并明确两卡口径。当时未先写卡即执行代码，违反 CLAUDE.md「❌ 未写任务卡片就开始执行代码」——**本卡为补登记**（Codex stop-gate 标记 "outside active task scope" 后补）。P3-1A/1B 与本卡均**代码完成 + 门禁通过、未提交**，在 `imageHealth.ts`/`api.ts`/`ImageHealthClient.tsx`/`ImageHealthClient.test.tsx` 等文件交织 → commit 时一并或按 hunk 拆两条逻辑 commit（待用户定夺）。单轨「仅 1 个 🔄」临时双活，因二者均待提交、commit 后同时收口。

**问题理解**：KPI 卡片信息密度低。①「视频总数（已发布）」单值卡 → 改「图片正常视频」：已发布 + 全部双口径「封面 ok 数 / 视频数 + 覆盖率」（如 40/47、1001/1200）。②「Poster 覆盖率」「Backdrop 覆盖率」两单值卡 → 合并「图片覆盖率」：封面/背景/台标/Banner 4 类各显示 已发布% / 全部%。KPI 网格 4 卡 → 3 卡（保留「近 7 日新增破损」）。

**口径裁定**：卡①「健康」= 封面 `poster_status='ok'`（用户经 AskUserQuestion 选定，对齐既有 Poster 覆盖率口径）。

**方案**：
- **后端**：`getImageHealthStats` 改单次扫描 `COUNT(*) FILTER(...)` 出 published/all 双口径 × 4 类 ok 数 + 视频分母；`ImageHealthStats` 重构为 `{ published: ImageCoverageScope; all: ImageCoverageScope; brokenLast7Days }`（**保留顶层 `brokenLast7Days`**——NavCountsService 依赖）。**改现有 `/stats` 端点（非新增 route → 无 ADR）**；覆盖率前端现算（不预存浮点）。
- **前端**：DTO 同构；新建 `_client/ImageHealthKpiCards.tsx`（复用共享 `KpiCard`，`value: ReactNode` 槽承载密集布局 → **不改 admin-ui 公开 Props**，无强制 Opus）+ `Spark`；`ImageHealthClient` 内联 KPI 块 → 组件调用（591→541 行收敛）；复合 value 根用 `display:grid` 的 `<span>` 避免 KpiCard `<p>` 内 `<div>` 非法嵌套。

**涉及文件**：
- 后端：`apps/api/src/db/queries/imageHealth.ts`（stats query + ImageHealthStats）、`tests/integration/api/admin-image-health.test.ts`
- 前端：`apps/server-next/src/lib/image-health/api.ts`（DTO）、`_client/ImageHealthKpiCards.tsx`（新）、`_client/ImageHealthClient.tsx`、`tests/unit/components/server-next/admin/image-health/ImageHealthKpiCards.test.tsx`（新）+ `ImageHealthClient.test.tsx`

**门禁**：typecheck ✅ / lint ✅ / test:changed ✅（22 文件 192 测）/ 集成测试新契约（preflight 节点跑）。无新 route（`verify:endpoint-adr` 不触发）；无 admin-ui Props 改动（M8 强制 Opus 不触发）；无新 ADR。**已提交 f804de79**。

**子代理调用**：无

---

### 🔄 SEQ-20260620-01 · IMGH-P3-4A — 后端：problem-images 端点（ADR-211 Accepted）

**创建**：2026-06-20 ｜ **建议模型**：opus ｜ **执行模型**：claude-opus-4-8 ｜ **分支**：`fix/imgh-broken-samples-empty-20260620`

**问题理解**：图片健康数据信号双向不可靠 → 改「真实缩略图 + 人眼批量分诊」。本卡落后端 problem-images 只读端点（ADR-211），供前端问题板（4B）消费。

**方案**（口径 D-211-2，含 Codex 终审吸收）：
- `getProblemImages(db, kind, scope, offset, limit)` query 落 `imageHealth.scan.ts`：口径 `<kind>_url IS NOT NULL AND btrim(url)<>'' AND (status<>'ok' OR EXISTS 未解决真坏事件 image_kind=$kind ∧ event_type∈BROKEN_SAMPLE_EVENT_TYPES)`；**kind→列名经白名单 Record（含 poster→cover_url 历史名）禁裸插值**；LATERAL 取最近真坏事件；派生 `problemReason`（broken_event>broken>low_quality>pending）默认排序真坏在前 + last_seen DESC。
- `getProblemImageCounts(db, scope)`：4 类 COUNT FILTER（各 kind 谓词 + EXISTS 真坏事件）。
- `ImageHealthService` 两方法（守分层）；`imageHealth.ts` re-export。
- `GET /admin/image-health/problem-images` route：admin-only / 只读无审计 / zod（kind enum 默认 poster / scope enum 默认 published / offset≥0 / limit clamp 1-100 默认 48）。
- 端点单测（口径 / url 守卫 btrim / 注入防护〔kind 白名单〕/ reason 排序 / counts / scope）。

**涉及文件**：`apps/api/src/db/queries/imageHealth.scan.ts`、`imageHealth.ts`（re-export）、`apps/api/src/services/ImageHealthService.ts`、`apps/api/src/routes/admin/image-health.ts`、`tests/unit/api/image-health-*.test.ts`

**门禁**：**Opus arch-reviewer PASS（新 admin route，MUST-8）+ Subagents trailer** + `verify:endpoint-adr` + 端点单测 + typecheck/lint/test:changed。client DTO/fetcher 归 4B。

**完成备注**（✅ 2026-06-20）：query `getProblemImages`/`getProblemImageCounts` 落 scan.ts（kind→列名 `PROBLEM_KIND_COLS` 白名单含 poster→cover_url 历史名 / btrim url 守卫 / LATERAL image_kind=$kind 白名单事件 / problemReason CASE + 优先级 ORDER）+ re-export + service 两方法 + route（zod kind 默认 poster/scope/offset/limit clamp，total=counts[kind] 省一次查询）+ 15 端点单测 + 3 集成 SQL 断言 + 修 actions 测试 mock 补 PROBLEM_IMAGE_KINDS。**arch-reviewer (claude-opus-4-8, agentId a5537f6bbb482bf06) PASS**〔SQL/注入/total=counts/分层/边界逐项通过；3 LOW 非阻塞：风险2 per-video 计数〔已加注释+ADR〕/ 风险3 SQL 测试〔已补集成测试〕/ 风险1 counts 规模〔ADR 已登记〕〕。门禁：typecheck/lint/test:changed 127 / verify:endpoint-adr 249（+problem-images）/ 集成 12（真库 url 守卫+排序+total=counts 等价）/ 真库口径验证 poster published 27（broken_event 7 排首+low_quality 20）、banner 0。执行模型: claude-opus-4-8；子代理: arch-reviewer (claude-opus-4-8)。

**子代理调用**：arch-reviewer (claude-opus-4-8)

---

_（**SEQ-20260619-02 image-health P2 治理闭环 ✅ 全交付 2026-06-20**：Phase 0〔ADR-208 + ADR-209〕+ Phase 1〔1A-1D 后端：candidates / apply-candidate / resolve-event + rescan-selected / missing-videos 筛选+行级契约〕+ Phase 2〔2A ImageCompare + 2B ImageCandidatePicker，admin-ui 共享组件〕+ Phase 3〔3A 治理抽屉 + 3B 工作台增强 + 3C 文档收尾〕全完成。**收口待办（合并 dev→main 前）**：`npm run test:e2e`（4 projects）✅ 已补跑（2026-06-20）：暴露 12 失败已全部修复（**E2E-AUDIT-FIX-20260620**，分支 `fix/e2e-audit-20260620`，详见 changelog），全量 173 pass / 0 fail；`npm run test -- --run` 单测全量 ✅ 585 文件 / 8084 测全过（2026-06-20，零回归）。**两道收口门禁均达标。** 下一任务取 task-queue.md 按优先级；取前先查 🚨 BLOCKER。）_

---

_（**SEQ-20260610-02 source-health v2 落地 🔄 15/17 — Phase 1 ✅ + Phase 2 ✅ + Phase 3 本轮可执行范围全收口 ✅ 2026-06-10**（P3-3-A/-B1/-B2 + P3-1 共 4 卡：source_hostname join key + host_health 熔断持久化 + 排序分桶软降权 + 双时钟新鲜度衰减——**D3+D4 闭环**；三轮 arch-reviewer claude-opus-4-8 裁决；母卡拆分序列 16→17）。**剩余 2 卡时序阻塞**：P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算，**最早 ~06-17 后启动**）→ P3-4 依赖评分项收口随后。登记：P3-3 ADR 草稿（双存储分工/排序分桶/恢复语义三决策）PHASE COMPLETE 前补；feedback success 不刷 last_rendered_at 非对称候选卡（P3-1 裁决 D 登记）。**Phase 1 全收口 ✅ + Phase 2 全收口 ✅ 2026-06-10**（P2-1：F1 断点闭合，PlayerShell 首播成功上报；P2-2：migration 105 EMA 三字段 + 写入侧即时半衰〔arch-reviewer claude-opus-4-8 两轮裁决 + 真库对拍〕；P2-3：复活/recheck 独立 ipHash SET 门槛；P2-4-A：migration 106 + manual_route_reprobe 真实信号入队；P2-4-B：worker 双 origin 混批定向消费）。下一步：Phase 3——P3-3-A 前置 Opus / **P3-2 影子验证一周硬前置（P2-2 落地 2026-06-10 起算）** / P3-1·P3-3 可先行；或 Phase 1 复盘三候选裁决（见 queue P1-2/P1-5 备注）。候选独立卡：e2e-next seed 基建（queue P2-1 备注）。取下一个前先查 `docs/task-queue.md` 是否有 🚨 BLOCKER。**SEQ-20260610-01 首次文档治理 T1 ✅ 2026-06-10**（CHORE-DOCS-CLEANUP-20260610：活区断链 20+2 处清零 + frontmatter 38 文件补齐，残留登记见 changelog）。**SEQ-20260609-01 P3 dismiss 软移除 ✅ 端到端闭环 2026-06-10**（ADR-197 + -A/-B1/-B2/-B3/-C1/-C2 全完成：schema / 写端点+守卫 / 双侧读过滤+purge 清理 / 通知+任务抽屉 UI〔单项移除 + 清空/清除已完成 + H-1 行重构〕）。**可选 follow-up**：selectTerminalTaskRunIds 真实 SQL 集成验证 + 跨标签即时同步（MEDIUM-1，drawer-refresh SSE 事件独立卡）。**SEQ-20260609-01 其余**：P0→P2 收官（除暂缓 P2-b）+ P2-c 可见性增强（UI-1 分组/UNREAD-FILTER 只看未读）✅。**SEQ-20260608-01** cutover：卡 4 回滚窗 🔄 ~2026-06-15、卡 5 改名待排期。）_

---

## 工作流提示

- 取新任务前先查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`（当前无）。
- 活跃序列与后续卡登记见 `docs/task-queue.md`（SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260602-03 / SEQ-20260604-02 / SEQ-20260605-01 各自"后续卡登记"小节）。
- 完成历史：`docs/changelog.md`（活跃段 CHG-VSR-1 起）；更早分段见 `docs/archive/changelog/`。
